#!/usr/bin/env node

/**
 * Debug version of cleanup script to test basic functionality
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('🔍 Debug: Starting cleanup script test...');
console.log('🔍 Debug: Current directory:', process.cwd());
console.log('🔍 Debug: MongoDB URI:', process.env.MONGODB_URI || 'mongodb://localhost:27017/call_center_shajgoj');

async function testConnection() {
  try {
    console.log('🔍 Debug: Attempting to connect to MongoDB...');
    
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/call_center_shajgoj';
    await mongoose.connect(mongoUri);
    
    console.log('✅ Debug: MongoDB connected successfully');
    
    // Test basic database operations
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log('🔍 Debug: Available collections:', collections.map(c => c.name));
    
    // Close connection
    await mongoose.connection.close();
    console.log('🔒 Debug: MongoDB connection closed');
    
  } catch (error) {
    console.error('❌ Debug: Error occurred:', error.message);
    console.error('❌ Debug: Stack trace:', error.stack);
  }
}

// Run the test
testConnection().then(() => {
  console.log('🔍 Debug: Test completed');
  process.exit(0);
}).catch(err => {
  console.error('❌ Debug: Test failed:', err.message);
  process.exit(1);
});
