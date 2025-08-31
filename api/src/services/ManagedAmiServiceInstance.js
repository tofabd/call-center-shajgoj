import ManagedAmiService from './ManagedAmiService.js';

/**
 * ManagedAmiServiceInstance - Singleton wrapper for ManagedAmiService
 * Ensures only one instance of the service runs at a time
 */
class ManagedAmiServiceInstance {
  constructor() {
    this.instance = null;
    this.isInitializing = false;
  }

  /**
   * Initialize the hybrid AMI service
   */
  async initialize() {
    if (this.instance && this.instance.getHealthStatus()) {
      console.log('⚠️ [ManagedAmiServiceInstance] Service already initialized and healthy');
      return this.instance;
    }

    if (this.isInitializing) {
      console.log('⏳ [ManagedAmiServiceInstance] Service initialization already in progress...');
      // Wait for initialization to complete
      while (this.isInitializing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.instance;
    }

    try {
      this.isInitializing = true;
      console.log('🚀 [ManagedAmiServiceInstance] Initializing Managed AMI Service...');
      
      // Clean up old instance if exists
      if (this.instance) {
        console.log('🧹 [ManagedAmiServiceInstance] Cleaning up old instance...');
        await this.instance.stop();
        this.instance = null;
      }

      // Create new instance
      this.instance = new ManagedAmiService();
      
      // Start the service
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
   * Get the current service instance
   */
  getInstance() {
    return this.instance;
  }

  /**
   * Check if service is running
   */
  isRunning() {
    return this.instance && this.instance.isRunning;
  }

  /**
   * Get the health status of the service
   */
  getHealthStatus() {
    return this.instance && this.instance.getHealthStatus();
  }

  /**
   * Get service status
   */
  getStatus() {
    if (!this.instance) {
      return {
        service: 'ManagedAmiServiceInstance',
        status: 'not_initialized',
        instance: null
      };
    }
    
    return {
      service: 'ManagedAmiServiceInstance',
      status: 'running',
      instance: this.instance.getStatus()
    };
  }

  /**
   * Stop the service
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
   * Restart the service
   */
  async restart() {
          console.log('🔄 [ManagedAmiServiceInstance] Restarting service...');
    await this.stop();
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
    return await this.initialize();
  }

  /**
   * Force reconnection
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
 * Initialize the hybrid AMI service
 */
export const initializeManagedAmiService = async () => {
  return await managedAmiServiceInstance.initialize();
};

/**
 * Get the current service instance
 */
export const getManagedAmiService = () => {
  return managedAmiServiceInstance.getInstance();
};

/**
 * Check if service is running
 */
export const isManagedAmiServiceRunning = () => {
  return managedAmiServiceInstance.isRunning();
};

/**
 * Check if service is healthy
 */
export const isManagedAmiServiceHealthy = () => {
  return managedAmiServiceInstance.getHealthStatus();
};

/**
 * Get service status
 */
export const getManagedAmiServiceStatus = () => {
  return managedAmiServiceInstance.getStatus();
};

/**
 * Stop the service
 */
export const stopManagedAmiService = async () => {
  return await managedAmiServiceInstance.stop();
};

/**
 * Restart the service
 */
export const restartManagedAmiService = async () => {
  return await managedAmiServiceInstance.restart();
};

/**
 * Force reconnection
 */
export const reconnectManagedAmiService = async () => {
  return await managedAmiServiceInstance.reconnect();
};

// Export the singleton instance for direct access
export default managedAmiServiceInstance;
