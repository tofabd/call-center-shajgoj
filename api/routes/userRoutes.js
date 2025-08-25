import express from 'express';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getActiveUsers,
  bulkCreateUsers
} from '../controllers/userController.js';

const router = express.Router();

// GET /api/users - Get all users with pagination and filtering
router.get('/', getAllUsers);

// GET /api/users/active - Get only active users
router.get('/active', getActiveUsers);

// GET /api/users/:id - Get user by ID
router.get('/:id', getUserById);

// POST /api/users - Create new user
router.post('/', createUser);

// POST /api/users/bulk - Bulk create users
router.post('/bulk', bulkCreateUsers);

// PUT /api/users/:id - Update user
router.put('/:id', updateUser);

// DELETE /api/users/:id - Delete user
router.delete('/:id', deleteUser);

export default router;