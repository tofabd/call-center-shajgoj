import mongoose from 'mongoose';
import { config } from 'dotenv';

// Load environment variables
config();

// Import models and services
import Extension from '../src/models/Extension.js';
import AmiQueryService from '../src/services/AmiQueryService.js';
import broadcast from '../src/services/BroadcastService.js';

// Database connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/call_center');
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Get all extensions from database with status mapping for efficient comparison
const getAllExtensionsWithStatus = async () => {
  console.log('💾 Loading extensions from database...');
  
  try {
    const extensions = await Extension.find({ is_active: true }).sort({ extension: 1 });
    console.log(`✅ Found ${extensions.length} active extensions in database`);
    
    // Create a map for efficient status comparison
    const extensionMap = new Map(extensions.map(ext => [ext.extension, ext]));
    
    return { extensions, extensionMap };
  } catch (error) {
    console.error('❌ Failed to load extensions from database:', error);
    return { extensions: [], extensionMap: new Map() };
  }
};

// Query individual extension via AMI with minimal logging
const queryIndividualExtension = async (amiService, extensionNumber, index, total) => {
  try {
    // Minimal logging - just progress indicator
    process.stdout.write(`\r🔍 Querying extension ${extensionNumber} [${index + 1}/${total}]`);
    
    const startTime = Date.now();
    const result = await amiService.queryExtensionStatus(extensionNumber);
    const queryTime = Date.now() - startTime;
    
    // Only log errors
    if (result.error) {
      console.log(`\n   ⚠️  Extension ${extensionNumber}: ${result.error}`);
    }
    
    return {
      extension: extensionNumber,
      status: result.status,
      query_time: queryTime,
      error: result.error || null
    };
  } catch (error) {
    console.log(`\n   ❌ Extension ${extensionNumber}: ${error.message}`);
    
    return {
      extension: extensionNumber,
      status: 'unknown',
      query_time: 0,
      error: error.message
    };
  }
};

// Query all extensions one by one via AMI with minimal logging
const queryAllExtensionsIndividually = async (amiService, extensions) => {
  console.log('\n🔍 Starting AMI queries for all extensions...');
  console.log(`📋 Total extensions to query: ${extensions.length}`);
  
  const results = [];
  const totalStartTime = Date.now();
  
  for (let i = 0; i < extensions.length; i++) {
    const ext = extensions[i];
    
    const result = await queryIndividualExtension(amiService, ext.extension, i, extensions.length);
    results.push(result);
    
    // Small delay between queries to avoid overwhelming Asterisk
    if (i < extensions.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  // Clear the progress line and show completion
  process.stdout.write('\r' + ' '.repeat(80) + '\r');
  
  const totalTime = Date.now() - totalStartTime;
  console.log(`✅ All AMI queries completed in ${totalTime}ms`);
  
  return results;
};

// Update database with batch operations for maximum efficiency
const updateDatabaseWithBatchUpdates = async (results, extensionMap) => {
  console.log('\n💾 Updating database with batch operations...');
  
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
      console.log(`   🔄 Executing batch update for ${batchUpdates.length} extensions...`);
      
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
        console.log(`   ✅ Batch update completed: ${bulkResult.modifiedCount} extensions updated`);
        
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
        console.error(`   ❌ Batch update failed:`, bulkError.message);
        
        // Fallback to individual updates if batch fails
        console.log(`   🔄 Falling back to individual updates...`);
        for (const update of batchUpdates) {
          try {
            const updatedExtension = await Extension.updateStatus(update.extension, update.status);
            
            // Broadcast the change
            try {
              broadcast.extensionStatusUpdated(updatedExtension);
            } catch (broadcastError) {
              // Silent fail for broadcast errors
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
      console.log(`   ✅ No status changes detected - database update skipped`);
    }
    
    console.log(`✅ Database update completed: ${updates.length} updated, ${unchanged.length} unchanged, ${errors.length} errors`);
    
    return { updates, unchanged, errors };
  } catch (error) {
    console.error('❌ Database update failed:', error);
    throw error;
  }
};

// Display final results table (simplified)
const displayFinalResultsTable = (results, updateSummary) => {
  console.log('\n📊 FINAL RESULTS TABLE');
  console.log('='.repeat(70));
  console.log('| Extension | Status   | Database Update |');
  console.log('='.repeat(70));
  
  results.forEach(result => {
    const status = result.status.padEnd(8);
    
    let dbUpdate = 'No Change';
    if (result.error) {
      dbUpdate = 'Query Failed';
    } else if (updateSummary && updateSummary.updates.find(u => u.extension === result.extension)) {
      dbUpdate = 'Updated';
    }
    
    const dbUpdateCol = dbUpdate.padEnd(16);
    
    console.log(`| ${result.extension.padEnd(9)} | ${status} | ${dbUpdateCol} |`);
  });
  
  console.log('='.repeat(70));
  
  // Summary statistics
  const onlineCount = results.filter(r => r.status === 'online' && !r.error).length;
  const offlineCount = results.filter(r => r.status === 'offline' && !r.error).length;
  const unknownCount = results.filter(r => r.status === 'unknown' && !r.error).length;
  const errorCount = results.filter(r => r.error).length;
  
  console.log(`\n📈 FINAL STATUS SUMMARY:`);
  console.log(`   🟢 Online: ${onlineCount}`);
  console.log(`   🔴 Offline: ${offlineCount}`);
  console.log(`   🟡 Unknown: ${unknownCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📊 Total: ${results.length}`);
  
  // Update summary
  if (updateSummary) {
    console.log(`\n💾 DATABASE UPDATE SUMMARY:`);
    console.log(`   📝 Updated: ${updateSummary.updates.length} extensions`);
    console.log(`   ✅ Unchanged: ${updateSummary.unchanged.length} extensions`);
    console.log(`   ❌ Errors: ${updateSummary.errors.length} extensions`);
    
    // Show detailed update information only if there are updates
    if (updateSummary.updates.length > 0) {
      console.log(`\n📝 DETAILED UPDATES:`);
      updateSummary.updates.forEach(update => {
        console.log(`   🔄 Extension ${update.extension}: ${update.old_status} → ${update.new_status}`);
      });
    }
  }
  
  // Performance statistics
  const validResults = results.filter(r => r.query_time > 0);
  if (validResults.length > 0) {
    const totalQueryTime = validResults.reduce((sum, r) => sum + r.query_time, 0);
    const avgQueryTime = totalQueryTime / validResults.length;
    
    console.log(`\n⏱️  PERFORMANCE:`);
    console.log(`   Average Query Time: ${avgQueryTime.toFixed(2)}ms`);
    console.log(`   Total Query Time: ${totalQueryTime}ms`);
  }
};

// Main function
const main = async () => {
  console.log('🚀 Starting Enhanced Extension Status Check Script');
  console.log('⏰ Started at:', new Date().toLocaleString());
  
  let amiService = null;
  const scriptStartTime = Date.now();
  
  try {
    // Connect to database first
    await connectDB();
    
    // Initialize AMI service FIRST
    console.log('\n🔌 Initializing AMI Query Service...');
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
      throw new Error('Failed to connect to AMI after 30 seconds');
    }
    
    const connectionTime = Date.now() - connectionStartTime;
    console.log(`✅ AMI Query Service connected successfully in ${connectionTime}ms`);
    
    // NOW get extensions from database AFTER AMI is connected
    const { extensions, extensionMap } = await getAllExtensionsWithStatus();
    
    if (extensions.length === 0) {
      console.log('❌ No extensions found in database');
      return;
    }
    
    // Query extensions individually via AMI
    const queryStartTime = Date.now();
    const results = await queryAllExtensionsIndividually(amiService, extensions);
    const totalQueryTime = Date.now() - queryStartTime;
    
    // Update database with batch operations and broadcast changes
    const updateStartTime = Date.now();
    const updateSummary = await updateDatabaseWithBatchUpdates(results, extensionMap);
    const updateTime = Date.now() - updateStartTime;
    
    // Display final results table
    displayFinalResultsTable(results, updateSummary);
    
    // Overall performance summary
    const totalScriptTime = Date.now() - scriptStartTime;
    console.log(`\n🎯 OVERALL PERFORMANCE:`);
    console.log(`   AMI Connection: ${connectionTime}ms`);
    console.log(`   Individual Queries: ${totalQueryTime}ms`);
    console.log(`   Database Updates: ${updateTime}ms`);
    console.log(`   Total Script Time: ${totalScriptTime}ms`);
    
    // Final summary
    console.log(`\n🎉 SCRIPT COMPLETED SUCCESSFULLY!`);
    console.log(`   📊 Processed ${extensions.length} extensions`);
    console.log(`   🔌 AMI connected and queries completed`);
    console.log(`   💾 Database updated with status changes`);
    console.log(`   📡 Changes broadcasted to real-time clients`);
    
  } catch (error) {
    console.error('❌ Script execution failed:', error);
    process.exit(1);
  } finally {
    // Cleanup
    if (amiService) {
      console.log('\n🛑 Stopping AMI Query Service...');
      amiService.stop();
    }
    
    // Close database connection
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    console.log('✅ Script completed at:', new Date().toLocaleString());
    process.exit(0);
  }
};

// Run the script
main().catch(console.error);
