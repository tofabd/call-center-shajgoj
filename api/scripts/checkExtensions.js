import mongoose from 'mongoose';
import { config } from 'dotenv';

// Load environment variables
config();

// Import models and services
import Extension from '../src/models/Extension.js';
import { initializeHybridAmiService } from '../src/services/HybridAmiServiceInstance.js';

// Configuration constants
const RATE_LIMIT_DELAY = parseInt(process.env.AMI_QUERY_DELAY) || 200; // Configurable delay

// Database connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/call_center');
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
};

// Get all extensions from database
const getAllExtensionsFromDB = async () => {
  // Reduced verbosity - removed detailed loading message
  // console.log('💾 Loading extensions from database...');
  
  try {
    const extensions = await Extension.find({ is_active: true }).sort({ extension: 1 });
    console.log(`✅ Found ${extensions.length} active extensions in database`);
    
    // Create a map for efficient status comparison
    const extensionMap = new Map(extensions.map(ext => [ext.extension, ext]));
    
    return { extensions, extensionMap };
  } catch (error) {
    console.error('❌ Failed to load extensions from database:', error.message);
    return { extensions: [], extensionMap: new Map() };
  }
};

// Status mapping functions for display
const mapExtensionStatus = (statusCode) => {
  const statusMap = {
    '0': 'online',    // NotInUse (Available)
    '1': 'online',    // InUse (Busy but online)
    '2': 'online',    // Busy (Still registered)
    '4': 'offline',   // Unavailable/Unregistered
    '8': 'online',    // Ringing
    '16': 'online',   // Ringinuse
    '-1': 'unknown'   // Unknown
  };
  return statusMap[statusCode] || 'unknown';
};

const mapDeviceState = (statusCode) => {
  const deviceStateMap = {
    '0': 'NOT_INUSE',
    '1': 'INUSE',
    '2': 'BUSY',
    '4': 'UNAVAILABLE',
    '8': 'RINGING',
    '16': 'RING*INUSE',
    '-1': 'UNKNOWN'
  };
  return deviceStateMap[statusCode] || 'UNKNOWN';
};

// Query all extensions using ExtensionStateList AMI command
const queryAllExtensionsViaAMI = async (amiService) => {
  console.log('🔍 Querying all extensions via AMI using ExtensionStateList...');
  
  try {
    const startTime = Date.now();
    const response = await amiService.queryExtensionStateList();
    const queryTime = Date.now() - startTime;
    
    // Parse the ExtensionStateList response
    const extensions = parseExtensionStateListResponse(response);
    
    console.log(`✅ AMI ExtensionStateList query completed in ${queryTime}ms`);
    // Reduced verbosity - removed detailed count message
    // console.log(`📊 Found ${extensions.length} extensions from AMI`);
    
    return { extensions, queryTime };
  } catch (error) {
    console.error('❌ Failed to query extensions via AMI:', error.message);
    return { extensions: [], queryTime: 0 };
  }
};

// Get all extensions from database and AMI, then compare statuses
const getAndCompareExtensions = async (amiService) => {
  console.log('🔄 Getting and comparing extensions from database and AMI...');
  
  try {
    // Get extensions from database
    const { extensions: dbExtensions, extensionMap } = await getAllExtensionsFromDB();
    
    if (dbExtensions.length === 0) {
      console.log('❌ No extensions found in database');
      return { comparisonResults: [], dbExtensions: [], amiExtensions: [] };
    }
    
    // Get extensions from AMI
    const { extensions: amiExtensions } = await queryAllExtensionsViaAMI(amiService);
    
    // Wait 2 seconds after AMI query completion
    console.log('⏳ Waiting 2 seconds after AMI query...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Compare statuses - only for extensions in database
    const comparisonResults = [];
    
    // Process only database extensions
    for (const dbExt of dbExtensions) {
      const extensionNumber = dbExt.extension;
      const dbStatus = dbExt.status || 'unknown';
      
      // Find corresponding AMI extension
      const amiExt = amiExtensions.find(ext => ext.extension === extensionNumber);
      const amiStatus = amiExt ? amiExt.status : 'not_found_in_ami';
      
      comparisonResults.push({
        extension: extensionNumber,
        databaseStatus: dbStatus,
        amiStatus: amiStatus,
        match: dbStatus === amiStatus
      });
    }
    
    // Reduced verbosity - simplified completion message
    console.log(`✅ Comparison completed for ${comparisonResults.length} extensions`);
    
    return { 
      comparisonResults, 
      dbExtensions, 
      amiExtensions,
      summary: {
        total: comparisonResults.length,
        matching: comparisonResults.filter(r => r.match).length,
        mismatching: comparisonResults.filter(r => !r.match).length,
        notFoundInAMI: comparisonResults.filter(r => r.amiStatus === 'not_found_in_ami').length
      }
    };
  } catch (error) {
    console.error('❌ Failed to get and compare extensions:', error.message);
    return { comparisonResults: [], dbExtensions: [], amiExtensions: [], summary: null };
  }
};

// Parse ExtensionStateList response from AMI
const parseExtensionStateListResponse = (response) => {
  const extensions = [];
  const lines = response.split('\r\n');
  let currentExtension = null;
  
  for (const line of lines) {
    if (line.startsWith('Event: ExtensionStatus')) {
      // Start of a new extension entry
      if (currentExtension) {
        extensions.push(currentExtension);
      }
      currentExtension = {};
    } else if (currentExtension && line.includes(': ')) {
      const [key, value] = line.split(': ', 2);
      if (key === 'Exten') {
        currentExtension.extension = value;
      } else if (key === 'Context') {
        currentExtension.context = value;
      } else if (key === 'Status') {
        currentExtension.statusCode = value;
        currentExtension.status = mapExtensionStatus(value);
        currentExtension.deviceState = mapDeviceState(value);
      } else if (key === 'StatusText') {
        currentExtension.statusText = value;
      }
    }
  }
  
  // Add the last extension if exists
  if (currentExtension && currentExtension.extension) {
    extensions.push(currentExtension);
  }
  
  // Reduced verbosity - only show count
  console.log(`\n📋 Parsed ${extensions.length} extensions from AMI response`);
  return extensions;
};

// Display comparison results in a formatted table
const displayComparisonTable = (comparisonResults, summary) => {
  console.log('\n📊 EXTENSION STATUS COMPARISON TABLE');
  console.log('=' .repeat(80));
  console.log('| Extension | Database Status | AMI Status | Match |');
  console.log('=' .repeat(80));
  
  // Sort extensions by extension number for better readability
  const sortedResults = comparisonResults.sort((a, b) => {
    return a.extension.localeCompare(b.extension, undefined, { numeric: true });
  });
  
  sortedResults.forEach(result => {
    const extension = (result.extension || 'N/A').padEnd(9);
    const dbStatus = (result.databaseStatus || 'N/A').padEnd(15);
    const amiStatus = (result.amiStatus || 'N/A').padEnd(12);
    const match = result.match ? '✅ Yes' : '❌ No ';
    
    console.log(`| ${extension} | ${dbStatus} | ${amiStatus} | ${match} |`);
  });
  
  console.log('=' .repeat(80));
  
  // Summary statistics - simplified
  if (summary) {
    console.log(`
📈 COMPARISON SUMMARY:`);
    console.log(`   📊 Total Extensions: ${summary.total}`);
    console.log(`   ✅ Matching Status: ${summary.matching}`);
    console.log(`   ❌ Mismatching Status: ${summary.mismatching}`);
    console.log(`   ❓ Not Found in AMI: ${summary.notFoundInAMI}`);
  }
};

// Main function
const main = async () => {
  console.log('🚀 Starting Extension Status Check Script (Database vs AMI Comparison)');
  console.log(`🔌 AMI Service: Using Hybrid AMI Service with ExtensionStateList`);
  console.log(`📄 Script Mode: Database comparison (no database updates)`);
  
  let hybridAmiService = null;
  const scriptStartTime = Date.now();
  
  try {
    // Initialize Hybrid AMI Service FIRST - CRITICAL: Must succeed before proceeding
    console.log('\n🔌 Initializing Hybrid AMI Service...');
    const connectionStartTime = Date.now();
    
    // Use the Hybrid AMI Service
    hybridAmiService = await initializeHybridAmiService();
    
    if (!hybridAmiService.isHealthy()) {
      const errorMessage = 'Failed to connect to Hybrid AMI Service';
      console.log(`❌ ${errorMessage}`);
      console.error('Hybrid AMI connection failed - script cannot proceed');
      
      console.log('\n🛑 SCRIPT TERMINATED: Hybrid AMI connection is required for extension status checking');
      process.exit(1); // Exit immediately with error code
    }
    
    const amiConnectionTime = Date.now() - connectionStartTime;
    console.log(`✅ Hybrid AMI Service connected successfully in ${amiConnectionTime}ms`);
    
    // Connect to database ONLY AFTER AMI is confirmed working
    console.log('\n💾 Connecting to MongoDB...');
    await connectDB();
    
    // Add ExtensionStateList method to HybridAmiService if not present
    if (!hybridAmiService.queryExtensionStateList) {
      console.log('⚠️ Adding queryExtensionStateList method to HybridAmiService...');
      hybridAmiService.queryExtensionStateList = async function() {
        if (!this.isRunning || !this.connectionManager.isHealthy()) {
          throw new Error('Hybrid AMI Service is not running or not healthy');
        }
        
        const socket = this.connectionManager.getSocket();
        if (!socket) {
          throw new Error('No active socket connection');
        }
        
        return new Promise((resolve, reject) => {
          const actionId = `ext_state_list_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const command = `Action: ExtensionStateList\r\nContext: from-internal\r\nActionID: ${actionId}\r\n\r\n`;
          
          let responseBuffer = '';
          let responseTimeout;
          
          const dataHandler = (data) => {
            responseBuffer += data.toString();
            
            // Check if we have a complete response (ExtensionStateListComplete event)
            if (responseBuffer.includes('Event: ExtensionStateListComplete') && responseBuffer.includes(`ActionID: ${actionId}`)) {
              clearTimeout(responseTimeout);
              socket.removeListener('data', dataHandler);
              resolve(responseBuffer);
            }
          };
          
          socket.on('data', dataHandler);
          
          // Send the command
          try {
            socket.write(command);
          } catch (error) {
            socket.removeListener('data', dataHandler);
            clearTimeout(responseTimeout);
            reject(error);
            return;
          }
          
          // Timeout after 15 seconds for bulk query
          responseTimeout = setTimeout(() => {
            socket.removeListener('data', dataHandler);
            reject(new Error('ExtensionStateList query timeout - no response received'));
          }, 15000);
        });
      };
      console.log('✅ queryExtensionStateList method added successfully');
    }
    
    // Get and compare extensions from database and AMI
    console.log('\n🔄 Comparing Extensions from Database and AMI...');
    const comparisonStartTime = Date.now();
    const { comparisonResults, dbExtensions, amiExtensions, summary } = await getAndCompareExtensions(hybridAmiService);
    const comparisonTime = Date.now() - comparisonStartTime;
    
    if (comparisonResults.length === 0) {
      console.log('❌ No extensions found for comparison');
      return;
    }
    
    // Wait 2 seconds before displaying the table
    console.log('⏳ Waiting 2 seconds before displaying results...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Display comparison table
    displayComparisonTable(comparisonResults, summary);
    
    // Overall performance summary - reduced verbosity
    const totalScriptTime = Date.now() - scriptStartTime;
    
    console.log(`\n🎯 OVERALL PERFORMANCE:`);
    console.log(`   AMI Connection: ${amiConnectionTime}ms`);
    console.log(`   Database Connection: Connected`);
    console.log(`   Database Query & Comparison: ${comparisonTime}ms`);
    console.log(`   Display Delay: 2000ms`);
    console.log(`   Total Script Time: ${totalScriptTime}ms`);
    
    console.log(`\n🎉 SCRIPT COMPLETED SUCCESSFULLY!`);
    console.log(`   📊 Compared ${comparisonResults.length} extensions`);
    console.log(`   🔌 Hybrid AMI connected and ExtensionStateList query completed`);
    console.log(`   💾 Database connected and extensions compared`);
    console.log(`   📊 No database updates performed (comparison mode)`);
    
  } catch (error) {
    console.error('Script execution failed:', error.message);
    
    // Provide specific guidance based on failure type - reduced verbosity
    if (error.message.includes('AMI') || error.message.includes('connect')) {
      console.error('\n🔌 Hybrid AMI Connection Issue:');
      console.error('   - Check if Asterisk is running');
      console.error(`   - Verify AMI credentials in environment variables`);
      console.error('   - Check network connectivity to Asterisk server');
    } else if (error.message.includes('MongoDB') || error.message.includes('database')) {
      console.error('\n💾 Database Connection Issue:');
      console.error('   - Check if MongoDB is running');
      console.error(`   - Verify MONGODB_URI environment variable`);
    } else {
      console.error('\n❓ Unknown Issue:');
      console.error('   - Check all environment variables are set correctly');
      console.error('   - Verify all dependencies are installed');
    }
    
    process.exit(1);
  } finally {
    // Cleanup
    if (hybridAmiService) {
      console.log('\n🛑 Stopping Hybrid AMI Service...');
      await hybridAmiService.stop();
    }
    
    // Close database connection if it was established
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('🔌 Database connection closed');
    }
    
    console.log('✅ Script completed');
    process.exit(0);
  }
};

// Run the script
main().catch(console.error);
