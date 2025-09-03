import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { MongoMemoryServer } from 'mongodb-memory-server';

dotenv.config();

let mongoServer;

const connectDB = async () => {
  try {
    let MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/call_center_shajgoj';
    
    // If local MongoDB is not available, use in-memory database
    try {
      await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      });
      console.log(`✅ MongoDB Connected: ${mongoose.connection.host}`);
    } catch (error) {
      console.log('⚠️ Local MongoDB not available, starting in-memory database...');
      
      // Start in-memory MongoDB server
      mongoServer = await MongoMemoryServer.create();
      MONGODB_URI = mongoServer.getUri();
      
      await mongoose.connect(MONGODB_URI);
      console.log(`✅ In-Memory MongoDB Connected: ${MONGODB_URI}`);
    }
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB disconnected');
    });

    // Graceful close on app termination
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      if (mongoServer) {
        await mongoServer.stop();
      }
      console.log('🔒 MongoDB connection closed through app termination');
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

export default connectDB;