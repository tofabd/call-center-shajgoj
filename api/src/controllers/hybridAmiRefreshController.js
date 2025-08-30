import logger from '../config/logging.js';
import HybridAmiService from '../services/HybridAmiService.js';
import Extension from '../models/Extension.js';
import fs from 'fs';
import path from 'path';

// Store separate connection instances
const separateConnections = new Map();

/**
 * Create JSON file with raw AMI response data for manual refresh
 */
const createAmiResponseJsonFile = async (rawAmiData, connectionId) => {
  try {
    // Create debug directory if it doesn't exist
    const debugDir = path.join(process.cwd(), 'debug', 'ami-responses');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    
    // Create filename with timestamp and connection ID
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `ami-raw-responses-${timestamp}-${connectionId}.json`;
    const filepath = path.join(debugDir, filename);
    
    // Prepare JSON data with raw AMI responses
    const jsonData = {
      metadata: {
        refreshTimestamp: new Date().toISOString(),
        connectionId: connectionId,
        amiHost: process.env.AMI_HOST,
        amiPort: process.env.AMI_PORT,
        generatedAt: new Date().toISOString(),
        note: "This file contains RAW AMI responses from Asterisk, not processed database data"
      },
      // Individual extension queries with raw AMI responses
      individualResponses: rawAmiData.individualResponses || [],
      // Bulk ExtensionStateList response if available
      bulkResponse: rawAmiData.bulkResponse || null,
      summary: {
        totalExtensions: rawAmiData.individualResponses?.length || 0,
        successfulQueries: rawAmiData.individualResponses?.filter(r => r.success).length || 0,
        failedQueries: rawAmiData.individualResponses?.filter(r => !r.success).length || 0,
        hasBulkResponse: !!rawAmiData.bulkResponse
      }
    };
    
    // Write JSON file
    fs.writeFileSync(filepath, JSON.stringify(jsonData, null, 2));
    
    logger.info(`📄 Raw AMI response JSON file created: ${filepath}`);
    
    return {
      filename: filename,
      filepath: filepath,
      fileSize: fs.statSync(filepath).size
    };
    
  } catch (error) {
    logger.error('❌ Failed to create raw AMI response JSON file:', error.message);
    return null;
  }
};

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
    
    // First, try to get ExtensionStateList (bulk query) for raw AMI data
    let bulkAmiResponse = null;
    try {
      logger.info(`📊 [HybridAmiRefreshController] Attempting bulk ExtensionStateList query...`);
      bulkAmiResponse = await separateAmiService.queryExtensionStateList();
      logger.info(`📊 [HybridAmiRefreshController] Bulk query successful: ${bulkAmiResponse.extensions?.length || 0} extensions found`);
    } catch (error) {
      logger.warn(`⚠️ [HybridAmiRefreshController] Bulk query failed, falling back to individual queries: ${error.message}`);
    }
    
    // Process bulk response if available, otherwise fall back to individual queries
    const results = [];
    const amiResponses = []; // Store all AMI responses for JSON file
    let successfulQueries = 0;
    let failedQueries = 0;
    
    if (bulkAmiResponse && bulkAmiResponse.extensions && bulkAmiResponse.extensions.length > 0) {
      // Process bulk response
      logger.info(`🔄 [HybridAmiRefreshController] Processing bulk response for ${bulkAmiResponse.extensions.length} extensions`);
      
      // Create a map of AMI extensions for quick lookup
      const amiExtensionMap = new Map();
      bulkAmiResponse.extensions.forEach(amiExt => {
        amiExtensionMap.set(amiExt.extension, amiExt);
      });
      
      // Process each database extension against AMI data
      for (const dbExtension of validExtensions) {
        try {
          const amiExtension = amiExtensionMap.get(dbExtension.extension);
          
          if (amiExtension) {
            // Extension found in AMI response
            const statusResult = {
              status: amiExtension.status,
              statusCode: amiExtension.statusCode,
              statusText: amiExtension.context || 'UNKNOWN',
              error: null
            };
            
            // Store AMI response for JSON file
            const amiResponse = {
              extension: dbExtension.extension,
              agent_name: dbExtension.agent_name,
              database_id: dbExtension._id,
              query_timestamp: new Date().toISOString(),
              success: true,
              rawAmiResponse: `Extension: ${amiExtension.extension}, Status: ${amiExtension.statusCode}, Context: ${amiExtension.context}`,
              parsedResult: statusResult
            };
            amiResponses.push(amiResponse);
            
            logger.info(`✅ [HybridAmiRefreshController] Extension ${dbExtension.extension}: ${statusResult.status} (${statusResult.statusCode})`);
            successfulQueries++;
            
            // Update extension status in database
            await Extension.findByIdAndUpdate(dbExtension._id, {
              status: statusResult.status,
              status_code: statusResult.statusCode,
              device_state: statusResult.statusText,
              last_seen: new Date(),
              last_status_change: new Date(),
              updated_at: new Date()
            });
            
            results.push({
              extension: dbExtension.extension,
              status: statusResult.status,
              statusCode: statusResult.statusCode,
              statusText: statusResult.statusText
            });
            
          } else {
            // Extension not found in AMI response
            logger.warn(`⚠️ [HybridAmiRefreshController] Extension ${dbExtension.extension} not found in AMI response`);
            failedQueries++;
            
            // Add failed response to AMI responses
            amiResponses.push({
              extension: dbExtension.extension,
              agent_name: dbExtension.agent_name,
              database_id: dbExtension._id,
              query_timestamp: new Date().toISOString(),
              success: false,
              rawAmiResponse: 'Extension not found in AMI response',
              parsedResult: {
                status: 'unknown',
                statusCode: null,
                statusText: null,
                error: 'Extension not found in AMI response'
              }
            });
          }
          
        } catch (error) {
          logger.error(`❌ [HybridAmiRefreshController] Error processing extension ${dbExtension.extension}:`, error.message);
          failedQueries++;
          
          // Add error response to AMI responses
          amiResponses.push({
            extension: dbExtension.extension,
            agent_name: dbExtension.agent_name,
            database_id: dbExtension._id,
            query_timestamp: new Date().toISOString(),
            success: false,
            rawAmiResponse: 'Processing error',
            parsedResult: {
              status: 'unknown',
              statusCode: null,
              statusText: null,
              error: error.message
            }
          });
        }
      }
      
    } else {
      // Fallback to individual queries if bulk query failed
      logger.info(`🔄 [HybridAmiRefreshController] Fallback: Using individual extension queries`);
      
      for (const extension of validExtensions) {
        try {
          logger.info(`🔍 [HybridAmiRefreshController] Querying extension ${extension.extension} via separate connection`);
          
          const statusResult = await separateAmiService.queryExtensionStatus(extension.extension);
          
          // Store RAW AMI response for JSON file
          const amiResponse = {
            extension: extension.extension,
            agent_name: extension.agent_name,
            database_id: extension._id,
            query_timestamp: new Date().toISOString(),
            success: !statusResult.error,
            // Raw AMI data from Asterisk
            rawAmiResponse: statusResult.rawAmiResponse || 'No raw response captured',
            // Parsed result for database update
            parsedResult: {
              status: statusResult.status,
              statusCode: statusResult.statusCode,
              statusText: statusResult.statusText,
              error: statusResult.error
            }
          };
          amiResponses.push(amiResponse);
          
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
          
          // Add failed response to AMI responses
          amiResponses.push({
            extension: extension.extension,
            agent_name: extension.agent_name,
            database_id: extension._id,
            query_timestamp: new Date().toISOString(),
            success: false,
            rawAmiResponse: 'Query error',
            parsedResult: {
              status: 'unknown',
              statusCode: null,
              statusText: null,
              error: error.message
            }
          });
        }
      }
    }
    
    // Update last used timestamp
    const connectionInfo = separateConnections.get(connectionId);
    if (connectionInfo) {
      connectionInfo.lastUsed = new Date();
    }
    
    // Create JSON file with AMI responses (including bulk response if available)
    const allAmiData = {
      individualResponses: amiResponses,
      bulkResponse: bulkAmiResponse
    };
    const jsonFileInfo = await createAmiResponseJsonFile(allAmiData, connectionId);
    
    logger.info(`✅ [HybridAmiRefreshController] Separate connection refresh completed: ${connectionId}`, {
      extensionsChecked: validExtensions.length,
      successfulQueries,
      failedQueries,
      resultsCount: results.length,
      jsonFileCreated: !!jsonFileInfo,
      jsonFilename: jsonFileInfo?.filename
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
        results: results,
        jsonFile: jsonFileInfo ? {
          filename: jsonFileInfo.filename,
          fileSize: jsonFileInfo.fileSize,
          message: 'AMI response data saved to JSON file'
        } : null
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
