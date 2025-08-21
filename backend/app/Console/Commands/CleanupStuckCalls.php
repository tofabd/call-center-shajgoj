<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Call;
use Illuminate\Support\Facades\Log;
use App\Events\CallUpdated;

class CleanupStuckCalls extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'calls:cleanup';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Clean up stuck calls using time-based cleanup logic';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('🧹 Starting time-based stuck calls cleanup...');
        $this->line("   📋 Logic: Clean up older calls when newer calls exist on same extension");
        $this->line("   🎯 Goal: Remove stuck calls that have been superseded by newer calls");

        try {
            $this->executeTimeBasedCleanup();
            $this->executeStaleCallCleanup();
            $this->info('✅ Cleanup completed successfully!');
            return 0;
        } catch (\Exception $e) {
            $this->error('❌ Cleanup failed: ' . $e->getMessage());
            Log::error('Time-based cleanup command failed', [
                'command' => 'calls:cleanup',
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return 1;
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
    private function executeTimeBasedCleanup(): void
    {
        $startTime = microtime(true);

        // Find all active calls that are 2+ minutes older
        $cutoffTime = now()->subMinutes(2);

        $activeCalls = Call::whereNull('ended_at')
            ->whereNotNull('agent_exten')
            ->where('started_at', '<', $cutoffTime)
            ->orderBy('started_at', 'asc') // Process from oldest to newest
            ->get();

        if ($activeCalls->isEmpty()) {
            $this->info("✅ No active calls found that are 2+ minutes older");
            return;
        }

        $this->info("📊 Found {$activeCalls->count()} active calls that are 2+ minutes older");
        $this->line("   🔍 Processing from oldest to newest...");

        $totalProcessed = 0;
        $totalCleaned = 0;
        $totalKept = 0;
        $errors = [];

        foreach ($activeCalls as $call) {
            $this->newLine();
            $this->info("🔧 Processing Call ID: {$call->id} (Extension: {$call->agent_exten}, Started: {$call->started_at->format('H:i:s')})");

            try {
                // Search for newer calls on the same extension
                $newerCall = $this->findNewerCallByExtension($call->agent_exten, $call);

                if ($newerCall) {
                    // Newer call found - clean up older call
                    $this->line("   🔍 Searching for newer calls on extension {$call->agent_exten}...");
                    $this->line("   ✅ Found newer call ID: {$newerCall->id} (Started: {$newerCall->started_at->format('H:i:s')})");

                    if ($this->cleanupOlderCall($call)) {
                        $this->line("   🧹 Cleaning up older call ID: {$call->id}");
                        $this->line("   ✅ Call cleaned up successfully");
                        $totalCleaned++;
                    } else {
                        $this->warn("   ⚠️ Failed to clean up call ID: {$call->id}");
                        $errors[] = "Failed to clean up Call ID: {$call->id}";
                    }
                } else {
                    // No newer call found - keep this call
                    $this->line("   🔍 Searching for newer calls on extension {$call->agent_exten}...");
                    $this->line("   ❌ No newer calls found on extension {$call->agent_exten}");
                    $this->line("   ℹ️ Keeping call ID: {$call->id} (no newer call exists)");
                    $totalKept++;
                }

                $totalProcessed++;

            } catch (\Exception $e) {
                $errorMsg = "Error processing Call ID: {$call->id} - {$e->getMessage()}";
                $this->error($errorMsg);
                $errors[] = $errorMsg;
                Log::error("Time-based cleanup error", [
                    'call_id' => $call->id,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString()
                ]);
            }
        }

        // Calculate execution time
        $executionTime = microtime(true) - $startTime;
        $executionTimeMs = round($executionTime * 1000, 2);

        // Summary
        $this->newLine();
        $this->info("🎉 Cleanup Summary:");
        $this->line("   • Total calls processed: {$totalProcessed}");
        $this->line("   • Calls cleaned up: {$totalCleaned}");
        $this->line("   • Calls kept: {$totalKept}");
        $this->line("   • Processing time: " . $this->formatProcessingTime($executionTime));

        if (!empty($errors)) {
            $this->warn("⚠️ " . count($errors) . " error(s) occurred during cleanup");
            foreach ($errors as $error) {
                $this->line("   • {$error}");
            }
        }

        // Log the cleanup execution
        Log::info('Time-based cleanup executed successfully', [
            'command' => 'calls:cleanup',
            'cleanup_type' => 'time_based_extension_validation',
            'total_calls_processed' => $totalProcessed,
            'total_calls_cleaned' => $totalCleaned,
            'total_calls_kept' => $totalKept,
            'processing_time_ms' => $executionTimeMs,
            'executed_by' => 'artisan_command',
            'cleanup_strategy' => 'Clean up older calls when newer calls exist on same extension',
            'time_threshold_minutes' => 2
        ]);
    }

    /**
     * Execute stale call cleanup (20+ minutes active)
     *
     * Simple cleanup: Remove ALL calls that have been active for 20+ minutes
     * No extension checking, no complex logic - just clean up old calls
     */
    private function executeStaleCallCleanup(): void
    {
        $startTime = microtime(true);

        $this->info("⏰ Starting STALE CALL cleanup (20+ minutes active)");
        $this->line("   📋 Logic: Remove ALL calls active for 20+ minutes (no extension checking)");
        $this->line("   🎯 Goal: Simple cleanup of old stuck calls");

        // Find all active calls that are 20+ minutes older
        $cutoffTime = now()->subMinutes(20);

        $staleCalls = Call::whereNull('ended_at')
            ->where('started_at', '<', $cutoffTime)
            ->orderBy('started_at', 'asc') // Process from oldest to newest
            ->get();

        if ($staleCalls->isEmpty()) {
            $this->info("✅ No stale calls found (20+ minutes active)");
            return;
        }

        $this->info("📊 Found {$staleCalls->count()} stale calls (20+ minutes active)");
        $this->line("   🔍 Processing from oldest to newest...");

        $totalProcessed = 0;
        $totalCleaned = 0;
        $errors = [];

        foreach ($staleCalls as $call) {
            $this->newLine();
            $callType = $call->answered_at ? 'Answered' : 'Ringing';
            $duration = $call->started_at->diffInMinutes(now());

            $this->info("🔧 Processing Stale Call ID: {$call->id} (Extension: {$call->agent_exten}, Type: {$callType}, Duration: {$duration} minutes)");

            try {
                if ($this->cleanupStaleCall($call)) {
                    $this->line("   🧹 Cleaning up stale call ID: {$call->id}");
                    $this->line("   ✅ Call cleaned up successfully");
                    $totalCleaned++;
                } else {
                    $this->warn("   ⚠️ Failed to clean up stale call ID: {$call->id}");
                    $errors[] = "Failed to clean up stale Call ID: {$call->id}";
                }

                $totalProcessed++;

            } catch (\Exception $e) {
                $errorMsg = "Error processing stale Call ID: {$call->id} - {$e->getMessage()}";
                $this->error($errorMsg);
                $errors[] = $errorMsg;
                Log::error("Stale call cleanup error", [
                    'call_id' => $call->id,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString()
                ]);
            }
        }

        // Calculate execution time
        $executionTime = microtime(true) - $startTime;
        $executionTimeMs = round($executionTime * 1000, 2);

        // Summary
        $this->newLine();
        $this->info("🎉 Stale Call Cleanup Summary:");
        $this->line("   • Total stale calls processed: {$totalProcessed}");
        $this->line("   • Stale calls cleaned up: {$totalCleaned}");
        $this->line("   • Processing time: " . $this->formatProcessingTime($executionTime));

        if (!empty($errors)) {
            $this->warn("⚠️ " . count($errors) . " error(s) occurred during stale call cleanup");
            foreach ($errors as $error) {
                $this->line("   • {$error}");
            }
        }

        // Log the stale call cleanup execution
        Log::info('Stale call cleanup executed successfully', [
            'command' => 'calls:cleanup',
            'cleanup_type' => 'stale_call_cleanup',
            'total_calls_processed' => $totalProcessed,
            'total_calls_cleaned' => $totalCleaned,
            'processing_time_ms' => $executionTimeMs,
            'executed_by' => 'artisan_command',
            'cleanup_strategy' => 'Remove ALL calls active for 20+ minutes (simple cleanup)',
            'time_threshold_minutes' => 20
        ]);
    }

    /**
     * Search for newer calls on the same extension
     *
     * @param string $extension The agent extension to search
     * @param Call $olderCall The older call to compare against
     * @return Call|null Newer call if found, null if not found
     */
    private function findNewerCallByExtension(string $extension, Call $olderCall): ?Call
    {
        // Find any call (active or ended) on the same extension
        // that started after the older call
        $newerCall = Call::where('agent_exten', $extension)
            ->where('started_at', '>', $olderCall->started_at)
            ->orderBy('started_at', 'desc') // Get the newest one first
            ->first();

        return $newerCall;
    }

    /**
     * Clean up an older call by marking it as ended
     *
     * @param Call $call The call to clean up
     * @return bool True if successful, false if failed
     */
    private function cleanupOlderCall(Call $call): bool
    {
        try {
            // Mark the call as ended
            $call->ended_at = now();

            // Set hangup cause based on call state and cleanup reason
            if ($call->answered_at) {
                $call->hangup_cause = 'time_based_cleanup_answered_call';
            } else {
                $call->hangup_cause = 'time_based_cleanup_ringing_call';
            }

            // Calculate talk duration if possible
            if ($call->answered_at && empty($call->talk_seconds)) {
                $call->talk_seconds = max(0, $call->answered_at->diffInSeconds($call->ended_at, true));
            }

            // Save the changes
            $call->save();

            // Broadcast the update to frontend
            broadcast(new CallUpdated($call));

            // Log the cleanup
            Log::info("✅ Time-based cleanup: Cleaned up call", [
                'call_id' => $call->id,
                'linkedid' => $call->linkedid,
                'extension' => $call->agent_exten,
                'call_type' => $call->answered_at ? 'Answered' : 'Ringing',
                'started_at' => $call->started_at,
                'ended_at' => $call->ended_at,
                'cleanup_time' => now(),
                'cleanup_reason' => 'Newer call exists on same extension',
                'hangup_cause' => $call->hangup_cause
            ]);

            return true;

        } catch (\Exception $e) {
            Log::error("❌ Time-based cleanup failed", [
                'call_id' => $call->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return false;
        }
    }

    /**
     * Clean up a stale call by marking it as ended
     *
     * Simple cleanup: No extension checking, just mark as ended
     *
     * @param Call $call The stale call to clean up
     * @return bool True if successful, false if failed
     */
    private function cleanupStaleCall(Call $call): bool
    {
        try {
            // Mark the call as ended
            $call->ended_at = now();

            // Set hangup cause based on call state and cleanup reason
            if ($call->answered_at) {
                $call->hangup_cause = 'stale_call_cleanup_answered_call';
            } else {
                $call->hangup_cause = 'stale_call_cleanup_ringing_call';
            }

            // Calculate talk duration if possible
            if ($call->answered_at && empty($call->talk_seconds)) {
                $call->talk_seconds = max(0, $call->answered_at->diffInSeconds($call->ended_at, true));
            }

            // Save the changes
            $call->save();

            // Broadcast the update to frontend (IMPORTANT: This updates frontend status!)
            broadcast(new CallUpdated($call));

            // Log the cleanup
            Log::info("✅ Stale call cleanup: Cleaned up call", [
                'call_id' => $call->id,
                'linkedid' => $call->linkedid,
                'extension' => $call->agent_exten,
                'call_type' => $call->answered_at ? 'Answered' : 'Ringing',
                'started_at' => $call->started_at,
                'ended_at' => $call->ended_at,
                'cleanup_time' => now(),
                'cleanup_reason' => 'Call active for 20+ minutes (stale)',
                'hangup_cause' => $call->hangup_cause,
                'total_duration_minutes' => $call->started_at->diffInMinutes(now())
            ]);

            return true;

        } catch (\Exception $e) {
            Log::error("❌ Stale call cleanup failed", [
                'call_id' => $call->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return false;
        }
    }

    /**
     * Format processing time in human-readable format
     */
    private function formatProcessingTime(float $seconds): string
    {
        if ($seconds < 1) {
            return round($seconds * 1000, 2) . ' milliseconds';
        }

        if ($seconds < 60) {
            return round($seconds, 2) . ' second' . ($seconds == 1 ? '' : 's');
        }

        $minutes = floor($seconds / 60);
        $remainingSeconds = round($seconds % 60, 2);

        if ($remainingSeconds == 0) {
            return $minutes . ' minute' . ($minutes == 1 ? '' : 's');
        }

        return $minutes . ' minute' . ($minutes == 1 ? '' : 's') . ' ' . $remainingSeconds . ' second' . ($remainingSeconds == 1 ? '' : 's');
    }
}
