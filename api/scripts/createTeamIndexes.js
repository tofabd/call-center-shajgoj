#!/usr/bin/env node

import mongoose from 'mongoose';
import Team from '../src/models/Team.js';
import connectDB from '../src/config/database.js';

const createTeamIndexes = async () => {
  try {
    console.log('🚀 Connecting to database...');
    await connectDB();
    
    console.log('📋 Creating Team collection indexes...');
    
    // The indexes are automatically created by the model definition,
    // but we can explicitly ensure they exist
    await Team.createIndexes();
    
    console.log('✅ Team indexes created successfully!');
    console.log('📊 Available indexes:');
    
    const indexes = await Team.collection.getIndexes();
    console.table(indexes);
    
    console.log('🎉 Team model setup complete!');
    
  } catch (error) {
    console.error('❌ Error setting up Team model:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔒 Database connection closed');
    process.exit(0);
  }
};

createTeamIndexes();