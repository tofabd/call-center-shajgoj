#!/usr/bin/env node

/**
 * getExtension.js - Single Extension AMI Query Script
 * 
 * This script creates a direct AMI connection to query a single extension
 * from Asterisk using ExtensionState action
 * Saves results to JSON files for analysis - both raw and parsed data
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
const OUTPUT_DIR = path.join(projectRoot, 'debug', 'getExtension');

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

// Parse command line arguments
const parseArgs = () => {
  const args = process.argv.slice(2);
  let extension = null;
  
  for (const arg of args) {
    if (arg.startsWith('--exten=')) {
      extension = arg.split('=')[1];
      break;
    }
  }
  
  if (!extension) {
    console.error('❌ Usage: node getExtension.js --exten=1002');
    console.error('   Example: node getExtension.js --exten=1001');
    console.error('   Example: node getExtension.js --exten=1003');
    process.exit(1);
  }
  
  // Validate extension is numeric
  if (!/^\d+$/.test(extension)) {
    console.error(`❌ Invalid extension: ${extension}. Extension must be numeric.`);
    process.exit(1);
  }
  
  return extension;
};

/**
 * Query single extension via direct AMI connection
 */
const queryExtensionStatus = (extensionNumber) => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    let socket;
    let authenticated = false;
    let queryStarted = false;
    let queryCompleted = false;
    let buffer = '';
    
    // Data collection
    let extensionData = null;
    const allEvents = [];
    let eventCount = 0;
    
    console.log('🚀 Starting AMI Extension Query...');
    console.log(`🔌 Connecting to AMI: ${AMI_CONFIG.host}:${AMI_CONFIG.port}`);
    console.log(`👤 Username: ${AMI_CONFIG.username}`);
    console.log(`📞 Target Extension: ${extensionNumber}`);
    
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
            
            // Send ExtensionState query for specific extension
            const query = [
              'Action: ExtensionState',
              `Exten: ${extensionNumber}`,
              'Context: ext-local',
              `ActionID: ExtQueryScript-${Date.now()}`,
              '', // Empty line to end the action
              ''  // Double CRLF
            ].join('\r\n');
            
            console.log('📡 Sending ExtensionState query...');
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
        
        // Handle ExtensionState response - look for ActionID match
        if (queryStarted && event.ActionID && event.ActionID.startsWith('ExtQueryScript-')) {
          if (event.Response === 'Success') {
            // The status is in the Status field
            const statusCode = event.Status;
            const statusText = event.StatusText || formatExtensionStatus(statusCode);
            
            console.log(`📋 Extension ${extensionNumber} found - Status: ${statusText} (${statusCode})`);
            
            extensionData = {
              extension: extensionNumber,
              context: event.Context || 'ext-local',
              status: statusCode || 'Unknown',
              statusText: statusText,
              statusCode: statusCode || 'Unknown',
              hint: event.Hint || null,
              receivedAt: new Date().toISOString(),
              rawResponse: message
            };
            
          } else if (event.Response === 'Error') {
            console.log(`❌ Extension ${extensionNumber} query failed: ${event.Message}`);
            
            extensionData = {
              extension: extensionNumber,
              context: 'ext-local',
              status: 'error',
              statusText: 'Query Failed',
              statusCode: null,
              hint: null,
              error: event.Message,
              receivedAt: new Date().toISOString(),
              rawResponse: message
            };
          }
          
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
              queryType: 'ExtensionState for single extension',
              targetExtension: extensionNumber
            },
            summary: {
              totalEvents: eventCount,
              querySuccessful: extensionData && !extensionData.error,
              extensionFound: extensionData && !extensionData.error,
              queryDuration: duration
            },
            extensionData: extensionData,
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
const saveResultsToFile = (results, extensionNumber) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // 1. Create raw data (all raw events and responses)
    const rawData = {
      metadata: results.metadata,
      summary: results.summary,
      rawEvents: results.rawEvents
    };
    
    // Create directory
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    
    const rawFilename = `getExtension-${extensionNumber}-raw-${timestamp}.json`;
    const rawFilepath = path.join(OUTPUT_DIR, rawFilename);
    const rawJsonContent = JSON.stringify(rawData, null, 2);
    fs.writeFileSync(rawFilepath, rawJsonContent, 'utf8');
    
    // 2. Create parsed extension data
    const parsedData = {
      metadata: {
        extractedAt: new Date().toISOString(),
        targetExtension: extensionNumber,
        extractionCriteria: `Single extension ${extensionNumber} in ext-local context`,
        sourceQuery: results.metadata.queryType,
        sourceTimestamp: results.metadata.queryEndTime
      },
      extensionData: results.extensionData ? {
        extension: results.extensionData.extension,
        status: results.extensionData.statusText,
        statusCode: results.extensionData.statusCode !== 'Unknown' ? parseInt(results.extensionData.statusCode) : null,
        context: results.extensionData.context,
        hint: results.extensionData.hint,
        error: results.extensionData.error || null,
        queryTime: results.summary.queryDuration
      } : null
    };
    
    // Save parsed data
    const parsedFilename = `getExtension-${extensionNumber}-parsed-${timestamp}.json`;
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
 * Display extension status result
 */
const displayExtensionResult = (results) => {
  console.log('\n📊 EXTENSION STATUS RESULT');
  console.log('='.repeat(60));
  
  const extensionData = results.extensionData;
  
  if (extensionData && extensionData.error) {
    console.log(`❌ Extension ${extensionData.extension}: Query failed`);
    console.log(`   Error: ${extensionData.error}`);
    console.log(`   Query Duration: ${results.metadata.queryDuration}`);
  } else if (extensionData) {
    console.log(`✅ Extension ${extensionData.extension}: Status retrieved successfully`);
    console.log(`   Status: ${extensionData.statusText}`);
    if (extensionData.statusCode !== 'Unknown') {
      console.log(`   Status Code: ${extensionData.statusCode}`);
    }
    console.log(`   Context: ${extensionData.context}`);
    if (extensionData.hint) {
      console.log(`   Hint: ${extensionData.hint}`);
    }
    console.log(`   Query Duration: ${results.metadata.queryDuration}`);
  } else {
    console.log(`❌ Extension ${results.metadata.targetExtension}: No data received`);
    console.log(`   Query Duration: ${results.metadata.queryDuration}`);
  }
  
  console.log('='.repeat(60));
  
  // Structured output for programmatic use
  const structuredResult = {
    extension: results.metadata.targetExtension,
    status: extensionData ? extensionData.statusText : null,
    statusCode: extensionData && extensionData.statusCode !== 'Unknown' ? extensionData.statusCode : null,
    context: extensionData ? extensionData.context : null,
    hint: extensionData ? extensionData.hint : null,
    error: extensionData ? extensionData.error : null,
    queryDuration: results.summary.queryDuration,
    timestamp: new Date().toISOString(),
    querySuccessful: results.summary.querySuccessful
  };
  
  console.log('\n📋 Structured Result (JSON):');
  console.log(JSON.stringify(structuredResult, null, 2));
};

/**
 * Main execution function
 */
const main = async () => {
  try {
    console.log('🎯 AMI Single Extension Query Script Starting...\n');
    
    // Parse command line arguments
    const extensionNumber = parseArgs();
    console.log(`📞 Target Extension: ${extensionNumber}`);
    
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
    const results = await queryExtensionStatus(extensionNumber);
    
    // Display results
    displayExtensionResult(results);
    
    // Save to files
    const fileInfo = saveResultsToFile(results, extensionNumber);
    
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
    
    // Provide specific guidance based on failure type
    if (error.message.includes('AMI') || error.message.includes('connect') || error.message.includes('Authentication')) {
      console.error('\n🔌 AMI Connection Issue:');
      console.error('   - Check if Asterisk is running');
      console.error('   - Verify AMI credentials in environment variables:');
      console.error(`     AMI_HOST=${process.env.AMI_HOST || 'NOT SET'}`);
      console.error(`     AMI_PORT=${process.env.AMI_PORT || 'NOT SET'}`);
      console.error(`     AMI_USERNAME=${process.env.AMI_USERNAME || 'NOT SET'}`);
      console.error(`     AMI_PASSWORD=${process.env.AMI_PASSWORD ? '[SET]' : 'NOT SET'}`);
      console.error('   - Check network connectivity to Asterisk server');
      console.error('   - Verify AMI port configuration (default: 5038)');
      console.error('   - Ensure AMI is enabled in manager.conf');
    } else {
      console.error('\n❓ Unknown Issue:');
      console.error('   - Check all environment variables are set correctly');
      console.error('   - Verify all dependencies are installed');
      console.error('   - Check log files for additional details');
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