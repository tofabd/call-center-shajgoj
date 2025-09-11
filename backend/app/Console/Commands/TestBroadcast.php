<?php

namespace App\Console\Commands;

use App\Events\CallUpdated;
use App\Events\ExtensionStatusUpdated;
use Illuminate\Console\Command;

class TestBroadcast extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:test-broadcast {--type= : Type of broadcast to test (call|extension|all)}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Test broadcasting functionality by firing CallUpdated and ExtensionStatusUpdated events';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $type = $this->option('type') ?: 'all';

        $this->info("Testing broadcasting functionality...");

        if ($type === 'call' || $type === 'all') {
            $this->testCallBroadcast();
        }

        if ($type === 'extension' || $type === 'all') {
            $this->testExtensionBroadcast();
        }

        $this->info("Broadcast test completed. Check frontend console for received events.");
    }

    private function testCallBroadcast()
    {
        $this->info("Broadcasting CallUpdated event...");

        // Create a sample call model instance
        $call = new \App\Models\Call([
            'linkedid' => 'test-call-123',
            'direction' => 'inbound',
            'other_party' => '1234567890',
            'agent_exten' => '1001',
            'started_at' => now(),
            'disposition' => 'ringing',
        ]);

        broadcast(new CallUpdated($call))->toOthers();

        $this->info("CallUpdated event broadcasted with call ID: " . $call->linkedid);
    }

    private function testExtensionBroadcast()
    {
        $this->info("Broadcasting ExtensionStatusUpdated event...");

        // Create a sample extension model instance
        $extension = new \App\Models\Extension([
            'extension' => '1001',
            'agent_name' => 'Test Agent',
            'availability_status' => 'busy',
            'status_code' => 2,
            'status_text' => 'In Call',
            'status_changed_at' => now(),
            'is_active' => true,
        ]);

        broadcast(new ExtensionStatusUpdated($extension))->toOthers();

        $this->info("ExtensionStatusUpdated event broadcasted for extension: " . $extension->extension);
    }
}
