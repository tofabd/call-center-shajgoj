#!/usr/bin/env node

/**
 * Cleanup Stuck Calls - MongoDB/Express.js Version
 * 
 * Compatible implementation of Laravel's CleanupStuckCalls command
 * for MongoDB database with Express.js backend
 * 
 * Usage:
 *   node scripts/cleanupStuckCalls.js
 *   npm run cleanup:calls
 * 
 * Strategies:
 * 1. Time-Based Extension Cleanup (2+ minutes)
 * 2. Ringing Stuck Call Cleanup (5+ minutes) 
 * 3. Stale Call Cleanup (20+ minutes)
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Call from '../models/Call.js';
import BroadcastService from '../services/BroadcastService.js';
import LogService from '../services/LogService.js';

// Load environment variables
dotenv.config();

class StuckCallsCleanup {
  constructor() {
    this.startTime = Date.now();
    this.totalStats = {
      timeBasedProcessed: 0,
      timeBasedCleaned: 0,
      timeBasedKept: 0,
      ringingProcessed: 0,
      ringingCleaned: 0,
      staleProcessed: 0,
      staleCleaned: 0,
      totalErrors: 0
    };
    this.errors = [];
  }

  /**
   * Main execution method
   */
  async execute() {
    console.log('🧹 Starting MongoDB-based stuck calls cleanup...');
    console.log('   📋 Logic: Clean up older calls when newer calls exist on same extension');
    console.log('   🎯 Goal: Remove stuck calls that have been superseded by newer calls');
    console.log('');

    try {
      // Connect to MongoDB
      await this.connectDatabase();

      // Execute cleanup strategies
      await this.executeTimeBasedCleanup();
      await this.executeRingingStuckCallCleanup();
      await this.executeStaleCallCleanup();

      console.log('✅ Cleanup completed successfully!');
      console.log('');
      this.printFinalSummary();
      
      return 0;
    } catch (error) {
      console.error('❌ Cleanup failed:', error.message);
      LogService.error('MongoDB cleanup command failed', {
        command: 'cleanup:stuck-calls',
        error: error.message,
        stack: error.stack
      });
      return 1;
    } finally {
      await mongoose.connection.close();
    }
  }

  /**
   * Connect to MongoDB database
   */
  async connectDatabase() {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/call_center_shajgoj';
    
    try {
      await mongoose.connect(mongoUri);
      console.log('✅ Connected to MongoDB');
    } catch (error) {
      throw new Error(`Failed to connect to MongoDB: ${error.message}`);
    }
  }

  /**
   * Execute time-based cleanup logic
   * 
   * This method:
   * 1. Finds all active calls (not ended)
   * 2. Filters calls 2+ minutes older
   * 3. For each older call, searches by extension for newer calls
   * 4. If newer call found, cleans up older call
   * 5. Processes from oldest to newest call
   */
  async executeTimeBasedCleanup() {
    const startTime = Date.now();
    console.log('⏰ Starting TIME-BASED cleanup (2+ minutes old with newer calls on same extension)');

    // Find all active calls that are 2+ minutes older
    const cutoffTime = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes ago

    const activeCalls = await Call.find({
      ended_at: null,
      agent_exten: { $ne: null },
      started_at: { $lt: cutoffTime }
    }).sort({ started_at: 1 }); // Process from oldest to newest

    if (activeCalls.length === 0) {
      console.log('✅ No active calls found that are 2+ minutes older');
      return;
    }

    console.log(`📊 Found ${activeCalls.length} active calls that are 2+ minutes older`);
    console.log('   🔍 Processing from oldest to newest...');

    let processed = 0;
    let cleaned = 0;
    let kept = 0;

    for (const call of activeCalls) {
      console.log('');
      console.log(`🔧 Processing Call ID: ${call._id} (Extension: ${call.agent_exten}, Started: ${this.formatTime(call.started_at)})`);

      try {
        // Search for newer calls on the same extension
        const newerCall = await this.findNewerCallByExtension(call.agent_exten, call);

        if (newerCall) {
          console.log(`   🔍 Searching for newer calls on extension ${call.agent_exten}...`);
          console.log(`   ✅ Found newer call ID: ${newerCall._id} (Started: ${this.formatTime(newerCall.started_at)})`);

          if (await this.cleanupOlderCall(call)) {
            console.log(`   🧹 Cleaning up older call ID: ${call._id}`);
            console.log('   ✅ Call cleaned up successfully');
            cleaned++;
          } else {
            console.warn(`   ⚠️ Failed to clean up call ID: ${call._id}`);
            this.errors.push(`Failed to clean up Call ID: ${call._id}`);
          }
        } else {
          console.log(`   🔍 Searching for newer calls on extension ${call.agent_exten}...`);
          console.log(`   ❌ No newer calls found on extension ${call.agent_exten}`);
          console.log(`   ℹ️ Keeping call ID: ${call._id} (no newer call exists)`);
          kept++;
        }

        processed++;
      } catch (error) {
        const errorMsg = `Error processing Call ID: ${call._id} - ${error.message}`;
        console.error(errorMsg);
        this.errors.push(errorMsg);
        LogService.error('Time-based cleanup error', {
          call_id: call._id,
          error: error.message,
          stack: error.stack
        });
      }
    }

    // Calculate execution time
    const executionTime = Date.now() - startTime;

    // Summary
    console.log('');
    console.log('🎉 Time-Based Cleanup Summary:');
    console.log(`   • Total calls processed: ${processed}`);
    console.log(`   • Calls cleaned up: ${cleaned}`);
    console.log(`   • Calls kept: ${kept}`);
    console.log(`   • Processing time: ${this.formatProcessingTime(executionTime)}`);

    // Update stats
    this.totalStats.timeBasedProcessed = processed;
    this.totalStats.timeBasedCleaned = cleaned;
    this.totalStats.timeBasedKept = kept;

    // Log the cleanup execution
    LogService.info('Time-based cleanup executed successfully', {
      command: 'cleanup:stuck-calls',
      cleanup_type: 'time_based_extension_validation',
      total_calls_processed: processed,
      total_calls_cleaned: cleaned,
      total_calls_kept: kept,
      processing_time_ms: executionTime,
      executed_by: 'node_script',
      cleanup_strategy: 'Clean up older calls when newer calls exist on same extension',
      time_threshold_minutes: 2
    });
  }

  /**
   * Execute ringing stuck call cleanup (5+ minutes active)
   * 
   * Special cleanup: Remove ALL RINGING calls that have been active for 5+ minutes
   * No extension checking, no complex logic - just clean up old ringing calls
   */
  async executeRingingStuckCallCleanup() {
    const startTime = Date.now();
    console.log('');
    console.log('📞 Starting RINGING STUCK CALL cleanup (5+ minutes active)');
    console.log('   📋 Logic: Remove ALL RINGING calls active for 5+ minutes (no extension checking)');
    console.log('   🎯 Goal: Clean up stuck ringing calls that are clearly abandoned');

    // Find all active RINGING calls that are 5+ minutes older
    const cutoffTime = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago

    const ringingStuckCalls = await Call.find({
      ended_at: null,
      answered_at: null, // Only ringing calls (not answered)
      started_at: { $lt: cutoffTime }
    }).sort({ started_at: 1 }); // Process from oldest to newest

    if (ringingStuckCalls.length === 0) {
      console.log('✅ No ringing stuck calls found (5+ minutes active)');
      return;
    }

    console.log(`📊 Found ${ringingStuckCalls.length} ringing stuck calls (5+ minutes active)`);
    console.log('   🔍 Processing from oldest to newest...');

    let processed = 0;
    let cleaned = 0;

    for (const call of ringingStuckCalls) {
      console.log('');
      const duration = Math.floor((Date.now() - call.started_at.getTime()) / (1000 * 60));

      console.log(`🔧 Processing Ringing Stuck Call ID: ${call._id} (Extension: ${call.agent_exten}, Duration: ${duration} minutes)`);

      try {
        if (await this.cleanupRingingStuckCall(call)) {
          console.log(`   🧹 Cleaning up ringing stuck call ID: ${call._id}`);
          console.log('   ✅ Call cleaned up successfully');
          cleaned++;
        } else {
          console.warn(`   ⚠️ Failed to clean up ringing stuck call ID: ${call._id}`);
          this.errors.push(`Failed to clean up ringing stuck Call ID: ${call._id}`);
        }

        processed++;
      } catch (error) {
        const errorMsg = `Error processing ringing stuck Call ID: ${call._id} - ${error.message}`;
        console.error(errorMsg);
        this.errors.push(errorMsg);
        LogService.error('Ringing stuck call cleanup error', {
          call_id: call._id,
          error: error.message,
          stack: error.stack
        });
      }
    }

    // Calculate execution time
    const executionTime = Date.now() - startTime;

    // Summary
    console.log('');
    console.log('🎉 Ringing Stuck Call Cleanup Summary:');
    console.log(`   • Total ringing stuck calls processed: ${processed}`);
    console.log(`   • Ringing stuck calls cleaned up: ${cleaned}`);
    console.log(`   • Processing time: ${this.formatProcessingTime(executionTime)}`);

    // Update stats
    this.totalStats.ringingProcessed = processed;
    this.totalStats.ringingCleaned = cleaned;

    // Log the ringing stuck call cleanup execution
    LogService.info('Ringing stuck call cleanup executed successfully', {
      command: 'cleanup:stuck-calls',
      cleanup_type: 'ringing_stuck_call_cleanup',
      total_calls_processed: processed,
      total_calls_cleaned: cleaned,
      processing_time_ms: executionTime,
      executed_by: 'node_script',
      cleanup_strategy: 'Remove ALL RINGING calls active for 5+ minutes (simple cleanup)',
      time_threshold_minutes: 5
    });
  }

  /**
   * Execute stale call cleanup (20+ minutes active)
   * 
   * Simple cleanup: Remove ALL calls that have been active for 20+ minutes
   * No extension checking, no complex logic - just clean up old calls
   */
  async executeStaleCallCleanup() {
    const startTime = Date.now();
    console.log('');
    console.log('⏰ Starting STALE CALL cleanup (20+ minutes active)');
    console.log('   📋 Logic: Remove ALL calls active for 20+ minutes (no extension checking)');
    console.log('   🎯 Goal: Simple cleanup of old stuck calls');

    // Find all active calls that are 20+ minutes older
    const cutoffTime = new Date(Date.now() - 20 * 60 * 1000); // 20 minutes ago

    const staleCalls = await Call.find({
      ended_at: null,
      started_at: { $lt: cutoffTime }
    }).sort({ started_at: 1 }); // Process from oldest to newest

    if (staleCalls.length === 0) {
      console.log('✅ No stale calls found (20+ minutes active)');
      return;
    }

    console.log(`📊 Found ${staleCalls.length} stale calls (20+ minutes active)`);
    console.log('   🔍 Processing from oldest to newest...');

    let processed = 0;
    let cleaned = 0;

    for (const call of staleCalls) {
      console.log('');
      const callType = call.answered_at ? 'Answered' : 'Ringing';
      const duration = Math.floor((Date.now() - call.started_at.getTime()) / (1000 * 60));

      console.log(`🔧 Processing Stale Call ID: ${call._id} (Extension: ${call.agent_exten}, Type: ${callType}, Duration: ${duration} minutes)`);

      try {
        if (await this.cleanupStaleCall(call)) {
          console.log(`   🧹 Cleaning up stale call ID: ${call._id}`);
          console.log('   ✅ Call cleaned up successfully');
          cleaned++;
        } else {
          console.warn(`   ⚠️ Failed to clean up stale call ID: ${call._id}`);
          this.errors.push(`Failed to clean up stale Call ID: ${call._id}`);
        }

        processed++;
      } catch (error) {
        const errorMsg = `Error processing stale Call ID: ${call._id} - ${error.message}`;
        console.error(errorMsg);
        this.errors.push(errorMsg);
        LogService.error('Stale call cleanup error', {
          call_id: call._id,
          error: error.message,
          stack: error.stack
        });
      }
    }

    // Calculate execution time
    const executionTime = Date.now() - startTime;

    // Summary
    console.log('');
    console.log('🎉 Stale Call Cleanup Summary:');
    console.log(`   • Total stale calls processed: ${processed}`);
    console.log(`   • Stale calls cleaned up: ${cleaned}`);
    console.log(`   • Processing time: ${this.formatProcessingTime(executionTime)}`);

    // Update stats
    this.totalStats.staleProcessed = processed;
    this.totalStats.staleCleaned = cleaned;

    // Log the stale call cleanup execution
    LogService.info('Stale call cleanup executed successfully', {
      command: 'cleanup:stuck-calls',
      cleanup_type: 'stale_call_cleanup',
      total_calls_processed: processed,
      total_calls_cleaned: cleaned,
      processing_time_ms: executionTime,
      executed_by: 'node_script',
      cleanup_strategy: 'Remove ALL calls active for 20+ minutes (simple cleanup)',
      time_threshold_minutes: 20
    });
  }

  /**
   * Search for newer calls on the same extension
   * 
   * @param {string} extension The agent extension to search
   * @param {Object} olderCall The older call to compare against
   * @returns {Object|null} Newer call if found, null if not found
   */
  async findNewerCallByExtension(extension, olderCall) {
    // Find any call (active or ended) on the same extension
    // that started after the older call
    const newerCall = await Call.findOne({
      agent_exten: extension,
      started_at: { $gt: olderCall.started_at }
    }).sort({ started_at: -1 }); // Get the newest one first

    return newerCall;
  }

  /**
   * Clean up an older call by marking it as ended
   * 
   * @param {Object} call The call to clean up
   * @returns {boolean} True if successful, false if failed
   */
  async cleanupOlderCall(call) {
    try {
      const updateData = {
        ended_at: new Date(),
        updatedAt: new Date()
      };

      // Set hangup cause based on call state and cleanup reason
      if (call.answered_at) {
        updateData.hangup_cause = 'time_based_cleanup_answered_call';
      } else {
        updateData.hangup_cause = 'time_based_cleanup_ringing_call';
      }

      // Calculate talk duration if possible
      if (call.answered_at && !call.talk_seconds) {
        updateData.talk_seconds = Math.max(0, Math.floor((updateData.ended_at - call.answered_at) / 1000));
      }

      // Update the call
      await Call.findByIdAndUpdate(call._id, updateData);

      // Get updated call for broadcasting
      const updatedCall = await Call.findById(call._id);

      // Broadcast the update to frontend
      BroadcastService.callUpdated(updatedCall);

      // Log the cleanup
      LogService.info('✅ Time-based cleanup: Cleaned up call', {
        call_id: call._id,
        linkedid: call.linkedid,
        extension: call.agent_exten,
        call_type: call.answered_at ? 'Answered' : 'Ringing',
        started_at: call.started_at,
        ended_at: updateData.ended_at,
        cleanup_time: new Date(),
        cleanup_reason: 'Newer call exists on same extension',
        hangup_cause: updateData.hangup_cause
      });

      return true;
    } catch (error) {
      LogService.error('❌ Time-based cleanup failed', {
        call_id: call._id,
        error: error.message,
        stack: error.stack
      });
      return false;
    }
  }

  /**
   * Clean up a ringing stuck call by marking it as ended
   * 
   * @param {Object} call The ringing stuck call to clean up
   * @returns {boolean} True if successful, false if failed
   */
  async cleanupRingingStuckCall(call) {
    try {
      const updateData = {
        ended_at: new Date(),
        hangup_cause: 'ringing_stuck_call_cleanup_5_minutes',
        updatedAt: new Date()
      };

      // Update the call
      await Call.findByIdAndUpdate(call._id, updateData);

      // Get updated call for broadcasting
      const updatedCall = await Call.findById(call._id);

      // Broadcast the update to frontend (IMPORTANT: This updates frontend status!)
      BroadcastService.callUpdated(updatedCall);

      // Log the cleanup
      LogService.info('✅ Ringing stuck call cleanup: Cleaned up call', {
        call_id: call._id,
        linkedid: call.linkedid,
        extension: call.agent_exten,
        call_type: 'Ringing',
        started_at: call.started_at,
        ended_at: updateData.ended_at,
        cleanup_time: new Date(),
        cleanup_reason: 'Ringing call active for 5+ minutes (stuck)',
        hangup_cause: updateData.hangup_cause,
        total_duration_minutes: Math.floor((Date.now() - call.started_at.getTime()) / (1000 * 60))
      });

      return true;
    } catch (error) {
      LogService.error('❌ Ringing stuck call cleanup failed', {
        call_id: call._id,
        error: error.message,
        stack: error.stack
      });
      return false;
    }
  }

  /**
   * Clean up a stale call by marking it as ended
   * 
   * @param {Object} call The stale call to clean up
   * @returns {boolean} True if successful, false if failed
   */
  async cleanupStaleCall(call) {
    try {
      const updateData = {
        ended_at: new Date(),
        updatedAt: new Date()
      };

      // Set hangup cause based on call state and cleanup reason
      if (call.answered_at) {
        updateData.hangup_cause = 'stale_call_cleanup_answered_call';
      } else {
        updateData.hangup_cause = 'stale_call_cleanup_ringing_call';
      }

      // Calculate talk duration if possible
      if (call.answered_at && !call.talk_seconds) {
        updateData.talk_seconds = Math.max(0, Math.floor((updateData.ended_at - call.answered_at) / 1000));
      }

      // Update the call
      await Call.findByIdAndUpdate(call._id, updateData);

      // Get updated call for broadcasting
      const updatedCall = await Call.findById(call._id);

      // Broadcast the update to frontend (IMPORTANT: This updates frontend status!)
      BroadcastService.callUpdated(updatedCall);

      // Log the cleanup
      LogService.info('✅ Stale call cleanup: Cleaned up call', {
        call_id: call._id,
        linkedid: call.linkedid,
        extension: call.agent_exten,
        call_type: call.answered_at ? 'Answered' : 'Ringing',
        started_at: call.started_at,
        ended_at: updateData.ended_at,
        cleanup_time: new Date(),
        cleanup_reason: 'Call active for 20+ minutes (stale)',
        hangup_cause: updateData.hangup_cause,
        total_duration_minutes: Math.floor((Date.now() - call.started_at.getTime()) / (1000 * 60))
      });

      return true;
    } catch (error) {
      LogService.error('❌ Stale call cleanup failed', {
        call_id: call._id,
        error: error.message,
        stack: error.stack
      });
      return false;
    }
  }

  /**
   * Print final summary of all cleanup operations
   */
  printFinalSummary() {
    const totalExecutionTime = Date.now() - this.startTime;
    const totalProcessed = this.totalStats.timeBasedProcessed + this.totalStats.ringingProcessed + this.totalStats.staleProcessed;
    const totalCleaned = this.totalStats.timeBasedCleaned + this.totalStats.ringingCleaned + this.totalStats.staleCleaned;

    console.log('🎯 FINAL CLEANUP SUMMARY');
    console.log(''.padEnd(50, '='));
    console.log(`📊 Total Calls Processed: ${totalProcessed}`);
    console.log(`🧹 Total Calls Cleaned: ${totalCleaned}`);
    console.log(`⏱️ Total Execution Time: ${this.formatProcessingTime(totalExecutionTime)}`);
    console.log('');
    console.log('📋 Breakdown by Strategy:');
    console.log(`   • Time-Based: ${this.totalStats.timeBasedCleaned}/${this.totalStats.timeBasedProcessed} cleaned (${this.totalStats.timeBasedKept} kept)`);
    console.log(`   • Ringing Stuck: ${this.totalStats.ringingCleaned}/${this.totalStats.ringingProcessed} cleaned`);
    console.log(`   • Stale Calls: ${this.totalStats.staleCleaned}/${this.totalStats.staleProcessed} cleaned`);
    
    if (this.errors.length > 0) {
      console.log('');
      console.warn(`⚠️ ${this.errors.length} error(s) occurred during cleanup:`);
      this.errors.forEach(error => {
        console.log(`   • ${error}`);
      });
    }

    // Log final summary
    LogService.info('MongoDB cleanup completed', {
      command: 'cleanup:stuck-calls',
      total_execution_time_ms: totalExecutionTime,
      total_calls_processed: totalProcessed,
      total_calls_cleaned: totalCleaned,
      breakdown: this.totalStats,
      total_errors: this.errors.length
    });
  }

  /**
   * Format time for display
   */
  formatTime(date) {
    return date.toTimeString().split(' ')[0];
  }

  /**
   * Format processing time in human-readable format
   */
  formatProcessingTime(milliseconds) {
    const seconds = milliseconds / 1000;

    if (seconds < 1) {
      return `${Math.round(milliseconds)} milliseconds`;
    }

    if (seconds < 60) {
      return `${Math.round(seconds * 100) / 100} second${seconds === 1 ? '' : 's'}`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round((seconds % 60) * 100) / 100;

    if (remainingSeconds === 0) {
      return `${minutes} minute${minutes === 1 ? '' : 's'}`;
    }

    return `${minutes} minute${minutes === 1 ? '' : 's'} ${remainingSeconds} second${remainingSeconds === 1 ? '' : 's'}`;
  }
}

// Execute if run directly
if (process.argv[1] && process.argv[1].endsWith('cleanupStuckCalls.js')) {
  const cleanup = new StuckCallsCleanup();
  const exitCode = await cleanup.execute();
  process.exit(exitCode);
}

export default StuckCallsCleanup;