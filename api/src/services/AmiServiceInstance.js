import AmiService from './AmiService.js';

/**
 * AmiServiceInstance - Singleton wrapper for AmiService
 * Ensures only one service instance runs at a time and manages lifecycle
 */
class AmiServiceInstance {
  constructor() {
    // Singleton instance reference
    this.instance = null;
    
    // Prevents multiple simultaneous initializations
    this.isInitializing = false;
  }

  /**
   * Initializes the service with singleton enforcement
   * Prevents race conditions and manages instance lifecycle
   */
  async initialize() {
    // Return existing healthy instance if available
    if (this.instance && this.instance.getHealthStatus()) {
      console.log('⚠️ [AmiServiceInstance] Service already initialized and healthy');
      return this.instance;
    }

    // Prevent multiple simultaneous initializations
    if (this.isInitializing) {
      console.log('⏳ [AmiServiceInstance] Service initialization already in progress...');
      while (this.isInitializing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.instance;
    }

    try {
      this.isInitializing = true;
      console.log('🚀 [AmiServiceInstance] Initializing AMI Service...');
      
      // Clean up old instance if it exists
      if (this.instance) {
        console.log('🧹 [AmiServiceInstance] Cleaning up old instance...');
        await this.instance.stop();
        this.instance = null;
      }

      // Create and start new instance
      this.instance = new AmiService();
      await this.instance.start();
      
      console.log('✅ [AmiServiceInstance] AMI Service initialized successfully');
      return this.instance;
      
    } catch (error) {
      console.error('❌ [AmiServiceInstance] Failed to initialize service:', error.message);
      this.instance = null;
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Returns the current service instance
   */
  getInstance() {
    return this.instance;
  }

  /**
   * Checks if the service is currently running
   */
  isRunning() {
    return this.instance && this.instance.isRunning;
  }

  /**
   * Returns the overall health status of the service
   */
  getHealthStatus() {
    return this.instance && this.instance.getHealthStatus();
  }

  /**
   * Returns comprehensive service status information
   */
  getStatus() {
    if (!this.instance) {
      return {
        service: 'AmiServiceInstance',
        status: 'not_initialized',
        instance: null,
        message: 'Service has not been initialized yet'
      };
    }
    
          return {
        service: 'AmiServiceInstance',
      status: 'running',
      instance: this.instance.getStatus(),
      message: 'Service is running and healthy'
    };
  }

  /**
   * Gracefully stops the service and cleans up resources
   */
  async stop() {
    if (this.instance) {
      console.log('🛑 [AmiServiceInstance] Stopping service...');
      await this.instance.stop();
      this.instance = null;
      console.log('✅ [AmiServiceInstance] Service stopped');
    }
  }

  /**
   * Restarts the service with full cleanup and reinitialization
   */
  async restart() {
          console.log('🔄 [AmiServiceInstance] Restarting service...');
    await this.stop();
    await new Promise(resolve => setTimeout(resolve, 1000));
    return await this.initialize();
  }

  /**
   * Forces reconnection of the current service instance
   */
  async reconnect() {
    if (this.instance) {
      console.log('🔄 [AmiServiceInstance] Force reconnection requested...');
      await this.instance.reconnect();
    } else {
              console.log('⚠️ [AmiServiceInstance] No instance to reconnect');
    }
  }
}

// Create singleton instance
const amiServiceInstance = new AmiServiceInstance();

/**
 * Public API Functions
 */

/**
 * Initializes the Managed AMI Service
 */
export const initializeAmiService = async () => {
  return await amiServiceInstance.initialize();
};

/**
 * Returns the current service instance
 */
export const getAmiService = () => {
  return amiServiceInstance.getInstance();
};

/**
 * Checks if the service is currently running
 */
export const isAmiServiceRunning = () => {
  return amiServiceInstance.isRunning();
};

/**
 * Checks if the service is healthy
 */
export const isAmiServiceHealthy = () => {
  return amiServiceInstance.getHealthStatus();
};

/**
 * Returns comprehensive service status
 */
export const getAmiServiceStatus = () => {
  return amiServiceInstance.getStatus();
};

/**
 * Stops the service gracefully
 */
export const stopAmiService = async () => {
  return await amiServiceInstance.stop();
};

/**
 * Restarts the service completely
 */
export const restartAmiService = async () => {
  return await amiServiceInstance.restart();
};

/**
 * Forces service reconnection
 */
export const reconnectAmiService = async () => {
  return await amiServiceInstance.reconnect();
};

// Export singleton instance for direct access
export default amiServiceInstance;
