import mongoose from 'mongoose';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import models
import Extension from '../src/models/Extension.js';

// Database connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/call_center');
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Get all extensions from database
const getExtensionsFromDatabase = async () => {
  console.log('💾 Loading extensions from database...');
  
  try {
    const extensions = await Extension.find({ is_active: true }).sort({ extension: 1 });
    console.log(`✅ Found ${extensions.length} extensions in database`);
    return extensions;
  } catch (error) {
    console.error('❌ Failed to load extensions from database:', error);
    return [];
  }
};

// Query individual extension via AMI (simulated)
const queryIndividualExtension = async (extensionNumber) => {
  // This is a simulated individual AMI query
  // In real implementation, you would:
  // 1. Connect to Asterisk AMI
  // 2. Send "Show extension status [extension]" command
  // 3. Parse the response
  
  try {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
    
    // Simulated AMI response for individual extension
    const statuses = ['online', 'offline', 'unknown'];
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
    
    return {
      extension: extensionNumber,
      status: randomStatus,
      last_seen: new Date(),
      query_time: Math.random() * 100 + 50
    };
  } catch (error) {
    console.error(`❌ Failed to query extension ${extensionNumber}:`, error);
    return {
      extension: extensionNumber,
      status: 'error',
      last_seen: null,
      query_time: 0
    };
  }
};

// Query all extensions one by one
const queryAllExtensionsIndividually = async (extensions) => {
  console.log('🔍 Querying extensions individually via AMI...');
  
  const results = [];
  const totalStartTime = Date.now();
  
  for (let i = 0; i < extensions.length; i++) {
    const ext = extensions[i];
    console.log(`   [${i + 1}/${extensions.length}] Querying extension ${ext.extension}...`);
    
    const startTime = Date.now();
    const result = await queryIndividualExtension(ext.extension);
    const queryTime = Date.now() - startTime;
    
    result.query_time = queryTime;
    results.push(result);
    
    // Small delay between queries to avoid overwhelming Asterisk
    if (i < extensions.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  const totalTime = Date.now() - totalStartTime;
  console.log(`✅ Individual queries completed in ${totalTime}ms`);
  
  return results;
};

// Update database with individual query results
const updateDatabaseWithIndividualResults = async (results) => {
  console.log('💾 Updating database with individual query results...');
  
  try {
    for (const result of results) {
      if (result.status !== 'error') {
        await Extension.findOneAndUpdate(
          { extension: result.extension },
          {
            status: result.status,
            last_seen: result.last_seen,
            updated_at: new Date()
          },
          { new: true }
        );
      }
    }
    
    console.log('✅ Database updated successfully');
  } catch (error) {
    console.error('❌ Database update failed:', error);
  }
};

// Display results in console table
const displayIndividualResultsTable = (results) => {
  console.log('\n📊 INDIVIDUAL EXTENSION QUERY RESULTS');
  console.log('='.repeat(90));
  console.log('| Extension | Status   | Last Seen           | Query Time | Database Status |');
  console.log('='.repeat(90));
  
  results.forEach(result => {
    const status = result.status.padEnd(8);
    const lastSeen = result.last_seen ? new Date(result.last_seen).toLocaleString() : 'Never';
    const queryTime = `${result.query_time}ms`.padEnd(11);
    const dbStatus = result.status !== 'error' ? 'Updated' : 'Failed';
    
    console.log(`| ${result.extension.padEnd(9)} | ${status} | ${lastSeen.padEnd(20)} | ${queryTime} | ${dbStatus.padEnd(15)} |`);
  });
  
  console.log('='.repeat(90));
  
  // Summary statistics
  const onlineCount = results.filter(r => r.status === 'online').length;
  const offlineCount = results.filter(r => r.status === 'offline').length;
  const unknownCount = results.filter(r => r.status === 'unknown').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  
  console.log(`\n📈 SUMMARY:`);
  console.log(`   🟢 Online: ${onlineCount}`);
  console.log(`   🔴 Offline: ${offlineCount}`);
  console.log(`   🟡 Unknown: ${unknownCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📊 Total: ${results.length}`);
  
  // Performance statistics
  const totalQueryTime = results.reduce((sum, r) => sum + r.query_time, 0);
  const avgQueryTime = totalQueryTime / results.length;
  const minQueryTime = Math.min(...results.map(r => r.query_time));
  const maxQueryTime = Math.max(...results.map(r => r.query_time));
  
  console.log(`\n⏱️ PERFORMANCE:`);
  console.log(`   Average Query Time: ${avgQueryTime.toFixed(2)}ms`);
  console.log(`   Fastest Query: ${minQueryTime}ms`);
  console.log(`   Slowest Query: ${maxQueryTime}ms`);
  console.log(`   Total Query Time: ${totalQueryTime}ms`);
};

// Main function
const main = async () => {
  console.log('🚀 Starting checkAllExtensions.js - Individual Extension Query Script');
  console.log('⏰ Started at:', new Date().toLocaleString());
  
  try {
    // Connect to database
    await connectDB();
    
    // Get extensions from database
    const dbStartTime = Date.now();
    const extensions = await getExtensionsFromDatabase();
    const dbLoadTime = Date.now() - dbStartTime;
    
    if (extensions.length === 0) {
      console.log('❌ No extensions found in database');
      return;
    }
    
    // Query extensions individually
    const queryStartTime = Date.now();
    const results = await queryAllExtensionsIndividually(extensions);
    const totalQueryTime = Date.now() - queryStartTime;
    
    // Update database
    const updateStartTime = Date.now();
    await updateDatabaseWithIndividualResults(results);
    const updateTime = Date.now() - updateStartTime;
    
    // Display results
    displayIndividualResultsTable(results);
    
    // Overall performance summary
    console.log(`\n🎯 OVERALL PERFORMANCE:`);
    console.log(`   Database Load: ${dbLoadTime}ms`);
    console.log(`   Individual Queries: ${totalQueryTime}ms`);
    console.log(`   Database Update: ${updateTime}ms`);
    console.log(`   Total Script Time: ${Date.now() - dbStartTime}ms`);
    
  } catch (error) {
    console.error('❌ Script execution failed:', error);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    console.log('✅ Script completed at:', new Date().toLocaleString());
    process.exit(0);
  }
};

// Run the script
main().catch(console.error);
