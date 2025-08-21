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
    protected $description = 'Clean up stuck calls using the same logic as CleanupStuckCallsJob';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('🧹 Starting stuck calls cleanup...');

        try {
            $this->executeCleanup();
            $this->info('✅ Cleanup completed successfully!');
            return 0;
        } catch (\Exception $e) {
            $this->error('❌ Cleanup failed: ' . $e->getMessage());
            Log::error('Manual cleanup command failed', [
                'command' => 'calls:cleanup',
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return 1;
        }
    }

    /**
     * Execute the actual cleanup logic
     */
    private function executeCleanup(): void
    {
        $startTime = microtime(true);
        $timeoutMinutes = 5; // Default timeout like the job

        $this->info("🤖 Starting cleanup for calls stuck longer than {$timeoutMinutes} minutes");

        // 1. Clean up answered calls that are stuck
        $stuckAnsweredCalls = Call::whereNotNull('answered_at')
            ->whereNull('ended_at')
            ->where('answered_at', '<', now()->subMinutes($timeoutMinutes))
            ->get();

        // 2. Clean up ringing calls that never got answered
        $stuckRingingCalls = Call::whereNull('answered_at')
            ->whereNull('ended_at')
            ->where('created_at', '<', now()->subMinutes($timeoutMinutes))
            ->get();

        // Initialize counters
        $totalStuckCalls = $stuckAnsweredCalls->count() + $stuckRingingCalls->count();
        $answeredCallsToCleanup = 0;
        $ringingCallsToCleanup = 0;

        if ($totalStuckCalls === 0) {
            $this->info("✅ No stuck calls found. All calls are healthy!");
            return;
        }

        $this->info("📊 Found {$totalStuckCalls} total stuck call(s)");
        $this->line("   • Answered calls stuck: " . $stuckAnsweredCalls->count());
        $this->line("   • Ringing calls stuck: " . $stuckRingingCalls->count());

        // Process answered calls
        if ($stuckAnsweredCalls->isNotEmpty()) {
            $answeredCallsToCleanup = $this->processAnsweredCalls($stuckAnsweredCalls);
        }

        // Process ringing calls
        if ($stuckRingingCalls->isNotEmpty()) {
            $ringingCallsToCleanup = $this->processRingingCalls($stuckRingingCalls);
        }

        // Calculate total cleanup needed
        $totalCleanupNeeded = $answeredCallsToCleanup + $ringingCallsToCleanup;

        // Calculate execution time
        $executionTime = microtime(true) - $startTime;
        $executionTimeMs = round($executionTime * 1000, 2);

        // Summary
        if ($totalCleanupNeeded > 0) {
            $this->newLine();
            $this->info("🎉 Summary - Successfully cleaned up {$totalCleanupNeeded} stuck call(s)!");
            $this->line("   • Answered calls cleaned: {$answeredCallsToCleanup}");
            $this->line("   • Ringing calls cleaned: {$ringingCallsToCleanup}");
            $this->line("   • Processing time: " . $this->formatProcessingTime($executionTime));
        } else {
            $this->newLine();
            $this->info("ℹ️ No calls were eligible for cleanup");
            $this->line("   • Processing time: " . $this->formatProcessingTime($executionTime));
        }

        // Log the manual execution
        Log::info('Manual cleanup command executed', [
            'command' => 'calls:cleanup',
            'timeout_minutes' => $timeoutMinutes,
            'total_stuck_found' => $totalStuckCalls,
            'total_cleaned' => $totalCleanupNeeded,
            'answered_cleaned' => $answeredCallsToCleanup,
            'ringing_cleaned' => $ringingCallsToCleanup,
            'processing_time_ms' => $executionTimeMs,
            'executed_by' => 'artisan_command'
        ]);
    }

    /**
     * Process answered calls that are stuck
     */
    private function processAnsweredCalls($stuckAnsweredCalls): int
    {
        if ($stuckAnsweredCalls->isEmpty()) {
            return 0;
        }

        // Smart cleanup logic: Clean up if extension is free OR if there are newer calls
        $callsToCleanup = $stuckAnsweredCalls->filter(function ($call) {
            $extension = $call->agent_exten;
            $stuckDuration = $call->answered_at->diffInMinutes(now(), false);

            // CRITICAL: If call is stuck for 30+ minutes, clean it up regardless of extension status
            if ($stuckDuration >= 30) {
                $this->line("🚨 Critical cleanup - Answered Call ID {$call->id} stuck for {$stuckDuration} minutes (30+ min override)");
                return true; // Force cleanup for 30+ minute stuck calls
            }

            // Get all active calls on this extension (including the stuck one)
            $allActiveCallsOnExtension = Call::where('agent_exten', $extension)
                ->whereNotNull('answered_at')
                ->whereNull('ended_at')
                ->orderBy('answered_at', 'asc')  // Oldest first
                ->get();

            if ($allActiveCallsOnExtension->count() === 1) {
                // Only this stuck call exists on extension - safe to clean up
                return true;
            }

            // Multiple calls on extension - check if this is the oldest (stuck) one
            $oldestCall = $allActiveCallsOnExtension->first();
            if ($oldestCall->id === $call->id) {
                // This is the oldest call - clean it up to make room for newer ones
                return true;
            }

            // This is not the oldest call - don't clean up (let newer calls continue)
            return false;
        });

        if ($callsToCleanup->isEmpty()) {
            $this->line("ℹ️ Found stuck answered calls but none eligible for cleanup (newer calls exist)");
            Log::info("ℹ️ CleanupStuckCalls: Found stuck answered calls but none eligible for cleanup (newer calls exist)", [
                'total_stuck_answered' => $stuckAnsweredCalls->count(),
                'eligible_for_cleanup' => 0
            ]);
            return 0;
        }

        $this->warn("⚠️ Found {$callsToCleanup->count()} answered call(s) to clean up");
        Log::info("⚠️ CleanupStuckCalls: Found {$callsToCleanup->count()} answered call(s) to clean up");

        $cleanedCount = 0;
        $errors = [];

        foreach ($callsToCleanup as $call) {
            try {
                $stuckDuration = $call->answered_at->diffInMinutes(now(), false);

                // Mark the call as ended
                $call->ended_at = now();

                // Set hangup cause based on stuck duration
                if ($stuckDuration >= 30) {
                    $call->hangup_cause = 'critical_timeout_override';
                } else {
                    $call->hangup_cause = 'queue_cleanup_timeout';
                }

                // Calculate talk duration if possible
                if ($call->answered_at && empty($call->talk_seconds)) {
                    $call->talk_seconds = max(0, $call->answered_at->diffInSeconds($call->ended_at, true));
                }

                $call->save();

                // Broadcast the update to frontend
                broadcast(new CallUpdated($call));

                $cleanedCount++;
                $this->line("✅ Cleaned up ANSWERED Call ID: {$call->id} (Extension: {$call->agent_exten}, Stuck: {$stuckDuration} min)");

                Log::info("✅ CleanupStuckCalls: Cleaned up ANSWERED Call ID: {$call->id}", [
                    'call_id' => $call->id,
                    'linkedid' => $call->linkedid,
                    'extension' => $call->agent_exten,
                    'stuck_duration_minutes' => $stuckDuration,
                    'cleanup_time' => now(),
                    'cleanup_type' => 'answered_manual_command'
                ]);

            } catch (\Exception $e) {
                $errorMsg = "Failed to clean up Answered Call ID: {$call->id} - {$e->getMessage()}";
                $this->error($errorMsg);
                Log::error("CleanupStuckCalls: Failed to clean up stuck answered call", [
                    'call_id' => $call->id,
                    'error' => $e->getMessage(),
                ]);
                $errors[] = $errorMsg;
            }
        }

        if (!empty($errors)) {
            $this->warn("⚠️ " . count($errors) . " error(s) occurred during answered call cleanup");
            Log::warning("⚠️ CleanupStuckCalls: " . count($errors) . " error(s) occurred during answered call cleanup", [
                'errors' => $errors
            ]);
        }

        return $cleanedCount;
    }

    /**
     * Process ringing calls that never got answered
     */
    private function processRingingCalls($stuckRingingCalls): int
    {
        if ($stuckRingingCalls->isEmpty()) {
            return 0;
        }

        // Smart cleanup logic for ringing calls (same as answered calls)
        $ringingCallsToCleanup = $stuckRingingCalls->filter(function ($call) {
            $extension = $call->agent_exten;
            $ringingDuration = $call->created_at->diffInMinutes(now(), false);

            // CRITICAL: If ringing for 30+ minutes, clean it up regardless of extension status
            if ($ringingDuration >= 30) {
                $this->line("🚨 Critical cleanup - Ringing Call ID {$call->id} stuck for {$ringingDuration} minutes (30+ min override)");
                return true; // Force cleanup for 30+ minute ringing calls
            }

            // Get all active calls on this extension (including the ringing one)
            $allActiveCallsOnExtension = Call::where('agent_exten', $extension)
                ->whereNull('ended_at')
                ->orderBy('created_at', 'asc')  // Oldest first
                ->get();

            if ($allActiveCallsOnExtension->count() === 1) {
                // Only this ringing call exists on extension - safe to clean up
                return true;
            }

            // Multiple calls on extension - check if this is the oldest (ringing) one
            $oldestCall = $allActiveCallsOnExtension->first();
            if ($oldestCall->id === $call->id) {
                // This is the oldest call - clean it up to make room for newer ones
                return true;
            }

            // This is not the oldest call - don't clean up (let newer calls continue)
            return false;
        });

        if ($ringingCallsToCleanup->isEmpty()) {
            $this->line("ℹ️ Found stuck ringing calls but none eligible for cleanup (newer calls exist)");
            Log::info("ℹ️ CleanupStuckCalls: Found stuck ringing calls but none eligible for cleanup (newer calls exist)", [
                'total_stuck_ringing' => $stuckRingingCalls->count(),
                'eligible_for_cleanup' => 0
            ]);
            return 0;
        }

        $this->warn("⚠️ Found {$ringingCallsToCleanup->count()} ringing call(s) to clean up");
        Log::info("⚠️ CleanupStuckCalls: Found {$ringingCallsToCleanup->count()} ringing call(s) to clean up");

        $cleanedCount = 0;
        $errors = [];

        foreach ($ringingCallsToCleanup as $call) {
            try {
                $ringingDuration = $call->created_at->diffInMinutes(now(), false);

                // Mark the call as ended
                $call->ended_at = now();

                // Set hangup cause based on ringing duration
                if ($ringingDuration >= 30) {
                    $call->hangup_cause = 'critical_ringing_timeout_override';
                } else {
                    $call->hangup_cause = 'ringing_cleanup_timeout';
                }

                // No talk duration since never answered
                $call->talk_seconds = 0;

                $call->save();

                // Broadcast the update to frontend
                broadcast(new CallUpdated($call));

                $cleanedCount++;
                $this->line("🔔 Cleaned up RINGING Call ID: {$call->id} (Extension: {$call->agent_exten}, Ringing: {$ringingDuration} min)");

                Log::info("🔔 CleanupStuckCalls: Cleaned up RINGING Call ID: {$call->id}", [
                    'call_id' => $call->id,
                    'linkedid' => $call->linkedid,
                    'extension' => $call->agent_exten,
                    'ringing_duration_minutes' => $ringingDuration,
                    'cleanup_time' => now(),
                    'cleanup_type' => 'ringing_manual_command'
                ]);

            } catch (\Exception $e) {
                $errorMsg = "Failed to clean up Ringing Call ID: {$call->id} - {$e->getMessage()}";
                $this->error($errorMsg);
                Log::error("CleanupStuckCalls: Failed to clean up ringing call", [
                    'call_id' => $call->id,
                    'error' => $e->getMessage(),
                ]);
                $errors[] = $errorMsg;
            }
        }

        if (!empty($errors)) {
            $this->warn("⚠️ " . count($errors) . " error(s) occurred during ringing call cleanup");
            Log::warning("⚠️ CleanupStuckCalls: " . count($errors) . " error(s) occurred during ringing call cleanup", [
                'errors' => $errors
            ]);
        }

        return $cleanedCount;
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
