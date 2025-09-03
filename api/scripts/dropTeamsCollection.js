#!/usr/bin/env node

import mongoose from 'mongoose';
import Team from '../src/models/Team.js';
import connectDB from '../src/config/database.js';

const dropTeamsCollection = async () => {
  try {
    console.log('🚀 Connecting to database...');
    await connectDB();
    
    console.log('🗑️  Dropping existing teams collection...');
    
    // Check if collection exists
    const collections = await mongoose.connection.db.listCollections().toArray();
    const teamsCollectionExists = collections.some(col => col.name === 'teams');
    
    if (teamsCollectionExists) {
      await mongoose.connection.db.dropCollection('teams');
      console.log('✅ Teams collection dropped successfully!');
    } else {
      console.log('ℹ️  Teams collection does not exist, nothing to drop.');
    }
    
    console.log('📋 Creating empty teams collection with proper schema...');
    
    // Create indexes (this will create the collection if it doesn't exist)
    await Team.createIndexes();
    
    console.log('✅ Empty teams collection created successfully with indexes!');
    console.log('📊 Available indexes:');
    
    const indexes = await Team.collection.getIndexes();
    console.table(indexes);
    
    console.log('🎉 Teams collection reset complete (empty)!');
    console.log('💡 You can now add teams via the API or run "npm run seed-teams" for sample data');
    
  } catch (error) {
    console.error('❌ Error dropping teams collection:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔒 Database connection closed');
    process.exit(0);
  }
};

dropTeamsCollection();