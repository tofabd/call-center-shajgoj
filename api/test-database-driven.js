import mongoose from 'mongoose';
import Extension from './models/Extension.js';
import { initializeAmiQueryService, getAmiQueryService } from './services/AmiQueryServiceInstance.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/call_center_shajgoj';

async function testDatabaseDrivenApproach() {
  try {
    console.log('🔍 Testing Database-Driven Extension Monitoring');
    console.log('='.repeat(60));

    // 1. Connect to MongoDB
    console.log('\n1️⃣ Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // 2. Check current extensions in database
    console.log('\n2️⃣ Checking current extensions in database...');
    const extensions = await Extension.find({ is_active: true }).lean();
    console.log(`📋 Found ${extensions.length} active extensions in database:`);
    extensions.slice(0, 5).forEach(ext => {
      console.log(`   - ${ext.extension}: ${ext.status} (last seen: ${ext.last_seen || 'never'})`);
    });
    if (extensions.length > 5) {
      console.log(`   ... and ${extensions.length - 5} more`);
    }

    // 3. Initialize AMI Query Service
    console.log('\n3️⃣ Initializing AMI Query Service...');
    await initializeAmiQueryService();
    const amiService = getAmiQueryService();
    
    if (amiService) {
      console.log('✅ AMI Query Service initialized');
      
      // Wait a bit for the service to stabilize
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // 4. Test manual refresh
      console.log('\n4️⃣ Testing manual refresh...');
      const refreshResult = await amiService.manualRefresh();
      console.log('✅ Manual refresh completed:');
      console.log(`   - Extensions checked: ${refreshResult.extensionsChecked}`);
      console.log(`   - Last query time: ${refreshResult.lastQueryTime}`);
      console.log(`   - Success rate: ${refreshResult.statistics.successfulQueries} / ${refreshResult.statistics.successfulQueries + refreshResult.statistics.failedQueries}`);
      
      // 5. Check database after refresh
      console.log('\n5️⃣ Checking database after AMI refresh...');
      const updatedExtensions = await Extension.find({ is_active: true }).lean();
      console.log(`📊 Database now has ${updatedExtensions.length} extensions:`);
      
      const statusCounts = {};
      updatedExtensions.forEach(ext => {
        statusCounts[ext.status] = (statusCounts[ext.status] || 0) + 1;
      });
      
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`   - ${status}: ${count} extensions`);
      });
      
      // Show recently updated extensions
      const recentlyUpdated = updatedExtensions
        .filter(ext => ext.last_seen && new Date(ext.last_seen) > new Date(Date.now() - 60000))
        .slice(0, 5);
      
      if (recentlyUpdated.length > 0) {
        console.log('\n📅 Recently updated extensions (last 1 minute):');
        recentlyUpdated.forEach(ext => {
          console.log(`   - ${ext.extension}: ${ext.status} (updated: ${new Date(ext.last_seen).toLocaleTimeString()})`);
        });
      }
      
      // 6. Test service status
      console.log('\n6️⃣ Testing service status...');
      const status = await amiService.getStatus();
      console.log('📊 Service status:');
      console.log(`   - Connected: ${status.connected}`);
      console.log(`   - Query interval: ${status.queryInterval / 1000} seconds`);
      console.log(`   - Extensions monitored: ${status.extensionsMonitored}`);
      console.log(`   - Successful queries: ${status.statistics.successfulQueries}`);
      console.log(`   - Failed queries: ${status.statistics.failedQueries}`);
      
    } else {
      console.log('❌ AMI Query Service not available');
    }
    
    console.log('\n✅ Database-driven test completed successfully!');
    console.log('\n💡 What happens every 30 seconds:');
    console.log('   1. Service fetches all active extensions from database');
    console.log('   2. Queries each extension status via AMI');
    console.log('   3. Updates database with new status');
    console.log('   4. Broadcasts real-time updates to frontend');
    console.log('   5. Frontend can also fetch updated data from database');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    // Cleanup
    const amiService = getAmiQueryService();
    if (amiService) {
      amiService.stop();
    }
    await mongoose.connection.close();
    console.log('\n🔒 Database connection closed');
    process.exit(0);
  }
}

console.log('🚀 Starting Database-Driven Extension Monitoring Test...');
testDatabaseDrivenApproach();