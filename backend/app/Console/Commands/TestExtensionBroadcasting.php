<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Extension;
use App\Events\ExtensionStatusUpdated;

class TestExtensionBroadcasting extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:test-extension-broadcasting {extension?} {status?}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Test extension status broadcasting functionality';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $extensionNumber = $this->argument('extension') ?? '1001';
        $status = $this->argument('status') ?? 'online';

        $this->info("🧪 Testing Extension Broadcasting System");
        $this->line("Extension: {$extensionNumber}");
        $this->line("Status: {$status}");
        $this->line("");

        try {
            // Check if extension exists
            $extension = Extension::where('extension', $extensionNumber)->first();

            if (!$extension) {
                $this->error("❌ Extension {$extensionNumber} not found in database");
                $this->line("Creating test extension...");

                $extension = Extension::create([
                    'extension' => $extensionNumber,
                    'agent_name' => 'Test Agent',
                    'status' => 'unknown',
                    'last_seen' => now(),
                ]);

                $this->info("✅ Created test extension {$extensionNumber}");
            }

            $this->info("📱 Current extension status: {$extension->status}");
            $this->line("");

            // Test broadcasting
            $this->info("📡 Testing broadcast...");

            try {
                broadcast(new ExtensionStatusUpdated($extension));
                $this->info("✅ Broadcast sent successfully!");
                $this->line("Check your frontend console for real-time updates");
            } catch (\Exception $e) {
                $this->error("❌ Broadcast failed: " . $e->getMessage());
                $this->line("This usually means broadcasting is not configured properly");
                $this->line("");
                $this->line("Common issues:");
                $this->line("1. Broadcasting not enabled in .env");
                $this->line("2. Queue worker not running");
                $this->line("3. Missing broadcast configuration");
            }

            // Test status update
            $this->line("");
            $this->info("🔄 Testing status update...");

            $oldStatus = $extension->status;
            $result = $extension->updateStatus($status);

            if ($result) {
                $this->info("✅ Status updated from '{$oldStatus}' to '{$status}'");

                // Try broadcasting again with new status
                try {
                    $extension->refresh();
                    broadcast(new ExtensionStatusUpdated($extension));
                    $this->info("✅ Status change broadcasted successfully!");
                } catch (\Exception $e) {
                    $this->error("❌ Status change broadcast failed: " . $e->getMessage());
                }
            } else {
                $this->error("❌ Failed to update extension status");
            }

        } catch (\Exception $e) {
            $this->error("❌ Test failed: " . $e->getMessage());
            $this->line("Stack trace: " . $e->getTraceAsString());
        }

        $this->line("");
        $this->info("🔍 Troubleshooting Tips:");
        $this->line("1. Check Laravel logs: tail -f storage/logs/laravel.log");
        $this->line("2. Verify broadcasting config in .env");
        $this->line("3. Ensure queue worker is running: php artisan queue:work");
        $this->line("4. Check frontend console for WebSocket errors");
        $this->line("5. Verify Echo.js is properly configured");
    }
}
