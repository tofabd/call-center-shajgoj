import express from 'express';
import {
  getCalls,
  getCallById,
  getCallDetails,
  getCallStatistics,
  getLiveCalls,
  getTodayStats,
  getWeeklyStats,
  getMonthlyStats,
  getCustomRangeStats
} from '../controllers/callController.js';

const router = express.Router();

// GET /api/calls - Get all calls with pagination and filtering
router.get('/', getCalls);

// GET /api/calls/statistics - Get call statistics
router.get('/statistics', getCallStatistics);

// GET /api/calls/today-stats - Get today's statistics
router.get('/today-stats', getTodayStats);

// GET /api/calls/weekly-stats - Get weekly statistics  
router.get('/weekly-stats', getWeeklyStats);

// GET /api/calls/monthly-stats - Get monthly statistics
router.get('/monthly-stats', getMonthlyStats);

// GET /api/calls/custom-range-stats - Get custom date range statistics
router.get('/custom-range-stats', getCustomRangeStats);

// GET /api/calls/live - Get live/active calls
router.get('/live', getLiveCalls);

// GET /api/calls/:id/details - Get detailed call information (NEW)
router.get('/:id/details', getCallDetails);

// GET /api/calls/:id - Get call by ID with details
router.get('/:id', getCallById);

export default router;