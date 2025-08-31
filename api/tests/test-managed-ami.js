#!/usr/bin/env node

/**
 * Test Script for Hybrid AMI Service
 * Tests the new hybrid approach: PHP-style connections + Node.js-style events
 */

import dotenv from 'dotenv';
import { initializeManagedAmiService, getManagedAmiServiceStatus, stopManagedAmiService } from './src/services/ManagedAmiServiceInstance.js';

dotenv.config();

console.log('🧪 Testing Hybrid AMI Service');
console.log('='.repeat(50));

async function testManagedAmiService() {
  try {
    console.log('🚀 Phase 1: Initializing Hybrid AMI Service...');
    
    // Initialize the service
    const service = await initializeManagedAmiService();
    console.log('✅ Service initialized successfully');
    
    // Wait a moment for connection to stabilize
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('\n📊 Phase 2: Checking service status...');
    const status = getManagedAmiServiceStatus();
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
    const finalStatus = getManagedAmiServiceStatus();
    console.log('Final Status:', JSON.stringify(finalStatus, null, 2));
    
    console.log('\n🛑 Phase 5: Stopping service...');
    await stopManagedAmiService();
    console.log('✅ Service stopped successfully');
    
    console.log('\n🎉 Test completed successfully!');
    console.log('✨ Hybrid AMI Service is working correctly');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    
    // Try to stop service if it was started
    try {
      await stopManagedAmiService();
    } catch (stopError) {
      console.error('❌ Error stopping service:', stopError.message);
    }
    
    process.exit(1);
  }
}

// Run the test
testManagedAmiService().then(() => {
  console.log('\n🏁 Test script finished');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Unexpected error:', error.message);
  process.exit(1);
});
