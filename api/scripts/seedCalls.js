import mongoose from 'mongoose';
import Call from '../models/Call.js';
import dotenv from 'dotenv';

dotenv.config();

const sampleCalls = [
  {
    linkedid: 'call_001_20240115',
    direction: 'incoming',
    caller_number: '+1234567890',
    caller_name: 'John Doe',
    agent_exten: '1001',
    started_at: new Date('2024-01-15T10:00:00Z'),
    answered_at: new Date('2024-01-15T10:05:00Z'),
    ended_at: new Date('2024-01-15T10:15:00Z'),
    ring_seconds: 5,
    talk_seconds: 600
  },
  {
    linkedid: 'call_002_20240115',
    direction: 'outgoing',
    other_party: '+0987654321',
    agent_exten: '1002',
    started_at: new Date('2024-01-15T11:00:00Z'),
    answered_at: new Date('2024-01-15T11:02:00Z'),
    ended_at: new Date('2024-01-15T11:10:00Z'),
    ring_seconds: 2,
    talk_seconds: 480
  },
  {
    linkedid: 'call_003_20240115',
    direction: 'incoming',
    caller_number: '+1555123456',
    caller_name: 'Jane Smith',
    agent_exten: '1003',
    started_at: new Date('2024-01-15T12:00:00Z'),
    ended_at: new Date('2024-01-15T12:30:00Z'),
    ring_seconds: 30
  },
  {
    linkedid: 'call_004_20240115',
    direction: 'outgoing',
    other_party: '+1555987654',
    agent_exten: '1001',
    started_at: new Date('2024-01-15T13:00:00Z'),
    ended_at: new Date('2024-01-15T13:05:00Z'),
    ring_seconds: 5
  },
  {
    linkedid: 'call_005_20240115',
    direction: 'incoming',
    caller_number: '+1888123456',
    caller_name: 'Bob Johnson',
    agent_exten: '1002',
    started_at: new Date('2024-01-15T14:00:00Z'),
    answered_at: new Date('2024-01-15T14:03:00Z'),
    ended_at: new Date('2024-01-15T14:20:00Z'),
    ring_seconds: 3,
    talk_seconds: 1020
  }
];

async function seedCalls() {
  try {
    console.log('🌱 Starting to seed calls...');
    
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/call_center_shajgoj');
    console.log('✅ Connected to MongoDB');
    
    // Clear existing calls
    await Call.deleteMany({});
    console.log('🧹 Cleared existing calls');
    
    // Insert sample calls
    const result = await Call.insertMany(sampleCalls);
    console.log(`✅ Seeded ${result.length} calls`);
    
    // Display the created calls
    console.log('\n📞 Sample calls created:');
    result.forEach((call, index) => {
      const status = call.ended_at ? (call.answered_at ? 'ended' : (call.disposition || 'ended')) : (call.answered_at ? 'answered' : 'ringing');
      console.log(`${index + 1}. ${call.direction} call to ${call.caller_number || call.other_party} - Status: ${status}`);
    });
    
    await mongoose.disconnect();
    console.log('🔒 Disconnected from MongoDB');
    console.log('\n🎉 Call seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Error seeding calls:', error);
    process.exit(1);
  }
}

seedCalls();
