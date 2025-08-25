#!/usr/bin/env node

import mongoose from 'mongoose';
import AmiListener from './services/AmiListener.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/call_center_shajgoj';

async function startAmiListener() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Start AMI listener
    const amiListener = new AmiListener();
    await amiListener.start();

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Received SIGINT. Shutting down gracefully...');
      amiListener.stop();
      mongoose.connection.close();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Received SIGTERM. Shutting down gracefully...');
      amiListener.stop();
      mongoose.connection.close();
      process.exit(0);
    });

    console.log('🎧 AMI Listener is running. Press Ctrl+C to stop.');

  } catch (error) {
    console.error('❌ Failed to start AMI listener:', error.message);
    process.exit(1);
  }
}

startAmiListener();