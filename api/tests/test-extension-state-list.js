#!/usr/bin/env node

import net from 'net';
import fs from 'fs';
import path from 'path';

class ExtensionStateListTester {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.events = [];
    this.extensionStateListResponse = null;
    this.startTime = new Date();
    
    // Create logs directory if it doesn't exist
    this.logsDir = './ami-logs';
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
    
    // Generate unique filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.logFile = path.join(this.logsDir, `extension-state-list-test-${timestamp}.json`);
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
      
      console.log('\n📥 Raw response received:');
      console.log('========================');
      console.log(response);
      
      // Split the response into individual AMI events
      const events = this.splitAMIResponse(response);
      
      // Process each individual event
      events.forEach(eventData => {
        if (eventData.trim()) {
          // Store each individual event
          this.events.push({
            type: 'RawResponse',
            timestamp: new Date().toISOString(),
            data: eventData
          });
          
          // Check for ExtensionStateList response
          if (eventData.includes('Response: Success') && eventData.includes('EventList: start')) {
            console.log('\n📊 ExtensionStateList Response Started:');
            console.log('=======================================');
            this.parseExtensionStateListStart(eventData);
          }
          
          // Check for ExtensionStateList completion
          if (eventData.includes('EventList: Complete')) {
            console.log('\n✅ ExtensionStateList Response Completed:');
            console.log('==========================================');
            this.parseExtensionStateListComplete(eventData);
            this.extensionStateListResponse = 'Completed';
          }
          
          // Check for individual extension status events
          if (eventData.includes('Event: ExtensionStatus')) {
            console.log('\n📱 ExtensionStatus Event:');
            console.log('==========================');
            this.parseExtensionStatus(eventData);
          }
          
          // Check for error responses
          if (eventData.includes('Response: Error')) {
            console.log('\n❌ Error Response Received:');
            console.log('===========================');
            this.parseErrorResponse(eventData);
          }
        }
      });
    });
  }

  splitAMIResponse(response) {
    // Split by double newline to separate individual AMI events
    const events = response.split('\r\n\r\n');
    
    // Filter out empty events and clean up
    return events
      .map(event => event.trim())
      .filter(event => event.length > 0);
  }

  parseExtensionStateListStart(response) {
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
    console.log('EventList:', responseData.EventList);
    console.log('ListItems:', responseData.ListItems);
  }

  parseExtensionStateListComplete(response) {
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
    console.log('EventList:', responseData.EventList);
    console.log('ListItems:', responseData.ListItems);
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

  parseEventData(event) {
    if (event.type === 'RawResponse' && event.data) {
      const lines = event.data.split('\r\n');
      const parsedData = {};
      
      lines.forEach(line => {
        if (line.includes(':')) {
          const [key, ...valueParts] = line.split(':');
          const value = valueParts.join(':').trim();
          parsedData[key] = value;
        }
      });
      
      return parsedData;
    }
    
    return event;
  }

  cleanAMIData(data) {
    // Replace \r\n with \n for proper JSON formatting
    return data.replace(/\r\n/g, '\n');
  }

  getExtensionStateList() {
    if (!this.connected) {
      console.log('❌ Not connected to AMI');
      return;
    }
    
    console.log('\n📋 Getting ExtensionStateList...');
    
    // Send ExtensionStateList command exactly as specified
    const cmd = `Action: ExtensionStateList\r\n\r\n`;
    
    console.log('📤 ExtensionStateList command sent:');
    console.log(cmd);
    
    this.socket.write(cmd);
    
    // Store the command sent
    this.events.push({
      type: 'ExtensionStateListCommand',
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
      
      // Count different types of events
      const extensionStatusEvents = this.events.filter(e => 
        e.type === 'RawResponse' && e.data.includes('Event: ExtensionStatus')
      ).length;
      
      const systemEvents = this.events.filter(e => 
        e.type === 'RawResponse' && !e.data.includes('Event: ExtensionStatus') && 
        !e.data.includes('Response: Success') && !e.data.includes('Response: Error')
      ).length;
      
      // Process all events with cleaned data
      const processedEvents = this.events.map((event, index) => {
        const processedEvent = {
          eventNumber: index + 1,
          eventType: event.type,
          timestamp: event.timestamp,
          rawData: {
            ...event,
            data: event.data ? this.cleanAMIData(event.data) : event.data,
            response: event.response ? this.cleanAMIData(event.response) : event.response,
            command: event.command ? this.cleanAMIData(event.command) : event.command
          },
          parsedData: this.parseEventData(event),
          eventDescription: this.getEventDescription(event)
        };
        
        // Add specific parsing for different event types
        if (event.type === 'RawResponse' && event.data) {
          if (event.data.includes('Event: ExtensionStatus')) {
            processedEvent.extensionStatus = this.parseExtensionStatusData(event.data);
          } else if (event.data.includes('Response: Success') && event.data.includes('EventList: start')) {
            processedEvent.extensionStateListStart = this.parseExtensionStateListStartData(event.data);
          } else if (event.data.includes('EventList: Complete')) {
            processedEvent.extensionStateListComplete = this.parseExtensionStateListCompleteData(event.data);
          } else if (event.data.includes('Response: Error')) {
            processedEvent.errorResponse = this.parseErrorResponseData(event.data);
          }
        }
        
        return processedEvent;
      });
      
      const dataToSave = {
        testInfo: {
          description: 'ExtensionStateList Test with Clean JSON Format - No \\r\\n',
          startTime: this.startTime.toISOString(),
          endTime: endTime.toISOString(),
          duration: `${duration}ms`,
          commands: [
            'Action: Login',
            'Action: ExtensionStateList',
            'Action: Logoff'
          ]
        },
        connection: {
          host: '103.177.125.83',
          port: 5038,
          username: 'admin'
        },
        events: processedEvents,
        summary: {
          totalEvents: this.events.length,
          extensionStateListResponse: this.extensionStateListResponse || 'Not Completed',
          extensionStatusEvents: extensionStatusEvents,
          systemEvents: systemEvents,
          loginResponse: this.events.find(e => e.type === 'LoginResponse') ? 'Received' : 'Not Received',
          logoffResponse: this.events.find(e => e.type === 'RawResponse' && e.data.includes('Response: Goodbye')) ? 'Received' : 'Not Received',
          expectedEvents: 224,
          eventsCaptured: this.events.length
        }
      };

      // Save as JSON
      fs.writeFileSync(this.logFile, JSON.stringify(dataToSave, null, 2));
      
      console.log(`\n💾 Test results saved to: ${this.logFile}`);
      console.log(`📊 Total events captured: ${this.events.length}`);
      console.log(`📱 Extension status events: ${extensionStatusEvents}`);
      console.log(`⚙️ System events: ${systemEvents}`);
      console.log(`🎯 Expected events: 224`);
      console.log(`✅ Events captured: ${this.events.length}`);
      console.log(`📄 All events saved in clean JSON format: ${this.logFile}`);
      
    } catch (error) {
      console.error('❌ Error saving events:', error.message);
    }
  }

  cleanAMIData(data) {
    // Replace \r\n with \n for proper JSON formatting
    return data.replace(/\r\n/g, '\n');
  }

  getEventDescription(event) {
    switch (event.type) {
      case 'LoginResponse':
        return 'AMI Login Authentication Response';
      case 'ExtensionStateListCommand':
        return 'Extension State List Command Sent';
      case 'LogoffCommand':
        return 'AMI Logoff Command Sent';
      case 'RawResponse':
        if (event.data.includes('Event: ExtensionStatus')) {
          return 'Extension Status Event';
        } else if (event.data.includes('Response: Success') && event.data.includes('EventList: start')) {
          return 'Extension State List Response Start';
        } else if (event.data.includes('EventList: Complete')) {
          return 'Extension State List Response Complete';
        } else if (event.data.includes('Response: Error')) {
          return 'Error Response';
        } else if (event.data.includes('Response: Goodbye')) {
          return 'Logoff Response';
        } else {
          return 'AMI Raw Response';
        }
      default:
        return 'Unknown Event Type';
    }
  }

  parseExtensionStatusData(response) {
    const lines = response.split('\r\n');
    const eventData = {};
    
    lines.forEach(line => {
      if (line.includes(':')) {
        const [key, ...valueParts] = line.split(':');
        const value = valueParts.join(':').trim();
        eventData[key] = value;
      }
    });
    
    return {
      event: eventData.Event,
      extension: eventData.Exten,
      context: eventData.Context,
      status: eventData.Status,
      statusText: eventData.StatusText,
      hint: eventData.Hint
    };
  }

  parseExtensionStateListStartData(response) {
    const lines = response.split('\r\n');
    const responseData = {};
    
    lines.forEach(line => {
      if (line.includes(':')) {
        const [key, ...valueParts] = line.split(':');
        const value = valueParts.join(':').trim();
        responseData[key] = value;
      }
    });
    
    return {
      response: responseData.Response,
      eventList: responseData.EventList,
      listItems: responseData.ListItems
    };
  }

  parseExtensionStateListCompleteData(response) {
    const lines = response.split('\r\n');
    const responseData = {};
    
    lines.forEach(line => {
      if (line.includes(':')) {
        const [key, ...valueParts] = line.split(':');
        const value = valueParts.join(':').trim();
        responseData[key] = value;
      }
    });
    
    return {
      response: responseData.Response,
      eventList: responseData.EventList,
      listItems: responseData.ListItems
    };
  }

  parseErrorResponseData(response) {
    const lines = response.split('\r\n');
    const errorData = {};
    
    lines.forEach(line => {
      if (line.includes(':')) {
        const [key, ...valueParts] = line.split(':');
        const value = valueParts.join(':').trim();
        errorData[key] = value;
      }
    });
    
    return {
      response: errorData.Response,
      actionID: errorData.ActionID,
      message: errorData.Message
    };
  }

  async run() {
    try {
      console.log('🧪 Starting ExtensionStateList Test...');
      console.log('========================================');
      
      // Connect using the provided credentials
      await this.connect('103.177.125.83', 5038, 'admin', 'Tractor@0152');
      
      // Wait a moment for connection to stabilize
      setTimeout(() => {
        // Get ExtensionStateList
        this.getExtensionStateList();
        
        // Wait for response then logoff
        setTimeout(() => {
          console.log('\n⏰ Timeout reached, proceeding to logoff...');
          this.logoff();
        }, 15000); // 15 second timeout for ExtensionStateList
      }, 1000);
      
    } catch (error) {
      console.error('❌ Failed to connect to AMI:', error.message);
      this.saveEventsToFile();
      process.exit(1);
    }
  }
}

// Main execution
const tester = new ExtensionStateListTester();

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
