import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './src/config/database.js';
import userRoutes from './src/routes/userRoutes.js';
import authRoutes from './src/routes/authRoutes.js';
import callRoutes from './src/routes/callRoutes.js';
import extensionRoutes from './src/routes/extensionRoutes.js';
import { errorHandler, notFound } from './src/middleware/errorHandler.js';
import AmiListener from './src/services/AmiListener.js';
import { initializeAmiQueryService, stopAmiQueryService } from './src/services/AmiQueryServiceInstance.js';
import broadcast from './src/services/BroadcastService.js';
import LogService from './src/services/LogService.js';
import { createLoggingMiddleware } from './src/middleware/loggingMiddleware.js';

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:5173'],
    credentials: true
  }
});
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:5173'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Enhanced logging middleware using Pino
app.use(createLoggingMiddleware());

// Routes
app.get('/', (req, res) => {
  LogService.info('Root endpoint accessed');
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
  LogService.info('Health check endpoint accessed');
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
app.use('/api/calls', callRoutes);
app.use('/api/extensions', extensionRoutes);

// Documentation endpoint
app.get('/api/docs', (req, res) => {
  LogService.info('API documentation endpoint accessed');
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
      calls: {
        'GET /api/calls': 'Get all calls with pagination and filtering',
        'GET /api/calls/statistics': 'Get call statistics',
        'GET /api/calls/live': 'Get live/active calls',
        'GET /api/calls/:id': 'Get call details by ID'
      },
      extensions: {
        'GET /api/extensions': 'Get all extensions with pagination and filtering',
        'GET /api/extensions/statistics': 'Get extension statistics',
        'POST /api/extensions': 'Create new extension',
        'PUT /api/extensions/status': 'Update extension status (AMI)',
        'GET /api/extensions/:id': 'Get extension by ID',
        'PUT /api/extensions/:id': 'Update extension',
        'DELETE /api/extensions/:id': 'Delete extension'
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

// Socket.IO connection handling
io.on('connection', (socket) => {
  LogService.socketEvent('connected', socket.id);
  
  // Send initial connection confirmation
  socket.emit('connected', { 
    message: 'Connected to Call Center API',
    timestamp: new Date().toISOString() 
  });
  
  // Handle heartbeat ping from client
  socket.on('ping', () => {
    socket.emit('pong', {
      timestamp: new Date().toISOString(),
      server_time: Date.now()
    });
  });

  // Add connection health monitoring
  let lastPing = Date.now();
  
  socket.on('ping', () => {
    lastPing = Date.now();
  });

  // Check client health every 30 seconds
  const healthCheck = setInterval(() => {
    const timeSinceLastPing = Date.now() - lastPing;
    if (timeSinceLastPing > 60000) { // 1 minute
      LogService.warn(`Client ${socket.id} seems unresponsive, disconnecting`, { socketId: socket.id, timeSinceLastPing });
      socket.disconnect();
      clearInterval(healthCheck);
    }
  }, 30000);
  
  socket.on('disconnect', (reason) => {
    LogService.socketEvent('disconnected', socket.id, { reason });
    clearInterval(healthCheck);
  });
});

// Bridge BroadcastService events to Socket.IO
broadcast.onCallUpdated((call) => {
  LogService.info('Broadcasting call update to all clients', { linkedid: call.linkedid });
  
  // Derive status from call state using disposition for consistency
  let status;
  if (call.ended_at) {
    // Call has ended - use disposition or default to 'ended'
    status = call.disposition || 'ended';
  } else if (call.answered_at) {
    // Call is answered but not ended
    status = 'answered';
  } else {
    // Call is not answered and not ended
    status = 'ringing';
  }
  
  io.emit('call-updated', {
    id: call._id,
    linkedid: call.linkedid,
    direction: call.direction,
    other_party: call.other_party,
    agent_exten: call.agent_exten,
    started_at: call.started_at,
    answered_at: call.answered_at,
    ended_at: call.ended_at,
    duration: call.talk_seconds,
    status: status, // Include derived status
    disposition: call.disposition, // Also include original disposition
    timestamp: new Date().toISOString()
  });
});

broadcast.onExtensionStatusUpdated((extension) => {
  LogService.info('Broadcasting extension status to all clients', { extension: extension.extension });
  io.emit('extension-status-updated', {
    extension: extension.extension,
    status: extension.status,
    agent_name: extension.agent_name,
    last_seen: extension.last_seen,
    timestamp: new Date().toISOString()
  });
});

// Start server with Socket.IO support
httpServer.listen(PORT, () => {
  LogService.info('Server started successfully', {
    port: PORT,
    endpoints: {
      api: `http://localhost:${PORT}`,
      health: `http://localhost:${PORT}/health`,
      docs: `http://localhost:${PORT}/api/docs`,
      users: `http://localhost:${PORT}/api/users`,
      calls: `http://localhost:${PORT}/api/calls`,
      extensions: `http://localhost:${PORT}/api/extensions`
    }
  });

  
  // Start AMI services after server is running
  if (process.env.ENABLE_AMI_LISTENER !== 'false') {
    LogService.info('Starting AMI Listener service');
    const amiListener = new AmiListener();
    amiListener.start().catch(err => {
      LogService.error('Failed to start AMI Listener', { error: err.message, stack: err.stack });
    });
    
    // Graceful shutdown for AMI listener
    process.on('SIGTERM', () => {
      LogService.info('SIGTERM received, shutting down AMI listener gracefully');
      amiListener.stop();
    });
    
    process.on('SIGINT', () => {
      LogService.info('SIGINT received, shutting down AMI listener gracefully');
      amiListener.stop();
    });
  } else {
    LogService.info('AMI Listener is disabled via environment variable');
  }

  // Start AMI Query Service for periodic status checks
  if (process.env.ENABLE_AMI_QUERY_SERVICE !== 'false') {
    LogService.info('Starting AMI Query Service for periodic extension status checks');
    initializeAmiQueryService().catch(err => {
      LogService.error('Failed to start AMI Query Service', { error: err.message, stack: err.stack });
    });
    
    // Graceful shutdown for AMI Query Service
    process.on('SIGTERM', () => {
      LogService.info('SIGTERM received, shutting down AMI Query Service gracefully');
      stopAmiQueryService();
    });
    
    process.on('SIGINT', () => {
      LogService.info('SIGINT received, shutting down AMI Query Service gracefully');
      stopAmiQueryService();
    });
  } else {
    LogService.info('AMI Query Service is disabled via environment variable');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  LogService.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  LogService.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});
