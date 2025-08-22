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
    protected $description = 'Sync ALL extensions from Asterisk AMI (including offline, unreachable, etc.)';

    /**
     * Execute the console command.
     */
    public function handle(ExtensionService $extensionService)
    {
        $startTime = microtime(true);
        $this->info('🔄 Starting extension sync from Asterisk AMI...');

        // Log the start of sync process
        Log::info('Extension sync command started', [
            'command' => 'app:sync-extensions',
            'started_at' => now()->toISOString(),
            'user' => 'artisan_command'
        ]);

        try {
            // Get current extensions count before sync
            $extensionsBefore = Extension::count();
            $onlineBefore = Extension::where('status', 'online')->count();

            $this->line("📊 Current state: {$extensionsBefore} total extensions, {$onlineBefore} online");

            // Attempt to get ALL extensions from AMI (including offline, unreachable, etc.)
            $this->info('🔌 Connecting to Asterisk AMI...');
            $amiExtensions = $extensionService->getAllSipExtensions();

            $this->info("📡 Found " . count($amiExtensions) . " extensions in Asterisk AMI");

            // Log AMI response details
            Log::info('AMI extensions response received', [
                'ami_extensions_count' => count($amiExtensions),
                'ami_extensions' => $amiExtensions,
                'response_time' => now()->toISOString()
            ]);

            if (count($amiExtensions) > 0) {
                $this->table(
                    ['Extension', 'Status'],
                    collect($amiExtensions)->map(function ($ext) {
                        return [
                            $ext['extension'] ?? 'N/A',
                            $ext['status'] ?? 'unknown'
                        ];
                    })->toArray()
                );
            }

            // Perform the sync
            $this->info('🔄 Syncing extensions with database...');
            $synced = $extensionService->syncExtensions();

            // Get post-sync counts
            $extensionsAfter = Extension::count();
            $onlineAfter = Extension::where('status', 'online')->count();

            $this->info("✅ Successfully synced " . count($synced) . " extensions");
            $this->line("📊 Post-sync state: {$extensionsAfter} total extensions, {$onlineAfter} online");

            // Show detailed sync results
            if (count($synced) > 0) {
                $this->info('📋 Synced Extensions Details:');
                $this->table(
                    ['Extension', 'Agent Name', 'Status', 'Last Seen', 'Sync Type'],
                    collect($synced)->map(function ($ext) {
                        return [
                            $ext->extension,
                            $ext->agent_name ?? 'N/A',
                            $ext->status,
                            $ext->last_seen ? $ext->last_seen->format('Y-m-d H:i:s') : 'N/A',
                            $ext->wasRecentlyCreated ? 'New' : 'Updated'
                        ];
                    })->toArray()
                );
            }

            // Show status summary
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
                'ami_extensions_count' => count($amiExtensions),
                'synced_count' => count($synced),
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
