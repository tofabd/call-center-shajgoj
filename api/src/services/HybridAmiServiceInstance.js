import HybridAmiService from './HybridAmiService.js';

/**
 * HybridAmiServiceInstance - Singleton wrapper for HybridAmiService
 * Ensures only one instance of the service runs at a time
 */
class HybridAmiServiceInstance {
  constructor() {
    this.instance = null;
    this.isInitializing = false;
  }

  /**
   * Initialize the hybrid AMI service
   */
  async initialize() {
    if (this.instance && this.instance.isHealthy()) {
      console.log('⚠️ [HybridAmiServiceInstance] Service already initialized and healthy');
      return this.instance;
    }

    if (this.isInitializing) {
      console.log('⏳ [HybridAmiServiceInstance] Service initialization already in progress...');
      // Wait for initialization to complete
      while (this.isInitializing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.instance;
    }

    try {
      this.isInitializing = true;
      console.log('🚀 [HybridAmiServiceInstance] Initializing Hybrid AMI Service...');
      
      // Clean up old instance if exists
      if (this.instance) {
        console.log('🧹 [HybridAmiServiceInstance] Cleaning up old instance...');
        await this.instance.stop();
        this.instance = null;
      }

      // Create new instance
      this.instance = new HybridAmiService();
      
      // Start the service
      await this.instance.start();
      
      console.log('✅ [HybridAmiServiceInstance] Hybrid AMI Service initialized successfully');
      return this.instance;
      
    } catch (error) {
      console.error('❌ [HybridAmiServiceInstance] Failed to initialize service:', error.message);
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
   * Check if service is healthy
   */
  isHealthy() {
    return this.instance && this.instance.isHealthy();
  }

  /**
   * Get service status
   */
  getStatus() {
    if (!this.instance) {
      return {
        service: 'HybridAmiServiceInstance',
        status: 'not_initialized',
        instance: null
      };
    }
    
    return {
      service: 'HybridAmiServiceInstance',
      status: 'running',
      instance: this.instance.getStatus()
    };
  }

  /**
   * Stop the service
   */
  async stop() {
    if (this.instance) {
      console.log('🛑 [HybridAmiServiceInstance] Stopping service...');
      await this.instance.stop();
      this.instance = null;
      console.log('✅ [HybridAmiServiceInstance] Service stopped');
    }
  }

  /**
   * Restart the service
   */
  async restart() {
    console.log('🔄 [HybridAmiServiceInstance] Restarting service...');
    await this.stop();
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
    return await this.initialize();
  }

  /**
   * Force reconnection
   */
  async reconnect() {
    if (this.instance) {
      console.log('🔄 [HybridAmiServiceInstance] Force reconnection requested...');
      await this.instance.reconnect();
    } else {
      console.log('⚠️ [HybridAmiServiceInstance] No instance to reconnect');
    }
  }
}

// Create singleton instance
const hybridAmiServiceInstance = new HybridAmiServiceInstance();

/**
 * Initialize the hybrid AMI service
 */
export const initializeHybridAmiService = async () => {
  return await hybridAmiServiceInstance.initialize();
};

/**
 * Get the current service instance
 */
export const getHybridAmiService = () => {
  return hybridAmiServiceInstance.getInstance();
};

/**
 * Check if service is running
 */
export const isHybridAmiServiceRunning = () => {
  return hybridAmiServiceInstance.isRunning();
};

/**
 * Check if service is healthy
 */
export const isHybridAmiServiceHealthy = () => {
  return hybridAmiServiceInstance.isHealthy();
};

/**
 * Get service status
 */
export const getHybridAmiServiceStatus = () => {
  return hybridAmiServiceInstance.getStatus();
};

/**
 * Stop the service
 */
export const stopHybridAmiService = async () => {
  return await hybridAmiServiceInstance.stop();
};

/**
 * Restart the service
 */
export const restartHybridAmiService = async () => {
  return await hybridAmiServiceInstance.restart();
};

/**
 * Force reconnection
 */
export const reconnectHybridAmiService = async () => {
  return await hybridAmiServiceInstance.reconnect();
};

// Export the singleton instance for direct access
export default hybridAmiServiceInstance;
