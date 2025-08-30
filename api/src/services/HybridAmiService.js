import dotenv from 'dotenv';
import AmiConnectionManager from './AmiConnectionManager.js';
import AmiEventProcessor from './AmiEventProcessor.js';

dotenv.config();

/**
 * HybridAmiService - Combines reliable connections (PHP-style) with efficient event processing (Node.js-style)
 * Best of both worlds: Simple connections + Powerful event handling
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
    
    const host = process.env.AMI_HOST || '103.177.125.83';
    const port = parseInt(process.env.AMI_PORT) || 5038;
    const username = process.env.AMI_USERNAME || 'admin';
    const password = process.env.AMI_PASSWORD || 'Tractor@0152';

    try {
      // Phase 1: Establish connection (PHP-style)
      console.log('🔌 [HybridAmiService] Phase 1: Establishing connection...');
      await this.connectionManager.establishConnection(host, port, username, password);
      this.connectionState = 'connected';
      
      // Phase 2: Authenticate (Events: off for query-only mode)
      console.log('🔐 [HybridAmiService] Phase 2: Authenticating...');
      await this.connectionManager.authenticate(username, password, 'off');
      
      // Phase 3: Setup event processing (Node.js-style)
      console.log('📡 [HybridAmiService] Phase 3: Setting up event processing...');
      const socket = this.connectionManager.getSocket();
      this.eventProcessor.setupEventProcessing(socket);
      
      this.isRunning = true;
      this.reconnectAttempts = 0;
      
      console.log('✅ [HybridAmiService] Hybrid AMI Service started successfully!');
      console.log('🎯 [HybridAmiService] Connection: PHP-style reliability');
      console.log('⚡ [HybridAmiService] Events: Node.js-style efficiency');
      
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
   * Stop the service
   */
  async stop() {
    console.log('🛑 [HybridAmiService] Stopping Hybrid AMI Service...');
    
    this.isRunning = false;
    this.connectionState = 'disconnected';
    
    try {
      await this.connectionManager.cleanup();
      console.log('✅ [HybridAmiService] Service stopped successfully');
    } catch (error) {
      console.error('❌ [HybridAmiService] Error during shutdown:', error.message);
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    const connectionStatus = this.connectionManager.getConnectionStatus();
    
    return {
      service: 'HybridAmiService',
      running: this.isRunning,
      connectionState: this.connectionState,
      connection: connectionStatus,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts
    };
  }

  /**
   * Check if service is healthy
   */
  isHealthy() {
    return this.isRunning && this.connectionManager.isHealthy();
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
      const query = `Action: ExtensionState\r\nActionID: ${actionId}\r\nExten: ${extensionNumber}\r\nContext: from-internal\r\n\r\n`;

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
                error: null
              });
            } else {
              console.warn(`❌ Extension ${extensionNumber} - No Status line found in response\n`);
              resolve({
                status: 'unknown',
                statusCode: null,
                statusText: null,
                error: 'Could not parse status from response'
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
              error: error
            });
          }
          
          // Clean up
          clearTimeout(responseTimeout);
          socket.removeListener('data', dataHandler);
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
          error: 'Query timeout - no response received'
        });
      }, 10000);
    });
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
}

export default HybridAmiService;
