import mongoose from 'mongoose';
import { config } from 'dotenv';

// Load environment variables
config();

// Import models and services
import Extension from '../src/models/Extension.js';
import AmiQueryService from '../src/services/AmiQueryService.js';
import broadcast from '../src/services/BroadcastService.js';
import { createComponentLogger } from '../src/config/logging.js';

// Initialize Pino logger for this script
const logger = createComponentLogger('ExtensionStatusChecker');

// Helper functions to convert derived status back to raw AMI data
// This is a temporary solution until AmiQueryService returns raw data
const getStatusCodeFromDerivedStatus = (derivedStatus) => {
  const statusCodeMap = {
    'online': 0,    // Default to NotInUse for online
    'offline': 4,   // Unavailable
    'unknown': -1   // Unknown
  };
  return statusCodeMap[derivedStatus] || -1;
};

const getDeviceStateFromDerivedStatus = (derivedStatus) => {
  const deviceStateMap = {
    'online': 'NOT_INUSE',     // Default for online
    'offline': 'UNAVAILABLE',  // For offline
    'unknown': 'UNKNOWN'       // For unknown
  };
  return deviceStateMap[derivedStatus] || 'UNKNOWN';
};

// Configuration constants
const RATE_LIMIT_DELAY = parseInt(process.env.AMI_QUERY_DELAY) || 200; // Configurable delay

// Database connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/call_center');
    logger.info('✅ MongoDB connected successfully');
  } catch (error) {
    logger.error('❌ MongoDB connection error:', { error: error.message });
    process.exit(1);
  }
};

// Get all extensions from database with status mapping for efficient comparison
const getAllExtensionsWithStatus = async () => {
  logger.info('💾 Loading extensions from database...');
  
  try {
    const extensions = await Extension.find({ is_active: true }).sort({ extension: 1 });
    logger.info(`✅ Found ${extensions.length} active extensions in database`);
    
    // Create a map for efficient status comparison
    const extensionMap = new Map(extensions.map(ext => [ext.extension, ext]));
    
    return { extensions, extensionMap };
  } catch (error) {
    logger.error('❌ Failed to load extensions from database:', { error: error.message });
    return { extensions: [], extensionMap: new Map() };
  }
};

// Query individual extension via AMI with minimal logging
// Updated to handle raw AMI data properly
const queryIndividualExtension = async (amiService, extensionNumber, index, total) => {
  try {
    // Minimal logging - just progress indicator
    process.stdout.write(`\r🔍 Querying extension ${extensionNumber} [${index + 1}/${total}]`);
    
    const startTime = Date.now();
    const result = await amiService.queryExtensionStatus(extensionNumber);
    const queryTime = Date.now() - startTime;
    
    // Only log errors
    if (result.error) {
      logger.warn(`⚠️  Extension ${extensionNumber}: ${result.error}`);
    }
    
    return {
      extension: extensionNumber,
      status: result.status, // Mapped status (online/offline/unknown)
      query_time: queryTime,
      error: result.error || null
    };
  } catch (error) {
    logger.error(`❌ Extension ${extensionNumber}: ${error.message}`);
    
    return {
      extension: extensionNumber,
      status: 'unknown',
      query_time: 0,
      error: error.message
    };
  }
};

// DEPRECATED: Query all extensions one by one via AMI with minimal logging
// This function is no longer used - sequential processing is preferred
const queryAllExtensionsIndividually = async (amiService, extensions) => {
  logger.info('🔍 Starting AMI queries for all extensions...');
  logger.info(`📋 Total extensions to query: ${extensions.length}`);
  
  const results = [];
  const totalStartTime = Date.now();
  
  for (let i = 0; i < extensions.length; i++) {
    const ext = extensions[i];
    
    const result = await queryIndividualExtension(amiService, ext.extension, i, extensions.length);
    results.push(result);
    
    // Configurable delay between queries to avoid overwhelming Asterisk
    if (i < extensions.length - 1) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
    }
  }
  
  // Clear the progress line and show completion
  process.stdout.write('\r' + ' '.repeat(80) + '\r');
  
  const totalTime = Date.now() - totalStartTime;
  logger.info(`✅ All AMI queries completed in ${totalTime}ms`);
  
  return results;
};

// DEPRECATED: Update database with batch operations for maximum efficiency
// This function is no longer used - real-time sequential updates are preferred
const updateDatabaseWithBatchUpdates = async (results, extensionMap) => {
  logger.info('💾 Updating database with batch operations...');
  
  const updates = [];
  const unchanged = [];
  const errors = [];
  const batchUpdates = [];
  
  try {
    // First pass: collect all changes and prepare batch updates
    for (const result of results) {
      if (result.error) {
        errors.push(result);
        continue;
      }
      
      try {
        // Get current extension from the pre-loaded map (no additional DB query)
        const currentExtension = extensionMap.get(result.extension);
        
        if (!currentExtension) {
          continue;
        }
        
        // Check if status has changed
        if (currentExtension.status !== result.status) {
          // Prepare batch update operation
          batchUpdates.push({
            extension: result.extension,
            status: result.status,
            old_status: currentExtension.status
          });
          
          updates.push({
            extension: result.extension,
            old_status: currentExtension.status,
            new_status: result.status,
            updated_at: new Date()
          });
        } else {
          unchanged.push({
            extension: result.extension,
            status: result.status
          });
        }
      } catch (dbError) {
        errors.push({
          extension: result.extension,
          error: dbError.message
        });
      }
    }
    
    // Second pass: execute batch update if there are changes
    if (batchUpdates.length > 0) {
      logger.info(`   🔄 Executing batch update for ${batchUpdates.length} extensions...`);
      
      try {
        // Use bulkWrite for efficient batch updates
        const bulkOps = batchUpdates.map(update => ({
          updateOne: {
            filter: { extension: update.extension },
            update: { 
              $set: { 
                status: update.status,
                updated_at: new Date()
              }
            }
          }
        }));
        
        const bulkResult = await Extension.bulkWrite(bulkOps);
        logger.info(`   ✅ Batch update completed: ${bulkResult.modifiedCount} extensions updated`);
        
        // Update the extensionMap with new statuses for broadcasting
        for (const update of batchUpdates) {
          const extension = extensionMap.get(update.extension);
          if (extension) {
            extension.status = update.status;
            extension.updated_at = new Date();
            
            // Broadcast the change
            try {
              broadcast.extensionStatusUpdated(extension);
            } catch (broadcastError) {
              // Silent fail for broadcast errors
            }
          }
        }
        
        // Update the updated_at timestamps in our results
        const now = new Date();
        updates.forEach(update => {
          update.updated_at = now;
        });
        
      } catch (bulkError) {
        logger.error(`   ❌ Batch update failed:`, { error: bulkError.message });
        
        // Fallback to individual updates if batch fails
        logger.info(`   🔄 Falling back to individual updates...`);
        for (const update of batchUpdates) {
          try {
            // Convert derived status back to statusCode and deviceState for proper update
            const statusCode = getStatusCodeFromDerivedStatus(update.status);
            const deviceState = getDeviceStateFromDerivedStatus(update.status);
            
            const updatedExtension = await Extension.updateStatus(update.extension, statusCode, deviceState);
            
            // Broadcast the change with error logging
            try {
              broadcast.extensionStatusUpdated(updatedExtension);
            } catch (broadcastError) {
              logger.warn(`   ⚠️ Extension ${update.extension}: Broadcast failed - ${broadcastError.message}`);
            }
            
            // Update the updated_at timestamp
            const updateIndex = updates.findIndex(u => u.extension === update.extension);
            if (updateIndex !== -1) {
              updates[updateIndex].updated_at = updatedExtension.updated_at;
            }
            
          } catch (individualError) {
            errors.push({
              extension: update.extension,
              error: individualError.message
            });
          }
        }
      }
    } else {
      logger.info(`   ✅ No status changes detected - database update skipped`);
    }
    
    logger.info(`✅ Database update completed: ${updates.length} updated, ${unchanged.length} unchanged, ${errors.length} errors`);
    
    return { updates, unchanged, errors };
  } catch (error) {
    logger.error('❌ Database update failed:', { error: error.message });
    throw error;
  }
};

// Process all extensions in parallel for maximum speed (like manual telnet)
const processExtensionsInParallel = async (amiService, extensions, extensionMap) => {
  console.log('\n🔍 Starting parallel processing of all extensions...');
  console.log(`📋 Total extensions to process: ${extensions.length}`);
  console.log('🚀 Using parallel processing for maximum speed (like manual telnet)');
  console.log('='.repeat(80));
  
  const totalStartTime = Date.now();
  
  // Process all extensions simultaneously (like your manual telnet approach)
  const promises = extensions.map((ext, index) => 
    processSingleExtension(amiService, ext, extensionMap, index, extensions.length)
  );
  
  // Wait for all extensions to complete (parallel execution)
  const results = await Promise.all(promises);
  
  const totalTime = Date.now() - totalStartTime;
  console.log('\n' + '='.repeat(80));
  console.log(`✅ All extensions processed in parallel in ${totalTime}ms`);
  console.log(`⚡ Speed improvement: ~${Math.round((extensions.length * 200) / totalTime)}x faster than sequential`);
  
  return results;
};

// Process all extensions sequentially with real-time feedback
const processExtensionsSequentially = async (amiService, extensions, extensionMap) => {
  logger.info('🔍 Starting sequential processing of all extensions...');
  logger.info(`📋 Total extensions to process: ${extensions.length}`);
  console.log('='.repeat(80)); // Keep visual separator for console output
  
  const results = [];
  const totalStartTime = Date.now();
  
  for (let i = 0; i < extensions.length; i++) {
    const ext = extensions[i];
    
    const result = await processSingleExtension(amiService, ext, extensionMap, i, extensions.length);
    results.push(result);
    
    // Configurable delay between queries to avoid overwhelming Asterisk
    if (i < extensions.length - 1) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
    }
  }
  
  const totalTime = Date.now() - totalStartTime;
  console.log('\n' + '='.repeat(80)); // Keep visual separator for console output
  logger.info(`✅ All extensions processed in ${totalTime}ms`);
  
  return results;
};

// Process single extension: Query → Compare → Update → Console Output
const processSingleExtension = async (amiService, extension, extensionMap, index, total) => {
  const extensionNumber = extension.extension;
  const currentStatus = extension.status;
  
  try {
    // Show progress indicator
    process.stdout.write(`\r🔍 [${index + 1}/${total}] Processing Extension ${extensionNumber}...`);
    
    // Query current status via AMI
    const startTime = Date.now();
    const result = await amiService.queryExtensionStatus(extensionNumber);
    const queryTime = Date.now() - startTime;
    
    if (result.error) {
      logger.warn(`Extension ${extensionNumber}: Query failed - ${result.error}`);
      return {
        extension: extensionNumber,
        old_status: currentStatus,
        new_status: 'unknown',
        changed: false,
        error: result.error,
        query_time: queryTime
      };
    }
    
    const newStatus = result.status;
    const statusChanged = currentStatus !== newStatus;
    
    // Clear progress line
    process.stdout.write('\r' + ' '.repeat(80) + '\r');
    
    if (statusChanged) {
      // Status changed - update database immediately
      logger.info(`Extension ${extensionNumber}: ${currentStatus} → ${newStatus} (Updating database...)`);
      
      try {
        // Get raw AMI data by mapping derived status back to statusCode and deviceState
        logger.debug(`Extension ${extensionNumber}: Getting raw AMI data for proper update...`);
        
        // Convert derived status back to statusCode and deviceState for proper update
        const statusCode = getStatusCodeFromDerivedStatus(newStatus);
        const deviceState = getDeviceStateFromDerivedStatus(newStatus);
        
        // Update with proper parameters: extension, statusCode, deviceState
        const updatedExtension = await Extension.updateStatus(extensionNumber, statusCode, deviceState);
        
        if (updatedExtension) {
          // Update the extensionMap with new statuses for broadcasting
          extension.status = updatedExtension.status;
          extension.status_code = updatedExtension.status_code;
          extension.device_state = updatedExtension.device_state;
          extension.updated_at = updatedExtension.updated_at;
          
          // Broadcast the change with error logging
          try {
            broadcast.extensionStatusUpdated(updatedExtension);
            logger.debug(`Extension ${extensionNumber}: Status change broadcasted`);
          } catch (broadcastError) {
            logger.warn(`Extension ${extensionNumber}: Broadcast failed - ${broadcastError.message}`);
          }
          
          logger.info(`Extension ${extensionNumber}: Database updated successfully`);
          
          return {
            extension: extensionNumber,
            old_status: currentStatus,
            new_status: updatedExtension.status,
            changed: true,
            error: null,
            query_time: queryTime,
            updated_at: updatedExtension.updated_at
          };
        } else {
          logger.warn(`Extension ${extensionNumber}: Update returned null (extension not found or inactive)`);
          
          return {
            extension: extensionNumber,
            old_status: currentStatus,
            new_status: newStatus,
            changed: true,
            error: 'Extension not found or inactive in database',
            query_time: queryTime
          };
        }
        
      } catch (updateError) {
        logger.error(`Extension ${extensionNumber}: Database update failed - ${updateError.message}`);
        
        return {
          extension: extensionNumber,
          old_status: currentStatus,
          new_status: newStatus,
          changed: true,
          error: `Database update failed: ${updateError.message}`,
          query_time: queryTime
        };
      }
      
    } else {
      // Status unchanged
      logger.debug(`Extension ${extensionNumber}: ${newStatus} (No change)`);
      
      return {
        extension: extensionNumber,
        old_status: currentStatus,
        new_status: newStatus,
        changed: false,
        error: null,
        query_time: queryTime
      };
    }
    
  } catch (error) {
    logger.error(`Extension ${extensionNumber}: Processing failed - ${error.message}`);
    
    return {
      extension: extensionNumber,
      old_status: currentStatus,
      new_status: 'unknown',
      changed: false,
      error: error.message,
      query_time: 0
    };
  }
};

// Display final results table with detailed information
const displayFinalResultsTable = (results) => {
  // Keep console table for visual presentation
  console.log('\n📊 FINAL RESULTS TABLE');
  console.log('='.repeat(90));
  console.log('| Extension | Old Status | New Status | Changed | Database Update | Query Time |');
  console.log('='.repeat(90));
  
  results.forEach(result => {
    const extension = result.extension.padEnd(9);
    const oldStatus = (result.old_status || 'N/A').padEnd(11);
    const newStatus = (result.new_status || 'N/A').padEnd(11);
    const changed = result.changed ? 'Yes' : 'No';
    const changedCol = changed.padEnd(7);
    
    let dbUpdate = 'N/A';
    if (result.error && result.changed) {
      dbUpdate = 'Failed';
    } else if (result.changed) {
      dbUpdate = 'Updated';
    } else if (result.error) {
      dbUpdate = 'Query Failed';
    } else {
      dbUpdate = 'No Change';
    }
    const dbUpdateCol = dbUpdate.padEnd(16);
    
    const queryTime = result.query_time > 0 ? `${result.query_time}ms` : 'N/A';
    const queryTimeCol = queryTime.padEnd(11);
    
    console.log(`| ${extension} | ${oldStatus} | ${newStatus} | ${changedCol} | ${dbUpdateCol} | ${queryTimeCol} |`);
  });
  
  console.log('='.repeat(90));
  
  // Summary statistics
  const changedCount = results.filter(r => r.changed).length;
  const unchangedCount = results.filter(r => !r.changed && !r.error).length;
  const errorCount = results.filter(r => r.error).length;
  const totalCount = results.length;
  
  // Log summary with Pino for structured logging
  logger.info('Extension status check summary:', {
    changed: changedCount,
    unchanged: unchangedCount,
    errors: errorCount,
    total: totalCount
  });
  
  // Keep console output for visual presentation
  console.log(`\n📈 FINAL STATUS SUMMARY:`);
  console.log(`   🔄 Changed: ${changedCount} extensions`);
  console.log(`   ✅ Unchanged: ${unchangedCount} extensions`);
  console.log(`   ❌ Errors: ${errorCount} extensions`);
  console.log(`   📊 Total: ${totalCount}`);
  
  // Show detailed changes
  if (changedCount > 0) {
    console.log(`\n📝 DETAILED CHANGES:`);
    results.filter(r => r.changed).forEach(result => {
      if (result.error) {
        console.log(`   ❌ Extension ${result.extension}: ${result.old_status} → ${result.new_status} (Update failed: ${result.error})`);
      } else {
        console.log(`   ✅ Extension ${result.extension}: ${result.old_status} → ${result.new_status}`);
      }
    });
  }
  
  // Performance statistics with structured logging
  const validResults = results.filter(r => r.query_time > 0);
  if (validResults.length > 0) {
    const totalQueryTime = validResults.reduce((sum, r) => sum + r.query_time, 0);
    const avgQueryTime = totalQueryTime / validResults.length;
    
    logger.info('Performance statistics:', {
      averageQueryTime: avgQueryTime,
      totalQueryTime: totalQueryTime,
      validQueries: validResults.length
    });
    
    // Keep console output for visual presentation
    console.log(`\n⏱️  PERFORMANCE:`);
    console.log(`   Average Query Time: ${avgQueryTime.toFixed(2)}ms`);
    console.log(`   Total Query Time: ${totalQueryTime}ms`);
  }
};

// Main function
const main = async () => {
  // Keep initial console output for visual script start
  console.log('🚀 Starting Parallel Extension Status Check Script (Maximum Speed)');
  console.log('⏰ Started at:', new Date().toLocaleString());
  console.log(`⚙️ Configuration: AMI query delay = ${RATE_LIMIT_DELAY}ms`);
  console.log(`⚙️ Environment: MongoDB URI = ${process.env.MONGODB_URI ? '[SET]' : '[NOT SET]'}`);
  console.log(`⚙️ Environment: AMI Host = ${process.env.AMI_HOST || 'DEFAULT'}`);
  
  // Log script start with Pino
  logger.info('Extension status check script started', {
    amiQueryDelay: RATE_LIMIT_DELAY,
    mongoUri: process.env.MONGODB_URI ? '[SET]' : '[NOT SET]',
    amiHost: process.env.AMI_HOST || 'DEFAULT',
    startTime: new Date().toISOString()
  });
  
  let amiService = null;
  const scriptStartTime = Date.now();
  
  try {
    // Initialize AMI service FIRST - CRITICAL: Must succeed before proceeding
    console.log('\n🔌 Initializing AMI Query Service...');
    logger.info('Attempting AMI connection - script will exit if this fails');
    const connectionStartTime = Date.now();
    
    amiService = new AmiQueryService();
    await amiService.start();
    
    // Wait for AMI connection
    let attempts = 0;
    while (!amiService.connected && attempts < 30) {
      console.log(`   ⏳ Waiting for AMI connection... (${attempts + 1}/30)`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }
    
    if (!amiService.connected) {
      const errorMessage = 'Failed to connect to AMI after 30 seconds';
      console.log(`❌ ${errorMessage}`);
      logger.error('AMI connection failed - script cannot proceed', {
        maxAttempts: 30,
        timeoutSeconds: 30,
        amiHost: process.env.AMI_HOST || 'NOT SET',
        amiPort: process.env.AMI_PORT || 'NOT SET',
        amiUsername: process.env.AMI_USERNAME || 'NOT SET',
        amiPassword: process.env.AMI_PASSWORD ? '[SET]' : 'NOT SET'
      });
      
      console.log('\n🛑 SCRIPT TERMINATED: AMI connection is required for extension status checking');
      console.log('💡 Troubleshooting:');
      console.log('   1. Verify AMI_HOST and AMI_PORT environment variables');
      console.log('   2. Check if Asterisk server is running and accessible');
      console.log('   3. Verify AMI credentials (AMI_USERNAME, AMI_PASSWORD)');
      console.log('   4. Check firewall settings for AMI port (usually 5038)');
      console.log('   5. Ensure AMI is enabled in manager.conf');
      
      process.exit(1); // Exit immediately with error code
    }
    
    const connectionTime = Date.now() - connectionStartTime;
    console.log(`✅ AMI Query Service connected successfully in ${connectionTime}ms`);
    logger.info('AMI connection established successfully', {
      connectionTime: connectionTime,
      attempts: attempts + 1
    });
    
    // Connect to database ONLY AFTER AMI is confirmed working
    console.log('\n💾 Connecting to MongoDB...');
    logger.info('AMI connection successful, proceeding with database connection');
    await connectDB();
    
    // NOW get extensions from database AFTER both AMI and MongoDB are connected
    const { extensions, extensionMap } = await getAllExtensionsWithStatus();
    
    if (extensions.length === 0) {
      console.log('❌ No extensions found in database');
      return;
    }
    
    // 4. Process extensions using parallel processing for maximum speed (like manual telnet)
    const processingStartTime = Date.now();
    const results = await processExtensionsInParallel(amiService, extensions, extensionMap);
    const processingTime = Date.now() - processingStartTime;
    
    // 5. Display final results table
    displayFinalResultsTable(results);
    
    // Overall performance summary
    const totalScriptTime = Date.now() - scriptStartTime;
    
    // Log performance with Pino
    logger.info('Script performance summary:', {
      amiConnectionTime: connectionTime,
      parallelProcessingTime: processingTime,
      totalScriptTime: totalScriptTime,
      extensionsProcessed: extensions.length
    });
    
    // Keep console output for visual presentation
    console.log(`\n🎯 OVERALL PERFORMANCE:`);
    console.log(`   AMI Connection: ${connectionTime}ms`);
    console.log(`   Parallel Processing: ${processingTime}ms`);
    console.log(`   Total Script Time: ${totalScriptTime}ms`);
    
    // Speed comparison
    const estimatedSequentialTime = extensions.length * 200; // 200ms per extension
    const speedImprovement = Math.round(estimatedSequentialTime / processingTime);
    console.log(`   ⚡ Speed Improvement: ~${speedImprovement}x faster than sequential processing`);
    
    // Final summary with Pino logging
    logger.info('Script completed successfully', {
      extensionsProcessed: extensions.length,
      totalTime: totalScriptTime,
      completedAt: new Date().toISOString()
    });
    
    // Keep console output for visual presentation
    console.log(`\n🎉 SCRIPT COMPLETED SUCCESSFULLY!`);
    console.log(`   📊 Processed ${extensions.length} extensions`);
    console.log(`   🔌 AMI connected and queries completed`);
    console.log(`   💾 Database connected and updated with status changes in real-time`);
    console.log(`   📡 Changes broadcasted to real-time clients`);
    
  } catch (error) {
    logger.error('Script execution failed:', { error: error.message, stack: error.stack });
    
    // Keep console error output for immediate visibility
    console.error('❌ Script execution failed:', error.message);
    
    // Provide specific guidance based on failure type with structured logging
    if (error.message.includes('AMI') || error.message.includes('connect')) {
      logger.error('AMI connection issue detected', {
        amiHost: process.env.AMI_HOST || 'NOT SET',
        amiPort: process.env.AMI_PORT || 'NOT SET',
        amiUsername: process.env.AMI_USERNAME || 'NOT SET',
        amiPassword: process.env.AMI_PASSWORD ? '[SET]' : 'NOT SET'
      });
      
      console.error('\n🔌 AMI Connection Issue:');
      console.error('   - Check if Asterisk is running');
      console.error('   - Verify AMI credentials in environment variables:');
      console.error(`     AMI_HOST=${process.env.AMI_HOST || 'NOT SET'}`);
      console.error(`     AMI_PORT=${process.env.AMI_PORT || 'NOT SET'}`);
      console.error(`     AMI_USERNAME=${process.env.AMI_USERNAME || 'NOT SET'}`);
      console.error(`     AMI_PASSWORD=${process.env.AMI_PASSWORD ? '[SET]' : 'NOT SET'}`);
      console.error('   - Check network connectivity to Asterisk server');
      console.error('   - Verify AMI port configuration (default: 5038)');
      console.error('   - Ensure AMI is enabled in manager.conf');
    } else if (error.message.includes('MongoDB') || error.message.includes('database')) {
      logger.error('Database connection issue detected', {
        mongoUri: process.env.MONGODB_URI || 'NOT SET'
      });
      
      console.error('\n💾 Database Connection Issue:');
      console.error('   - Check if MongoDB is running');
      console.error(`   - Verify MONGODB_URI: ${process.env.MONGODB_URI || 'NOT SET'}`);
      console.error('   - Check network connectivity to database');
      console.error('   - Verify database permissions and credentials');
    } else if (error.message.includes('updateStatus') || error.message.includes('Extension')) {
      logger.error('Extension update issue detected', { error: error.message });
      
      console.error('\n🔄 Extension Update Issue:');
      console.error('   - Check Extension model updateStatus method signature');
      console.error('   - Verify extension exists and is active in database');
      console.error('   - Check AMI response parsing for statusCode and deviceState');
    } else {
      logger.error('Unknown issue detected', { error: error.message });
      
      console.error('\n❓ Unknown Issue:');
      console.error('   - Check all environment variables are set correctly');
      console.error('   - Verify all dependencies are installed');
      console.error('   - Check log files for additional details');
    }
    
    process.exit(1);
  } finally {
    // Cleanup
    if (amiService) {
      logger.info('Stopping AMI Query Service...');
      console.log('\n🛑 Stopping AMI Query Service...');
      amiService.stop();
    }
    
    // Close database connection if it was established
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      logger.info('Database connection closed');
      console.log('🔌 Database connection closed');
    }
    
    const completionTime = new Date().toLocaleString();
    logger.info('Script completed', { completedAt: completionTime });
    console.log('✅ Script completed at:', completionTime);
    process.exit(0);
  }
};

// Run the script
main().catch(console.error);
