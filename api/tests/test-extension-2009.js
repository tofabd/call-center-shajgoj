#!/usr/bin/env node

import net from 'net';
import fs from 'fs';
import path from 'path';

class Extension2009Tester {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.events = [];
    this.extensionStateResponse = null;
    this.startTime = new Date();
    
    // Create logs directory if it doesn't exist
    this.logsDir = './ami-logs';
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
    
    // Generate unique filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.logFile = path.join(this.logsDir, `extension-2009-test-${timestamp}.json`);
  }

  connect(host, port, username, password) {
    return new Promise((resolve, reject) => {
      console.log(`🔌 Connecting to Asterisk AMI at ${host}:${port}...`);
      
      this.socket = net.createConnection(port, host);

      this.socket.on('connect', () => {
        console.log('🔗 Connected to Asterisk AMI');
        this.login(username, password)
          .then(() => {
            console.log('✅ AMI Authentication successful');
            this.connected = true;
            this.setupEventListeners();
            resolve();
          })
          .catch(reject);
      });

      this.socket.on('error', (error) => {
        console.error('❌ AMI Socket error:', error.message);
        this.connected = false;
        if (!this.socket.connecting) {
          reject(error);
        }
      });

      this.socket.on('close', () => {
        console.log('🔌 AMI Connection closed');
        this.connected = false;
      });

      this.socket.on('end', () => {
        console.log('🔌 AMI Connection ended');
        this.connected = false;
      });
    });
  }

  login(username, password) {
    return new Promise((resolve, reject) => {
      const loginCmd = `Action: Login\r\nUsername: ${username}\r\nSecret: ${password}\r\nEvents: on\r\n\r\n`;
      
      console.log('🔐 Sending login command...');
      console.log('📤 Login command sent:');
      console.log(loginCmd);
      
      this.socket.write(loginCmd);
      
      // Wait for complete response
      let responseData = '';
      const dataHandler = (data) => {
        responseData += data.toString();
        
        // Check if we have a complete response (ends with double newline)
        if (responseData.includes('\r\n\r\n')) {
          this.socket.removeListener('data', dataHandler);
          console.log('📥 Login response received');
          console.log('📋 Response content:');
          console.log(responseData);
          
          // Store login response
          this.events.push({
            type: 'LoginResponse',
            timestamp: new Date().toISOString(),
            command: 'Action: Login',
            response: responseData
          });
          
          // Check for successful authentication
          if (responseData.includes('Response: Success') || responseData.includes('Message: Authentication accepted')) {
            resolve();
          } else {
            console.error('❌ Authentication failed. Response:', responseData);
            reject(new Error('Authentication failed'));
          }
        }
      };
      
      this.socket.on('data', dataHandler);
      
      // Timeout after 10 seconds
      setTimeout(() => {
        this.socket.removeListener('data', dataHandler);
        reject(new Error('Authentication timeout'));
      }, 10000);
    });
  }

  setupEventListeners() {
    console.log('👂 Setting up event listeners...');
    
    this.socket.on('data', (data) => {
      const response = data.toString();
      
      // Store all received data as events
      this.events.push({
        type: 'RawResponse',
        timestamp: new Date().toISOString(),
        data: response
      });
      
      console.log('\n📥 Raw response received:');
      console.log('========================');
      console.log(response);
      
      // Check for ExtensionState response
      if (response.includes('Response: Success') && response.includes('ActionID: action-id-2009')) {
        console.log('\n📊 ExtensionState Response Received:');
        console.log('====================================');
        this.parseExtensionState(response);
        this.extensionStateResponse = response;
      }
      
      // Check for ExtensionStatus event for extension 2009
      if (response.includes('Event: ExtensionStatus') && response.includes('Exten: 2009')) {
        console.log('\n📱 ExtensionStatus Event for 2009:');
        console.log('===================================');
        this.parseExtensionStatus(response);
      }
      
      // Check for error responses
      if (response.includes('Response: Error')) {
        console.log('\n❌ Error Response Received:');
        console.log('===========================');
        this.parseErrorResponse(response);
      }
    });
  }

  parseExtensionState(response) {
    const lines = response.split('\r\n');
    const responseData = {};
    
    lines.forEach(line => {
      if (line.includes(':')) {
        const [key, ...valueParts] = line.split(':');
        const value = valueParts.join(':').trim();
        responseData[key] = value;
      }
    });
    
    console.log('Response:', responseData.Response);
    console.log('ActionID:', responseData.ActionID);
    console.log('Extension:', responseData.Exten);
    console.log('Context:', responseData.Context);
    console.log('Status:', responseData.Status);
    console.log('Status Text:', responseData.StatusText);
    
    if (responseData.Response === 'Success') {
      if (responseData.Exten && responseData.Status) {
        console.log('✅ ExtensionState command successful with data');
      } else {
        console.log('⚠️ ExtensionState command successful but no extension data returned');
        console.log('This might mean extension 2009 does not exist in the specified context');
      }
    }
  }

  parseExtensionStatus(response) {
    const lines = response.split('\r\n');
    const eventData = {};
    
    lines.forEach(line => {
      if (line.includes(':')) {
        const [key, ...valueParts] = line.split(':');
        const value = valueParts.join(':').trim();
        eventData[key] = value;
      }
    });
    
    console.log('Event Type:', eventData.Event);
    console.log('Extension:', eventData.Exten);
    console.log('Context:', eventData.Context);
    console.log('Status:', eventData.Status);
    console.log('Status Text:', eventData.StatusText);
    console.log('Hint:', eventData.Hint);
  }

  parseErrorResponse(response) {
    const lines = response.split('\r\n');
    const errorData = {};
    
    lines.forEach(line => {
      if (line.includes(':')) {
        const [key, ...valueParts] = line.split(':');
        const value = valueParts.join(':').trim();
        errorData[key] = value;
      }
    });
    
    console.log('Response:', errorData.Response);
    console.log('ActionID:', errorData.ActionID);
    console.log('Message:', errorData.Message);
  }

  checkExtension2009() {
    if (!this.connected) {
      console.log('❌ Not connected to AMI');
      return;
    }
    
    console.log('\n📱 Checking status for extension 2009 in context from-internal...');
    
    // Send ExtensionState command exactly as specified
    const cmd = `Action: ExtensionState\r\nActionID: action-id-2009\r\nExten: 2009\r\nContext: from-internal\r\n\r\n`;
    
    console.log('📤 ExtensionState command sent:');
    console.log(cmd);
    
    this.socket.write(cmd);
    
    // Store the command sent
    this.events.push({
      type: 'ExtensionStateCommand',
      timestamp: new Date().toISOString(),
      command: cmd
    });
    
    console.log('⏳ Waiting for response...');
  }

  logoff() {
    if (!this.connected) {
      console.log('❌ Not connected to AMI');
      return;
    }
    
    console.log('\n🚪 Sending Logoff command...');
    const cmd = `Action: Logoff\r\n\r\n`;
    
    console.log('📤 Logoff command sent:');
    console.log(cmd);
    
    this.socket.write(cmd);
    
    // Store the command sent
    this.events.push({
      type: 'LogoffCommand',
      timestamp: new Date().toISOString(),
      command: cmd
    });
    
    // Wait a moment for response then close
    setTimeout(() => {
      console.log('🔌 Closing connection...');
      this.saveEventsToFile();
      this.socket.end();
      process.exit(0);
    }, 2000);
  }

  saveEventsToFile() {
    try {
      const endTime = new Date();
      const duration = endTime - this.startTime;
      
      const dataToSave = {
        testInfo: {
          description: 'Extension 2009 Status Test',
          startTime: this.startTime.toISOString(),
          endTime: endTime.toISOString(),
          duration: `${duration}ms`,
          commands: [
            'Action: Login',
            'Action: ExtensionState',
            'Action: Logoff'
          ]
        },
        connection: {
          host: '103.177.125.83',
          port: 5038,
          username: 'admin'
        },
        events: this.events,
        summary: {
          totalEvents: this.events.length,
          extensionStateResponse: this.extensionStateResponse ? 'Received' : 'Not Received',
          extensionStatusEvents: this.events.filter(e => e.type === 'RawResponse' && e.data.includes('Event: ExtensionStatus') && e.data.includes('Exten: 2009')).length
        }
      };

      // Save as JSON
      fs.writeFileSync(this.logFile, JSON.stringify(dataToSave, null, 2));
      
      console.log(`\n💾 Test results saved to: ${this.logFile}`);
      console.log(`📊 Total events captured: ${this.events.length}`);
      
    } catch (error) {
      console.error('❌ Error saving events:', error.message);
    }
  }

  async run() {
    try {
      console.log('🧪 Starting Extension 2009 Test...');
      console.log('=====================================');
      
      // Connect using the provided credentials
      await this.connect('103.177.125.83', 5038, 'admin', 'Tractor@0152');
      
      // Wait a moment for connection to stabilize
      setTimeout(() => {
        // Check extension 2009 status
        this.checkExtension2009();
        
        // Wait for response then logoff
        setTimeout(() => {
          console.log('\n⏰ Timeout reached, proceeding to logoff...');
          this.logoff();
        }, 10000); // 10 second timeout
      }, 1000);
      
    } catch (error) {
      console.error('❌ Failed to connect to AMI:', error.message);
      this.saveEventsToFile();
      process.exit(1);
    }
  }
}

// Main execution
const tester = new Extension2009Tester();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  if (tester.socket) {
    tester.socket.end();
  }
  tester.saveEventsToFile();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  if (tester.socket) {
    tester.socket.end();
  }
  tester.saveEventsToFile();
  process.exit(0);
});

// Run the test
tester.run();
