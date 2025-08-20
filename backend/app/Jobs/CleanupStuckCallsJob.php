<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Bus\Queueable as BusQueueable;
use Illuminate\Foundation\Bus\Dispatchable;
use App\Models\Call;
use Illuminate\Support\Facades\Log;

class CleanupStuckCallsJob implements ShouldQueue
{
    use Dispatchable, BusQueueable, Queueable, InteractsWithQueue;

    /**
     * The number of times the job may be attempted.
     */
    public $tries = 3;

    /**
     * The number of seconds the job can run before timing out.
     */
    public $timeout = 60; // 5 minutes

    /**
     * Create a new job instance.
     */
    public function __construct(
        public int $timeoutMinutes = 5
    ) {
        //
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $startTime = microtime(true);
        Log::info("🤖 CleanupStuckCallsJob: Starting cleanup for calls stuck longer than {$this->timeoutMinutes} minutes");

        // 1. Clean up answered calls that are stuck
        $stuckAnsweredCalls = Call::whereNotNull('answered_at')
            ->whereNull('ended_at')
            ->where('answered_at', '<', now()->subMinutes($this->timeoutMinutes))
            ->get();

        // 2. Clean up ringing calls that never got answered
        $stuckRingingCalls = Call::whereNull('answered_at')
            ->whereNull('ended_at')
            ->where('created_at', '<', now()->subMinutes($this->timeoutMinutes)) // Use same timeout as answered calls
            ->get();

        // Initialize counters
        $totalStuckCalls = $stuckAnsweredCalls->count() + $stuckRingingCalls->count();
        $answeredCallsToCleanup = 0;
        $ringingCallsToCleanup = 0;
        $totalCleanupNeeded = 0;

        if ($totalStuckCalls === 0) {
            Log::info("✅ CleanupStuckCallsJob: No stuck calls found. All calls are healthy!", [
                'timeout_minutes' => $this->timeoutMinutes,
                'total_stuck_calls' => 0,
                'cleanup_processes_needed' => 0
            ]);
            return;
        }

        Log::info("📊 CleanupStuckCallsJob: Found {$totalStuckCalls} total stuck call(s)", [
            'answered_calls_stuck' => $stuckAnsweredCalls->count(),
            'ringing_calls_stuck' => $stuckRingingCalls->count(),
            'total_stuck_calls' => $totalStuckCalls
        ]);

        // Process answered calls (existing logic)
        $answeredCallsToCleanup = $this->processAnsweredCalls($stuckAnsweredCalls);

        // Process ringing calls (new logic)
        $ringingCallsToCleanup = $this->processRingingCalls($stuckRingingCalls);

        // Calculate total cleanup needed
        $totalCleanupNeeded = $answeredCallsToCleanup + $ringingCallsToCleanup;

                // Calculate execution time
        $executionTime = microtime(true) - $startTime;
        $executionTimeMs = round($executionTime * 1000, 2);

        // Format human-readable processing time
        $processingTimeMessage = $this->formatProcessingTime($executionTime);

        // Summary with counter and timing
        if ($totalCleanupNeeded > 0) {
            Log::info("🎉 CleanupStuckCallsJob: Summary - Successfully cleaned up {$totalCleanupNeeded} stuck call(s)!");
            Log::info("⏱️ Clean up processing time: {$processingTimeMessage}");
            Log::info("📊 CleanupStuckCallsJob: Detailed summary", [
                'answered_calls_cleaned' => $answeredCallsToCleanup,
                'ringing_calls_cleaned' => $ringingCallsToCleanup,
                'total_cleaned_count' => $totalCleanupNeeded,
                'cleanup_processes_completed' => $totalCleanupNeeded,
                'timeout_minutes' => $this->timeoutMinutes,
                'execution_time' => now(),
                'processing_time_ms' => $executionTimeMs,
                'processing_time_seconds' => round($executionTime, 3)
            ]);
        } else {
            Log::info("ℹ️ CleanupStuckCallsJob: No calls were eligible for cleanup");
            Log::info("⏱️ Clean up processing time: {$processingTimeMessage}");
            Log::info("📊 CleanupStuckCallsJob: Detailed summary", [
                'total_stuck_found' => $totalStuckCalls,
                'cleanup_processes_needed' => 0,
                'processing_time_ms' => $executionTimeMs,
                'processing_time_seconds' => round($executionTime, 3)
            ]);
        }
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
                Log::info("🚨 CleanupStuckCallsJob: Critical cleanup - Answered Call ID {$call->id} stuck for {$stuckDuration} minutes (30+ min override)", [
                    'call_id' => $call->id,
                    'extension' => $extension,
                    'stuck_duration_minutes' => $stuckDuration,
                    'cleanup_reason' => 'critical_timeout_override'
                ]);
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
            Log::info("ℹ️ CleanupStuckCallsJob: Found stuck answered calls but none eligible for cleanup (newer calls exist)", [
                'total_stuck_answered' => $stuckAnsweredCalls->count(),
                'eligible_for_cleanup' => 0
            ]);
            return 0;
        }

        Log::info("⚠️ CleanupStuckCallsJob: Found {$callsToCleanup->count()} answered call(s) to clean up");

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
                broadcast(new \App\Events\CallUpdated($call));

                $cleanedCount++;
                Log::info("✅ CleanupStuckCallsJob: Cleaned up ANSWERED Call ID: {$call->id}", [
                    'call_id' => $call->id,
                    'linkedid' => $call->linkedid,
                    'extension' => $call->agent_exten,
                    'stuck_duration_minutes' => $stuckDuration,
                    'cleanup_time' => now(),
                    'cleanup_type' => 'answered_queue_job'
                ]);

            } catch (\Exception $e) {
                $errorMsg = "Failed to clean up Answered Call ID: {$call->id} - {$e->getMessage()}";
                Log::error("CleanupStuckCallsJob: Failed to clean up stuck answered call", [
                    'call_id' => $call->id,
                    'error' => $e->getMessage(),
                ]);
                $errors[] = $errorMsg;
            }
        }

        if (!empty($errors)) {
            Log::warning("⚠️ CleanupStuckCallsJob: " . count($errors) . " error(s) occurred during answered call cleanup", [
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
                Log::info("🚨 CleanupStuckCallsJob: Critical cleanup - Ringing Call ID {$call->id} stuck for {$ringingDuration} minutes (30+ min override)", [
                    'call_id' => $call->id,
                    'extension' => $extension,
                    'ringing_duration_minutes' => $ringingDuration,
                    'cleanup_reason' => 'critical_ringing_timeout_override'
                ]);
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
            Log::info("ℹ️ CleanupStuckCallsJob: Found stuck ringing calls but none eligible for cleanup (newer calls exist)", [
                'total_stuck_ringing' => $stuckRingingCalls->count(),
                'eligible_for_cleanup' => 0
            ]);
            return 0;
        }

        Log::info("⚠️ CleanupStuckCallsJob: Found {$ringingCallsToCleanup->count()} ringing call(s) to clean up");

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
                broadcast(new \App\Events\CallUpdated($call));

                $cleanedCount++;
                Log::info("🔔 CleanupStuckCallsJob: Cleaned up RINGING Call ID: {$call->id}", [
                    'call_id' => $call->id,
                    'linkedid' => $call->linkedid,
                    'extension' => $call->agent_exten,
                    'ringing_duration_minutes' => $ringingDuration,
                    'cleanup_time' => now(),
                    'cleanup_type' => 'ringing_queue_job'
                ]);

            } catch (\Exception $e) {
                $errorMsg = "Failed to clean up Ringing Call ID: {$call->id} - {$e->getMessage()}";
                Log::error("CleanupStuckCallsJob: Failed to clean up ringing call", [
                    'call_id' => $call->id,
                    'error' => $e->getMessage(),
                ]);
                $errors[] = $errorMsg;
            }
        }

        if (!empty($errors)) {
            Log::warning("⚠️ CleanupStuckCallsJob: " . count($errors) . " error(s) occurred during ringing call cleanup", [
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
