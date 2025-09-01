#!/usr/bin/env node

/**
 * cleanupCalls.js - Cleanup stuck calls by querying AMI and database
 *
 * This script identifies stuck calls (ringing too long or answered too long)
 * and forces them to hangup using AMI, then updates the database accordingly.
 */

import net from 'net';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Call from '../src/models/Call.js';
import CallLeg from '../src/models/CallLeg.js';
import BridgeSegment from '../src/models/BridgeSegment.js';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');
dotenv.config({ path: path.join(projectRoot, '.env') });

// AMI Configuration from environment
const AMI_CONFIG = {
  host: process.env.AMI_HOST || '103.177.125.83',
  port: parseInt(process.env.AMI_PORT) || 5038,
  username: process.env.AMI_USERNAME || 'admin',
  password: process.env.AMI_PASSWORD || 'admin123'
};

// Database configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/call_center_shajgoj';

// Script configuration
const QUERY_TIMEOUT = 30000; // 30 seconds timeout
const STUCK_RINGING_THRESHOLD = 2 * 60 * 1000; // 2 minutes
const STUCK_ANSWERED_THRESHOLD = 3 * 60 * 1000; // 3 minutes

/**
 * Parse AMI response into key-value pairs
 */
const parseAmiEvent = (eventText) => {
  const event = {};
  const lines = eventText.trim().split('\r\n');

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();
      event[key] = value;
    }
  }

  return event;
};

/**
 * Query active channels from AMI
 */
const queryActiveChannels = () => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    let socket;
    let authenticated = false;
    let queryStarted = false;
    let queryCompleted = false;
    let buffer = '';

    const channels = [];
    const allEvents = [];
    let eventCount = 0;
    let channelEventCount = 0;

    console.log('🚀 Starting AMI Active Channels Query...');

    socket = new net.Socket();
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error(`Query timeout after ${QUERY_TIMEOUT}ms`));
    }, QUERY_TIMEOUT);

    socket.connect(AMI_CONFIG.port, AMI_CONFIG.host, () => {
      console.log('✅ Socket connected to AMI');
    });

    socket.on('data', (data) => {
      buffer += data.toString();

      let messages = buffer.split('\r\n\r\n');
      buffer = messages.pop();

      for (const message of messages) {
        if (!message.trim()) continue;

        const event = parseAmiEvent(message);
        allEvents.push({ raw: message, parsed: event, timestamp: new Date().toISOString() });
        eventCount++;

        if (!authenticated && message.includes('Authentication')) {
          if (message.includes('accepted')) {
            authenticated = true;
            const query = [
              'Action: CoreShowChannels',
              'Events: off',
              `ActionID: CleanupScript-${Date.now()}`,
              '', ''
            ].join('\r\n');
            socket.write(query);
            queryStarted = true;
          } else {
            clearTimeout(timeout);
            socket.destroy();
            reject(new Error('Authentication failed'));
            return;
          }
        }

        if (queryStarted && event.Event) {
          if (event.Event === 'CoreShowChannel') {
            channels.push({
              channel: event.Channel || 'Unknown',
              uniqueId: event.Uniqueid || null,
              linkedId: event.Linkedid || null,
              state: event.ChannelState || 'Unknown',
              context: event.Context || 'Unknown',
              extension: event.Extension || 'Unknown'
            });
            channelEventCount++;
          } else if (event.Event === 'CoreShowChannelsComplete') {
            queryCompleted = true;
            const logoffAction = ['Action: Logoff', '', ''].join('\r\n');
            socket.write(logoffAction);
            setTimeout(() => {
              clearTimeout(timeout);
              socket.destroy();
              resolve(channels);
            }, 100);
            return;
          }
        }
      }
    });

    socket.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    socket.on('close', () => {
      if (!queryCompleted) {
        clearTimeout(timeout);
        reject(new Error('Connection closed before query completed'));
      }
    });

    socket.on('connect', () => {
      setTimeout(() => {
        const loginAction = [
          'Action: Login',
          `Username: ${AMI_CONFIG.username}`,
          `Secret: ${AMI_CONFIG.password}`,
          '', ''
        ].join('\r\n');
        socket.write(loginAction);
      }, 500);
    });
  });
};



/**
 * Find stuck calls
 */
const findStuckCalls = async () => {
  const now = new Date();
  const stuckCalls = [];

  // Find active calls (not ended)
  const activeCalls = await Call.find({ ended_at: null });
  console.log(`📞 Found ${activeCalls.length} active calls in DB`);

  for (const call of activeCalls) {
    let isStuck = false;
    let reason = '';

    if (!call.answered_at) {
      // Ringing call
      const ringingDuration = now - call.started_at;
      if (ringingDuration > STUCK_RINGING_THRESHOLD) {
        isStuck = true;
        reason = `Ringing too long: ${Math.floor(ringingDuration / 1000)}s`;
      }
    } else {
      // Answered call
      const answeredDuration = now - call.answered_at;
      if (answeredDuration > STUCK_ANSWERED_THRESHOLD) {
        isStuck = true;
        reason = `Answered too long: ${Math.floor(answeredDuration / 1000)}s`;
      }
    }

    if (isStuck) {
      console.log(`🚨 Stuck call detected: ${call.linkedid} - ${reason}`);
      stuckCalls.push({ call, reason });
    }
  }

  console.log(`🚨 Total stuck calls: ${stuckCalls.length}`);
  return stuckCalls;
};

/**
 * Cleanup stuck calls
 */
const cleanupStuckCalls = async (stuckCalls, activeChannels) => {
  const cleaned = [];
  const failed = [];

  for (const { call, reason } of stuckCalls) {
    console.log(`🧹 Processing stuck call ${call.linkedid}: ${reason}`);

    // Check call legs
    const callLegs = await CallLeg.find({ linkedid: call.linkedid, hangup_at: null });
    console.log(`   CallLegs: ${callLegs.length} active`);

    let hasActiveChannel = false;
    for (const leg of callLegs) {
      console.log(`   Leg: ${leg.uniqueid}`);
      const channel = activeChannels.find(ch => ch.uniqueId === leg.uniqueid || ch.linkedId === leg.linkedid);
      if (channel) {
        hasActiveChannel = true;
        console.log(`   Channel: ${channel.channel}`);
        break;
      }
    }

    console.log(`   Active channel: ${hasActiveChannel ? 'Yes' : 'No'}`);
    console.log(`   Call ID: ${call._id}`);

    // Update Call
    const updateResult = await Call.updateOne(
      { _id: call._id },
      {
        ended_at: new Date(),
        disposition: 'canceled',
        hangup_cause: 'Stuck call cleanup'
      }
    );
    console.log(`   Call update: ${updateResult.modifiedCount} modified`);

    // Update CallLegs
    const legResult = await CallLeg.updateMany(
      { linkedid: call.linkedid, hangup_at: null },
      { hangup_at: new Date(), hangup_cause: 'Stuck call cleanup' }
    );
    console.log(`   CallLeg update: ${legResult.modifiedCount} modified`);

    // Update BridgeSegments
    const segmentResult = await BridgeSegment.updateMany(
      { linkedid: call.linkedid, left_at: null },
      { left_at: new Date() }
    );
    console.log(`   BridgeSegment update: ${segmentResult.modifiedCount} modified`);

    console.log(`📡 Broadcasting update for ${call.linkedid}`);
    cleaned.push(call);
  }

  return { cleaned, failed };
};

/**
 * Main execution
 */
const main = async () => {
  try {
    console.log('🧹 Starting Stuck Calls Cleanup Script...\n');

    // Validate configuration
    if (!AMI_CONFIG.host || !MONGODB_URI) {
      throw new Error('Missing AMI or DB configuration');
    }

    // Connect to database
    try {
      await mongoose.connect(MONGODB_URI);
      console.log('✅ Connected to database');
    } catch (dbError) {
      console.error('❌ Database connection failed:', dbError.message);
      throw dbError;
    }

    // Find stuck calls
    console.log('🔍 Finding stuck calls...');
    const stuckCalls = await findStuckCalls();
    console.log(`📞 Found ${stuckCalls.length} stuck calls`);

    if (stuckCalls.length === 0) {
      console.log('✅ No stuck calls found');
      return;
    }

    // Query active channels
    console.log('📡 Querying active channels...');
    const activeChannels = await queryActiveChannels();
    console.log(`📞 Found ${activeChannels.length} active channels`);

    // Cleanup stuck calls
    console.log('🔪 Cleaning up stuck calls...');
    const { cleaned, failed } = await cleanupStuckCalls(stuckCalls, activeChannels);

    console.log(`\n✅ Cleanup Summary:`);
    console.log(`   Cleaned: ${cleaned.length} calls`);
    console.log(`   Failed: ${failed.length} calls`);

    if (cleaned.length > 0) {
      console.log('\n🧹 Cleaned calls:');
      cleaned.forEach((call, i) => console.log(`   ${i + 1}. ${call.linkedid}`));
    }

    if (failed.length > 0) {
      console.log('\n❌ Failed calls:');
      failed.forEach((item, i) => console.log(`   ${i + 1}. ${item.call.linkedid} - ${item.reason}`));
    }

  } catch (error) {
    console.error('❌ Script failed:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔒 Database connection closed');
    process.exit(0);
  }
};

// Run main
main();