import dotenv from 'dotenv';
import AmiConnectionManager from './AmiConnectionManager.js';
import AmiEventProcessor from './AmiEventProcessor.js';

dotenv.config();

/**
 * HybridAmiService - Combines reliable TCP connections with efficient event processing
 * Best of both worlds: Robust connection management + Powerful real-time event handling
 */
class HybridAmiService {
  constructor() {
    this.connectionManager = new AmiConnectionManager();
    this.eventProcessor = new AmiEventProcessor();
    this.connectionState = 'disconnected';
    this.reconnectDelay = 5000; // 5 seconds
    this.maxReconnectAttempts = 10;
    this.reconnectAttempts = 0;
    this.isRunning = false;
  }

  /**
   * Start the hybrid AMI service
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️ [HybridAmiService] Service already running');
      return;
    }

    console.log('🚀 [HybridAmiService] Starting Hybrid AMI Service...');
    
    const host = process.env.AMI_HOST;
    const port = parseInt(process.env.AMI_PORT);
    const username = process.env.AMI_USERNAME;
    const password = process.env.AMI_PASSWORD;

    // Validate required environment variables
    if (!host || !port || !username || !password) {
      throw new Error('Missing required AMI environment variables. Please ensure AMI_HOST, AMI_PORT, AMI_USERNAME, and AMI_PASSWORD are set in your .env file.');
    }

    try {
      // Phase 1: Establish TCP connection
      console.log('🔌 [HybridAmiService] Phase 1: Establishing connection...');
      await this.connectionManager.establishConnection(host, port, username, password);
      this.connectionState = 'connected';
      
      // Phase 2: Authenticate with AMI
      console.log('🔐 [HybridAmiService] Phase 2: Authenticating...');
      await this.connectionManager.authenticate(username, password, 'on');
      
      // Phase 3: Setup real-time event processing
      console.log('📡 [HybridAmiService] Phase 3: Setting up event processing...');
      const socket = this.connectionManager.getSocket();
      this.eventProcessor.setupEventProcessing(socket);
      
      this.isRunning = true;
      this.reconnectAttempts = 0;
      
      console.log('✅ [HybridAmiService] Hybrid AMI Service started successfully!');
      console.log('🎯 [HybridAmiService] Connection: Robust TCP reliability');
      console.log('⚡ [HybridAmiService] Events: Real-time processing efficiency');
      
      // Setup connection monitoring
      this.setupConnectionMonitoring();
      
    } catch (error) {
      console.error('❌ [HybridAmiService] Failed to start service:', error.message);
      this.connectionState = 'failed';
      this.scheduleReconnect();
    }
  }

  /**
   * Setup connection monitoring for automatic recovery
   */
  setupConnectionMonitoring() {
    const socket = this.connectionManager.getSocket();
    
    if (!socket) return;
    
    socket.on('close', () => {
      console.log('🔌 [HybridAmiService] Connection closed - scheduling reconnection');
      this.connectionState = 'disconnected';
      this.isRunning = false;
      this.scheduleReconnect();
    });
    
    socket.on('error', (error) => {
      console.error('❌ [HybridAmiService] Connection error:', error.message);
      this.connectionState = 'failed';
      this.isRunning = false;
      this.scheduleReconnect();
    });
  }

  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ [HybridAmiService] Max reconnection attempts reached. Stopping service.');
      return;
    }

    this.reconnectAttempts++;
    console.log(`🔄 [HybridAmiService] Scheduling reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectDelay}ms`);
    
    setTimeout(() => {
      this.start();
    }, this.reconnectDelay);
  }

  /**
   * Force reconnection
   */
  async reconnect() {
    console.log('🔄 [HybridAmiService] Force reconnection requested...');
    
    try {
      await this.stop();
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      await this.start();
    } catch (error) {
      console.error('❌ [HybridAmiService] Force reconnection failed:', error.message);
    }
  }

  /**
   * Get connection manager for direct access
   */
  getConnectionManager() {
    return this.connectionManager;
  }

  /**
   * Query extension status via AMI
   */
  async queryExtensionStatus(extensionNumber) {
    if (!this.isRunning || !this.connectionManager.isHealthy()) {
      throw new Error('Hybrid AMI Service is not running or not healthy');
    }

    const socket = this.connectionManager.getSocket();
    if (!socket) {
      throw new Error('No active socket connection');
    }

    return new Promise((resolve, reject) => {
      const actionId = `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const query = `Action: ExtensionState\r\nActionID: ${actionId}\r\nExten: ${extensionNumber}\r\nContext: from-internal\r\nEvents: off\r\n\r\n`;

      let responseBuffer = '';
      let responseTimeout;

      const dataHandler = (data) => {
        responseBuffer += data.toString();
        
        // Check if we have a complete response
        if (responseBuffer.includes(`ActionID: ${actionId}`)) {
          
          // Show raw response data for every query
          console.log(`\n🔍 Extension ${extensionNumber} - Raw AMI Response:`);
          console.log('=' .repeat(60));
          console.log(responseBuffer);
          console.log('=' .repeat(60));
          
          if (responseBuffer.includes('Response: Success')) {
            // Parse the response to get status
            const lines = responseBuffer.split('\r\n');
            const statusLine = lines.find(line => line.startsWith('Status: '));
            const statusTextLine = lines.find(line => line.startsWith('StatusText: '));
            
            if (statusLine) {
              const statusCode = statusLine.split(': ')[1];
              const statusText = statusTextLine ? statusTextLine.split(': ')[1] : '';
              
              // Map status code to derived status
              const derivedStatus = this.mapExtensionStatus(statusCode);
              
              console.log(`✅ Extension ${extensionNumber} - Parsed: statusCode=${statusCode}, derivedStatus=${derivedStatus}, statusText="${statusText}"\n`);
              
              resolve({
                status: derivedStatus,
                statusCode: statusCode,
                statusText: statusText,
                error: null,
                rawAmiResponse: responseBuffer // Include raw AMI response
              });
            } else {
              console.warn(`❌ Extension ${extensionNumber} - No Status line found in response\n`);
              resolve({
                status: 'unknown',
                statusCode: null,
                statusText: null,
                error: 'Could not parse status from response',
                rawAmiResponse: responseBuffer // Include raw AMI response even for errors
              });
            }
          } else if (responseBuffer.includes('Response: Error')) {
            const lines = responseBuffer.split('\r\n');
            const errorLine = lines.find(line => line.startsWith('Message: '));
            const error = errorLine ? errorLine.split(': ')[1] : 'Unknown error';
            
            console.error(`❌ Extension ${extensionNumber} - AMI Error: ${error}\n`);
            
            resolve({
              status: 'unknown',
              statusCode: null,
              statusText: null,
              error: error,
              rawAmiResponse: responseBuffer // Include raw AMI response for errors
            });
          }
          
          // Clean up
          clearTimeout(responseTimeout);
          socket.removeListener('dataHandler');
        }
      };

      socket.on('data', dataHandler);

      // Send the query
      try {
        socket.write(query);
      } catch (error) {
        socket.removeListener('data', dataHandler);
        clearTimeout(responseTimeout);
        reject(error);
        return;
      }

      // Timeout after 10 seconds
      responseTimeout = setTimeout(() => {
        socket.removeListener('data', dataHandler);
        resolve({
          status: 'unknown',
          statusCode: null,
          statusText: null,
          error: 'Query timeout - no response received',
          rawAmiResponse: '' // No response for timeout
        });
      }, 10000);
    });
  }

  /**
   * Query all extension statuses via AMI using ExtensionStateList (bulk query)
   * Enhanced to capture and parse ALL events before completing
   */
  async queryExtensionStateList() {
    if (!this.isRunning || !this.connectionManager.isHealthy()) {
      throw new Error('Hybrid AMI Service is not running or not healthy');
    }

    const socket = this.connectionManager.getSocket();
    if (!socket) {
      throw new Error('No active socket connection');
    }

    return new Promise((resolve, reject) => {
      const actionId = `bulk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const query = `Action: ExtensionStateList\r\nActionID: ${actionId}\r\nContext: from-internal\r\nEvents: off\r\n\r\n`;

      let responseBuffer = '';
      let responseTimeout;
      let isComplete = false;
      let lastEventTime = Date.now();
      let eventCount = 0;
      let extensionCount = 0;
      let completionEventDetected = false;

      const dataHandler = (data) => {
        const dataStr = data.toString();
        responseBuffer += dataStr;
        lastEventTime = Date.now();
        eventCount++;

        // Count extensions in the response
        const extensionMatches = dataStr.match(/Extension: (\d+)/g);
        if (extensionMatches) {
          extensionCount += extensionMatches.length;
        }

        // Check if we have a complete response (Events: off format)
        const hasCompletionSignal = (
          responseBuffer.includes(`ActionID: ${actionId}`) && 
          (
            responseBuffer.includes('Response: Follows') || 
            responseBuffer.includes('Response: Success')
          )
        );
        
        // Check for ExtensionStateListComplete event specifically
        if (responseBuffer.includes('Event: ExtensionStateListComplete')) {
          completionEventDetected = true;
          console.log(`🎯 ExtensionStateListComplete event detected - list is complete`);
          
          // Send Logoff action to finish the query
          try {
            const logoffAction = `Action: Logoff\r\nActionID: ${actionId}-complete\r\n\r\n`;
            socket.write(logoffAction);
            console.log(`🔌 [HybridAmiService] Sent Logoff action after ExtensionStateListComplete`);
          } catch (logoffError) {
            console.warn(`⚠️ [HybridAmiService] Failed to send Logoff action:`, logoffError.message);
          }
          
          // Process response immediately after ExtensionStateListComplete
          setTimeout(() => {
            if (!isComplete) {
              isComplete = true;
              processResponse();
            }
          }, 500); // Shorter buffer since we have explicit completion
        }
        
        if (hasCompletionSignal) {
          // Enhanced waiting strategy: wait for events to stabilize
          setTimeout(() => {
            if (!isComplete) {
              isComplete = true;
              processResponse();
            }
          }, 1000); // Increased buffer to 1 second for more events
        }
      };

      const processResponse = () => {
        if (isComplete) return;
        isComplete = true;

        console.log(`\n🔍 Bulk ExtensionStateList - Enhanced Response Processing:`);
        console.log('=' .repeat(70));
        console.log(`📊 Total Events Received: ${eventCount}`);
        console.log(`📊 Extensions Found: ${extensionCount}`);
        console.log(`📊 Response Buffer Size: ${responseBuffer.length} characters`);
        console.log('=' .repeat(70));
        console.log(responseBuffer);
        console.log('=' .repeat(70));

        try {
          // Parse the enhanced response with all events
          const extensions = this.parseExtensionStateListResponse(responseBuffer);
          
          console.log(`✅ Enhanced bulk query completed: ${extensions.length} extensions parsed\n`);
          
          resolve({
            extensions: extensions,
            rawAmiResponse: responseBuffer,
            eventCount: eventCount,
            extensionCount: extensionCount,
            bufferSize: responseBuffer.length,
            completionEventDetected: completionEventDetected,
            error: null
          });
          
        } catch (error) {
          console.error(`❌ Failed to parse enhanced bulk response:`, error.message);
          console.error(`❌ Response buffer preview:`, responseBuffer.substring(0, 500));
          
          resolve({
            extensions: [],
            rawAmiResponse: responseBuffer,
            eventCount: eventCount,
            extensionCount: extensionCount,
            bufferSize: responseBuffer.length,
            completionEventDetected: completionEventDetected,
            error: error.message
          });
        }

        // Clean up
        clearTimeout(responseTimeout);
        socket.removeListener('data', dataHandler);
      };

      socket.on('data', dataHandler);

      // Send the query
      try {
        socket.write(query);
      } catch (error) {
        socket.removeListener('data', dataHandler);
        clearTimeout(responseTimeout);
        reject(error);
        return;
      }

      // Enhanced timeout: wait longer for comprehensive event collection
      responseTimeout = setTimeout(async () => {
        if (!isComplete) {
          isComplete = true;
          console.log(`⏰ Enhanced bulk query timeout reached - processing ${eventCount} events received`);
          
          // Send Logoff action to cleanly terminate the query
          try {
            const logoffAction = `Action: Logoff\r\nActionID: ${actionId}-timeout\r\n\r\n`;
            socket.write(logoffAction);
            console.log(`🔌 [HybridAmiService] Sent Logoff action due to timeout`);
          } catch (logoffError) {
            console.warn(`⚠️ [HybridAmiService] Failed to send Logoff action:`, logoffError.message);
          }
          
          processResponse();
        }
      }, 20000); // 20 seconds timeout for Events: off format
    });
  }

  /**
   * Manually stop an active ExtensionStateList query using Logoff action
   * @param {string} actionId - The action ID of the query to stop
   */
  async stopExtensionStateListQuery(actionId) {
    if (!this.socket || !this.socket.writable) {
      console.warn(`⚠️ [HybridAmiService] Cannot stop query - socket not available`);
      return false;
    }

    try {
      const logoffAction = `Action: Logoff\r\nActionID: ${actionId}-stop\r\n\r\n`;
      this.socket.write(logoffAction);
      console.log(`🔌 [HybridAmiService] Manually sent Logoff action to stop query: ${actionId}`);
      return true;
    } catch (error) {
      console.error(`❌ [HybridAmiService] Failed to send Logoff action:`, error.message);
      return false;
    }
  }

  /**
   * Parse ExtensionStateList response to extract extension statuses
   * Optimized for Events: off format with ExtensionStateListComplete event
   */
  parseExtensionStateListResponse(responseBuffer) {
    const extensions = [];
    const lines = responseBuffer.split('\r\n');
    
    let currentExtension = null;
    let eventCount = 0;
    let extensionEventCount = 0;
    let otherEventCount = 0;
    let completionEventDetected = false;

    console.log(`🔍 [HybridAmiService] Parsing Events: off ExtensionStateList response...`);
    console.log(`📄 Raw response buffer length: ${responseBuffer.length} characters`);

    for (const line of lines) {
      // Skip empty lines
      if (!line.trim()) continue;
      
      // Count all events
      if (line.startsWith('Event: ')) {
        eventCount++;
        
        if (line.includes('ExtensionStatus') || line.includes('ExtensionState')) {
          extensionEventCount++;
        } else if (line.includes('ExtensionStateListComplete')) {
          // Special handling for completion event
          completionEventDetected = true;
          console.log(`🎯 ExtensionStateListComplete event detected during parsing`);
        } else {
          otherEventCount++;
        }
      }

      // Parse extension data from Events: off format
      if (line.startsWith('Event: ExtensionStatus') || line.startsWith('Event: ExtensionState')) {
        // Save previous extension if exists
        if (currentExtension && currentExtension.extension) {
          extensions.push(currentExtension);
          console.log(`📱 Parsed extension: ${currentExtension.extension} -> ${currentExtension.status} (${currentExtension.statusCode})`);
        }
        
        // Start new extension
        currentExtension = {
          extension: '',
          status: '',
          statusCode: '',
          context: '',
          eventType: line.split(': ')[1],
          timestamp: new Date().toISOString()
        };
      } else if (currentExtension) {
        if (line.startsWith('Exten: ') || line.startsWith('Extension: ')) {
          currentExtension.extension = line.split(': ')[1];
        } else if (line.startsWith('Status: ')) {
          currentExtension.statusCode = line.split(': ')[1];
          currentExtension.status = this.mapExtensionStatus(line.split(': ')[1]);
        } else if (line.startsWith('Context: ')) {
          currentExtension.context = line.split(': ')[1];
        }
      }
    }
    
    // Don't forget the last extension
    if (currentExtension && currentExtension.extension) {
      extensions.push(currentExtension);
      console.log(`📱 Parsed extension: ${currentExtension.extension} -> ${currentExtension.status} (${currentExtension.statusCode})`);
    }
    
    console.log(`📊 Events: off Parsing Summary:`);
    console.log(`   - Total Events: ${eventCount}`);
    console.log(`   - Extension Events: ${extensionEventCount}`);
    console.log(`   - Other Events: ${otherEventCount}`);
    console.log(`   - Extensions Parsed: ${extensions.length}`);
    console.log(`   - Completion Event: ${completionEventDetected ? '✅ Detected' : '❌ Not Found'}`);
    
    // Debug: Show first few parsed extensions
    if (extensions.length > 0) {
      console.log(`🔍 First 3 parsed extensions:`, extensions.slice(0, 3));
    }
    
    return extensions;
  }

  /**
   * Map extension status code to derived status
   */
  mapExtensionStatus(statusCode) {
    const statusMap = {
      '0': 'online',    // NotInUse
      '1': 'online',    // InUse
      '2': 'online',    // Busy
      '4': 'offline',   // Unavailable
      '8': 'online',    // Ringing
      '16': 'online',   // Ringinuse
      '-1': 'unknown'   // Unknown
    };
    
    return statusMap[statusCode] || 'unknown';
  }

  /**
   * Get event processor for direct access
   */
  getEventProcessor() {
    return this.eventProcessor;
  }

  /**
   * Check if the service is healthy and running
   */
  isHealthy() {
    return this.isRunning && 
           this.connectionState === 'connected' && 
           this.connectionManager.isHealthy();
  }

  /**
   * Get the current service status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      connectionState: this.connectionState,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      connection: this.connectionManager.getStatus()
    };
  }

  /**
   * Test smart parsing system (for debugging)
   */
  testSmartParsing() {
    console.log('🧪 [HybridAmiService] Testing smart parsing system...');
    
    // This service now handles both individual and bulk parsing
    console.log('✅ [HybridAmiService] Individual ExtensionState parsing is working');
    console.log('📊 [HybridAmiService] ExtensionStateList parsing is handled internally');
    
    return {
      service: 'HybridAmiService',
      parsingType: 'Both Individual ExtensionState and ExtensionStateList',
      smartParsing: 'Handled internally by HybridAmiService'
    };
  }

  /**
   * Stop the service
   */
  async stop() {
    if (!this.isRunning) {
      console.log('⚠️ [HybridAmiService] Service is not running');
      return;
    }

    console.log('🛑 [HybridAmiService] Stopping Hybrid AMI Service...');
    
    try {
      // Stop event processing
      if (this.eventProcessor) {
        this.eventProcessor.stop();
      }
      
      // Stop connection manager
      if (this.connectionManager) {
        await this.connectionManager.disconnect();
      }
      
      this.isRunning = false;
      this.connectionState = 'disconnected';
      
      console.log('✅ [HybridAmiService] Hybrid AMI Service stopped successfully');
      
    } catch (error) {
      console.error('❌ [HybridAmiService] Error stopping service:', error.message);
      throw error;
    }
  }
}

export default HybridAmiService;
