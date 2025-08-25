import express from 'express';
import {
  getCalls,
  getCallById,
  getCallStatistics,
  getLiveCalls
} from '../controllers/callController.js';

const router = express.Router();

// GET /api/calls - Get all calls with pagination and filtering
router.get('/', getCalls);

// GET /api/calls/statistics - Get call statistics
router.get('/statistics', getCallStatistics);

// GET /api/calls/live - Get live/active calls
router.get('/live', getLiveCalls);

// GET /api/calls/:id - Get call by ID with details
router.get('/:id', getCallById);

export default router;