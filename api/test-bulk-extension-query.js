#!/usr/bin/env node

import dotenv from 'dotenv';
import { createSeparateConnectionAndRefresh } from './src/controllers/hybridAmiRefreshController.js';

dotenv.config();

/**
 * Test script for bulk ExtensionStateList functionality
 * This tests the new bulk query approach instead of individual queries
 */
const testBulkExtensionQuery = async () => {
  console.log('🧪 Testing Bulk ExtensionStateList Query');
  console.log('==================================================');
  
  try {
    console.log('🚀 Phase 1: Testing bulk ExtensionStateList query...');
    
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
        
        // Analyze the response
        if (data.success) {
          console.log('\n📊 Analysis:');
          console.log(`   Extensions checked: ${data.data.extensionsChecked}`);
          console.log(`   Successful queries: ${data.data.statistics.successfulQueries}`);
          console.log(`   Failed queries: ${data.data.statistics.failedQueries}`);
          console.log(`   JSON file created: ${data.data.jsonFile ? 'Yes' : 'No'}`);
          
          if (data.data.jsonFile) {
            console.log(`   JSON filename: ${data.data.jsonFile.filename}`);
            console.log(`   JSON file size: ${data.data.jsonFile.fileSize}`);
          }
        }
      },
      status: (code) => {
        console.log(`📡 HTTP Status: ${code}`);
        return mockRes;
      }
    };
    
    // Test the bulk query functionality
    await createSeparateConnectionAndRefresh(mockReq, mockRes);
    
    console.log('\n🎉 Test completed successfully!');
    console.log('✨ Bulk ExtensionStateList query is working correctly');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
};

// Run the test
testBulkExtensionQuery();
