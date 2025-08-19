<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Call;
use Illuminate\Support\Facades\Log;

class CleanupStuckCalls extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:cleanup-stuck-calls {--timeout=5 : Timeout in minutes for stuck calls} {--dry-run : Show what would be cleaned up without actually doing it}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Clean up stuck calls that have been in progress for too long without receiving ended_at timestamp';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $timeoutMinutes = (int) $this->option('timeout');
        $isDryRun = $this->option('dry-run');

                $this->info("🔍 Looking for calls stuck in progress for more than {$timeoutMinutes} minutes...");

        // Find calls that have been "in_progress" for too long
        $stuckCalls = Call::whereNotNull('answered_at')
            ->whereNull('ended_at')
            ->where('answered_at', '<', now()->subMinutes($timeoutMinutes))
            ->get();

        // Smart cleanup logic: Clean up if extension is free OR if there are newer calls
        $stuckCalls = $stuckCalls->filter(function ($call) {
            $extension = $call->agent_exten;

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

                if ($stuckCalls->isEmpty()) {
            $this->info("✅ No stuck calls found. All calls are healthy!");
            return 0;
        }

        $this->warn("⚠️  Found {$stuckCalls->count()} stuck call(s) to clean up:");

        // Display stuck calls with cleanup reason
        foreach ($stuckCalls as $call) {
            $stuckDuration = now()->diffInMinutes($call->answered_at);
            $extension = $call->agent_exten;

            // Get all active calls on this extension to show the reason
            $allActiveCallsOnExtension = Call::where('agent_exten', $extension)
                ->whereNotNull('answered_at')
                ->whereNull('ended_at')
                ->orderBy('answered_at', 'asc')
                ->get();

            if ($allActiveCallsOnExtension->count() === 1) {
                $this->line("   • Call ID: {$call->id}, Extension: {$extension}, Stuck for: {$stuckDuration} min → CLEANUP: Extension is free");
            } else {
                $this->line("   • Call ID: {$call->id}, Extension: {$extension}, Stuck for: {$stuckDuration} min → CLEANUP: Newer calls exist (total: {$allActiveCallsOnExtension->count()})");
            }
        }

        // Show calls that were NOT cleaned up (newer calls on same extension)
        $allStuckCalls = Call::whereNotNull('answered_at')
            ->whereNull('ended_at')
            ->where('answered_at', '<', now()->subMinutes($timeoutMinutes))
            ->get();

        $notCleanedUp = $allStuckCalls->whereNotIn('id', $stuckCalls->pluck('id'));

        if ($notCleanedUp->isNotEmpty()) {
            $this->info("ℹ️  Calls NOT cleaned up (newer calls on same extension):");
            foreach ($notCleanedUp as $call) {
                $stuckDuration = now()->diffInMinutes($call->answered_at);
                $extension = $call->agent_exten;

                $allActiveCallsOnExtension = Call::where('agent_exten', $extension)
                    ->whereNotNull('answered_at')
                    ->whereNull('ended_at')
                    ->orderBy('answered_at', 'asc')
                    ->get();

                $this->line("   • Call ID: {$call->id}, Extension: {$extension}, Stuck for: {$stuckDuration} min → KEEP: Newer call exists (Call ID: {$allActiveCallsOnExtension->last()->id})");
            }
        }

        if ($isDryRun) {
            $this->info("🔍 Dry run mode - no changes made. Use --dry-run=false to actually clean up.");
            return 0;
        }

        // Confirm cleanup
        if (!$this->confirm("Do you want to clean up these {$stuckCalls->count()} stuck calls?")) {
            $this->info("❌ Cleanup cancelled.");
            return 0;
        }

        $cleanedCount = 0;
        $errors = [];

        foreach ($stuckCalls as $call) {
            try {
                // Mark the call as ended
                $call->ended_at = now();
                $call->hangup_cause = 'timeout_cleanup';

                // Calculate talk duration if possible
                if ($call->answered_at && empty($call->talk_seconds)) {
                    $call->talk_seconds = max(0, $call->answered_at->diffInSeconds($call->ended_at, true));
                }

                $call->save();

                // Broadcast the update to frontend
                broadcast(new \App\Events\CallUpdated($call));

                $cleanedCount++;
                $this->line("   ✅ Cleaned up Call ID: {$call->id}");

                // Log the cleanup
                Log::info("Stuck call cleaned up", [
                    'call_id' => $call->id,
                    'linkedid' => $call->linkedid,
                    'extension' => $call->agent_exten,
                    'stuck_duration_minutes' => now()->diffInMinutes($call->answered_at),
                    'cleanup_time' => now(),
                ]);

            } catch (\Exception $e) {
                $errorMsg = "Failed to clean up Call ID: {$call->id} - {$e->getMessage()}";
                $this->error($errorMsg);
                $errors[] = $errorMsg;

                Log::error("Failed to clean up stuck call", [
                    'call_id' => $call->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        // Summary
        $this->newLine();
        if ($cleanedCount > 0) {
            $this->info("🎉 Successfully cleaned up {$cleanedCount} stuck call(s)!");
        }

        if (!empty($errors)) {
            $this->warn("⚠️  {$errors} error(s) occurred during cleanup.");
        }

        $this->info("📊 Cleanup completed at: " . now()->format('Y-m-d H:i:s'));

        return 0;
    }
}
