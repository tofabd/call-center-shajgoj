import mongoose from 'mongoose';
import Extension from '../models/Extension.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/call_center_shajgoj';

const checkExtensions = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get total count
    const totalCount = await Extension.countDocuments();
    console.log('\n📊 Extension Database Summary');
    console.log('='.repeat(50));
    console.log(`Total Extensions: ${totalCount}`);

    if (totalCount === 0) {
      console.log('❌ No extensions found in database.');
      console.log('💡 Run "npm run seed-extensions" to create extensions.');
      return;
    }

    // Count by ranges
    const supportCount = await Extension.countDocuments({ 
      extension: { $gte: '1001', $lte: '1020' } 
    });
    const salesCount = await Extension.countDocuments({ 
      extension: { $gte: '2001', $lte: '2020' } 
    });

    console.log(`Support Extensions (1001-1020): ${supportCount}/20`);
    console.log(`Sales Extensions (2001-2020): ${salesCount}/20`);

    // Status breakdown
    const statusStats = await Extension.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    console.log('\n📈 Status Distribution:');
    console.log('-'.repeat(30));
    statusStats.forEach(stat => {
      console.log(`${stat._id}: ${stat.count}`);
    });

    // Department breakdown
    const deptStats = await Extension.aggregate([
      { $group: { _id: '$metadata.department', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    console.log('\n🏢 Department Distribution:');
    console.log('-'.repeat(30));
    deptStats.forEach(stat => {
      console.log(`${stat._id}: ${stat.count}`);
    });

    // Sample extensions from each range
    console.log('\n📝 Sample Support Extensions (1001-1020):');
    console.log('-'.repeat(45));
    const supportSample = await Extension.find({ 
      extension: { $gte: '1001', $lte: '1020' } 
    }).limit(5).sort({ extension: 1 });
    
    supportSample.forEach(ext => {
      console.log(`  ${ext.extension} - ${ext.agent_name} (${ext.status})`);
    });

    console.log('\n📝 Sample Sales Extensions (2001-2020):');
    console.log('-'.repeat(45));
    const salesSample = await Extension.find({ 
      extension: { $gte: '2001', $lte: '2020' } 
    }).limit(5).sort({ extension: 1 });
    
    salesSample.forEach(ext => {
      console.log(`  ${ext.extension} - ${ext.agent_name} (${ext.status})`);
    });

    // Missing extensions check
    const supportExtensions = await Extension.find({ 
      extension: { $gte: '1001', $lte: '1020' } 
    }, 'extension').sort({ extension: 1 });
    
    const salesExtensions = await Extension.find({ 
      extension: { $gte: '2001', $lte: '2020' } 
    }, 'extension').sort({ extension: 1 });

    const missingSupportExts = [];
    for (let i = 1001; i <= 1020; i++) {
      if (!supportExtensions.find(ext => ext.extension === i.toString())) {
        missingSupportExts.push(i);
      }
    }

    const missingSalesExts = [];
    for (let i = 2001; i <= 2020; i++) {
      if (!salesExtensions.find(ext => ext.extension === i.toString())) {
        missingSalesExts.push(i);
      }
    }

    if (missingSupportExts.length > 0 || missingSalesExts.length > 0) {
      console.log('\n⚠️ Missing Extensions:');
      console.log('-'.repeat(30));
      if (missingSupportExts.length > 0) {
        console.log(`Support: ${missingSupportExts.join(', ')}`);
      }
      if (missingSalesExts.length > 0) {
        console.log(`Sales: ${missingSalesExts.join(', ')}`);
      }
    } else {
      console.log('\n✅ All expected extensions are present!');
    }

    console.log('\n💡 Available Commands:');
    console.log('-'.repeat(30));
    console.log('npm run seed-extensions  - Reseed all extensions');
    console.log('npm run ami-process     - Start AMI listener for real-time updates');
    console.log('node scripts/checkExtensions.js - Run this check again');

  } catch (error) {
    console.error('❌ Error checking extensions:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔒 Database connection closed');
    process.exit(0);
  }
};

console.log('🔍 Checking Extension Database Status...');
checkExtensions();