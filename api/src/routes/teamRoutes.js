import express from 'express';
import {
  getTeams,
  getTeamById,
  createTeam,
  updateTeam,
  deleteTeam,
  getTeamStatistics,
  getTeamsSimple
} from '../controllers/teamController.js';

const router = express.Router();

// GET /api/teams - Get all teams with pagination and filtering
router.get('/', getTeams);

// GET /api/teams/simple - Get teams for dropdown/selection
router.get('/simple', getTeamsSimple);

// GET /api/teams/statistics - Get team statistics
router.get('/statistics', getTeamStatistics);

// GET /api/teams/:id - Get team by ID with members
router.get('/:id', getTeamById);

// POST /api/teams - Create new team
router.post('/', createTeam);

// PUT /api/teams/:id - Update team
router.put('/:id', updateTeam);

// DELETE /api/teams/:id - Delete team
router.delete('/:id', deleteTeam);

export default router;