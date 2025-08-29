import mongoose from 'mongoose';
import Extension from '../src/models/Extension.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/call_center_shajgoj';

// Sample agent names for random assignment
const agentNames = [
  'John Doe', 'Jane Smith', 'Mike Johnson', 'Sarah Wilson', 'David Brown',
  'Lisa Davis', 'Robert Miller', 'Emma Garcia', 'James Rodriguez', 'Olivia Martinez',
  'William Anderson', 'Sophia Taylor', 'Benjamin Thomas', 'Isabella Jackson',
  'Lucas White', 'Mia Harris', 'Henry Clark', 'Charlotte Lewis', 'Alexander Lee',
  'Amelia Walker', 'Sebastian Hall', 'Harper Allen', 'Ethan Young', 'Evelyn King',
  'Jacob Wright', 'Abigail Lopez', 'Samuel Hill', 'Emily Scott', 'Daniel Green',
  'Elizabeth Adams', 'Matthew Baker', 'Sofia Gonzalez', 'Joseph Nelson', 'Avery Carter',
  'Andrew Mitchell', 'Scarlett Perez', 'Joshua Roberts', 'Grace Turner', 'Christopher Phillips',
  'Chloe Campbell', 'Ryan Murphy', 'Zoe Richardson'
];

// Configuration
const config = {
  supportRange: { start: 1001, end: 1020 },
  salesRange: { start: 2001, end: 2020 },
  specialExtensions: ['5000'],
  defaultStatus: 'offline', // Fixed: changed from 'online' to 'offline'
  clearExisting: true
};

/**
 * Get a random agent name from the list
 */
const getRandomAgentName = () => {
  const randomIndex = Math.floor(Math.random() * agentNames.length);
  return agentNames[randomIndex];
};

/**
 * Get department based on extension number
 */
const getDepartment = (extension) => {
  const ext = parseInt(extension);
  if (ext >= 2000) return 'Sales';
  if (ext >= 1000) return 'Support';
  if (ext === 5000) return 'Administration';
  return 'General';
};

/**
 * Generate extensions for a given range
 */
const generateExtensions = (start, end) => {
  const extensions = [];
  for (let i = start; i <= end; i++) {
    extensions.push({
      extension: i.toString(),
      agent_name: getRandomAgentName(),
      status_code: 0,
      device_state: 'NOT_INUSE',
      status: config.defaultStatus,
      department: getDepartment(i.toString()),
      is_active: true,
      last_status_change: new Date(),
      last_seen: new Date()
    });
  }
  return extensions;
};

/**
 * Generate special extensions
 */
const generateSpecialExtensions = () => {
  return config.specialExtensions.map(ext => ({
    extension: ext,
    agent_name: ext === '5000' ? 'System Administrator' : 'Special Agent',
    status_code: 0,
    device_state: 'NOT_INUSE',
    status: config.defaultStatus,
    department: getDepartment(ext),
    is_active: true,
    last_status_change: new Date(),
    last_seen: new Date()
  }));
};

async function seedExtensions() {
  try {
    // Check for force flag
    const confirmDrop = process.argv.includes('--force');
    if (!confirmDrop) {
      console.log('⚠️  Use --force flag to drop existing collection and recreate');
      console.log('   Usage: node seedExtensions.js --force');
      console.log('   Or modify script to preserve existing data');
      process.exit(0);
    }

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Drop existing extensions collection
    console.log('🗑️ Dropping existing extensions collection...');
    await mongoose.connection.db.dropCollection('extensions');
    console.log('✅ Extensions collection dropped');

    // Generate extensions for support range (1001-1020)
    const supportExtensions = generateExtensions(config.supportRange.start, config.supportRange.end);
    console.log(`📞 Generated ${supportExtensions.length} support extensions (${config.supportRange.start}-${config.supportRange.end})`);

    // Generate extensions for sales range (2001-2020)
    const salesExtensions = generateExtensions(config.salesRange.start, config.salesRange.end);
    console.log(`📞 Generated ${salesExtensions.length} sales extensions (${config.salesRange.start}-${config.salesRange.end})`);

    // Generate special extensions (5000)
    const specialExtensions = generateSpecialExtensions();
    console.log(`📞 Generated ${specialExtensions.length} special extensions (${specialExtensions.join(', ')})`);

    // Combine all extensions
    const allExtensions = [...supportExtensions, ...salesExtensions, ...specialExtensions];

    // Create new extensions with enhanced schema
    console.log('🌱 Seeding extensions with standard schema...');
    const createdExtensions = await Extension.insertMany(allExtensions);
    console.log(`✅ Created ${createdExtensions.length} extensions`);

    // Display summary
    console.log('\n📋 Extension Seeding Summary:');
    console.log('='.repeat(50));
    console.log(`Total Extensions Created: ${createdExtensions.length}`);
    console.log(`Support Extensions (${config.supportRange.start}-${config.supportRange.end}): ${supportExtensions.length}`);
    console.log(`Sales Extensions (${config.salesRange.start}-${config.salesRange.end}): ${salesExtensions.length}`);
    console.log(`Special Extensions (${config.specialExtensions.join(', ')}): ${specialExtensions.length}`);
    console.log(`Default Status: ${config.defaultStatus}`);
    console.log(`Default Device State: NOT_INUSE`);

    // Display sample extensions
    console.log('\n📝 Sample Extensions Created:');
    console.log('-'.repeat(50));
    createdExtensions.slice(0, 5).forEach((ext, index) => {
      console.log(`${index + 1}. Extension ${ext.extension} - ${ext.agent_name} (${ext.department})`);
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
      { $group: { _id: '$department', count: { $sum: 1 } } }
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
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Handle script arguments
const args = process.argv.slice(2);
const helpFlag = args.includes('--help') || args.includes('-h');

if (helpFlag) {
  console.log('🔧 Extension Seeder Help');
  console.log('='.repeat(30));
  console.log('Usage: node seedExtensions.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --force        Drop existing collection and recreate (required)');
  console.log('  --help, -h     Show this help message');
  console.log('');
  console.log('Description:');
  console.log('  Seeds extensions with standard schema:');
  console.log(`  - Support: ${config.supportRange.start}-${config.supportRange.end} (${config.supportRange.end - config.supportRange.start + 1} extensions)`);
  console.log(`  - Sales: ${config.salesRange.start}-${config.salesRange.end} (${config.salesRange.end - config.salesRange.start + 1} extensions)`);
  console.log(`  - Special: ${config.specialExtensions.join(', ')} (${config.specialExtensions.length} extensions)`);
  console.log(`  - Default status: ${config.defaultStatus}`);
  console.log(`  - Random agent names assigned`);
  console.log('');
  console.log('Environment Variables:');
  console.log('  MONGODB_URI    MongoDB connection string');
  console.log('                 Default: mongodb://localhost:27017/call_center_shajgoj');
  process.exit(0);
}

console.log('🌱 Starting Extension Seeding Process...');
console.log(`📋 Will create extensions: ${config.supportRange.start}-${config.supportRange.end} (Support), ${config.salesRange.start}-${config.salesRange.end} (Sales), and ${config.specialExtensions.join(', ')} (Special)`);
console.log(`👤 Each extension will have a random agent name and ${config.defaultStatus} status`);
console.log('⚠️  Use --force flag to proceed with collection drop and recreation');
console.log('');

seedExtensions();