import AmiQueryService from './AmiQueryService.js';

let amiQueryServiceInstance = null;

/**
 * Initialize the AMI Query Service instance
 * Should be called once during application startup
 */
export const initializeAmiQueryService = async () => {
  if (amiQueryServiceInstance) {
    console.log('⚠️ AMI Query Service already initialized');
    return amiQueryServiceInstance;
  }

  console.log('🚀 Initializing AMI Query Service...');
  amiQueryServiceInstance = new AmiQueryService();
  
  try {
    await amiQueryServiceInstance.start();
    console.log('✅ AMI Query Service initialized successfully');
    return amiQueryServiceInstance;
  } catch (error) {
    console.error('❌ Failed to initialize AMI Query Service:', error.message);
    amiQueryServiceInstance = null;
    throw error;
  }
};

/**
 * Get the AMI Query Service instance
 * Returns null if not initialized
 */
export const getAmiQueryService = () => {
  return amiQueryServiceInstance;
};

/**
 * Stop and cleanup the AMI Query Service
 */
export const stopAmiQueryService = () => {
  if (amiQueryServiceInstance) {
    console.log('🛑 Stopping AMI Query Service...');
    amiQueryServiceInstance.stop();
    amiQueryServiceInstance = null;
  }
};

/**
 * Check if AMI Query Service is running
 */
export const isAmiQueryServiceRunning = () => {
  return amiQueryServiceInstance && amiQueryServiceInstance.connected;
};