import logger from '../config/logging.js';
import Extension from '../models/Extension.js';
import broadcast from '../services/BroadcastService.js';
import fs from 'fs';
import path from 'path';
import { performExtensionRefresh } from '../../scripts/standaloneRefresh.js';



/**
 * Create JSON file with refresh results for debugging
 */
const createRefreshResultsJsonFile = async (refreshResults, connectionId) => {
  try {
    // Create debug directory if it doesn't exist
    const debugDir = path.join(process.cwd(), 'debug', 'refresh-results');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    
    // Create filename with timestamp and connection ID
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `refresh-results-${timestamp}-${connectionId}.json`;
    const filepath = path.join(debugDir, filename);
    
    // Write JSON file
    fs.writeFileSync(filepath, JSON.stringify(refreshResults, null, 2));
    
    logger.info(`📄 Refresh results JSON file created: ${filepath}`);
    
    return {
      filename: filename,
      filepath: filepath,
      fileSize: fs.statSync(filepath).size
    };
    
  } catch (error) {
    logger.error('❌ Failed to create refresh results JSON file:', error.message);
    return null;
  }
};

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
 * Create a separate AMI connection and refresh extension statuses
 * This bypasses the project's existing connection and uses the standalone refresh script
 */
export const createSeparateConnectionAndRefresh = async (req, res) => {
  const connectionId = `separate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    logger.info(`🚀 [AmiRefreshController] Starting extension refresh via standalone script: ${connectionId}`);
    
    // Use the standalone refresh script
    const refreshResults = await performExtensionRefresh();
    
    if (!refreshResults.success) {
      throw new Error(refreshResults.error || 'Refresh failed with unknown error');
    }
    
    logger.info(`✅ [AmiRefreshController] Extension refresh completed successfully: ${connectionId}`, {
      duration: refreshResults.duration,
      amiExtensions: refreshResults.amiExtensions,
      updated: refreshResults.updated,
      unchanged: refreshResults.unchanged,
      markedOffline: refreshResults.markedOffline,
      errors: refreshResults.errors
    });
    
    // Create JSON file with refresh results for debugging
    const jsonFileInfo = await createRefreshResultsJsonFile(refreshResults, connectionId);
    
    res.json({
      success: true,
      message: 'Extension status refresh completed via standalone script',
      data: {
        connectionId,
        extensionsChecked: refreshResults.totalProcessed,
        lastQueryTime: refreshResults.timestamp,
        duration: refreshResults.duration,
        statistics: {
          successfulQueries: refreshResults.updated + refreshResults.unchanged + refreshResults.markedOffline,
          failedQueries: refreshResults.errors,
          statusChanges: refreshResults.updated + refreshResults.markedOffline,
          noChanges: refreshResults.unchanged,
          markedOffline: refreshResults.markedOffline
        },
        results: refreshResults,
        jsonFile: jsonFileInfo ? {
          filename: jsonFileInfo.filename,
          fileSize: jsonFileInfo.fileSize,
          message: 'Refresh results saved to JSON file'
        } : null
      }
    });
    
  } catch (error) {
    logger.error(`❌ [AmiRefreshController] Extension refresh failed: ${connectionId}`, { error: error.message });
    
    res.status(500).json({
      success: false,
      message: 'Failed to refresh extension statuses',
      error: error.message,
      connectionId
    });
  }
};

/**
 * Get status of extension refresh operations
 */
export const getSeparateConnectionStatus = async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Extension refresh status retrieved successfully',
      data: {
        message: 'Using standalone refresh script - no persistent connections'
      }
    });
    
  } catch (error) {
    logger.error('❌ [AmiRefreshController] Failed to get refresh status:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to get refresh status',
      error: error.message
    });
  }
};

/**
 * Close specific connection (not applicable for standalone script)
 */
export const closeSeparateConnection = async (req, res) => {
  res.json({
    success: true,
    message: 'Using standalone refresh script - no persistent connections to close'
  });
};

/**
 * Stop active query (not applicable for standalone script)
 */
export const stopActiveQuery = async (req, res) => {
  res.json({
    success: true,
    message: 'Using standalone refresh script - no persistent queries to stop'
  });
};

/**
 * Close all connections (not applicable for standalone script)
 */
export const closeAllSeparateConnections = async (req, res) => {
  res.json({
    success: true,
    message: 'Using standalone refresh script - no persistent connections to close'
  });
};

