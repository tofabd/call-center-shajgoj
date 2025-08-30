import dotenv from 'dotenv';
import connectDB from './src/config/database.js';
import { getAmiQueryService } from './src/services/AmiQueryServiceInstance.js';
import { createComponentLogger } from './src/config/logging.js';

dotenv.config();

const logger = createComponentLogger('TestExtensionUpdate');

async function testExtensionUpdate() {
  try {
    logger.info('🧪 Starting extension update test...');
    
    // Connect to database
    await connectDB();
    logger.info('✅ Database connected');
    
    // Get AMI Query Service
    const amiQueryService = getAmiQueryService();
    if (!amiQueryService) {
      logger.error('❌ AMI Query Service not available');
      return;
    }
    
    logger.info('✅ AMI Query Service available');
    
    // Test manual refresh
    logger.info('🔄 Testing manual extension refresh...');
    const result = await amiQueryService.manualRefresh();
    
    logger.info('✅ Manual refresh completed', {
      success: result.success,
      message: result.message,
      extensionsChecked: result.extensionsChecked,
      lastQueryTime: result.lastQueryTime
    });
    
    // Test service status
    logger.info('📊 Getting service status...');
    const status = await amiQueryService.getStatus();
    
    logger.info('✅ Service status retrieved', {
      connected: status.connected,
      extensionsMonitored: status.extensionsMonitored,
      isQuerying: status.isQuerying,
      lastQueryTime: status.lastQueryTime,
      statistics: status.statistics
    });
    
    logger.info('🎉 Test completed successfully');
    
  } catch (error) {
    logger.error('❌ Test failed', { error: error.message, stack: error.stack });
  } finally {
    process.exit(0);
  }
}

// Run the test
testExtensionUpdate();

