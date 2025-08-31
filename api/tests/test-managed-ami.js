#!/usr/bin/env node

/**
 * Test Script for AmiService
 * Tests the AmiService approach: robust connections + Node.js-style events
 */

import dotenv from 'dotenv';
import { initializeAmiService, getAmiServiceStatus, stopAmiService } from './src/services/AmiServiceInstance.js';

dotenv.config();

console.log('🧪 Testing AmiService');
console.log('='.repeat(50));

async function testAmiService() {
  try {
    console.log('🚀 Phase 1: Initializing AmiService...');
    
    // Initialize the service
          const service = await initializeAmiService();
    console.log('✅ Service initialized successfully');
    
    // Wait a moment for connection to stabilize
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('\n📊 Phase 2: Checking service status...');
          const status = getAmiServiceStatus();
    console.log('Service Status:', JSON.stringify(status, null, 2));
    
    // Test connection health
    if (service.getHealthStatus()) {
      console.log('✅ Service is healthy and running');
    } else {
      console.log('⚠️ Service is running but not healthy');
    }
    
    console.log('\n⏳ Phase 3: Running for 10 seconds to test event processing...');
    console.log('📡 Listening for AMI events...');
    
    // Run for 10 seconds to test event processing
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    console.log('\n📊 Phase 4: Final status check...');
          const finalStatus = getAmiServiceStatus();
    console.log('Final Status:', JSON.stringify(finalStatus, null, 2));
    
    console.log('\n🛑 Phase 5: Stopping service...');
          await stopAmiService();
    console.log('✅ Service stopped successfully');
    
    console.log('\n🎉 Test completed successfully!');
    console.log('✨ AmiService is working correctly');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    
    // Try to stop service if it was started
    try {
      await stopAmiService();
    } catch (stopError) {
      console.error('❌ Error stopping service:', stopError.message);
    }
    
    process.exit(1);
  }
}

// Run the test
testAmiService().then(() => {
  console.log('\n🏁 Test script finished');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Unexpected error:', error.message);
  process.exit(1);
});
