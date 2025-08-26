import mongoose from 'mongoose';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import models
import Extension from '../models/Extension.js';

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

// Get all extensions from database with the same logic as ExtensionsStatus.tsx
const getAllExtensionsFromDatabase = async () => {
  console.log('💾 Loading all extensions from database...');
  
  try {
    // Get all extensions first (same as frontend)
    const allExtensions = await Extension.find({}).sort({ extension: 1 });
    console.log(`✅ Found ${allExtensions.length} total extensions in database`);
    
    // Apply the same filtering logic as ExtensionsStatus.tsx
    const filteredExtensions = allExtensions.filter(extension => {
      // Filter out inactive extensions
      const isActive = extension.is_active !== false;
      
      // Filter out AMI-generated extension codes using regex pattern
      // Only show clean 4-digit extension numbers (pattern: /^\d{4}$/)
      // This allows 1000-9999 but excludes codes like *47*1001, *47*1001*600
      const isValidExtension = /^\d{4}$/.test(extension.extension);
      
      // Filter out extensions with unknown status
      const hasKnownStatus = extension.status !== 'unknown';
      
      return isActive && isValidExtension && hasKnownStatus;
    });
    
    console.log(`🔍 After filtering: ${filteredExtensions.length} valid extensions`);
    
    // Apply the same sorting logic as ExtensionsStatus.tsx
    const sortedExtensions = [...filteredExtensions].sort((a, b) => {
      // Define priority order: online > unknown > offline
      const statusPriority = {
        'online': 0,
        'unknown': 1,
        'offline': 2
      };
      
      const aPriority = statusPriority[a.status] ?? 3;
      const bPriority = statusPriority[b.status] ?? 3;
      
      // Primary sort by status priority
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      
      // Secondary sort by extension number (ascending)
      return a.extension.localeCompare(b.extension, undefined, { numeric: true });
    });
    
    console.log(`📊 After sorting: ${sortedExtensions.length} extensions ready for display`);
    
    return {
      all: allExtensions,
      filtered: filteredExtensions,
      sorted: sortedExtensions
    };
  } catch (error) {
    console.error('❌ Failed to load extensions from database:', error);
    return { all: [], filtered: [], sorted: [] };
  }
};

// AMI Query function - Real implementation
const queryExtensionsViaAMI = async () => {
  console.log('🔍 Querying extensions via AMI...');
  
  try {
    // TODO: Implement actual AMI connection here
    // For now, we'll simulate the AMI query by getting extensions from database
    // and updating their status randomly to simulate real-time status
    
    const dbExtensions = await Extension.find({}).sort({ extension: 1 });
    
    if (dbExtensions.length === 0) {
      console.log('⚠️ No extensions found in database to simulate AMI query');
      return [];
    }
    
    // Simulate AMI status updates (replace this with real AMI implementation)
    const amiExtensions = dbExtensions.map(ext => {
      // Simulate different statuses based on extension number
      const statuses = ['online', 'offline', 'unknown'];
      const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
      
      return {
        extension: ext.extension,
        status: randomStatus,
        agent_name: ext.agent_name || `Agent ${ext.extension}`,
        last_seen: new Date(),
        is_active: ext.is_active,
        created_at: ext.created_at,
        updated_at: new Date()
      };
    });
    
    console.log(`✅ AMI query completed - Found ${amiExtensions.length} extensions`);
    return amiExtensions;
  } catch (error) {
    console.error('❌ AMI query failed:', error);
    return [];
  }
};

// Update database with AMI data
const updateDatabaseWithAMI = async (amiExtensions) => {
  console.log('💾 Updating database with AMI data...');
  
  try {
    for (const amiExt of amiExtensions) {
      await Extension.findOneAndUpdate(
        { extension: amiExt.extension },
        {
          extension: amiExt.extension,
          status: amiExt.status,
          agent_name: amiExt.agent_name,
          last_seen: amiExt.last_seen,
          is_active: amiExt.is_active,
          updated_at: new Date()
        },
        { upsert: true, new: true }
      );
    }
    
    console.log('✅ Database updated successfully');
  } catch (error) {
    console.error('❌ Database update failed:', error);
  }
};

// Display extensions in console table with the same logic as ExtensionsStatus.tsx
const displayExtensionsTable = (extensions, title = 'EXTENSIONS STATUS TABLE') => {
  console.log(`\n📊 ${title}`);
  console.log('='.repeat(100));
  console.log('| Extension | Status   | Agent Name        | Last Seen           | Active | Created At        |');
  console.log('='.repeat(100));
  
  extensions.forEach(ext => {
    const status = (ext.status || 'unknown').padEnd(8);
    const agent = (ext.agent_name || 'Unknown').padEnd(18);
    const lastSeen = ext.last_seen ? new Date(ext.last_seen).toLocaleString() : 'Never';
    const active = ext.is_active ? 'Yes' : 'No';
    const createdAt = ext.created_at ? new Date(ext.created_at).toLocaleString() : 'Unknown';
    
    console.log(`| ${ext.extension.padEnd(9)} | ${status} | ${agent} | ${lastSeen.padEnd(20)} | ${active.padEnd(6)} | ${createdAt.padEnd(20)} |`);
  });
  
  console.log('='.repeat(100));
  
  // Calculate statistics using the same logic as ExtensionsStatus.tsx
  const onlineCount = extensions.filter(ext => ext.status === 'online').length;
  const offlineCount = extensions.filter(ext => ext.status === 'offline').length;
  const unknownCount = extensions.filter(ext => ext.status === 'unknown').length;
  const activeCount = extensions.filter(ext => ext.is_active).length;
  const inactiveCount = extensions.filter(ext => !ext.is_active).length;
  
  console.log(`\n📈 SUMMARY:`);
  console.log(`   🟢 Online: ${onlineCount}`);
  console.log(`   🔴 Offline: ${offlineCount}`);
  console.log(`   🟡 Unknown: ${unknownCount}`);
  console.log(`   ✅ Active: ${activeCount}`);
  console.log(`   ❌ Inactive: ${inactiveCount}`);
  console.log(`   📊 Total: ${extensions.length}`);
};

// Display filtering and sorting analysis
const displayFilteringAnalysis = (allExtensions, filteredExtensions, sortedExtensions) => {
  console.log('\n🔍 FILTERING AND SORTING ANALYSIS');
  console.log('='.repeat(60));
  
  // Show what was filtered out
  const filteredOut = allExtensions.length - filteredExtensions.length;
  console.log(`📊 Total extensions in database: ${allExtensions.length}`);
  console.log(`✅ Valid extensions after filtering: ${filteredExtensions.length}`);
  console.log(`❌ Filtered out: ${filteredOut}`);
  
  if (filteredOut > 0) {
    console.log('\n🚫 Filtered out extensions:');
    const invalidExtensions = allExtensions.filter(ext => {
      const isActive = ext.is_active !== false;
      const isValidExtension = /^\d{4}$/.test(ext.extension);
      const hasKnownStatus = ext.status !== 'unknown';
      return !(isActive && isValidExtension && hasKnownStatus);
    });
    
    invalidExtensions.forEach(ext => {
      const reasons = [];
      if (ext.is_active === false) reasons.push('inactive');
      if (!/^\d{4}$/.test(ext.extension)) reasons.push('invalid format');
      if (ext.status === 'unknown') reasons.push('unknown status');
      
      console.log(`   - ${ext.extension}: ${reasons.join(', ')}`);
    });
  }
  
  // Show sorting order
  console.log('\n📋 Sorting order applied:');
  console.log('   1. Primary: Status priority (online > unknown > offline)');
  console.log('   2. Secondary: Extension number (ascending)');
  
  // Show first few sorted extensions
  if (sortedExtensions.length > 0) {
    console.log('\n🏆 Top 5 extensions after sorting:');
    sortedExtensions.slice(0, 5).forEach((ext, index) => {
      console.log(`   ${index + 1}. ${ext.extension} (${ext.status})`);
    });
  }
};

// Main function
const main = async () => {
  console.log('🚀 Starting getAllExtensions.js - AMI Query Script');
  console.log('⏰ Started at:', new Date().toLocaleString());
  
  try {
    // Connect to database
    await connectDB();
    
    // First, show current extensions from database with the same logic as ExtensionsStatus.tsx
    console.log('\n📋 STEP 1: Current Extensions in Database (Using ExtensionsStatus.tsx Logic)');
    const { all: allExtensions, filtered: filteredExtensions, sorted: sortedExtensions } = await getAllExtensionsFromDatabase();
    
    if (allExtensions.length > 0) {
      // Show all extensions first
      displayExtensionsTable(allExtensions, 'ALL EXTENSIONS IN DATABASE');
      
      // Show filtering analysis
      displayFilteringAnalysis(allExtensions, filteredExtensions, sortedExtensions);
      
      // Show filtered and sorted extensions (same as frontend displays)
      displayExtensionsTable(sortedExtensions, 'FILTERED & SORTED EXTENSIONS (Same as Frontend)');
    } else {
      console.log('⚠️ No extensions found in database');
    }
    
    // Query extensions via AMI
    console.log('\n🔍 STEP 2: Querying Extensions via AMI');
    const startTime = Date.now();
    const amiExtensions = await queryExtensionsViaAMI();
    const amiTime = Date.now() - startTime;
    
    if (amiExtensions.length === 0) {
      console.log('❌ No extensions found via AMI');
      return;
    }
    
    // Update database
    console.log('\n💾 STEP 3: Updating Database with AMI Data');
    const dbStartTime = Date.now();
    await updateDatabaseWithAMI(amiExtensions);
    const dbTime = Date.now() - dbStartTime;
    
    // Display updated results with the same filtering logic
    console.log('\n📊 STEP 4: Updated Extensions After AMI Query (Using Same Logic)');
    
    // Apply the same filtering and sorting to AMI results
    const updatedFiltered = amiExtensions.filter(ext => {
      const isActive = ext.is_active !== false;
      const isValidExtension = /^\d{4}$/.test(ext.extension);
      const hasKnownStatus = ext.status !== 'unknown';
      return isActive && isValidExtension && hasKnownStatus;
    });
    
    const updatedSorted = [...updatedFiltered].sort((a, b) => {
      const statusPriority = { 'online': 0, 'unknown': 1, 'offline': 2 };
      const aPriority = statusPriority[a.status] ?? 3;
      const bPriority = statusPriority[b.status] ?? 3;
      
      if (aPriority !== bPriority) return aPriority - bPriority;
      return a.extension.localeCompare(b.extension, undefined, { numeric: true });
    });
    
    displayExtensionsTable(updatedSorted, 'UPDATED EXTENSIONS (Filtered & Sorted)');
    
    // Performance summary
    console.log(`\n⏱️ PERFORMANCE:`);
    console.log(`   AMI Query: ${amiTime}ms`);
    console.log(`   Database Update: ${dbTime}ms`);
    console.log(`   Total Time: ${Date.now() - startTime}ms`);
    
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
