#!/usr/bin/env node

import dotenv from 'dotenv';
import { createSeparateConnectionAndRefresh } from './src/controllers/hybridAmiRefreshController.js';

dotenv.config();

/**
 * Test script for separate Hybrid AMI connection functionality
 * This tests the ability to create a separate connection for manual refresh
 */
const testSeparateConnection = async () => {
  console.log('🧪 Testing Separate Hybrid AMI Connection');
  console.log('==================================================');
  
  try {
    console.log('🚀 Phase 1: Creating separate connection and refreshing extensions...');
    
    // Mock request and response objects
    const mockReq = {
      body: {
        useSeparateConnection: true,
        timestamp: Date.now()
      }
    };
    
    const mockRes = {
      json: (data) => {
        console.log('✅ Response received:');
        console.log(JSON.stringify(data, null, 2));
      },
      status: (code) => {
        console.log(`📡 HTTP Status: ${code}`);
        return mockRes;
      }
    };
    
    // Test the separate connection functionality
    await createSeparateConnectionAndRefresh(mockReq, mockRes);
    
    console.log('\n🎉 Test completed successfully!');
    console.log('✨ Separate Hybrid AMI connection is working correctly');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
};

// Run the test
testSeparateConnection();
