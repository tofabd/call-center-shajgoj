import express from 'express';
import { login, getProfile } from '../controllers/authController.js';

const router = express.Router();

// POST /api/auth/login - User login
router.post('/login', login);

// POST /api/auth/profile - Get user profile
router.post('/profile', getProfile);

export default router;