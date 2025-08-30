import express from 'express';
import fs from 'fs';
import path from 'path';
import {
  getExtensions,
  getExtensionById,
  createExtension,
  updateExtension,
  deleteExtension,
  updateExtensionStatus,
  getExtensionStatistics,
  refreshExtensionStatus,
  getQueryServiceStatus,
  getExtensionCallStatistics
} from '../controllers/extensionController.js';

import {
  createSeparateConnectionAndRefresh,
  getSeparateConnectionStatus,
  closeSeparateConnection,
  closeAllSeparateConnections
} from '../controllers/hybridAmiRefreshController.js';

const router = express.Router();

// GET /api/extensions - Get all extensions with pagination and filtering
router.get('/', getExtensions);

// GET /api/extensions/statistics - Get extension statistics
router.get('/statistics', getExtensionStatistics);

// GET /api/extensions/query-service/status - Get AMI Query Service status (uses separate connection)
router.get('/query-service/status', getQueryServiceStatus);

// GET /api/extensions/ami-responses - List available AMI response JSON files
router.get('/ami-responses', (req, res) => {
  try {
    const debugDir = path.join(process.cwd(), 'debug', 'ami-responses');
    if (!fs.existsSync(debugDir)) {
      return res.json({
        success: true,
        data: {
          files: [],
          message: 'No AMI response files found'
        }
      });
    }
    
    const files = fs.readdirSync(debugDir)
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const filepath = path.join(debugDir, file);
        const stats = fs.statSync(filepath);
        return {
          filename: file,
          fileSize: stats.size,
          createdAt: stats.birthtime,
          modifiedAt: stats.mtime
        };
      })
      .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());
    
    res.json({
      success: true,
      data: {
        files: files,
        totalFiles: files.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to list AMI response files',
      error: error.message
    });
  }
});

// GET /api/extensions/ami-responses/:filename - Download specific AMI response JSON file
router.get('/ami-responses/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const debugDir = path.join(process.cwd(), 'debug', 'ami-responses');
    const filepath = path.join(debugDir, filename);
    
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({
        success: false,
        message: 'AMI response file not found'
      });
    }
    
    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Stream the file
    const fileStream = fs.createReadStream(filepath);
    fileStream.pipe(res);
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to download AMI response file',
      error: error.message
    });
  }
});

// POST /api/extensions - Create new extension
router.post('/', createExtension);

// POST /api/extensions/refresh - Manual refresh extension status (uses separate Hybrid AMI connection)
router.post('/refresh', refreshExtensionStatus);

// Hybrid AMI Refresh Routes - Separate connection operations
// POST /api/extensions/hybrid-refresh - Create separate connection and refresh
router.post('/hybrid-refresh', createSeparateConnectionAndRefresh);

// GET /api/extensions/hybrid-refresh/status - Get separate connection status
router.get('/hybrid-refresh/status', getSeparateConnectionStatus);

// POST /api/extensions/hybrid-refresh/close - Close all separate connections
router.post('/hybrid-refresh/close', closeAllSeparateConnections);

// PUT /api/extensions/status - Update extension status (used by AMI)
router.put('/status', updateExtensionStatus);

// GET /api/extensions/:id - Get extension by ID
router.get('/:id', getExtensionById);

// GET /api/extensions/:id/call-statistics - Get call statistics for specific extension
router.get('/:id/call-statistics', getExtensionCallStatistics);

// PUT /api/extensions/:id - Update extension
router.put('/:id', updateExtension);

// DELETE /api/extensions/:id - Delete extension
router.delete('/:id', deleteExtension);

export default router;