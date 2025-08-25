import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/database.js';
import userRoutes from './routes/userRoutes.js';
import authRoutes from './routes/authRoutes.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Call Center Shajgoj API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      users: '/api/users',
      auth: '/api/auth',
      documentation: '/api/docs'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    database: 'Connected',
    uptime: process.uptime()
  });
});

// API Routes
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);

// Documentation endpoint
app.get('/api/docs', (req, res) => {
  res.json({
    title: 'Call Center Shajgoj API Documentation',
    version: '1.0.0',
    endpoints: {
      users: {
        'GET /api/users': 'Get all users with pagination and filtering',
        'GET /api/users/active': 'Get only active users',
        'GET /api/users/:id': 'Get user by ID',
        'POST /api/users': 'Create new user',
        'POST /api/users/bulk': 'Bulk create users',
        'PUT /api/users/:id': 'Update user',
        'DELETE /api/users/:id': 'Delete user'
      },
      authentication: {
        'POST /api/auth/login': 'User login with email and password',
        'POST /api/auth/profile': 'Get user profile by email'
      }
    },
    examples: {
      createUser: {
        method: 'POST',
        url: '/api/users',
        body: {
          name: 'John Doe',
          email: 'john.doe@example.com',
          extension: '1001',
          password: 'password123',
          role: 'agent',
          department: 'Sales'
        }
      },
      login: {
        method: 'POST',
        url: '/api/auth/login',
        body: {
          email: 'tofa@gmail.com',
          password: '12345678'
        }
      },
      getUsersWithFilters: {
        method: 'GET',
        url: '/api/users?page=1&limit=10&role=agent&search=john'
      }
    }
  });
});

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📱 API available at http://localhost:${PORT}`);
  console.log(`🔍 Health check at http://localhost:${PORT}/health`);
  console.log(`📚 API docs at http://localhost:${PORT}/api/docs`);
  console.log(`👥 Users API at http://localhost:${PORT}/api/users`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received. Shutting down gracefully...');
  process.exit(0);
});
