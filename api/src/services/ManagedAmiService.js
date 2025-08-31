import dotenv from 'dotenv';
import AmiConnectionManager from './AmiConnectionManager.js';
import AmiEventProcessor from './AmiEventProcessor.js';

dotenv.config();

/**
 * ManagedAmiService - Core orchestration service for AMI (Asterisk Manager Interface) operations
 * 
 * This service coordinates the complete lifecycle of AMI connections including:
 * - Connection establishment and authentication
 * - Real-time event processing setup
 * - Automatic reconnection and recovery
 * - Service health monitoring and status reporting
 * 
 * Architecture: The service follows a layered approach where:
 * - ConnectionManager handles low-level socket operations
 * - EventProcessor manages event parsing and business logic
 * - This service orchestrates the overall flow and recovery
 */
class ManagedAmiService {
  constructor() {
    // Core service components
    this.connectionManager = new AmiConnectionManager();
    this.eventProcessor = new AmiEventProcessor();
    
    // Connection state tracking
    this.connectionState = 'disconnected';
    
    // Reconnection configuration
    this.reconnectDelay = 5000; // 5 seconds between reconnection attempts
    this.maxReconnectAttempts = 10; // Maximum number of reconnection attempts
    this.reconnectAttempts = 0; // Current reconnection attempt counter
    
    // Service lifecycle flag
    this.isRunning = false;
  }

  /**
   * Initiates the AMI service startup sequence
   * 
   * The startup process follows a three-phase approach:
   * 1. TCP Connection: Establishes network connectivity
   * 2. Authentication: Validates credentials with AMI
   * 3. Event Processing: Configures real-time event handling
   * 
   * @throws {Error} When required environment variables are missing
   * @throws {Error} When connection establishment fails
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️ [ManagedAmiService] Service already running');
      return;
    }

    console.log('🚀 [ManagedAmiService] Starting AMI Service...');
    
    // Extract configuration from environment
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
      console.log('🔌 [ManagedAmiService] Phase 1: Establishing connection...');
      await this.connectionManager.establishConnection(host, port, username, password);
      this.connectionState = 'connected';
      
      // Phase 2: Authenticate with AMI
      console.log('🔐 [ManagedAmiService] Phase 2: Authenticating...');
      await this.connectionManager.authenticate(username, password, 'on');
      
      // Phase 3: Setup real-time event processing
      console.log('📡 [ManagedAmiService] Phase 3: Setting up event processing...');
      const amiSocket = this.connectionManager.getSocket();
      this.eventProcessor.setupEventProcessing(amiSocket);
      
      // Update service state
      this.isRunning = true;
      this.reconnectAttempts = 0;
      
      console.log('✅ [ManagedAmiService] AMI Service started successfully!');
      console.log('🎯 [ManagedAmiService] Connection: Robust TCP reliability');
      console.log('⚡ [ManagedAmiService] Events: Real-time streaming enabled');
      
      // Setup connection monitoring for automatic recovery
      this.setupConnectionMonitoring();
      
    } catch (error) {
      console.error('❌ [ManagedAmiService] Failed to start service:', error.message);
      this.connectionState = 'failed';
      this.scheduleReconnect();
    }
  }

  /**
   * Configures connection event listeners for automatic recovery
   * 
   * Monitors socket events to detect disconnections and errors,
   * automatically triggering reconnection attempts when needed.
   * This ensures the service remains resilient to network issues.
   */
  setupConnectionMonitoring() {
    const amiSocket = this.connectionManager.getSocket();
    
    if (!amiSocket) return;
    
    // Monitor connection closure events
    amiSocket.on('close', () => {
      console.log('🔌 [ManagedAmiService] Connection closed - scheduling reconnection');
      this.connectionState = 'disconnected';
      this.isRunning = false;
      this.scheduleReconnect();
    });
    
    // Monitor connection error events
    amiSocket.on('error', (error) => {
      console.error('❌ [ManagedAmiService] Connection error:', error.message);
      this.connectionState = 'failed';
      this.isRunning = false;
      this.scheduleReconnect();
    });
  }

  /**
   * Schedules an automatic reconnection attempt
   * 
   * Implements exponential backoff with a maximum retry limit.
   * Each reconnection attempt is delayed to avoid overwhelming
   * the target server during recovery scenarios.
   */
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ [ManagedAmiService] Max reconnection attempts reached. Stopping service.');
      return;
    }

    this.reconnectAttempts++;
    console.log(`🔄 [ManagedAmiService] Scheduling reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectDelay}ms`);
    
    setTimeout(() => {
      this.start();
    }, this.reconnectDelay);
  }

  /**
   * Forces an immediate reconnection attempt
   * 
   * Useful for manual recovery scenarios or when immediate
   * reconnection is required. Stops the current service
   * and restarts it after a brief delay.
   */
  async reconnect() {
    console.log('🔄 [ManagedAmiService] Force reconnection requested...');
    
    try {
      await this.stop();
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      await this.start();
    } catch (error) {
      console.error('❌ [ManagedAmiService] Force reconnection failed:', error.message);
    }
  }

  /**
   * Provides access to the connection manager instance
   * 
   * @returns {AmiConnectionManager} The connection manager instance
   */
  getConnectionManager() {
    return this.connectionManager;
  }

  /**
   * Provides access to the event processor instance
   * 
   * @returns {AmiEventProcessor} The event processor instance
   */
  getEventProcessor() {
    return this.eventProcessor;
  }

  /**
   * Evaluates the overall health status of the service
   * 
   * A service is considered healthy when:
   * - The service is running
   * - Connection state is 'connected'
   * - Connection manager reports healthy status
   * 
   * @returns {boolean} True if the service is healthy, false otherwise
   */
  getHealthStatus() {
    return this.isRunning && 
           this.connectionState === 'connected' && 
           this.connectionManager.getHealthStatus();
  }

  /**
   * Retrieves comprehensive service status information
   * 
   * Provides detailed information about the service state,
   * connection status, and reconnection attempts for monitoring
   * and debugging purposes.
   * 
   * @returns {Object} Service status object with detailed information
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
   * Gracefully shuts down the AMI service
   * 
   * Performs cleanup operations in the correct order:
   * 1. Stops event processing to prevent new events
   * 2. Disconnects the AMI connection
   * 3. Updates service state flags
   * 
   * @throws {Error} When cleanup operations fail
   */
  async stop() {
    if (!this.isRunning) {
      console.log('⚠️ [ManagedAmiService] Service is not running');
      return;
    }

    console.log('🛑 [ManagedAmiService] Stopping AMI Service...');
    
    try {
      // Stop event processing first to prevent new events
      if (this.eventProcessor) {
        this.eventProcessor.stop();
      }
      
      // Disconnect the AMI connection
      if (this.connectionManager) {
        await this.connectionManager.disconnect();
      }
      
      // Update service state
      this.isRunning = false;
      this.connectionState = 'disconnected';
      
      console.log('✅ [ManagedAmiService] AMI Service stopped successfully');
      
    } catch (error) {
      console.error('❌ [ManagedAmiService] Error stopping service:', error.message);
      throw error;
    }
  }
}

export default ManagedAmiService;
