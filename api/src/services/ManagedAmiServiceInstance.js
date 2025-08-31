import ManagedAmiService from './ManagedAmiService.js';

/**
 * ManagedAmiServiceInstance - Singleton wrapper for ManagedAmiService
 * Ensures only one service instance runs at a time and manages lifecycle
 */
class ManagedAmiServiceInstance {
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
      console.log('⚠️ [ManagedAmiServiceInstance] Service already initialized and healthy');
      return this.instance;
    }

    // Prevent multiple simultaneous initializations
    if (this.isInitializing) {
      console.log('⏳ [ManagedAmiServiceInstance] Service initialization already in progress...');
      while (this.isInitializing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.instance;
    }

    try {
      this.isInitializing = true;
      console.log('🚀 [ManagedAmiServiceInstance] Initializing Managed AMI Service...');
      
      // Clean up old instance if it exists
      if (this.instance) {
        console.log('🧹 [ManagedAmiServiceInstance] Cleaning up old instance...');
        await this.instance.stop();
        this.instance = null;
      }

      // Create and start new instance
      this.instance = new ManagedAmiService();
      await this.instance.start();
      
      console.log('✅ [ManagedAmiServiceInstance] Managed AMI Service initialized successfully');
      return this.instance;
      
    } catch (error) {
      console.error('❌ [ManagedAmiServiceInstance] Failed to initialize service:', error.message);
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
        service: 'ManagedAmiServiceInstance',
        status: 'not_initialized',
        instance: null,
        message: 'Service has not been initialized yet'
      };
    }
    
    return {
      service: 'ManagedAmiServiceInstance',
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
      console.log('🛑 [ManagedAmiServiceInstance] Stopping service...');
      await this.instance.stop();
      this.instance = null;
      console.log('✅ [ManagedAmiServiceInstance] Service stopped');
    }
  }

  /**
   * Restarts the service with full cleanup and reinitialization
   */
  async restart() {
    console.log('🔄 [ManagedAmiServiceInstance] Restarting service...');
    await this.stop();
    await new Promise(resolve => setTimeout(resolve, 1000));
    return await this.initialize();
  }

  /**
   * Forces reconnection of the current service instance
   */
  async reconnect() {
    if (this.instance) {
      console.log('🔄 [ManagedAmiServiceInstance] Force reconnection requested...');
      await this.instance.reconnect();
    } else {
      console.log('⚠️ [ManagedAmiServiceInstance] No instance to reconnect');
    }
  }
}

// Create singleton instance
const managedAmiServiceInstance = new ManagedAmiServiceInstance();

/**
 * Public API Functions
 */

/**
 * Initializes the Managed AMI Service
 */
export const initializeManagedAmiService = async () => {
  return await managedAmiServiceInstance.initialize();
};

/**
 * Returns the current service instance
 */
export const getManagedAmiService = () => {
  return managedAmiServiceInstance.getInstance();
};

/**
 * Checks if the service is currently running
 */
export const isManagedAmiServiceRunning = () => {
  return managedAmiServiceInstance.isRunning();
};

/**
 * Checks if the service is healthy
 */
export const isManagedAmiServiceHealthy = () => {
  return managedAmiServiceInstance.getHealthStatus();
};

/**
 * Returns comprehensive service status
 */
export const getManagedAmiServiceStatus = () => {
  return managedAmiServiceInstance.getStatus();
};

/**
 * Stops the service gracefully
 */
export const stopManagedAmiService = async () => {
  return await managedAmiServiceInstance.stop();
};

/**
 * Restarts the service completely
 */
export const restartManagedAmiService = async () => {
  return await managedAmiServiceInstance.restart();
};

/**
 * Forces service reconnection
 */
export const reconnectManagedAmiService = async () => {
  return await managedAmiServiceInstance.reconnect();
};

// Export singleton instance for direct access
export default managedAmiServiceInstance;
