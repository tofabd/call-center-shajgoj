<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\ExtensionService;
use Illuminate\Support\Facades\Log;
use App\Models\Extension;

class SyncExtensions extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:sync-extensions';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Sync extension statuses: Get from DB, check with Asterisk, then update DB';

    /**
     * Execute the console command.
     */
    public function handle(ExtensionService $extensionService)
    {
        $startTime = microtime(true);
        $this->info('�� Starting extension sync: DB → Asterisk → DB Update...');

        // Log the start of sync process
        Log::info('Extension sync command started', [
            'command' => 'app:sync-extensions',
            'started_at' => now()->toISOString(),
            'user' => 'artisan_command'
        ]);

        try {
            // STEP 1: Get all extensions from database first
            $this->info('📊 Step 1: Getting extensions from database...');
            $dbExtensions = Extension::all();
            $extensionsBefore = $dbExtensions->count();
            $onlineBefore = $dbExtensions->where('status', 'online')->count();

            $this->line("�� Database state: {$extensionsBefore} total extensions, {$onlineBefore} online");

            if ($dbExtensions->count() === 0) {
                $this->warn("⚠️ No extensions found in database. Run initial sync first.");
                return 1;
            }

            // Show current database extensions
            $this->info('📋 Current Database Extensions:');
            $this->table(
                ['Extension', 'Agent Name', 'Status', 'Last Seen'],
                $dbExtensions->map(function ($ext) {
                    return [
                        $ext->extension,
                        $ext->agent_name ?? 'N/A',
                        $ext->status,
                        $ext->last_seen ? $ext->last_seen->format('Y-m-d H:i:s') : 'N/A'
                    ];
                })->toArray()
            );

            // STEP 2: Check status of each extension with Asterisk
            $this->info('🔌 Step 2: Checking extension statuses with Asterisk...');
            $statusUpdates = [];
            $errors = [];

            foreach ($dbExtensions as $dbExtension) {
                try {
                    $this->line("Checking extension {$dbExtension->extension}...");

                    // Check individual extension status with Asterisk
                    $asteriskStatus = $this->checkExtensionStatusWithAsterisk($dbExtension->extension);

                    if ($asteriskStatus !== null) {
                        $statusUpdates[] = [
                            'extension' => $dbExtension->extension,
                            'old_status' => $dbExtension->status,
                            'new_status' => $asteriskStatus,
                            'changed' => $dbExtension->status !== $asteriskStatus
                        ];

                        $this->line("  ✅ {$dbExtension->extension}: {$dbExtension->status} → {$asteriskStatus}");
                    } else {
                        $errors[] = "Could not get status for extension {$dbExtension->extension}";
                        $this->warn("  ⚠️ {$dbExtension->extension}: Status unknown");
                    }

                } catch (\Exception $e) {
                    $errors[] = "Error checking extension {$dbExtension->extension}: " . $e->getMessage();
                    $this->error("  ❌ {$dbExtension->extension}: " . $e->getMessage());
                }
            }

            // STEP 3: Update database with new statuses
            $this->info('🔄 Step 3: Updating database with new statuses...');
            $updatedCount = 0;
            $unchangedCount = 0;

            foreach ($statusUpdates as $update) {
                try {
                    $extension = Extension::where('extension', $update['extension'])->first();

                    if ($extension) {
                        $oldStatus = $extension->status;
                        $extension->status = $update['new_status'];
                        $extension->last_seen = now();
                        $extension->save();

                        if ($update['changed']) {
                            $updatedCount++;
                            $this->line("  ✅ Updated {$update['extension']}: {$oldStatus} → {$update['new_status']}");
                        } else {
                            $unchangedCount++;
                            $this->line("  ℹ️ No change for {$update['extension']}: {$update['new_status']}");
                        }
                    }
                } catch (\Exception $e) {
                    $this->error("  ❌ Failed to update {$update['extension']}: " . $e->getMessage());
                }
            }

            // STEP 4: Show results
            $this->info('📊 Step 4: Sync Results Summary');

            // Get post-sync counts
            $extensionsAfter = Extension::count();
            $onlineAfter = Extension::where('status', 'online')->count();

            $this->line("📊 Database state after sync:");
            $this->line("  Total extensions: {$extensionsBefore} → {$extensionsAfter}");
            $this->line("  Online extensions: {$onlineBefore} → {$onlineAfter}");
            $this->line("  Status updates: {$updatedCount}");
            $this->line("  Unchanged: {$unchangedCount}");
            $this->line("  Errors: " . count($errors));

            // Show detailed status changes
            if (count($statusUpdates) > 0) {
                $this->info('📋 Status Change Details:');
                $this->table(
                    ['Extension', 'Old Status', 'New Status', 'Changed'],
                    collect($statusUpdates)->map(function ($update) {
                        return [
                            $update['extension'],
                            $update['old_status'],
                            $update['new_status'],
                            $update['changed'] ? '✅ Yes' : 'ℹ️ No'
                        ];
                    })->toArray()
                );
            }

            // Show errors if any
            if (count($errors) > 0) {
                $this->warn('⚠️ Errors encountered:');
                foreach ($errors as $error) {
                    $this->line("  - {$error}");
                }
            }

            // Show final status summary
            $this->showStatusSummary();

            // Calculate and display processing time
            $processingTime = round((microtime(true) - $startTime) * 1000, 2);
            $this->info("⏱️ Sync completed in {$processingTime}ms");

            // Log successful completion
            Log::info('Extension sync completed successfully', [
                'command' => 'app:sync-extensions',
                'extensions_before' => $extensionsBefore,
                'extensions_after' => $extensionsAfter,
                'online_before' => $onlineBefore,
                'online_after' => $onlineAfter,
                'status_updates' => $updatedCount,
                'unchanged' => $unchangedCount,
                'errors' => count($errors),
                'processing_time_ms' => $processingTime,
                'completed_at' => now()->toISOString(),
                'user' => 'artisan_command'
            ]);

        } catch (\Exception $e) {
            $errorMessage = 'Failed to sync extensions: ' . $e->getMessage();
            $this->error("❌ {$errorMessage}");

            // Log the error
            Log::error('Extension sync failed', [
                'command' => 'app:sync-extensions',
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'failed_at' => now()->toISOString(),
                'user' => 'artisan_command'
            ]);

            return 1;
        }

        return 0;
    }

    /**
     * Check individual extension status with Asterisk
     */
    private function checkExtensionStatusWithAsterisk(string $extension): ?string
    {
        try {
            // Method 1: Try to get status via ExtensionService
            $extensionService = new ExtensionService();

            // Check if the extension is online by querying Asterisk
            $status = $extensionService->getExtensionStatus($extension);

            if ($status !== null) {
                return $status;
            }

            // Method 2: Try direct AMI query (if ExtensionService doesn't work)
            $status = $this->queryAsteriskDirectly($extension);

            return $status;

        } catch (\Exception $e) {
            Log::warning("Failed to check extension status via ExtensionService", [
                'extension' => $extension,
                'error' => $e->getMessage()
            ]);
            return null;
        }
    }

    /**
     * Direct AMI query as fallback method
     */
    private function queryAsteriskDirectly(string $extension): ?string
    {
        try {
            // This is a fallback method - you might need to implement this
            // based on your Asterisk AMI configuration

            // Example: Query SIP peer status
            // $command = "Action: SIPshowpeer\r\nPeer: {$extension}\r\n\r\n";

            // For now, return null to indicate we couldn't check
            return null;

        } catch (\Exception $e) {
            Log::warning("Direct AMI query failed", [
                'extension' => $extension,
                'error' => $e->getMessage()
            ]);
            return null;
        }
    }

    /**
     * Display a summary of extension statuses
     */
    private function showStatusSummary(): void
    {
        $this->info('📊 Extension Status Summary:');

        $statuses = Extension::selectRaw('status, COUNT(*) as count')
            ->groupBy('status')
            ->orderBy('count', 'desc')
            ->get();

        if ($statuses->count() > 0) {
            $this->table(
                ['Status', 'Count'],
                $statuses->map(function ($status) {
                    $icon = match($status->status) {
                        'online' => '🟢',
                        'offline' => '🔴',
                        'unknown' => '🟡',
                        default => '⚪'
                    };
                    return [
                        "{$icon} {$status->status}",
                        $status->count
                    ];
                })->toArray()
            );
        }

        // Show recent activity
        $recentExtensions = Extension::where('updated_at', '>=', now()->subMinutes(5))
            ->orderBy('updated_at', 'desc')
            ->limit(5)
            ->get();

        if ($recentExtensions->count() > 0) {
            $this->info('🕒 Recently Updated Extensions:');
            $this->table(
                ['Extension', 'Status', 'Last Updated'],
                $recentExtensions->map(function ($ext) {
                    return [
                        $ext->extension,
                        $ext->status,
                        $ext->updated_at->format('H:i:s')
                    ];
                })->toArray()
            );
        }
    }
}
