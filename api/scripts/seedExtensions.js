import mongoose from 'mongoose';
import Extension from '../models/Extension.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/call_center_shajgoj';

// Sample agent names for random assignment
const agentNames = [
  'John Smith', 'Jane Doe', 'Michael Johnson', 'Sarah Wilson', 'Robert Brown',
  'Lisa Davis', 'David Miller', 'Emma Garcia', 'James Rodriguez', 'Olivia Martinez',
  'William Anderson', 'Sophia Taylor', 'Benjamin Thomas', 'Isabella Jackson',
  'Lucas White', 'Mia Harris', 'Henry Clark', 'Charlotte Lewis', 'Alexander Lee',
  'Amelia Walker', 'Sebastian Hall', 'Harper Allen', 'Ethan Young', 'Evelyn King',
  'Jacob Wright', 'Abigail Lopez', 'Samuel Hill', 'Emily Scott', 'Daniel Green',
  'Elizabeth Adams', 'Matthew Baker', 'Sofia Gonzalez', 'Joseph Nelson', 'Avery Carter',
  'Andrew Mitchell', 'Scarlett Perez', 'Joshua Roberts', 'Grace Turner', 'Christopher Phillips',
  'Chloe Campbell'
];

/**
 * Get a random agent name from the list
 */
const getRandomAgentName = () => {
  const randomIndex = Math.floor(Math.random() * agentNames.length);
  return agentNames[randomIndex];
};

/**
 * Generate extension data for a given range
 */
const generateExtensions = (start, end) => {
  const extensions = [];
  for (let i = start; i <= end; i++) {
    extensions.push({
      extension: i.toString(),
      agent_name: getRandomAgentName(),
      status: 'offline', // Default status as requested
      last_seen: null,
      is_active: true,
      context: 'ext-local',
      hint: `SIP/${i}`,
      metadata: {
        department: i >= 2000 ? 'Sales' : 'Support',
        team: i >= 2000 ? 'Sales Team' : 'Support Team',
        shift: Math.random() > 0.5 ? 'Day' : 'Night'
      }
    });
  }
  return extensions;
};

const seedExtensions = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing extensions (optional - comment out if you want to keep existing ones)
    const existingCount = await Extension.countDocuments();
    console.log(`📊 Found ${existingCount} existing extensions`);
    
    // Ask user if they want to clear existing extensions
    console.log('🗑️ Clearing existing extensions...');
    await Extension.deleteMany({});
    console.log('✅ Cleared existing extensions');

    // Generate extensions for range 1001-1020
    const supportExtensions = generateExtensions(1001, 1020);
    console.log(`📞 Generated ${supportExtensions.length} support extensions (1001-1020)`);

    // Generate extensions for range 2001-2020
    const salesExtensions = generateExtensions(2001, 2020);
    console.log(`📞 Generated ${salesExtensions.length} sales extensions (2001-2020)`);

    // Combine all extensions
    const allExtensions = [...supportExtensions, ...salesExtensions];

    // Insert extensions into database
    const createdExtensions = await Extension.insertMany(allExtensions);
    console.log(`✅ Successfully inserted ${createdExtensions.length} extensions`);

    // Display summary
    console.log('\n📋 Extension Seeding Summary:');
    console.log('='.repeat(50));
    console.log(`Total Extensions Created: ${createdExtensions.length}`);
    console.log(`Support Extensions (1001-1020): ${supportExtensions.length}`);
    console.log(`Sales Extensions (2001-2020): ${salesExtensions.length}`);
    console.log(`Default Status: offline`);
    console.log(`Default Context: ext-local`);

    // Display sample extensions
    console.log('\n📝 Sample Extensions Created:');
    console.log('-'.repeat(50));
    createdExtensions.slice(0, 5).forEach((ext, index) => {
      console.log(`${index + 1}. Extension ${ext.extension} - ${ext.agent_name} (${ext.metadata.department})`);
    });

    if (createdExtensions.length > 5) {
      console.log(`... and ${createdExtensions.length - 5} more extensions`);
    }

    // Display extensions by status
    const statusCounts = await Extension.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    console.log('\n📊 Extensions by Status:');
    console.log('-'.repeat(30));
    statusCounts.forEach(item => {
      console.log(`${item._id}: ${item.count}`);
    });

    // Display extensions by department
    const deptCounts = await Extension.aggregate([
      { $group: { _id: '$metadata.department', count: { $sum: 1 } } }
    ]);
    
    console.log('\n🏢 Extensions by Department:');
    console.log('-'.repeat(30));
    deptCounts.forEach(item => {
      console.log(`${item._id}: ${item.count}`);
    });

    console.log('\n🎉 Extension seeding completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('- Use the AMI listener to update extension status in real-time');
    console.log('- Extensions will automatically update when agents register/unregister');
    console.log('- Check the frontend Extension Management page to view all extensions');

  } catch (error) {
    console.error('❌ Error seeding extensions:', error.message);
    if (error.code === 11000) {
      console.error('💡 Duplicate extension detected. Some extensions may already exist.');
      console.error('   Consider clearing existing extensions or modifying the script to handle duplicates.');
    }
  } finally {
    await mongoose.connection.close();
    console.log('🔒 Database connection closed');
    process.exit(0);
  }
};

// Handle script arguments
const args = process.argv.slice(2);
const helpFlag = args.includes('--help') || args.includes('-h');

if (helpFlag) {
  console.log('🔧 Extension Seeder Help');
  console.log('='.repeat(30));
  console.log('Usage: node scripts/seedExtensions.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --help, -h     Show this help message');
  console.log('');
  console.log('Description:');
  console.log('  Seeds extensions from 1001-1020 and 2001-2020 with:');
  console.log('  - Random agent names');
  console.log('  - Default offline status');
  console.log('  - Department assignment (Support: 1001-1020, Sales: 2001-2020)');
  console.log('  - Random shift assignments');
  console.log('');
  console.log('Environment Variables:');
  console.log('  MONGODB_URI    MongoDB connection string');
  console.log('                 Default: mongodb://localhost:27017/call_center_shajgoj');
  process.exit(0);
}

console.log('🌱 Starting Extension Seeding Process...');
console.log('📋 Will create extensions: 1001-1020 (Support) and 2001-2020 (Sales)');
console.log('👤 Each extension will have a random agent name and offline status');
console.log('');

seedExtensions();