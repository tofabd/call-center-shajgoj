#!/usr/bin/env node

/**
 * cleanupCalls.js - Query active channels using AMI CoreShowChannels
 * 
 * This script creates a standalone AMI connection to query all active channels
 * from Asterisk using CoreShowChannels with Events: off
 * Parses all channel events until CoreShowChannelsComplete
 * Displays all active channels in console
 */

import net from 'net';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

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

// Script configuration
const QUERY_TIMEOUT = 30000; // 30 seconds timeout

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
 * Format channel state for better readability
 */
const formatChannelState = (state) => {
  const stateMap = {
    '0': 'Down',
    '1': 'Reserved',
    '2': 'Off Hook',
    '3': 'Dialing',
    '4': 'Ring',
    '5': 'Ringing',
    '6': 'Up',
    '7': 'Busy',
    '8': 'Dialing Offhook',
    '9': 'Pre-ring',
    '10': 'Unknown'
  };
  
  return stateMap[state] || `State ${state}`;
};

/**
 * Main AMI Query Function for Active Channels
 */
const queryActiveChannels = () => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    let socket;
    let authenticated = false;
    let queryStarted = false;
    let queryCompleted = false;
    let buffer = '';
    
    // Data collection
    const channels = [];
    const allEvents = [];
    let eventCount = 0;
    let channelEventCount = 0;
    
    console.log('🚀 Starting AMI Active Channels Query Script...');
    console.log(`🔌 Connecting to AMI: ${AMI_CONFIG.host}:${AMI_CONFIG.port}`);
    console.log(`👤 Username: ${AMI_CONFIG.username}`);
    
    // Create socket connection
    socket = new net.Socket();
    
    // Set timeout
    const timeout = setTimeout(() => {
      console.log('⏰ Query timeout reached');
      socket.destroy();
      reject(new Error(`Query timeout after ${QUERY_TIMEOUT}ms`));
    }, QUERY_TIMEOUT);
    
    // Handle socket connection
    socket.connect(AMI_CONFIG.port, AMI_CONFIG.host, () => {
      console.log('✅ Socket connected to AMI');
    });
    
    // Handle incoming data
    socket.on('data', (data) => {
      buffer += data.toString();
      
      // Process complete messages (separated by double CRLF)
      let messages = buffer.split('\r\n\r\n');
      buffer = messages.pop(); // Keep incomplete message in buffer
      
      for (const message of messages) {
        if (!message.trim()) continue;
        
        const event = parseAmiEvent(message);
        allEvents.push({ raw: message, parsed: event, timestamp: new Date().toISOString() });
        eventCount++;
        
        // Handle authentication response
        if (!authenticated && message.includes('Authentication')) {
          if (message.includes('accepted')) {
            console.log('🔐 Authentication successful');
            authenticated = true;
            
            // Send CoreShowChannels query with Events: off
            const query = [
              'Action: CoreShowChannels',
              'Events: off',
              `ActionID: ChannelQueryScript-${Date.now()}`,
              '', // Empty line to end the action
              ''  // Double CRLF
            ].join('\r\n');
            
            console.log('📡 Sending CoreShowChannels query...');
            socket.write(query);
            queryStarted = true;
            
          } else if (message.includes('failed') || message.includes('denied')) {
            console.error('❌ Authentication failed');
            clearTimeout(timeout);
            socket.destroy();
            reject(new Error('Authentication failed'));
            return;
          }
        }
        
        // Handle CoreShowChannels events
        if (queryStarted && event.Event) {
          if (event.Event === 'CoreShowChannel') {
            console.log(`📞 Active Channel: ${event.Channel} - State: ${formatChannelState(event.ChannelState)} - Context: ${event.Context}`);
            
            const channelData = {
              channel: event.Channel || 'Unknown',
              context: event.Context || 'Unknown',
              extension: event.Extension || 'Unknown',
              priority: event.Priority || 'Unknown',
              state: event.ChannelState || 'Unknown',
              stateText: formatChannelState(event.ChannelState),
              application: event.Application || null,
              applicationData: event.ApplicationData || null,
              duration: event.Duration || '0',
              accountCode: event.AccountCode || null,
              callerIdNum: event.CallerIDNum || null,
              callerIdName: event.CallerIDName || null,
              connectedLineNum: event.ConnectedLineNum || null,
              connectedLineName: event.ConnectedLineName || null,
              uniqueId: event.Uniqueid || null,
              linkedId: event.Linkedid || null,
              receivedAt: new Date().toISOString(),
              rawEvent: message
            };
            
            channels.push(channelData);
            channelEventCount++;
            
          } else if (event.Event === 'CoreShowChannelsComplete') {
            console.log('✅ CoreShowChannelsComplete received - Query completed');
            console.log(`📊 Found ${channelEventCount} active channels`);
            queryCompleted = true;
            
            // Send logoff before closing
            console.log('👋 Sending AMI Logoff...');
            const logoffAction = [
              'Action: Logoff',
              '', // Empty line to end the action
              ''  // Double CRLF
            ].join('\r\n');
            socket.write(logoffAction);
            
            // Process final results
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            const results = {
              metadata: {
                queryStartTime: new Date(startTime).toISOString(),
                queryEndTime: new Date(endTime).toISOString(),
                queryDuration: `${duration}ms`,
                amiHost: AMI_CONFIG.host,
                amiPort: AMI_CONFIG.port,
                amiUsername: AMI_CONFIG.username,
                scriptVersion: '1.0.0',
                queryType: 'CoreShowChannels with Events: off'
              },
              summary: {
                totalEvents: eventCount,
                channelEvents: channelEventCount,
                totalChannels: channels.length,
                querySuccessful: true,
                completionEventReceived: true
              },
              channels: channels,
              rawEvents: allEvents
            };
            
            // Small delay to ensure logoff is sent before closing
            setTimeout(() => {
              clearTimeout(timeout);
              socket.destroy();
              resolve(results);
            }, 100);
            return;
          }
        }
      }
    });
    
    // Handle socket errors
    socket.on('error', (error) => {
      console.error('❌ Socket error:', error.message);
      clearTimeout(timeout);
      reject(error);
    });
    
    // Handle socket close
    socket.on('close', () => {
      console.log('🔌 Socket connection closed');
      
      if (!queryCompleted) {
        clearTimeout(timeout);
        reject(new Error('Connection closed before query completed'));
      }
    });
    
    // Start authentication when connected
    socket.on('connect', () => {
      // Wait for initial AMI banner
      setTimeout(() => {
        const loginAction = [
          'Action: Login',
          `Username: ${AMI_CONFIG.username}`,
          `Secret: ${AMI_CONFIG.password}`,
          '', // Empty line to end the action
          ''  // Double CRLF
        ].join('\r\n');
        
        console.log('🔐 Sending authentication...');
        socket.write(loginAction);
      }, 500); // Small delay to ensure banner is received
    });
  });
};

/**
 * Display active channels in console
 */
const displayActiveChannels = (results) => {
  console.log('\n📊 ACTIVE CHANNELS SUMMARY');
  console.log('==========================');
  console.log(`⏱️  Query Duration: ${results.metadata.queryDuration}`);
  console.log(`📡 Total Events: ${results.summary.totalEvents}`);
  console.log(`📞 Channel Events: ${results.summary.channelEvents}`);
  console.log(`📞 Total Active Channels: ${results.summary.totalChannels}`);
  console.log(`✅ Query Successful: ${results.summary.querySuccessful}`);
  console.log(`🏁 Completion Event: ${results.summary.completionEventReceived}`);
  
  if (results.channels.length > 0) {
    console.log('\n📞 ACTIVE CHANNELS:');
    console.log('==================');
    
    results.channels.forEach((channel, index) => {
      console.log(`${index + 1}. Channel: ${channel.channel}`);
      console.log(`   Context: ${channel.context}`);
      console.log(`   Extension: ${channel.extension}`);
      console.log(`   Priority: ${channel.priority}`);
      console.log(`   State: ${channel.stateText} (${channel.state})`);
      console.log(`   Application: ${channel.application || 'N/A'}`);
      console.log(`   Duration: ${channel.duration}`);
      console.log(`   Caller ID: ${channel.callerIdNum || 'N/A'} (${channel.callerIdName || 'N/A'})`);
      console.log(`   Connected Line: ${channel.connectedLineNum || 'N/A'} (${channel.connectedLineName || 'N/A'})`);
      console.log(`   Unique ID: ${channel.uniqueId || 'N/A'}`);
      console.log(`   Account Code: ${channel.accountCode || 'N/A'}`);
      console.log('');
    });
    
    // Show channel distribution by state
    const stateCount = {};
    results.channels.forEach(channel => {
      const state = channel.stateText;
      stateCount[state] = (stateCount[state] || 0) + 1;
    });
    
    console.log('📊 CHANNEL STATE DISTRIBUTION:');
    console.log('==============================');
    Object.entries(stateCount).forEach(([state, count]) => {
      console.log(`${state}: ${count} channels`);
    });
    
    // Show channel distribution by context
    const contextCount = {};
    results.channels.forEach(channel => {
      const context = channel.context;
      contextCount[context] = (contextCount[context] || 0) + 1;
    });
    
    console.log('\n📋 CHANNEL CONTEXT DISTRIBUTION:');
    console.log('================================');
    Object.entries(contextCount).forEach(([context, count]) => {
      console.log(`${context}: ${count} channels`);
    });
    
    // Show channels by application
    const appCount = {};
    results.channels.forEach(channel => {
      const app = channel.application || 'No Application';
      appCount[app] = (appCount[app] || 0) + 1;
    });
    
    console.log('\n📱 CHANNEL APPLICATION DISTRIBUTION:');
    console.log('===================================');
    Object.entries(appCount).forEach(([app, count]) => {
      console.log(`${app}: ${count} channels`);
    });
    
  } else {
    console.log('\n📞 No active channels found');
    console.log('   - All calls may have ended');
    console.log('   - Asterisk may be idle');
    console.log('   - Check if phones are registered');
  }
};

/**
 * Main execution function
 */
const main = async () => {
  try {
    console.log('🎯 AMI Active Channels Query Script Starting...\n');
    
    // Validate configuration
    if (!AMI_CONFIG.host || !AMI_CONFIG.port || !AMI_CONFIG.username || !AMI_CONFIG.password) {
      throw new Error('Missing AMI configuration. Check .env file.');
    }
    
    console.log('🔧 Configuration:');
    console.log(`   AMI Host: ${AMI_CONFIG.host}`);
    console.log(`   AMI Port: ${AMI_CONFIG.port}`);
    console.log(`   Username: ${AMI_CONFIG.username}`);
    console.log(`   Timeout: ${QUERY_TIMEOUT}ms`);
    console.log(`   Query: CoreShowChannels (Events: OFF)\n`);
    
    // Execute query
    const results = await queryActiveChannels();
    
    // Display results in console
    displayActiveChannels(results);
    
    console.log('\n✅ Active channels query completed successfully!');
    console.log('\n🏆 BENEFITS:');
    console.log('   📞 Real-time channel data from Asterisk');
    console.log('   🔄 Independent AMI connection');
    console.log('   🛡️  No interference with call monitoring');
    console.log('   ⚡ Fast standalone execution');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Script failed:', error.message);
    console.error('Stack trace:', error.stack);
    
    if (error.message.includes('AMI') || error.message.includes('connect') || error.message.includes('Authentication')) {
      console.error('\n🔌 AMI Connection Issue:');
      console.error('   - Check if Asterisk is running');
      console.error('   - Verify AMI credentials in environment variables');
      console.error('   - Check network connectivity to Asterisk server');
      console.error('   - Ensure AMI is enabled in manager.conf');
      console.error('   - Verify CoreShowChannels permission in AMI user configuration');
    }
    
    process.exit(1);
  }
};

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Script interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Script terminated');
  process.exit(1);
});

// Execute main function
main();