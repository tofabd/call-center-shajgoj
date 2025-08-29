import mongoose from 'mongoose';
import User from '../src/models/User.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/call_center_shajgoj';

// Sample users data
const sampleUsers = [
  {
    name: 'Tofa',
    email: 'tofa@gmail.com',
    password: '12345678',
    extension: '1000',
    role: 'admin',
    department: 'Administration',
    isActive: true,
    metadata: {
      phoneNumber: '+1234567999',
      team: 'Admin',
      isMainAdmin: true
    }
  },
  {
    name: 'John Doe',
    email: 'john.doe@callcenter.com',
    password: 'password123',
    extension: '1001',
    role: 'agent',
    department: 'Sales',
    isActive: true,
    metadata: {
      phoneNumber: '+1234567890',
      team: 'Team A'
    }
  },
  {
    name: 'Jane Smith',
    email: 'jane.smith@callcenter.com',
    password: 'password123',
    extension: '1002',
    role: 'supervisor',
    department: 'Sales',
    isActive: true,
    metadata: {
      phoneNumber: '+1234567891',
      team: 'Team A'
    }
  },
  {
    name: 'Mike Johnson',
    email: 'mike.johnson@callcenter.com',
    password: 'password123',
    extension: '1003',
    role: 'agent',
    department: 'Support',
    isActive: true,
    metadata: {
      phoneNumber: '+1234567892',
      team: 'Team B'
    }
  },
  {
    name: 'Sarah Wilson',
    email: 'sarah.wilson@callcenter.com',
    password: 'password123',
    extension: '1004',
    role: 'admin',
    department: 'IT',
    isActive: true,
    metadata: {
      phoneNumber: '+1234567893',
      team: 'Admin'
    }
  },
  {
    name: 'Robert Brown',
    email: 'robert.brown@callcenter.com',
    password: 'password123',
    extension: '1005',
    role: 'agent',
    department: 'Sales',
    isActive: false,
    metadata: {
      phoneNumber: '+1234567894',
      team: 'Team C'
    }
  }
];

const seedDatabase = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing users
    await User.deleteMany({});
    console.log('🗑️ Cleared existing users');

    // Insert sample users one by one to trigger password hashing middleware
    const createdUsers = [];
    for (const userData of sampleUsers) {
      const user = new User(userData);
      const savedUser = await user.save();
      createdUsers.push(savedUser);
    }
    console.log(`✅ Inserted ${createdUsers.length} sample users`);

    // Display created users
    console.log('\n📋 Created users:');
    createdUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} (${user.email}) - Extension: ${user.extension} - Role: ${user.role}`);
    });

    console.log('\n🎉 Database seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding database:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔒 Database connection closed');
    process.exit(0);
  }
};

// Run seeder
seedDatabase();