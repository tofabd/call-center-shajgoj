import logger from '../config/logging.js';
import HybridAmiService from '../services/HybridAmiService.js';
import Extension from '../models/Extension.js';

// Store separate connection instances
const separateConnections = new Map();

/**
 * Create a separate Hybrid AMI connection and refresh extension statuses
 * This bypasses the project's existing connection and creates a new one
 */
export const createSeparateConnectionAndRefresh = async (req, res) => {
  const connectionId = `separate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    logger.info(`🚀 [HybridAmiRefreshController] Creating separate Hybrid AMI connection: ${connectionId}`);
    
    // Create a new Hybrid AMI Service instance (separate from project's main instance)
    const separateAmiService = new HybridAmiService();
    
    // Start the separate service
    await separateAmiService.start();
    
    if (!separateAmiService.isHealthy()) {
      throw new Error('Failed to establish separate Hybrid AMI connection');
    }
    
    logger.info(`✅ [HybridAmiRefreshController] Separate connection established: ${connectionId}`);
    
    // Store the separate connection
    separateConnections.set(connectionId, {
      service: separateAmiService,
      createdAt: new Date(),
      lastUsed: new Date()
    });
    
    // Get all active extensions from database
    const dbExtensions = await Extension.find({ is_active: true }).lean();
    logger.info(`📋 [HybridAmiRefreshController] Found ${dbExtensions.length} active extensions in database`);
    
    // Filter out non-numeric extensions (only 4-digit numbers)
    const validExtensions = dbExtensions.filter(ext => /^\d{4}$/.test(ext.extension));
    logger.info(`🔍 [HybridAmiRefreshController] Processing ${validExtensions.length} valid extensions`);
    
    // Query each extension status via the separate AMI connection
    const results = [];
    let successfulQueries = 0;
    let failedQueries = 0;
    
    for (const extension of validExtensions) {
      try {
        logger.info(`🔍 [HybridAmiRefreshController] Querying extension ${extension.extension} via separate connection`);
        
        const statusResult = await separateAmiService.queryExtensionStatus(extension.extension);
        
        if (statusResult.error) {
          logger.warn(`⚠️ [HybridAmiRefreshController] Extension ${extension.extension} query failed: ${statusResult.error}`);
          failedQueries++;
        } else {
          logger.info(`✅ [HybridAmiRefreshController] Extension ${extension.extension}: ${statusResult.status} (${statusResult.statusCode})`);
          successfulQueries++;
          
          // Update extension status in database
          await Extension.findByIdAndUpdate(extension._id, {
            status: statusResult.status,
            status_code: statusResult.statusCode,
            device_state: statusResult.statusText || 'UNKNOWN',
            last_seen: new Date(),
            last_status_change: new Date(),
            updated_at: new Date()
          });
          
          results.push({
            extension: extension.extension,
            status: statusResult.status,
            statusCode: statusResult.statusCode,
            statusText: statusResult.statusText
          });
        }
        
        // Small delay between queries to avoid overwhelming AMI
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        logger.error(`❌ [HybridAmiRefreshController] Error querying extension ${extension.extension}:`, error.message);
        failedQueries++;
      }
    }
    
    // Update last used timestamp
    const connectionInfo = separateConnections.get(connectionId);
    if (connectionInfo) {
      connectionInfo.lastUsed = new Date();
    }
    
    logger.info(`✅ [HybridAmiRefreshController] Separate connection refresh completed: ${connectionId}`, {
      extensionsChecked: validExtensions.length,
      successfulQueries,
      failedQueries,
      resultsCount: results.length
    });
    
    res.json({
      success: true,
      message: 'Extension status refresh completed via separate Hybrid AMI connection',
      data: {
        connectionId,
        extensionsChecked: validExtensions.length,
        lastQueryTime: new Date().toISOString(),
        statistics: {
          successfulQueries,
          failedQueries
        },
        results: results
      }
    });
    
  } catch (error) {
    logger.error(`❌ [HybridAmiRefreshController] Separate connection refresh failed: ${connectionId}`, { error: error.message });
    
    // Clean up failed connection
    if (separateConnections.has(connectionId)) {
      try {
        const connectionInfo = separateConnections.get(connectionId);
        await connectionInfo.service.stop();
        separateConnections.delete(connectionId);
      } catch (cleanupError) {
        logger.error(`❌ [HybridAmiRefreshController] Failed to cleanup connection ${connectionId}:`, cleanupError.message);
      }
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to create separate Hybrid AMI connection and refresh extensions',
      error: error.message,
      connectionId
    });
  }
};

/**
 * Get status of separate Hybrid AMI connections
 */
export const getSeparateConnectionStatus = async (req, res) => {
  try {
    const connections = Array.from(separateConnections.entries()).map(([id, info]) => ({
      connectionId: id,
      createdAt: info.createdAt,
      lastUsed: info.lastUsed,
      isHealthy: info.service.isHealthy(),
      connectionState: info.service.connectionState
    }));
    
    res.json({
      success: true,
      message: 'Separate connection status retrieved successfully',
      data: {
        activeConnections: connections.length,
        connections: connections
      }
    });
    
  } catch (error) {
    logger.error('❌ [HybridAmiRefreshController] Failed to get separate connection status:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to get separate connection status',
      error: error.message
    });
  }
};

/**
 * Close a specific separate Hybrid AMI connection
 */
export const closeSeparateConnection = async (req, res) => {
  const { connectionId } = req.params;
  
  try {
    if (!separateConnections.has(connectionId)) {
      return res.status(404).json({
        success: false,
        message: 'Separate connection not found',
        connectionId
      });
    }
    
    const connectionInfo = separateConnections.get(connectionId);
    await connectionInfo.service.stop();
    separateConnections.delete(connectionId);
    
    logger.info(`✅ [HybridAmiRefreshController] Separate connection closed: ${connectionId}`);
    
    res.json({
      success: true,
      message: 'Separate connection closed successfully',
      connectionId
    });
    
  } catch (error) {
    logger.error(`❌ [HybridAmiRefreshController] Failed to close separate connection ${connectionId}:`, error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to close separate connection',
      error: error.message,
      connectionId
    });
  }
};

/**
 * Close all separate Hybrid AMI connections
 */
export const closeAllSeparateConnections = async (req, res) => {
  try {
    const connectionIds = Array.from(separateConnections.keys());
    
    for (const connectionId of connectionIds) {
      try {
        const connectionInfo = separateConnections.get(connectionId);
        await connectionInfo.service.stop();
        separateConnections.delete(connectionId);
        logger.info(`✅ [HybridAmiRefreshController] Closed separate connection: ${connectionId}`);
      } catch (error) {
        logger.error(`❌ [HybridAmiRefreshController] Failed to close connection ${connectionId}:`, error.message);
      }
    }
    
    res.json({
      success: true,
      message: 'All separate connections closed successfully',
      closedConnections: connectionIds.length
    });
    
  } catch (error) {
    logger.error('❌ [HybridAmiRefreshController] Failed to close all separate connections:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to close all separate connections',
      error: error.message
    });
  }
};

/**
 * Cleanup old connections (older than 5 minutes)
 */
export const cleanupOldConnections = async () => {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const connectionsToRemove = [];
  
  for (const [connectionId, info] of separateConnections.entries()) {
    if (info.lastUsed < fiveMinutesAgo) {
      connectionsToRemove.push(connectionId);
    }
  }
  
  for (const connectionId of connectionsToRemove) {
    try {
      const connectionInfo = separateConnections.get(connectionId);
      await connectionInfo.service.stop();
      separateConnections.delete(connectionId);
      logger.info(`🧹 [HybridAmiRefreshController] Cleaned up old connection: ${connectionId}`);
    } catch (error) {
      logger.error(`❌ [HybridAmiRefreshController] Failed to cleanup old connection ${connectionId}:`, error.message);
    }
  }
  
  if (connectionsToRemove.length > 0) {
    logger.info(`🧹 [HybridAmiRefreshController] Cleaned up ${connectionsToRemove.length} old connections`);
  }
};

// Setup periodic cleanup every 2 minutes
setInterval(cleanupOldConnections, 2 * 60 * 1000);
