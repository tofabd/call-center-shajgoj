import express from 'express';
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

// GET /api/extensions/query-service/status - Get AMI Query Service status
router.get('/query-service/status', getQueryServiceStatus);

// POST /api/extensions - Create new extension
router.post('/', createExtension);

// POST /api/extensions/refresh - Manual refresh extension status (existing)
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