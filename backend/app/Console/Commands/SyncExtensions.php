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
    protected $signature = 'app:sync-extensions
                            {--manual : Enable manual status update mode}
                            {--extension= : Specific extension to update (manual mode only)}
                            {--status=online : Status to set (online|offline|unknown) (manual mode only)}
                            {--all-online : Set all extensions to online (manual mode only)}
                            {--all-offline : Set all extensions to offline (manual mode only)}
                            {--query : Query and display current extension statuses}
                            {--query-asterisk : Query extension status from Asterisk directly}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Sync extension statuses: Get from DB, check with Asterisk, then update DB. Use --manual for manual updates, --query to view status.';

    /**
     * Execute the console command.
     */
    public function handle(ExtensionService $extensionService)
    {
        $startTime = microtime(true);

        // Check for query modes first
        if ($this->option('query')) {
            return $this->handleQueryMode($extensionService, $startTime);
        }

        if ($this->option('query-asterisk')) {
            return $this->handleQueryAsteriskMode($extensionService, $startTime);
        }

        // Check if manual mode is enabled
        if ($this->option('manual')) {
            return $this->handleManualMode($extensionService, $startTime);
        }

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

    /**
     * Handle query mode - display current extension statuses
     */
    private function handleQueryMode(ExtensionService $extensionService, float $startTime): int
    {
        $this->info('🔍 Extension Status Query Mode');
        $this->line('===============================');

        try {
            // Get all extensions from database
            $extensions = Extension::orderBy('extension')->get();

            if ($extensions->count() === 0) {
                $this->warn('⚠️ No extensions found in database.');
                return 1;
            }

            $this->info("📋 Found {$extensions->count()} extensions in database:");
            $this->line('');

            // Show extensions in a formatted table
            $this->table(
                ['Extension', 'Agent Name', 'Status', 'Last Seen', 'Updated'],
                $extensions->map(function ($ext) {
                    $statusIcon = match($ext->status) {
                        'online' => '🟢',
                        'offline' => '🔴',
                        'unknown' => '🟡',
                        default => '⚪'
                    };

                    $lastSeen = $ext->last_seen ? $ext->last_seen->format('M d H:i') : 'Never';
                    $updated = $ext->updated_at ? $ext->updated_at->diffForHumans() : 'Never';

                    return [
                        $ext->extension,
                        $ext->agent_name ?? 'N/A',
                        "{$statusIcon} {$ext->status}",
                        $lastSeen,
                        $updated
                    ];
                })->toArray()
            );

            // Show status summary
            $this->line('');
            $this->info('📊 Status Summary:');
            $this->showStatusSummary();

            // Show recent activity
            $recentExtensions = Extension::where('updated_at', '>=', now()->subHours(24))
                ->orderBy('updated_at', 'desc')
                ->limit(5)
                ->get();

            if ($recentExtensions->count() > 0) {
                $this->line('');
                $this->info('🕒 Recent Activity (Last 24 hours):');
                $this->table(
                    ['Extension', 'Status', 'Updated'],
                    $recentExtensions->map(function ($ext) {
                        $statusIcon = match($ext->status) {
                            'online' => '🟢',
                            'offline' => '🔴',
                            'unknown' => '🟡',
                            default => '⚪'
                        };
                        return [
                            $ext->extension,
                            "{$statusIcon} {$ext->status}",
                            $ext->updated_at->format('M d H:i:s')
                        ];
                    })->toArray()
                );
            }

            $processingTime = round((microtime(true) - $startTime) * 1000, 2);
            $this->line('');
            $this->info("⏱️ Query completed in {$processingTime}ms");

            return 0;

        } catch (\Exception $e) {
            $this->error('❌ Query failed: ' . $e->getMessage());
            return 1;
        }
    }

    /**
     * Handle query Asterisk mode - check status directly from Asterisk
     */
    private function handleQueryAsteriskMode(ExtensionService $extensionService, float $startTime): int
    {
        $this->info('🌐 Query Extension Status from Asterisk (18.9.0)');
        $this->line('================================================');
        $this->line('This will query extension statuses directly from Asterisk AMI');
        $this->line('');

        try {
            // Get all extensions from database
            $extensions = Extension::orderBy('extension')->get();

            if ($extensions->count() === 0) {
                $this->warn('⚠️ No extensions found in database.');
                return 1;
            }

            $this->info("🔍 Querying {$extensions->count()} extensions from Asterisk...");
            $this->line('');

            $results = [];
            $successful = 0;
            $failed = 0;

            foreach ($extensions as $extension) {
                $this->line("Checking {$extension->extension}...");

                try {
                    // Query Asterisk directly using the existing extension status method
                    $asteriskStatus = $extensionService->getExtensionStatus($extension->extension);

                    if ($asteriskStatus !== null) {
                        $successful++;
                        $match = $asteriskStatus === $extension->status ? '✅' : '❌';
                        $results[] = [
                            'extension' => $extension->extension,
                            'db_status' => $extension->status,
                            'asterisk_status' => $asteriskStatus,
                            'match' => $match,
                            'agent' => $extension->agent_name ?? 'N/A'
                        ];
                        $this->line("  ✅ {$extension->extension}: DB={$extension->status}, Asterisk={$asteriskStatus}");
                    } else {
                        $failed++;
                        $results[] = [
                            'extension' => $extension->extension,
                            'db_status' => $extension->status,
                            'asterisk_status' => 'FAILED',
                            'match' => '❌',
                            'agent' => $extension->agent_name ?? 'N/A'
                        ];
                        $this->warn("  ⚠️ {$extension->extension}: Query failed");
                    }

                } catch (\Exception $e) {
                    $failed++;
                    $results[] = [
                        'extension' => $extension->extension,
                        'db_status' => $extension->status,
                        'asterisk_status' => 'ERROR',
                        'match' => '❌',
                        'agent' => $extension->agent_name ?? 'N/A'
                    ];
                    $this->error("  ❌ {$extension->extension}: {$e->getMessage()}");
                }
            }

            $this->line('');
            $this->info('📊 Asterisk Query Results:');
            $this->table(
                ['Extension', 'Agent', 'DB Status', 'Asterisk Status', 'Match'],
                collect($results)->map(function ($result) {
                    return [
                        $result['extension'],
                        $result['agent'],
                        $result['db_status'],
                        $result['asterisk_status'],
                        $result['match']
                    ];
                })->toArray()
            );

            $this->line('');
            $this->info('📊 Summary:');
            $this->line("  ✅ Successful queries: {$successful}");
            $this->line("  ❌ Failed queries: {$failed}");
            $this->line("  📊 Total extensions: {$extensions->count()}");

            $processingTime = round((microtime(true) - $startTime) * 1000, 2);
            $this->line('');
            $this->info("⏱️ Query completed in {$processingTime}ms");

            // Show troubleshooting tips if there were failures
            if ($failed > 0) {
                $this->line('');
                $this->warn('💡 Troubleshooting Tips:');
                $this->line('  - Check if extensions are registered with Asterisk');
                $this->line('  - Verify AMI connection settings');
                $this->line('  - Check if SIP peers exist in Asterisk');
                $this->line('  - Run: asterisk -rx "sip show peers" to verify');
            }

            return $failed > 0 ? 1 : 0;

        } catch (\Exception $e) {
            $this->error('❌ Asterisk query failed: ' . $e->getMessage());
            return 1;
        }
    }

    /**
     * Handle manual status update mode
     */
    private function handleManualMode(ExtensionService $extensionService, float $startTime): int
    {
        $this->info('🔧 Manual Extension Status Update Mode');
        $this->line('=====================================');

        // Log manual mode start
        Log::info('Extension sync started in manual mode', [
            'command' => 'app:sync-extensions --manual',
            'started_at' => now()->toISOString(),
            'user' => 'artisan_command'
        ]);

        try {
            // Handle bulk operations first
            if ($this->option('all-online')) {
                return $this->setAllExtensionsStatus('online', $extensionService, $startTime);
            }

            if ($this->option('all-offline')) {
                return $this->setAllExtensionsStatus('offline', $extensionService, $startTime);
            }

            // Handle specific extension update
            $extension = $this->option('extension');
            $status = $this->option('status');

            if ($extension) {
                return $this->updateSpecificExtension($extension, $status, $extensionService, $startTime);
            }

            // Interactive mode - show current status and allow updates
            return $this->interactiveMode($extensionService, $startTime);

        } catch (\Exception $e) {
            $this->error('❌ Manual update failed: ' . $e->getMessage());
            Log::error('Manual extension update failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return 1;
        }
    }

    /**
     * Set all extensions to a specific status
     */
    private function setAllExtensionsStatus(string $status, ExtensionService $extensionService, float $startTime): int
    {
        $this->info("📡 Setting ALL extensions to: {$status}");

        $extensions = Extension::all();
        $updatedCount = 0;
        $errors = [];

        if ($extensions->count() === 0) {
            $this->warn('⚠️ No extensions found in database.');
            return 1;
        }

        $this->line("Found {$extensions->count()} extensions to update...");

        foreach ($extensions as $extension) {
            try {
                $oldStatus = $extension->status;
                $success = $extensionService->updateExtensionStatus($extension->extension, $status);

                if ($success) {
                    $updatedCount++;
                    $this->line("  ✅ {$extension->extension}: {$oldStatus} → {$status}");
                } else {
                    $errors[] = "Failed to update {$extension->extension}";
                    $this->error("  ❌ Failed to update {$extension->extension}");
                }
            } catch (\Exception $e) {
                $errors[] = "Error updating {$extension->extension}: " . $e->getMessage();
                $this->error("  ❌ Error updating {$extension->extension}: " . $e->getMessage());
            }
        }

        // Show summary
        $processingTime = round((microtime(true) - $startTime) * 1000, 2);
        $this->info("\n📊 Bulk Update Summary:");
        $this->line("  ✅ Successfully updated: {$updatedCount}");
        $this->line("  ❌ Errors: " . count($errors));
        $this->line("  ⏱️ Processing time: {$processingTime}ms");

        if (count($errors) > 0) {
            $this->warn("\n⚠️ Errors encountered:");
            foreach ($errors as $error) {
                $this->line("  - {$error}");
            }
        }

        $this->showStatusSummary();

        Log::info('Bulk extension status update completed', [
            'status' => $status,
            'total_extensions' => $extensions->count(),
            'updated_count' => $updatedCount,
            'errors' => count($errors),
            'processing_time_ms' => $processingTime
        ]);

        return count($errors) > 0 ? 1 : 0;
    }

    /**
     * Update a specific extension
     */
    private function updateSpecificExtension(string $extensionNumber, string $status, ExtensionService $extensionService, float $startTime): int
    {
        $this->info("🎯 Updating specific extension: {$extensionNumber} → {$status}");

        // Validate status
        $validStatuses = ['online', 'offline', 'unknown'];
        if (!in_array($status, $validStatuses)) {
            $this->error("❌ Invalid status '{$status}'. Valid options: " . implode(', ', $validStatuses));
            return 1;
        }

        try {
            $extension = Extension::where('extension', $extensionNumber)->first();

            if (!$extension) {
                $this->error("❌ Extension '{$extensionNumber}' not found in database.");
                $this->line("\n💡 Available extensions:");
                $availableExtensions = Extension::pluck('extension')->toArray();
                $this->line('  ' . implode(', ', $availableExtensions));
                return 1;
            }

            $oldStatus = $extension->status;
            $success = $extensionService->updateExtensionStatus($extensionNumber, $status);

            if ($success) {
                $processingTime = round((microtime(true) - $startTime) * 1000, 2);
                $this->info("✅ Successfully updated {$extensionNumber}: {$oldStatus} → {$status}");
                $this->line("⏱️ Processing time: {$processingTime}ms");

                Log::info('Specific extension status updated', [
                    'extension' => $extensionNumber,
                    'old_status' => $oldStatus,
                    'new_status' => $status,
                    'processing_time_ms' => $processingTime
                ]);

                $this->showStatusSummary();
                return 0;
            } else {
                $this->error("❌ Failed to update extension {$extensionNumber}");
                return 1;
            }

        } catch (\Exception $e) {
            $this->error("❌ Error updating extension: " . $e->getMessage());
            return 1;
        }
    }

    /**
     * Interactive mode for manual updates
     */
    private function interactiveMode(ExtensionService $extensionService, float $startTime): int
    {
        $this->info('🎮 Interactive Extension Status Update Mode');
        $this->line('==========================================');

        // Show current extensions
        $extensions = Extension::orderBy('extension')->get();

        if ($extensions->count() === 0) {
            $this->warn('⚠️ No extensions found in database.');
            return 1;
        }

        $this->info('📋 Current Extension Status:');
        $this->table(
            ['Extension', 'Agent Name', 'Status', 'Last Seen'],
            $extensions->map(function ($ext) {
                $statusIcon = match($ext->status) {
                    'online' => '🟢',
                    'offline' => '🔴',
                    'unknown' => '🟡',
                    default => '⚪'
                };
                return [
                    $ext->extension,
                    $ext->agent_name ?? 'N/A',
                    "{$statusIcon} {$ext->status}",
                    $ext->last_seen ? $ext->last_seen->format('Y-m-d H:i:s') : 'N/A'
                ];
            })->toArray()
        );

        $this->line('');
        $this->info('💡 Manual Update Options:');
        $this->line('  --extension=1001 --status=online    Update specific extension');
        $this->line('  --all-online                       Set all extensions online');
        $this->line('  --all-offline                      Set all extensions offline');

        $this->line('');
        $this->info('📊 Current Status Summary:');
        $this->showStatusSummary();

        $processingTime = round((microtime(true) - $startTime) * 1000, 2);
        $this->line("⏱️ Display time: {$processingTime}ms");

        return 0;
    }
}
