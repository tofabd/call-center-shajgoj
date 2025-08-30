import logger from '../config/logging.js';
import HybridAmiService from '../services/HybridAmiService.js';
import Extension from '../models/Extension.js';
import broadcast from '../services/BroadcastService.js';
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
        note: "This file contains RAW AMI responses from Asterisk, not processed database data",
        queryType: "ExtensionStateList with Events: off",
        parsingStatus: rawAmiData.bulkResponse ? "Successful" : "Failed or No Response"
      },
      // Individual extension queries with raw AMI responses
      individualResponses: rawAmiData.individualResponses || [],
      // Bulk ExtensionStateList response if available
      bulkResponse: rawAmiData.bulkResponse || null,
      // Raw response data for debugging
      rawResponseData: rawAmiData.rawResponseData || null,
      summary: {
        totalExtensions: rawAmiData.individualResponses?.length || 0,
        successfulQueries: rawAmiData.individualResponses?.filter(r => r.success).length || 0,
        failedQueries: rawAmiData.individualResponses?.filter(r => !r.success).length || 0,
        hasBulkResponse: !!rawAmiData.bulkResponse,
        enhancedMetrics: rawAmiData.enhancedMetrics || null,
        parsingSuccessful: rawAmiData.rawResponseData?.parsingSuccessful || false
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
    
    // Filter out non-numeric extensions (allow 3 to 5 digit numbers)
    const validExtensions = dbExtensions.filter(ext => /^\d{3,5}$/.test(ext.extension));
    logger.info(`🔍 [HybridAmiRefreshController] Processing ${validExtensions.length} valid extensions`);
    
    // First, try to get ExtensionStateList (bulk query) for raw AMI data
    let bulkAmiResponse = null;
    try {
      logger.info(`📊 [HybridAmiRefreshController] Attempting enhanced bulk ExtensionStateList query...`);
      bulkAmiResponse = await separateAmiService.queryExtensionStateList();
      
             if (bulkAmiResponse && bulkAmiResponse.extensions) {
         logger.info(`📊 [HybridAmiRefreshController] Events: off bulk query successful:`, {
           extensionsFound: bulkAmiResponse.extensions.length,
           totalEvents: bulkAmiResponse.eventCount || 0,
           extensionEvents: bulkAmiResponse.extensionCount || 0,
           bufferSize: bulkAmiResponse.bufferSize || 0,
           completionEventDetected: bulkAmiResponse.completionEventDetected || false,
           queryFormat: 'Events: off with ExtensionStateListComplete'
         });
       } else {
        logger.warn(`⚠️ [HybridAmiRefreshController] Bulk query returned no extensions`);
      }
    } catch (error) {
      logger.warn(`⚠️ [HybridAmiRefreshController] Bulk query failed, falling back to individual queries: ${error.message}`);
    }
    
    // Process bulk response if available, otherwise fall back to individual queries
    const results = [];
    const amiResponses = []; // Store all AMI responses for JSON file
    let successfulQueries = 0;
    let failedQueries = 0;
    let statusChanges = 0;
    let noChanges = 0;
    let markedOffline = 0;
    
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
            
            // Check if status actually changed to avoid unnecessary database updates
            const statusChanged = dbExtension.status !== statusResult.status || 
                                dbExtension.status_code !== statusResult.statusCode ||
                                dbExtension.device_state !== statusResult.statusText;
            
            if (statusChanged) {
              logger.info(`📝 [HybridAmiRefreshController] Extension ${dbExtension.extension}: ${dbExtension.status} → ${statusResult.status} (${dbExtension.status_code} → ${statusResult.statusCode})`);
              
              // Update extension status in database
              await Extension.findByIdAndUpdate(dbExtension._id, {
                status: statusResult.status,
                status_code: statusResult.statusCode,
                device_state: statusResult.statusText,
                last_seen: new Date(),
                last_status_change: new Date(),
                updated_at: new Date()
              });
              
              // Broadcast status change for real-time frontend updates
              try {
                const updatedExtension = await Extension.findById(dbExtension._id);
                if (updatedExtension) {
                  broadcast.extensionStatusUpdated(updatedExtension);
                }
              } catch (broadcastError) {
                logger.warn(`⚠️ [HybridAmiRefreshController] Failed to broadcast extension ${dbExtension.extension} update:`, broadcastError.message);
              }
              
              statusChanges++;
              successfulQueries++;
            } else {
              logger.info(`✅ [HybridAmiRefreshController] Extension ${dbExtension.extension}: No change (${statusResult.status})`);
              noChanges++;
              successfulQueries++;
            }
            
            // Store AMI response for JSON file
            const amiResponse = {
              extension: dbExtension.extension,
              agent_name: dbExtension.agent_name,
              database_id: dbExtension._id,
              query_timestamp: new Date().toISOString(),
              success: true,
              statusChanged: statusChanged,
              oldStatus: dbExtension.status,
              newStatus: statusResult.status,
              rawAmiResponse: `Extension: ${amiExtension.extension}, Status: ${amiExtension.statusCode}, Context: ${amiExtension.context}`,
              parsedResult: statusResult
            };
            amiResponses.push(amiResponse);
            
            results.push({
              extension: dbExtension.extension,
              status: statusResult.status,
              statusCode: statusResult.statusCode,
              statusText: statusResult.statusText,
              statusChanged: statusChanged
            });
            
          } else {
            // Extension not found in AMI response - mark as offline
            logger.warn(`⚠️ [HybridAmiRefreshController] Extension ${dbExtension.extension} not found in AMI response - marking as offline`);
            
            // Check if extension is currently online (needs to be marked offline)
            if (dbExtension.status !== 'offline') {
              logger.info(`📝 [HybridAmiRefreshController] Extension ${dbExtension.extension}: ${dbExtension.status} → offline (not found in AMI)`);
              
              // Update extension status to offline
              await Extension.findByIdAndUpdate(dbExtension._id, {
                status: 'offline',
                status_code: '4', // Unavailable
                device_state: 'UNAVAILABLE',
                last_seen: new Date(),
                last_status_change: new Date(),
                updated_at: new Date()
              });
              
              // Broadcast status change for real-time frontend updates
              try {
                const updatedExtension = await Extension.findById(dbExtension._id);
                if (updatedExtension) {
                  broadcast.extensionStatusUpdated(updatedExtension);
                }
              } catch (broadcastError) {
                logger.warn(`⚠️ [HybridAmiRefreshController] Failed to broadcast extension ${dbExtension.extension} offline status:`, broadcastError.message);
              }
              
              markedOffline++;
              successfulQueries++;
            } else {
              logger.info(`✅ [HybridAmiRefreshController] Extension ${dbExtension.extension}: Already offline (no change)`);
              noChanges++;
              successfulQueries++;
            }
            
            // Add response to AMI responses
            amiResponses.push({
              extension: dbExtension.extension,
              agent_name: dbExtension.agent_name,
              database_id: dbExtension._id,
              query_timestamp: new Date().toISOString(),
              success: true,
              statusChanged: dbExtension.status !== 'offline',
              oldStatus: dbExtension.status,
              newStatus: 'offline',
              rawAmiResponse: 'Extension not found in AMI response - marked as offline',
              parsedResult: {
                status: 'offline',
                statusCode: '4',
                statusText: 'UNAVAILABLE',
                error: null
              }
            });
            
            results.push({
              extension: dbExtension.extension,
              status: 'offline',
              statusCode: '4',
              statusText: 'UNAVAILABLE',
              statusChanged: dbExtension.status !== 'offline'
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
    
    // Create JSON file with AMI responses (including enhanced bulk response if available)
    const allAmiData = {
      individualResponses: amiResponses,
      bulkResponse: bulkAmiResponse,
      enhancedMetrics: bulkAmiResponse ? {
        totalEvents: bulkAmiResponse.eventCount || 0,
        extensionEvents: bulkAmiResponse.extensionCount || 0,
        bufferSize: bulkAmiResponse.bufferSize || 0,
        extensionsParsed: bulkAmiResponse.extensions?.length || 0,
        completionEventDetected: bulkAmiResponse.completionEventDetected || false
      } : null,
      // Always include raw response data for debugging
      rawResponseData: {
        responseBuffer: bulkAmiResponse?.rawAmiResponse || 'No raw response available',
        eventCount: bulkAmiResponse?.eventCount || 0,
        extensionCount: bulkAmiResponse?.extensionCount || 0,
        bufferSize: bulkAmiResponse?.bufferSize || 0,
        parsingSuccessful: !!bulkAmiResponse?.extensions,
        parsingError: bulkAmiResponse?.error || null
      }
    };
    
    // Always create JSON file, even if parsing failed
    const jsonFileInfo = await createAmiResponseJsonFile(allAmiData, connectionId);
    
    if (jsonFileInfo) {
      logger.info(`📄 JSON file created successfully: ${jsonFileInfo.filename} (${jsonFileInfo.fileSize} bytes)`);
    } else {
      logger.warn(`⚠️ Failed to create JSON file for connection: ${connectionId}`);
    }
    
    logger.info(`✅ [HybridAmiRefreshController] Separate connection refresh completed: ${connectionId}`, {
      extensionsChecked: validExtensions.length,
      successfulQueries,
      failedQueries,
      statusChanges,
      noChanges,
      markedOffline,
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
          failedQueries,
          statusChanges,
          noChanges,
          markedOffline
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
 * Stop an active ExtensionStateList query using Logoff action
 */
export const stopActiveQuery = async (req, res) => {
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
    const { service } = connectionInfo;
    
    // Get the current action ID from the service (if available)
    const currentActionId = service.currentActionId || 'unknown';
    
    // Stop the active query
    const stopped = await service.stopExtensionStateListQuery(currentActionId);
    
    if (stopped) {
      logger.info(`✅ [HybridAmiRefreshController] Query stopped via Logoff action: ${connectionId}`);
      res.json({
        success: true,
        message: 'Query stopped successfully via Logoff action',
        connectionId,
        actionId: currentActionId
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to stop query',
        connectionId,
        actionId: currentActionId
      });
    }
    
  } catch (error) {
    logger.error(`❌ [HybridAmiRefreshController] Failed to stop query for connection ${connectionId}:`, error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to stop query',
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
