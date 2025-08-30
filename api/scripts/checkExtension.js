import { config } from 'dotenv';

// Load environment variables
config();

// Import services
import { initializeHybridAmiService } from '../src/services/HybridAmiServiceInstance.js';

// Parse command line arguments
const parseArgs = () => {
  const args = process.argv.slice(2);
  let extension = null;
  
  for (const arg of args) {
    if (arg.startsWith('--exten=')) {
      extension = arg.split('=')[1];
      break;
    }
  }
  
  if (!extension) {
    console.error('❌ Usage: node checkExtension.js --exten=1002');
    console.error('   Example: node checkExtension.js --exten=1001');
    console.error('   Example: node checkExtension.js --exten=1003');
    process.exit(1);
  }
  
  // Validate extension is numeric
  if (!/^\d+$/.test(extension)) {
    console.error(`❌ Invalid extension: ${extension}. Extension must be numeric.`);
    process.exit(1);
  }
  
  return extension;
};

// Query single extension via AMI
const queryExtensionStatus = async (amiService, extensionNumber) => {
  try {
    console.log(`🔍 Querying extension ${extensionNumber} status...`);
    
    const startTime = Date.now();
    const result = await amiService.queryExtensionStatus(extensionNumber);
    const queryTime = Date.now() - startTime;
    
    return {
      extension: extensionNumber,
      status: result.status,
      statusCode: result.statusCode,
      statusText: result.statusText,
      queryTime: queryTime,
      error: result.error
    };
  } catch (error) {
    console.error(`❌ Extension ${extensionNumber} query failed:`, error.message);
    
    return {
      extension: extensionNumber,
      status: 'unknown',
      statusCode: null,
      statusText: null,
      queryTime: 0,
      error: error.message
    };
  }
};

// Display extension status result
const displayExtensionResult = (result) => {
  console.log('\n📊 EXTENSION STATUS RESULT');
  console.log('='.repeat(60));
  
  if (result.error) {
    console.log(`❌ Extension ${result.extension}: Query failed`);
    console.log(`   Error: ${result.error}`);
    console.log(`   Query Time: ${result.queryTime}ms`);
  } else {
    console.log(`✅ Extension ${result.extension}: Status retrieved successfully`);
    console.log(`   Status: ${result.status}`);
    if (result.statusCode !== null) {
      console.log(`   Status Code: ${result.statusCode}`);
    }
    if (result.statusText) {
      console.log(`   Status Text: ${result.statusText}`);
    }
    console.log(`   Query Time: ${result.queryTime}ms`);
  }
  
  console.log('='.repeat(60));
  
  // Structured output for programmatic use
  const structuredResult = {
    extension: result.extension,
    status: result.status,
    statusCode: result.statusCode,
    statusText: result.statusText,
    queryTime: result.queryTime,
    error: result.error,
    timestamp: new Date().toISOString()
  };
  
  console.log('\n📋 Structured Result (JSON):');
  console.log(JSON.stringify(structuredResult, null, 2));
};

// Main function
const main = async () => {
  console.log('🚀 Single Extension Status Checker');
  console.log('⏰ Started at:', new Date().toLocaleString());
  
  // Parse command line arguments
  const extensionNumber = parseArgs();
  console.log(`📞 Target Extension: ${extensionNumber}`);
  console.log(`⚙️ Environment: AMI Host = ${process.env.AMI_HOST || 'DEFAULT'}`);
  console.log(`🔌 AMI Service: Using Hybrid AMI Service`);
  
  console.log(`📊 Script Configuration: {extension: "${extensionNumber}", amiHost: "${process.env.AMI_HOST || 'DEFAULT'}", amiService: "HybridAmiService", startTime: "${new Date().toISOString()}"}`);
  
  let hybridAmiService = null;
  const scriptStartTime = Date.now();
  
  try {
    // Initialize Hybrid AMI Service
    console.log('\n🔌 Initializing Hybrid AMI Service...');
    console.log('⚠️ Attempting AMI connection - script will exit if this fails');
    const connectionStartTime = Date.now();
    
    hybridAmiService = await initializeHybridAmiService();
    
    if (!hybridAmiService.isHealthy()) {
      const errorMessage = 'Failed to connect to Hybrid AMI Service';
      console.log(`❌ ${errorMessage}`);
      console.error('AMI connection failed - script cannot proceed');
      console.error(`   Connection Details: {amiHost: '${process.env.AMI_HOST || 'NOT SET'}', amiPort: '${process.env.AMI_PORT || 'NOT SET'}', amiUsername: '${process.env.AMI_USERNAME || 'NOT SET'}', amiPassword: '${process.env.AMI_PASSWORD ? '[SET]' : 'NOT SET'}'}`);
      
      console.log('\n🛑 SCRIPT TERMINATED: AMI connection is required for extension status checking');
      console.log('💡 Troubleshooting:');
      console.log('   1. Verify AMI_HOST and AMI_PORT environment variables');
      console.log('   2. Check if Asterisk server is running and accessible');
      console.log('   3. Verify AMI credentials (AMI_USERNAME, AMI_PASSWORD)');
      console.log('   4. Check firewall settings for AMI port (usually 5038)');
      console.log('   5. Ensure AMI is enabled in manager.conf');
      
      process.exit(1);
    }
    
    const connectionTime = Date.now() - connectionStartTime;
    console.log(`✅ Hybrid AMI Service connected successfully in ${connectionTime}ms`);
    console.log(`🎯 Service Status: ${hybridAmiService.getStatus().connectionState}`);
    console.log(`   Connection Stats: {connectionTime: ${connectionTime}, serviceStatus: '${hybridAmiService.getStatus().connectionState}'}`);
    
    // Query the single extension
    console.log(`\n🔍 Querying Extension ${extensionNumber}...`);
    const result = await queryExtensionStatus(hybridAmiService, extensionNumber);
    
    // Display results
    displayExtensionResult(result);
    
    // Overall performance summary
    const totalScriptTime = Date.now() - scriptStartTime;
    
    console.log(`\n🎯 OVERALL PERFORMANCE:`);
    console.log(`   AMI Connection: ${connectionTime}ms`);
    console.log(`   Extension Query: ${result.queryTime}ms`);
    console.log(`   Total Script Time: ${totalScriptTime}ms`);
    console.log(`   Performance Data: {amiConnectionTime: ${connectionTime}, extensionQueryTime: ${result.queryTime}, totalScriptTime: ${totalScriptTime}}`);
    
    console.log(`\n🎉 SCRIPT COMPLETED SUCCESSFULLY!`);
    console.log(`   📞 Extension ${extensionNumber} status retrieved`);
    console.log(`   🔌 AMI connection established and query completed`);
    console.log(`   Script Completion: {extension: "${extensionNumber}", status: "${result.status}", totalTime: ${totalScriptTime}, completedAt: '${new Date().toISOString()}'}`);
    
  } catch (error) {
    console.error('❌ Script execution failed:', error.message);
    console.error('Error Stack:', error.stack);
    
    // Provide specific guidance based on failure type
    if (error.message.includes('AMI') || error.message.includes('connect')) {
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
      console.error(`   AMI Connection Details: {amiHost: '${process.env.AMI_HOST || 'NOT SET'}', amiPort: '${process.env.AMI_PORT || 'NOT SET'}', amiUsername: '${process.env.AMI_USERNAME || 'NOT SET'}', amiPassword: '${process.env.AMI_PASSWORD ? '[SET]' : 'NOT SET'}'}`);
    } else {
      console.error('\n❓ Unknown Issue:');
      console.error('   - Check all environment variables are set correctly');
      console.error('   - Verify all dependencies are installed');
      console.error('   - Check log files for additional details');
      console.error(`   Unknown Error Details: {error: '${error.message}'}`);
    }
    
    process.exit(1);
  } finally {
    // Cleanup
    if (hybridAmiService) {
      console.log('\n🛑 Stopping Hybrid AMI Service...');
      await hybridAmiService.stop();
    }
    
    const completionTime = new Date().toLocaleString();
    console.log('✅ Script completed at:', completionTime);
    console.log(`Script Cleanup: {completedAt: '${completionTime}'}`);
    process.exit(0);
  }
};

// Run the script
main().catch(console.error);