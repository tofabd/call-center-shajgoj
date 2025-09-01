#!/usr/bin/env node

/**
 * standaloneRefresh.js - Standalone AMI Extension Status Refresh
 * 
 * This script creates a separate AMI connection to query all extensions
 * from Asterisk using ExtensionStateList with Events: off
 * Compares with database extensions and updates changed statuses
 * Marks missing extensions offline and returns summary statistics
 */

import net from 'net';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Extension from '../src/models/Extension.js';

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
const QUERY_TIMEOUT = 15000; // 15 seconds timeout

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
 * Create JSON file with parsed extension data for manual refresh
 */
const createParsedExtensionsJsonFile = async (parsedExtensions, connectionId) => {
  try {
    // Create debug directory if it doesn't exist
    const debugDir = path.join(process.cwd(), 'debug', 'parsed-extensions');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    
    // Create filename with timestamp and connection ID
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `parsed-extensions-${timestamp}-${connectionId}.json`;
    const filepath = path.join(debugDir, filename);
    
    // Prepare JSON data with parsed extensions and metadata
    const jsonData = {
      metadata: {
        refreshTimestamp: new Date().toISOString(),
        connectionId: connectionId,
        amiHost: process.env.AMI_HOST,
        amiPort: process.env.AMI_PORT,
        generatedAt: new Date().toISOString(),
        note: "This file contains PARSED extension data from AMI ExtensionStateList query",
        queryType: "ExtensionStateList with Events: off",
        totalExtensions: parsedExtensions.length
      },
      parsedExtensions: parsedExtensions.map(ext => ({
        extension: ext.extension,
        statusCode: ext.statusCode,
        deviceState: ext.deviceState,
        context: ext.context,
        statusLabel: ext.deviceState,
        onlineStatus: mapStatusCode(ext.statusCode)
      })),
      summary: {
        totalParsed: parsedExtensions.length,
        byDeviceState: parsedExtensions.reduce((acc, ext) => {
          acc[ext.deviceState] = (acc[ext.deviceState] || 0) + 1;
          return acc;
        }, {}),
        byStatusCode: parsedExtensions.reduce((acc, ext) => {
          acc[ext.statusCode] = (acc[ext.statusCode] || 0) + 1;
          return acc;
        }, {}),
        onlineCount: parsedExtensions.filter(ext => ext.statusCode !== 4).length,
        offlineCount: parsedExtensions.filter(ext => ext.statusCode === 4).length
      }
    };
    
    // Write JSON file
    fs.writeFileSync(filepath, JSON.stringify(jsonData, null, 2));
    
    console.log(`📄 Parsed extensions JSON file created: ${filepath}`);
    
    return {
      filename: filename,
      filepath: filepath,
      fileSize: fs.statSync(filepath).size,
      extensionCount: parsedExtensions.length
    };
    
  } catch (error) {
    console.error('❌ Failed to create parsed extensions JSON file:', error.message);
    return null;
  }
};

/**
 * Map status code to online/offline/unknown (matches Extension model)
 */
const mapStatusCode = (statusCode) => {
  const statusMap = {
    0: 'online',    // NotInUse
    1: 'online',    // InUse
    2: 'online',    // Busy
    4: 'offline',   // Unavailable
    8: 'online',    // Ringing
    16: 'online',   // Ringinuse
    '-1': 'unknown' // Unknown
  };
  return statusMap[statusCode] || 'unknown';
};

/**
 * Map Asterisk device state to our device_state enum
 */
const mapDeviceState = (statusCode) => {
  // Ensure statusCode is treated as string for mapping
  const statusStr = String(statusCode);
  
  const deviceStateMap = {
    '-1': 'UNKNOWN',
    '0': 'NOT_INUSE',
    '1': 'INUSE', 
    '2': 'BUSY',
    '4': 'UNAVAILABLE',
    '8': 'RINGING',
    '16': 'RING*INUSE'
  };
  
  const result = deviceStateMap[statusStr] || 'UNKNOWN';
  console.log(`🔍 Device mapping: statusCode "${statusCode}" (${typeof statusCode}) → "${result}"`);
  return result;
};

/**
 * Query all extensions from AMI using ExtensionStateList
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
    
    console.log('🚀 Starting AMI Extension Status Refresh...');
    console.log(`🔌 Connecting to AMI: ${AMI_CONFIG.host}:${AMI_CONFIG.port}`);
    
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
        
        // Handle authentication response
        if (!authenticated && message.includes('Authentication')) {
          if (message.includes('accepted')) {
            console.log('🔐 Authentication successful');
            authenticated = true;
            
            // Send ExtensionStateList query with Events: off
            const query = [
              'Action: ExtensionStateList',
              'Events: off',
              `ActionID: RefreshScript-${Date.now()}`,
              '', // Empty line to end the action
              ''  // Double CRLF
            ].join('\r\n');
            
            console.log('📡 Sending ExtensionStateList query...');
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
            // Filter for 3-5 digit extensions in ext-local context
            if (/^\d{3,5}$/.test(event.Exten) && event.Context === 'ext-local') {
              console.log(`📋 Extension found: ${event.Exten} - Status: "${event.Status}" (${typeof event.Status})`);
              
              const statusNum = parseInt(event.Status);
              const extensionData = {
                extension: event.Exten,
                statusCode: isNaN(statusNum) ? -1 : statusNum,
                deviceState: mapDeviceState(event.Status),
                context: event.Context,
                rawStatus: event.Status // Keep original for debugging
              };
              
              extensions.push(extensionData);
            }
            
          } else if (event.Event === 'ExtensionStateListComplete') {
            console.log('✅ ExtensionStateListComplete received - Query completed');
            queryCompleted = true;
            
            // Send logoff before closing
            console.log('👋 Sending AMI Logoff...');
            const logoffAction = [
              'Action: Logoff',
              '', // Empty line to end the action
              ''  // Double CRLF
            ].join('\r\n');
            socket.write(logoffAction);
            
            // Small delay to ensure logoff is sent before closing
            setTimeout(() => {
              clearTimeout(timeout);
              socket.destroy();
              resolve(extensions);
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
 * Connect to MongoDB database (reuse existing connection if available)
 */
const connectDatabase = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/call_center';
    console.log('🗄️ Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Database connected successfully');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    throw error;
  }
};

/**
 * Update database extensions with AMI data - Creates missing extensions automatically
 */
const updateDatabaseExtensions = async (amiExtensions) => {
  const stats = {
    updated: 0,
    unchanged: 0,
    created: 0,
    errors: 0,
    markedOffline: 0
  };
  
  console.log('\n📊 Starting database updates with auto-creation...');
  
  // 1. Update or create extensions found in AMI
  for (const amiExt of amiExtensions) {
    try {
      const dbExtension = await Extension.findOne({ 
        extension: amiExt.extension
      });
      
      if (!dbExtension) {
        // Extension not found - create new one
        const newExt = await Extension.createOrUpdateFromAMI(
          amiExt.extension,
          amiExt.statusCode,
          amiExt.deviceState
        );
        
        if (newExt) {
          console.log(`✨ Created new extension ${amiExt.extension}: ${amiExt.statusCode}/${amiExt.deviceState}`);
          stats.created++;
        } else {
          stats.errors++;
        }
        continue;
      }
      
      // Extension exists - check if active
      if (!dbExtension.is_active) {
        console.log(`🚫 Extension ${amiExt.extension} is inactive - skipping update`);
        continue;
      }
      
      // Check if status actually changed
      const statusChanged = (
        dbExtension.status_code !== amiExt.statusCode ||
        dbExtension.device_state !== amiExt.deviceState
      );
      
      if (statusChanged) {
        const updatedExt = await Extension.updateStatus(
          amiExt.extension,
          amiExt.statusCode,
          amiExt.deviceState
        );
        
        if (updatedExt) {
          console.log(`✅ Updated ${amiExt.extension}: ${dbExtension.status_code}→${amiExt.statusCode} (${dbExtension.device_state}→${amiExt.deviceState})`);
          stats.updated++;
        } else {
          stats.errors++;
        }
      } else {
        console.log(`📝 Extension ${amiExt.extension}: No change (${amiExt.statusCode}/${amiExt.deviceState})`);
        stats.unchanged++;
        
        // Still update last_seen timestamp even if status unchanged
        await Extension.findOneAndUpdate(
          { extension: amiExt.extension },
          { last_seen: new Date() },
          { new: true }
        );
      }
      
    } catch (error) {
      console.error(`❌ Error processing extension ${amiExt.extension}:`, error.message);
      stats.errors++;
    }
  }
  
  // 2. Mark extensions as offline if they exist in DB but not in AMI response
  try {
    const amiExtensionNumbers = amiExtensions.map(ext => ext.extension);
    const dbExtensions = await Extension.find({ 
      is_active: true,
      extension: { $not: { $in: amiExtensionNumbers } },
      status: { $ne: 'offline' } // Only update if not already offline
    });
    
    for (const dbExt of dbExtensions) {
      await Extension.updateStatus(dbExt.extension, 4, 'UNAVAILABLE'); // Status code 4 = Unavailable
      console.log(`🔴 Marked ${dbExt.extension} as offline (not found in AMI)`);
      stats.markedOffline++;
    }
    
  } catch (error) {
    console.error('❌ Error marking missing extensions offline:', error.message);
    stats.errors++;
  }
  
  return stats;
};

/**
 * Main refresh function that can be called from other scripts
 */
export const performExtensionRefresh = async () => {
  const startTime = Date.now();
  let createdConnection = false;
  
  try {
    console.log('🎯 Extension Status Refresh Starting...\n');
    
    // Validate AMI configuration
    if (!AMI_CONFIG.host || !AMI_CONFIG.port || !AMI_CONFIG.username || !AMI_CONFIG.password) {
      throw new Error('Missing AMI configuration. Check .env file.');
    }
    
    // Connect to database (reuse existing if available)
    if (mongoose.connection.readyState === 1) {
      console.log('✅ Reusing existing MongoDB connection');
    } else {
      await connectDatabase();
      createdConnection = true;
    }
    
    // Query AMI for current extension states
    const amiExtensions = await queryAllExtensions();
    console.log(`\n📞 Found ${amiExtensions.length} real extensions in AMI`);
    
    // Save parsed AMI extensions to JSON file
    const connectionId = `refresh-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const amiJsonFile = await createParsedExtensionsJsonFile(amiExtensions, connectionId);
    
    // Update database with AMI data
    const updateStats = await updateDatabaseExtensions(amiExtensions);
    
    // Calculate final statistics
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    const results = {
      success: true,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
      amiExtensions: amiExtensions.length,
      created: updateStats.created,
      updated: updateStats.updated,
      unchanged: updateStats.unchanged,
      markedOffline: updateStats.markedOffline,
      errors: updateStats.errors,
      totalProcessed: amiExtensions.length + updateStats.markedOffline,
      jsonFile: amiJsonFile ? {
        filename: amiJsonFile.filename,
        filepath: amiJsonFile.filepath,
        fileSize: amiJsonFile.fileSize,
        extensionCount: amiJsonFile.extensionCount
      } : null
    };
    
    console.log('\n📊 REFRESH SUMMARY');
    console.log('==================');
    console.log(`⏱️  Duration: ${results.duration}`);
    console.log(`📞 AMI Extensions Found: ${results.amiExtensions}`);
    console.log(`✨ Created: ${results.created}`);
    console.log(`✅ Updated: ${results.updated}`);
    console.log(`📝 Unchanged: ${results.unchanged}`);
    console.log(`🔴 Marked Offline: ${results.markedOffline}`);
    console.log(`❌ Errors: ${results.errors}`);
    console.log(`📊 Total Processed: ${results.totalProcessed}`);
    if (amiJsonFile) {
      console.log(`📄 JSON File: ${amiJsonFile.filename} (${amiJsonFile.extensionCount} extensions)`);
    }
    
    // Close database connection only if we created it
    if (createdConnection && mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('🔌 Database disconnected (created by refresh script)');
    } else {
      console.log('🔌 Keeping existing database connection open');
    }
    
    return results;
    
  } catch (error) {
    console.error('\n❌ Refresh failed:', error.message);
    
    // Ensure database is disconnected on error (only if we created the connection)
    if (createdConnection && mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      duration: `${Date.now() - startTime}ms`
    };
  }
};

/**
 * Main execution function (when run directly)
 */
const main = async () => {
  try {
    const results = await performExtensionRefresh();
    
    if (results.success) {
      console.log('\n✅ Extension refresh completed successfully!');
      process.exit(0);
    } else {
      console.log('\n❌ Extension refresh failed!');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ Script failed:', error.message);
    process.exit(1);
  }
};

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Script interrupted by user');
  mongoose.disconnect().finally(() => process.exit(1));
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Script terminated');
  mongoose.disconnect().finally(() => process.exit(1));
});

// Execute main function only if run directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}