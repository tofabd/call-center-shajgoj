#!/usr/bin/env node

/**
 * getAllExtensions.js - Standalone AMI Extension Query Script
 * 
 * This script creates a separate AMI connection to query all extensions
 * from Asterisk using ExtensionStateList with Events: off
 * Parses all extension events until ExtensionStateListComplete
 * Saves results to a JSON file for analysis
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
const OUTPUT_DIR = path.join(projectRoot, 'output', 'extensions');

/**
 * Create output directory if it doesn't exist
 */
const createOutputDirectory = () => {
  try {
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
      console.log(`📁 Created output directory: ${OUTPUT_DIR}`);
    }
  } catch (error) {
    console.error('❌ Failed to create output directory:', error.message);
    process.exit(1);
  }
};

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
 * Format extension status for better readability
 */
const formatExtensionStatus = (statusCode) => {
  const statusMap = {
    '-1': 'Extension Removed',
    '0': 'Idle',
    '1': 'In Use',
    '2': 'Busy',
    '4': 'Unavailable',
    '8': 'Ringing',
    '16': 'On Hold'
  };
  
  return statusMap[statusCode] || `Unknown (${statusCode})`;
};

/**
 * Main AMI Query Function
 */
const queryAllExtensions = () => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    let socket;
    let authenticated = false;
    let queryStarted = false;
    let queryCompleted = false;
    let buffer = '';
    
    // Data collection
    const extensions = [];
    const allEvents = [];
    let eventCount = 0;
    let extensionEventCount = 0;
    
    console.log('🚀 Starting AMI Extension Query Script...');
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
        
        console.log('📥 Received message:');
        console.log(message);
        console.log('---');
        
        const event = parseAmiEvent(message);
        allEvents.push({ raw: message, parsed: event, timestamp: new Date().toISOString() });
        eventCount++;
        
        // Handle authentication response
        if (!authenticated && message.includes('Authentication')) {
          if (message.includes('accepted')) {
            console.log('🔐 Authentication successful');
            authenticated = true;
            
            // Send ExtensionStateList query with Events: off
            const query = [
              'Action: ExtensionStateList',
              'Events: off',
              `ActionID: ExtQueryScript-${Date.now()}`,
              '', // Empty line to end the action
              ''  // Double CRLF
            ].join('\r\n');
            
            console.log('📡 Sending ExtensionStateList query...');
            console.log('Query:', query);
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
        
        // Handle ExtensionStateList events
        if (queryStarted && event.Event) {
          if (event.Event === 'ExtensionStatus') {
            console.log(`📋 Extension found: ${event.Exten} (${event.Context}) - Status: ${event.StatusText || event.Status}`);
            
            const extensionData = {
              extension: event.Exten || 'Unknown',
              context: event.Context || 'Unknown',
              status: event.Status || 'Unknown',
              statusText: event.StatusText || formatExtensionStatus(event.Status),
              statusCode: event.Status || 'Unknown',
              hint: event.Hint || null,
              receivedAt: new Date().toISOString(),
              rawEvent: message
            };
            
            extensions.push(extensionData);
            extensionEventCount++;
            
          } else if (event.Event === 'ExtensionStateListComplete') {
            console.log('✅ ExtensionStateListComplete received - Query completed');
            queryCompleted = true;
            
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
                queryType: 'ExtensionStateList with Events: off'
              },
              summary: {
                totalEvents: eventCount,
                extensionEvents: extensionEventCount,
                totalExtensions: extensions.length,
                querySuccessful: true,
                completionEventReceived: true
              },
              extensions: extensions,
              rawEvents: allEvents
            };
            
            clearTimeout(timeout);
            socket.destroy();
            resolve(results);
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
 * Save results to JSON files - both raw and parsed
 */
const saveResultsToFile = (results) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // 1. Create raw data (only raw events, no parsed extensions)
    const rawData = {
      metadata: results.metadata,
      summary: results.summary,
      rawEvents: results.rawEvents
    };
    
    const rawFilename = `extensions-raw-${timestamp}.json`;
    const rawFilepath = path.join(OUTPUT_DIR, rawFilename);
    const rawJsonContent = JSON.stringify(rawData, null, 2);
    fs.writeFileSync(rawFilepath, rawJsonContent, 'utf8');
    
    // 2. Create parsed extensions data
    const realExtensions = filterRealExtensions(results.extensions);
    const parsedData = {
      metadata: {
        extractedAt: new Date().toISOString(),
        totalRealExtensions: realExtensions.length,
        extractionCriteria: "3-5 digit extensions in ext-local context",
        sourceQuery: results.metadata.queryType,
        sourceTimestamp: results.metadata.queryEndTime
      },
      extensions: realExtensions.map(ext => ({
        extension: ext.extension,
        status: ext.statusText,
        statusCode: parseInt(ext.statusCode),
        context: ext.context
      }))
    };
    
    // Save parsed data
    const parsedFilename = `extensions-parsed-${timestamp}.json`;
    const parsedFilepath = path.join(OUTPUT_DIR, parsedFilename);
    const parsedJsonContent = JSON.stringify(parsedData, null, 2);
    fs.writeFileSync(parsedFilepath, parsedJsonContent, 'utf8');
    
    console.log('📄 Results saved to files:');
    console.log(`📁 Raw Data: ${rawFilepath}`);
    console.log(`📊 Raw Size: ${fs.statSync(rawFilepath).size} bytes`);
    console.log(`📁 Parsed Data: ${parsedFilepath}`);
    console.log(`📊 Parsed Size: ${fs.statSync(parsedFilepath).size} bytes`);
    
    return {
      rawFile: {
        filename: rawFilename,
        filepath: rawFilepath,
        fileSize: fs.statSync(rawFilepath).size
      },
      parsedFile: {
        filename: parsedFilename,
        filepath: parsedFilepath,
        fileSize: fs.statSync(parsedFilepath).size
      }
    };
    
  } catch (error) {
    console.error('❌ Failed to save results to file:', error.message);
    return null;
  }
};

/**
 * Filter real user extensions (3-5 digits)
 */
const filterRealExtensions = (extensions) => {
  return extensions
    .filter(ext => {
      // Filter for 3-5 digit extensions in ext-local context
      return /^\d{3,5}$/.test(ext.extension) && ext.context === 'ext-local';
    })
    .sort((a, b) => parseInt(a.extension) - parseInt(b.extension));
};

/**
 * Print summary to console
 */
const printSummary = (results) => {
  console.log('\n📊 QUERY SUMMARY');
  console.log('================');
  console.log(`⏱️  Query Duration: ${results.metadata.queryDuration}`);
  console.log(`📡 Total Events: ${results.summary.totalEvents}`);
  console.log(`📋 Extension Events: ${results.summary.extensionEvents}`);
  console.log(`📞 Total Extensions: ${results.summary.totalExtensions}`);
  console.log(`✅ Query Successful: ${results.summary.querySuccessful}`);
  console.log(`🏁 Completion Event: ${results.summary.completionEventReceived}`);
  
  // Filter and show real extensions only
  const realExtensions = filterRealExtensions(results.extensions);
  
  if (realExtensions.length > 0) {
    console.log('\n📞 REAL USER EXTENSIONS (3-5 digits):');
    console.log('====================================');
    
    realExtensions.forEach((ext, index) => {
      console.log(`${index + 1}. Extension: ${ext.extension}`);
      console.log(`   Status: ${ext.statusText}`);
      console.log(`   Status Code: ${ext.statusCode}`);
      console.log(`   Context: ${ext.context}`);
      console.log('');
    });
  }
  
  // Show status distribution for real extensions only
  const realStatusCounts = {};
  realExtensions.forEach(ext => {
    const status = ext.statusText;
    realStatusCounts[status] = (realStatusCounts[status] || 0) + 1;
  });
  
  console.log('📊 REAL EXTENSION STATUS DISTRIBUTION:');
  console.log('=====================================');
  Object.entries(realStatusCounts).forEach(([status, count]) => {
    console.log(`${status}: ${count}`);
  });
  
  console.log('\n📋 ALL EXTENSIONS BY CONTEXT:');
  console.log('=============================');
  const contextCounts = {};
  results.extensions.forEach(ext => {
    const context = ext.context;
    contextCounts[context] = (contextCounts[context] || 0) + 1;
  });
  
  Object.entries(contextCounts).forEach(([context, count]) => {
    console.log(`${context}: ${count} extensions`);
  });
};

/**
 * Main execution function
 */
const main = async () => {
  try {
    console.log('🎯 AMI Extensions Query Script Starting...\n');
    
    // Create output directory
    createOutputDirectory();
    
    // Validate configuration
    if (!AMI_CONFIG.host || !AMI_CONFIG.port || !AMI_CONFIG.username || !AMI_CONFIG.password) {
      throw new Error('Missing AMI configuration. Check .env file.');
    }
    
    console.log('🔧 Configuration:');
    console.log(`   AMI Host: ${AMI_CONFIG.host}`);
    console.log(`   AMI Port: ${AMI_CONFIG.port}`);
    console.log(`   Username: ${AMI_CONFIG.username}`);
    console.log(`   Timeout: ${QUERY_TIMEOUT}ms\n`);
    
    // Execute query
    const results = await queryAllExtensions();
    
    // Print summary
    printSummary(results);
    
    // Save to files
    const fileInfo = saveResultsToFile(results);
    
    if (fileInfo) {
      console.log('\n✅ Script completed successfully!');
      console.log(`📄 Raw data saved to: ${fileInfo.rawFile.filename}`);
      console.log(`📄 Parsed data saved to: ${fileInfo.parsedFile.filename}`);
    } else {
      console.log('\n⚠️  Script completed but failed to save results to files');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Script failed:', error.message);
    console.error('Stack trace:', error.stack);
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