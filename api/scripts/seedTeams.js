#!/usr/bin/env node

import mongoose from 'mongoose';
import Team from '../src/models/Team.js';
import connectDB from '../src/config/database.js';

const seedTeams = async () => {
  try {
    console.log('🚀 Connecting to database...');
    await connectDB();
    
    console.log('📝 Seeding teams collection with sample data...');
    
    // Clear existing teams first
    await Team.deleteMany({});
    console.log('🗑️  Cleared existing teams');
    
    // Sample teams data
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
      },
      {
        name: 'Marketing Team',
        description: 'Brand promotion and marketing campaigns'
      },
      {
        name: 'Quality Assurance',
        description: 'Testing and quality control processes'
      }
    ];
    
    const createdTeams = await Team.insertMany(sampleTeams);
    console.log('✅ Sample teams created:');
    createdTeams.forEach(team => {
      console.log(`  - ${team.name} (slug: ${team.slug}) - ${team.is_active ? 'Active' : 'Inactive'}`);
    });
    
    console.log(`🎉 Successfully seeded ${createdTeams.length} teams!`);
    
  } catch (error) {
    console.error('❌ Error seeding teams:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔒 Database connection closed');
    process.exit(0);
  }
};

seedTeams();