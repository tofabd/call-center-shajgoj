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
     *
     * This command handles two main scenarios:
     * 1. Multiple calls on same extension - cleans up all except the newest
     * 2. New call arrives on busy extension - cleans up all older calls
     *
     * The logic ensures that each extension always has only ONE active call
     * (the most recent one), preventing conflicts and stuck calls.
     */
    private function executeCleanup(): void
    {
        $startTime = microtime(true);

        $this->info("🤖 Starting cleanup for calls with extension conflicts");
        $this->line("   📋 Logic: Keep NEWEST call per extension, clean up ALL OLDER ones");
        $this->line("   🎯 Goal: Each extension should have only ONE active call");

        // 1. Find all active calls (answered or ringing) grouped by extension
        $activeCallsByExtension = Call::whereNull('ended_at')
            ->whereNotNull('agent_exten')
            ->orderBy('agent_exten')
            ->orderBy('created_at', 'asc')
            ->get()
            ->groupBy('agent_exten');

        // 2. Process extensions with multiple calls
        $extensionsWithConflicts = $activeCallsByExtension->filter(function ($calls, $extension) {
            return $calls->count() > 1;
        });

        if ($extensionsWithConflicts->isEmpty()) {
            $this->info("✅ No extension conflicts found. All extensions have single calls!");
            return;
        }

        $this->info("📊 Found " . $extensionsWithConflicts->count() . " extension(s) with multiple calls");
        $this->line("   🔍 These extensions have conflicts that need resolution");

        $totalCleaned = 0;
        $extensionsProcessed = 0;

        foreach ($extensionsWithConflicts as $extension => $calls) {
            $this->newLine();
            $this->info("🔧 Processing Extension: {$extension} ({$calls->count()} active calls)");
            $this->line("   📅 Call timeline:");

            // Show call timeline for this extension
            foreach ($calls as $index => $call) {
                $callType = $call->answered_at ? 'Answered' : 'Ringing';
                $status = $index === $calls->count() - 1 ? '← NEWEST (KEEPING)' : '← OLDER (CLEANING UP)';
                $callNumber = $index + 1;
                $this->line("      {$callNumber}. Call ID {$call->id} - {$callType} at {$call->created_at->format('H:i:s')} {$status}");
            }

            $cleanedCount = $this->processExtensionConflicts($extension, $calls);
            $totalCleaned += $cleanedCount;
            $extensionsProcessed++;

            if ($cleanedCount > 0) {
                $this->line("   ✅ Cleaned up {$cleanedCount} call(s) from extension {$extension}");
                $this->line("   🎯 Extension {$extension} now has 1 active call (conflict resolved)");
            } else {
                $this->line("   ℹ️ No cleanup needed for extension {$extension}");
            }
        }

        // Calculate execution time
        $executionTime = microtime(true) - $startTime;
        $executionTimeMs = round($executionTime * 1000, 2);

        // Summary
        $this->newLine();
        if ($totalCleaned > 0) {
            $this->info("🎉 Summary - Successfully cleaned up {$totalCleaned} call(s) from {$extensionsProcessed} extension(s)!");
            $this->line("   🎯 All extension conflicts have been resolved");
            $this->line("   📞 Each extension now has only ONE active call");
        } else {
            $this->info("ℹ️ No calls were eligible for cleanup");
        }
        $this->line("   • Extensions processed: {$extensionsProcessed}");
        $this->line("   • Total calls cleaned: {$totalCleaned}");
        $this->line("   • Processing time: " . $this->formatProcessingTime($executionTime));

        // Log the manual execution
        Log::info('Manual cleanup command executed - Extension conflict resolution', [
            'command' => 'calls:cleanup',
            'extensions_with_conflicts' => $extensionsWithConflicts->count(),
            'total_calls_cleaned' => $totalCleaned,
            'processing_time_ms' => $executionTimeMs,
            'executed_by' => 'artisan_command',
            'cleanup_strategy' => 'Keep newest call per extension, clean up all older ones'
        ]);
    }

    /**
     * Process extensions with multiple calls to clean up older calls.
     * Handles both scenarios:
     * 1. Multiple calls on same extension - clean up all except newest
     * 2. New call arrives on busy extension - clean up all older calls
     */
    private function processExtensionConflicts(string $extension, $calls): int
    {
        $cleanedCount = 0;
        $errors = [];

        // Sort calls by creation date (oldest first)
        $calls = $calls->sortBy('created_at');

        // ALWAYS keep only the newest call, clean up ALL others
        $callsToCleanup = $calls->slice(0, -1); // All except the last (newest) one

        if ($callsToCleanup->isEmpty()) {
            return 0;
        }

        $newestCall = $calls->last();
        $this->warn("⚠️ Found {$callsToCleanup->count()} older call(s) to clean up from extension {$extension}");
        $this->line("   📞 Keeping newest call: ID {$newestCall->id} (Created: {$newestCall->created_at->format('H:i:s')})");

        foreach ($callsToCleanup as $call) {
            try {
                // Mark the call as ended
                $call->ended_at = now();

                // Set hangup cause based on call state
                if ($call->answered_at) {
                    $call->hangup_cause = 'extension_conflict_answered_cleanup';
                } else {
                    $call->hangup_cause = 'extension_conflict_ringing_cleanup';
                }

                // Calculate talk duration if possible
                if ($call->answered_at && empty($call->talk_seconds)) {
                    $call->talk_seconds = max(0, $call->answered_at->diffInSeconds($call->ended_at, true));
                }

                $call->save();

                // Broadcast the update to frontend
                broadcast(new CallUpdated($call));

                $cleanedCount++;

                // Show call type in cleanup message
                $callType = $call->answered_at ? 'Answered' : 'Ringing';
                $this->line("   ✅ Cleaned up {$callType} Call ID: {$call->id} (Created: {$call->created_at->format('H:i:s')})");

                Log::info("✅ CleanupStuckCalls: Cleaned up {$callType} Call ID: {$call->id}", [
                    'call_id' => $call->id,
                    'linkedid' => $call->linkedid,
                    'extension' => $extension,
                    'call_type' => $callType,
                    'cleanup_time' => now(),
                    'cleanup_type' => 'extension_conflict_command',
                    'reason' => 'Multiple calls on same extension - keeping newest'
                ]);

            } catch (\Exception $e) {
                $errorMsg = "Failed to clean up Call ID: {$call->id} - {$e->getMessage()}";
                $this->error($errorMsg);
                Log::error("CleanupStuckCalls: Failed to clean up extension conflict call", [
                    'call_id' => $call->id,
                    'error' => $e->getMessage(),
                ]);
                $errors[] = $errorMsg;
            }
        }

        if (!empty($errors)) {
            $this->warn("⚠️ " . count($errors) . " error(s) occurred during extension conflict cleanup");
            Log::warning("⚠️ CleanupStuckCalls: " . count($errors) . " error(s) occurred during extension conflict cleanup", [
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
