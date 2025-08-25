#!/usr/bin/env node

import mongoose from 'mongoose';
import AmiListener from './services/AmiListener.js';
import broadcast from './services/BroadcastService.js';
import Log from './services/LogService.js';
import dotenv from 'dotenv';

dotenv.config();

class AmiProcess {
  constructor() {
    this.amiListener = null;
    this.isShuttingDown = false;
    this.heartbeatInterval = null;
    this.mongoConnection = null;
  }

  async start() {
    try {
      Log.info('🚀 Starting AMI Listener Process...');
      
      // Connect to MongoDB
      const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/call_center_shajgoj';
      this.mongoConnection = await mongoose.connect(MONGODB_URI);
      Log.info('✅ Connected to MongoDB', { uri: MONGODB_URI });

      // Start AMI listener
      this.amiListener = new AmiListener();
      await this.amiListener.start();
      Log.info('✅ AMI Listener started successfully');

      // Setup process monitoring
      this.setupProcessMonitoring();
      this.setupEventLogging();
      this.setupGracefulShutdown();

      Log.info('🎧 AMI Listener is running. Process monitoring active.');

    } catch (error) {
      Log.error('❌ Failed to start AMI listener process', { 
        error: error.message, 
        stack: error.stack 
      });
      process.exit(1);
    }
  }

  setupProcessMonitoring() {
    // Heartbeat monitoring
    this.heartbeatInterval = setInterval(() => {
      if (!this.isShuttingDown) {
        Log.debug('💓 AMI Process heartbeat', {
          pid: process.pid,
          uptime: Math.floor(process.uptime()),
          memory: process.memoryUsage(),
          connected: this.amiListener?.connected || false
        });
      }
    }, 30000); // Every 30 seconds

    // Process monitoring
    process.on('uncaughtException', (error) => {
      Log.error('🚨 Uncaught Exception', { error: error.message, stack: error.stack });
      this.gracefulShutdown(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      Log.error('🚨 Unhandled Rejection', { 
        reason: reason?.message || reason, 
        promise: promise.toString() 
      });
    });

    // Memory monitoring\n    const checkMemory = () => {\n      const memUsage = process.memoryUsage();\n      const memoryMB = memUsage.heapUsed / 1024 / 1024;\n      \n      if (memoryMB > 500) { // Alert if using more than 500MB\n        Log.warn('⚠️ High memory usage detected', { \n          heapUsed: `${memoryMB.toFixed(2)}MB`,\n          memUsage \n        });\n      }\n    };\n    \n    setInterval(checkMemory, 60000); // Check every minute
  }

  setupEventLogging() {
    // Log real-time events from broadcast service
    broadcast.onCallUpdated((call) => {
      Log.info('📞 Real-time call update', {
        linkedid: call.linkedid,
        direction: call.direction,
        status: call.status,
        other_party: call.other_party,
        agent_exten: call.agent_exten
      });
    });

    broadcast.onExtensionStatusUpdated((extension) => {
      Log.info('📱 Real-time extension update', {
        extension: extension.extension,
        status: extension.status,
        agent_name: extension.agent_name,
        last_seen: extension.last_seen
      });
    });
  }

  setupGracefulShutdown() {
    const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
    
    signals.forEach(signal => {
      process.on(signal, () => {
        Log.info(`🛑 Received ${signal}. Initiating graceful shutdown...`);
        this.gracefulShutdown(0);
      });
    });
  }

  async gracefulShutdown(exitCode = 0) {
    if (this.isShuttingDown) {
      Log.warn('⚠️ Shutdown already in progress...');
      return;
    }

    this.isShuttingDown = true;
    Log.info('🔄 Starting graceful shutdown process...');

    try {
      // Stop heartbeat
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
      }

      // Stop AMI listener
      if (this.amiListener) {
        Log.info('🔌 Stopping AMI listener...');
        this.amiListener.stop();
      }

      // Cleanup broadcast service
      broadcast.cleanup();
      Log.info('📡 Broadcast service cleaned up');

      // Close MongoDB connection
      if (this.mongoConnection) {
        Log.info('🗄️ Closing MongoDB connection...');
        await mongoose.connection.close();
      }

      Log.info('✅ Graceful shutdown completed');
      process.exit(exitCode);

    } catch (error) {
      Log.error('❌ Error during shutdown', { error: error.message });
      process.exit(1);
    }
  }

  // Health check endpoint data
  getHealthStatus() {
    return {
      status: 'healthy',
      uptime: Math.floor(process.uptime()),
      pid: process.pid,
      memory: process.memoryUsage(),
      ami: {
        connected: this.amiListener?.connected || false,
        reconnectAttempts: this.amiListener?.reconnectAttempts || 0
      },
      mongodb: {
        connected: mongoose.connection.readyState === 1
      },
      timestamp: new Date().toISOString()
    };
  }
}

// Start the AMI process
const amiProcess = new AmiProcess();
amiProcess.start();

// Export for potential monitoring integrations
export default amiProcess;