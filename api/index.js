import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/database.js';
import userRoutes from './routes/userRoutes.js';
import authRoutes from './routes/authRoutes.js';
import callRoutes from './routes/callRoutes.js';
import extensionRoutes from './routes/extensionRoutes.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import AmiListener from './services/AmiListener.js';
import { initializeAmiQueryService, stopAmiQueryService } from './services/AmiQueryServiceInstance.js';
import broadcast from './services/BroadcastService.js';

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
app.use('/api/calls', callRoutes);
app.use('/api/extensions', extensionRoutes);

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
  console.log('🔌 Client connected:', socket.id);
  
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
      console.log(`⚠️ Client ${socket.id} seems unresponsive, disconnecting...`);
      socket.disconnect();
      clearInterval(healthCheck);
    }
  }, 30000);
  
  socket.on('disconnect', (reason) => {
    console.log('🔌 Client disconnected:', socket.id, 'Reason:', reason);
    clearInterval(healthCheck);
  });
});

// Bridge BroadcastService events to Socket.IO
broadcast.onCallUpdated((call) => {
  console.log('📡 Broadcasting call update to all clients:', call.linkedid);
  io.emit('call-updated', {
    id: call._id,
    linkedid: call.linkedid,
    status: call.status,
    direction: call.direction,
    other_party: call.other_party,
    agent_exten: call.agent_exten,
    started_at: call.started_at,
    answered_at: call.answered_at,
    ended_at: call.ended_at,
    duration: call.talk_seconds,
    timestamp: new Date().toISOString()
  });
});

broadcast.onExtensionStatusUpdated((extension) => {
  console.log('📱 Broadcasting extension status to all clients:', extension.extension);
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
  console.log('🚀 Server is running on port', PORT);
  console.log('📱 API available at http://localhost:' + PORT);
  console.log('🔍 Health check at http://localhost:' + PORT + '/health');
  console.log('📚 API docs at http://localhost:' + PORT + '/api/docs');
  console.log('👥 Users API at http://localhost:' + PORT + '/api/users');
  console.log('📞 Calls API at http://localhost:' + PORT + '/api/calls');
  console.log('📱 Extensions API at http://localhost:' + PORT + '/api/extensions');
  console.log('🔌 Socket.IO server running for real-time updates');

  
  // Start AMI services after server is running
  if (process.env.ENABLE_AMI_LISTENER !== 'false') {
    console.log('🎧 Starting AMI Listener...');
    const amiListener = new AmiListener();
    amiListener.start().catch(err => {
      console.error('❌ Failed to start AMI Listener:', err.message);
    });
    
    // Graceful shutdown for AMI listener
    process.on('SIGTERM', () => {
      console.log('🛑 SIGTERM received. Shutting down AMI listener...');
      amiListener.stop();
    });
    
    process.on('SIGINT', () => {
      console.log('🛑 SIGINT received. Shutting down AMI listener...');
      amiListener.stop();
    });
  } else {
    console.log('⚠️ AMI Listener is disabled');
  }

  // Start AMI Query Service for periodic status checks
  if (process.env.ENABLE_AMI_QUERY_SERVICE !== 'false') {
    console.log('🔍 Starting AMI Query Service for periodic extension status checks...');
    initializeAmiQueryService().catch(err => {
      console.error('❌ Failed to start AMI Query Service:', err.message);
    });
    
    // Graceful shutdown for AMI Query Service
    process.on('SIGTERM', () => {
      console.log('🛑 SIGTERM received. Shutting down AMI Query Service...');
      stopAmiQueryService();
    });
    
    process.on('SIGINT', () => {
      console.log('🛑 SIGINT received. Shutting down AMI Query Service...');
      stopAmiQueryService();
    });
  } else {
    console.log('⚠️ AMI Query Service is disabled');
  }
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
