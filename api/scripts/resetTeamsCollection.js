#!/usr/bin/env node

import mongoose from 'mongoose';
import Team from '../src/models/Team.js';
import connectDB from '../src/config/database.js';

const resetTeamsCollection = async () => {
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
      console.log('ℹ️  Teams collection does not exist, skipping drop.');
    }
    
    console.log('📋 Creating new teams collection with proper schema...');
    
    // Create indexes (this will create the collection if it doesn't exist)
    await Team.createIndexes();
    
    console.log('✅ Teams collection created successfully with indexes!');
    console.log('📊 Available indexes:');
    
    const indexes = await Team.collection.getIndexes();
    console.table(indexes);
    
    // Optional: Add some sample data
    console.log('📝 Adding sample teams...');
    const sampleTeams = [
      {
        name: 'Sales Team',
        description: 'Responsible for customer acquisition and sales activities'
      },
      {
        name: 'Support Team', 
        description: 'Handles customer support and technical assistance'
      },
      {
        name: 'Development Team',
        description: 'Software development and technical implementation'
      }
    ];
    
    const createdTeams = await Team.insertMany(sampleTeams);
    console.log('✅ Sample teams created:');
    createdTeams.forEach(team => {
      console.log(`  - ${team.name} (slug: ${team.slug})`);
    });
    
    console.log('🎉 Teams collection reset complete!');
    
  } catch (error) {
    console.error('❌ Error resetting teams collection:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔒 Database connection closed');
    process.exit(0);
  }
};

resetTeamsCollection();