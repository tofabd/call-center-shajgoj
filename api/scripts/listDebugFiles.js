#!/usr/bin/env node

/**
 * listDebugFiles.js - List all generated JSON debug files
 * 
 * This script scans the debug directory and lists all JSON files
 * organized by script type and provides statistics
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const debugDir = path.join(__dirname, '../debug');

/**
 * Get file size in human readable format
 */
const getHumanFileSize = (bytes) => {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Get file age in human readable format
 */
const getFileAge = (filePath) => {
  try {
    const stats = fs.statSync(filePath);
    const now = new Date();
    const created = stats.birthtime;
    const diffMs = now - created;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) return `${diffDays} days ago`;
    if (diffHours > 0) return `${diffHours} hours ago`;
    if (diffMins > 0) return `${diffMins} minutes ago`;
    return 'Just now';
  } catch (error) {
    return 'Unknown';
  }
};

/**
 * Scan directory recursively for JSON files
 */
const scanDirectory = (dirPath, basePath = '') => {
  const files = [];
  
  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = path.join(dirPath, item.name);
      const relativePath = path.join(basePath, item.name);
      
      if (item.isDirectory()) {
        files.push(...scanDirectory(fullPath, relativePath));
      } else if (item.isFile() && item.name.endsWith('.json')) {
        const stats = fs.statSync(fullPath);
        files.push({
          name: item.name,
          relativePath,
          fullPath,
          size: stats.size,
          humanSize: getHumanFileSize(stats.size),
          created: stats.birthtime,
          modified: stats.mtime,
          age: getFileAge(fullPath),
          directory: basePath || '.'
        });
      }
    }
  } catch (error) {
    console.log(`⚠️  Cannot read directory: ${dirPath}`);
  }
  
  return files;
};

/**
 * Group files by script directory
 */
const groupFilesByScript = (files) => {
  const groups = {
    'deviceState': [],
    'getAllExtensions': [],
    'getChannels': [],
    'getExtension': [],
    'dndTracker': [],
    'standaloneRefresh': [],
    'legacy': [] // For old structure files
  };
  
  for (const file of files) {
    const dirName = file.directory.split('/')[0] || file.directory;
    
    if (groups[dirName]) {
      groups[dirName].push(file);
    } else {
      groups['legacy'].push(file);
    }
  }
  
  return groups;
};

/**
 * Display file listing
 */
const displayFileListing = (groups) => {
  console.log('🗂️  DEBUG FILES LISTING');
  console.log('======================');
  console.log(`📁 Debug Directory: ${debugDir}\n`);
  
  let totalFiles = 0;
  let totalSize = 0;
  
  Object.keys(groups).forEach(groupName => {
    const files = groups[groupName];
    if (files.length === 0) return;
    
    totalFiles += files.length;
    const groupSize = files.reduce((sum, file) => sum + file.size, 0);
    totalSize += groupSize;
    
    console.log(`📂 ${groupName.toUpperCase()}`);
    console.log(`   Files: ${files.length} | Total Size: ${getHumanFileSize(groupSize)}`);
    console.log('   ' + '─'.repeat(50));
    
    // Sort by creation time (newest first)
    files.sort((a, b) => b.created - a.created);
    
    files.forEach((file, index) => {
      const prefix = index === files.length - 1 ? '   └─' : '   ├─';
      console.log(`${prefix} ${file.name}`);
      console.log(`   ${index === files.length - 1 ? '  ' : ' │'} Size: ${file.humanSize} | Age: ${file.age}`);
      console.log(`   ${index === files.length - 1 ? '  ' : ' │'} Path: ${file.relativePath}`);
    });
    
    console.log('');
  });
  
  console.log('📊 SUMMARY');
  console.log('==========');
  console.log(`Total JSON Files: ${totalFiles}`);
  console.log(`Total Size: ${getHumanFileSize(totalSize)}`);
  console.log(`Debug Directory: ${debugDir}`);
  
  // Show recent files (last 10)
  const allFiles = Object.values(groups).flat();
  const recentFiles = allFiles
    .sort((a, b) => b.created - a.created)
    .slice(0, 10);
    
  if (recentFiles.length > 0) {
    console.log('\n🕒 RECENT FILES (Last 10)');
    console.log('=========================');
    recentFiles.forEach((file, index) => {
      console.log(`${index + 1}. ${file.name} (${file.age})`);
    });
  }
  
  // Cleanup suggestions
  console.log('\n🧹 CLEANUP SUGGESTIONS');
  console.log('======================');
  const oldFiles = allFiles.filter(file => {
    const daysDiff = (new Date() - file.created) / (1000 * 60 * 60 * 24);
    return daysDiff > 7;
  });
  
  if (oldFiles.length > 0) {
    console.log(`📅 ${oldFiles.length} files older than 7 days (${getHumanFileSize(oldFiles.reduce((sum, f) => sum + f.size, 0))})`);
  } else {
    console.log('✅ No old files found');
  }
  
  const largeFiles = allFiles.filter(file => file.size > 1024 * 1024); // > 1MB
  if (largeFiles.length > 0) {
    console.log(`💾 ${largeFiles.length} files larger than 1MB`);
  }
};

/**
 * Main execution
 */
const main = () => {
  try {
    if (!fs.existsSync(debugDir)) {
      console.log('❌ Debug directory not found:', debugDir);
      console.log('💡 Run some scripts first to generate debug files');
      process.exit(1);
    }
    
    console.log('🔍 Scanning debug directory...\n');
    const files = scanDirectory(debugDir);
    
    if (files.length === 0) {
      console.log('📭 No JSON files found in debug directory');
      console.log('💡 Run some scripts to generate debug files:');
      console.log('   • node scripts/deviceState.js');
      console.log('   • node scripts/getAllExtensions.js');
      console.log('   • node scripts/getChannels.js');
      console.log('   • node scripts/dndTracker.js');
      process.exit(0);
    }
    
    const groups = groupFilesByScript(files);
    displayFileListing(groups);
    
  } catch (error) {
    console.error('❌ Error scanning debug files:', error.message);
    process.exit(1);
  }
};

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Scan interrupted');
  process.exit(1);
});

// Execute main function
main();