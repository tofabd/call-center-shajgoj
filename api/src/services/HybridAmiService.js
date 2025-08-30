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
      
      // Phase 2: Authenticate
      console.log('🔐 [HybridAmiService] Phase 2: Authenticating...');
      await this.connectionManager.authenticate(username, password, 'on');
      
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
   * Get event processor for direct access
   */
  getEventProcessor() {
    return this.eventProcessor;
  }
}

export default HybridAmiService;
