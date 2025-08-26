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
  getQueryServiceStatus
} from '../controllers/extensionController.js';

const router = express.Router();

// GET /api/extensions - Get all extensions with pagination and filtering
router.get('/', getExtensions);

// GET /api/extensions/statistics - Get extension statistics
router.get('/statistics', getExtensionStatistics);

// GET /api/extensions/query-service/status - Get AMI Query Service status
router.get('/query-service/status', getQueryServiceStatus);

// POST /api/extensions - Create new extension
router.post('/', createExtension);

// POST /api/extensions/refresh - Manual refresh extension status
router.post('/refresh', refreshExtensionStatus);

// PUT /api/extensions/status - Update extension status (used by AMI)
router.put('/status', updateExtensionStatus);

// GET /api/extensions/:id - Get extension by ID
router.get('/:id', getExtensionById);

// PUT /api/extensions/:id - Update extension
router.put('/:id', updateExtension);

// DELETE /api/extensions/:id - Delete extension
router.delete('/:id', deleteExtension);

export default router;