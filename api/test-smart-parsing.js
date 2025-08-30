#!/usr/bin/env node

import AmiQueryService from './src/services/AmiQueryService.js';
import { createComponentLogger } from './src/config/logging.js';

// Create a test instance
const testService = new AmiQueryService();

// Test the smart parsing system
console.log('🧪 Testing Smart Parsing System');
console.log('================================');

try {
  // Test the smart parsing with both formats
  const result = testService.testSmartParsing();
  
  console.log('\n📊 Test Results:');
  console.log('================');
  console.log(`Events: off format: ${result.eventsOff.length} extensions`);
  console.log(`Events: on format: ${result.eventsOn.length} extensions`);
  console.log(`Smart parsing working: ${result.smartParsingWorking}`);
  
  console.log('\n📱 Events: off Extensions:');
  result.eventsOff.forEach(ext => {
    console.log(`  ${ext.extension}: Status ${ext.status} (${ext.context})`);
  });
  
  console.log('\n📱 Events: on Extensions:');
  result.eventsOn.forEach(ext => {
    const statusText = ext.statusText ? ` - ${ext.statusText}` : '';
    const hint = ext.hint ? ` (${ext.hint})` : '';
    console.log(`  ${ext.extension}: Status ${ext.status} (${ext.context})${statusText}${hint}`);
  });
  
  console.log('\n✅ Smart parsing test completed successfully!');
  
} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}
