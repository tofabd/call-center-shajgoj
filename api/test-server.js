import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import teamRoutes from './src/routes/teamRoutes.js';

const app = express();
const PORT = 3001;

// Simple in-memory MongoDB connection
const connectDB = async () => {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/test_teams', {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('✅ MongoDB Connected');
  } catch (error) {
    console.log('❌ MongoDB connection failed, continuing without database');
    // Continue without database for now
  }
};

// Middleware
app.use(cors({
  origin: ['http://localhost:5173'],
  credentials: true
}));
app.use(express.json());

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.use('/api/teams', teamRoutes);

// Connect to DB and start server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ Test API Server running on port ${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/health`);
    console.log(`   Teams:  http://localhost:${PORT}/api/teams`);
  });
});