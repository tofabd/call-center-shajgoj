#!/usr/bin/env node

/**
 * Debug AMI Authentication
 * Tests the raw AMI connection and authentication to see what's happening
 */

import net from 'net';
import dotenv from 'dotenv';

dotenv.config();

const host = process.env.AMI_HOST || '103.177.125.83';
const port = parseInt(process.env.AMI_PORT) || 5038;
const username = process.env.AMI_USERNAME || 'admin';
const password = process.env.AMI_PASSWORD || 'Tractor@0152';

console.log('🔍 Debugging AMI Authentication');
console.log('='.repeat(50));
console.log(`Host: ${host}:${port}`);
console.log(`Username: ${username}`);
console.log(`Password: ${password}`);
console.log('='.repeat(50));

function testAmiConnection() {
  return new Promise((resolve, reject) => {
    console.log('🔌 Connecting to AMI...');
    
    const socket = net.createConnection(port, host);
    let responseData = '';
    
    socket.on('connect', () => {
      console.log('🔗 Connected to AMI server');
      
      const loginCmd = `Action: Login\r\nUsername: ${username}\r\nSecret: ${password}\r\nEvents: on\r\n\r\n`;
      console.log('📤 Sending login command:');
      console.log(loginCmd);
      
      socket.write(loginCmd);
    });
    
    socket.on('data', (data) => {
      responseData += data.toString();
      console.log('📥 Received data:', data.toString());
      
      // Check if we have a complete response
      if (responseData.includes('\r\n\r\n')) {
        console.log('\n📋 Complete response:');
        console.log(responseData);
        
        if (responseData.includes('Response: Success')) {
          console.log('✅ Authentication successful!');
          socket.end();
          resolve(true);
        } else if (responseData.includes('Response: Error')) {
          console.log('❌ Authentication failed');
          console.log('Response analysis:');
          
          const lines = responseData.split('\r\n');
          lines.forEach(line => {
            if (line.trim()) {
              console.log(`  ${line}`);
            }
          });
          
          socket.end();
          reject(new Error('Authentication failed'));
        } else {
          // Wait a bit more for the response
          console.log('⏳ Waiting for complete response...');
        }
      }
    });
    
    socket.on('error', (error) => {
      console.error('❌ Socket error:', error.message);
      reject(error);
    });
    
    socket.on('close', () => {
      console.log('🔌 Connection closed');
    });
    
    // Timeout after 15 seconds
    setTimeout(() => {
      console.log('⏰ Connection timeout - final response:');
      console.log(responseData);
      
      if (responseData.includes('Response: Success')) {
        console.log('✅ Authentication successful!');
        socket.end();
        resolve(true);
      } else if (responseData.includes('Response: Error')) {
        console.log('❌ Authentication failed');
        socket.end();
        reject(new Error('Authentication failed'));
      } else {
        console.log('❓ No clear response received');
        socket.end();
        reject(new Error('No clear response received'));
      }
    }, 15000);
  });
}

async function main() {
  try {
    await testAmiConnection();
    console.log('\n🎉 Authentication test completed successfully!');
  } catch (error) {
    console.error('\n💥 Authentication test failed:', error.message);
    
    // Try with Events: off
    console.log('\n🔄 Trying with Events: off...');
    try {
      await testAmiConnectionWithEventsOff();
    } catch (secondError) {
      console.error('❌ Second attempt also failed:', secondError.message);
    }
  }
}

function testAmiConnectionWithEventsOff() {
  return new Promise((resolve, reject) => {
    console.log('🔌 Connecting to AMI with Events: off...');
    
    const socket = net.createConnection(port, host);
    let responseData = '';
    
    socket.on('connect', () => {
      console.log('🔗 Connected to AMI server');
      
      const loginCmd = `Action: Login\r\nUsername: ${username}\r\nSecret: ${password}\r\nEvents: off\r\n\r\n`;
      console.log('📤 Sending login command with Events: off:');
      console.log(loginCmd);
      
      socket.write(loginCmd);
    });
    
    socket.on('data', (data) => {
      responseData += data.toString();
      console.log('📥 Received data:', data.toString());
      
      if (responseData.includes('\r\n\r\n')) {
        console.log('\n📋 Complete response with Events: off:');
        console.log(responseData);
        
        if (responseData.includes('Response: Success')) {
          console.log('✅ Authentication successful with Events: off!');
          socket.end();
          resolve(true);
        } else {
          console.log('❌ Authentication failed with Events: off');
          socket.end();
          reject(new Error('Authentication failed with Events: off'));
        }
      }
    });
    
    socket.on('error', (error) => {
      console.error('❌ Socket error:', error.message);
      reject(error);
    });
    
    socket.on('close', () => {
      console.log('🔌 Connection closed');
    });
    
    setTimeout(() => {
      console.log('⏰ Connection timeout');
      socket.end();
      reject(new Error('Connection timeout'));
    }, 10000);
  });
}

main().then(() => {
  console.log('\n🏁 Debug script finished');
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 Unexpected error:', error.message);
  process.exit(1);
});
