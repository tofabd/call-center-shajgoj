#!/usr/bin/env node

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { initializeAmiService, stopAmiService } from '../src/services/AmiServiceInstance.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/call_center_shajgoj';

async function startAmiServiceForTest() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Initialize managed AMI service
    await initializeAmiService();

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Received SIGINT. Shutting down gracefully...');
      await stopAmiService();
      await mongoose.connection.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🛑 Received SIGTERM. Shutting down gracefully...');
      await stopAmiService();
      await mongoose.connection.close();
      process.exit(0);
    });

    console.log('🎧 Managed AMI Service is running for test. Press Ctrl+C to stop.');

  } catch (error) {
    console.error('❌ Failed to start AMI service for test:', error.message);
    process.exit(1);
  }
}

startAmiServiceForTest();