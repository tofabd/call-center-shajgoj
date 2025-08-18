<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Call;
use App\Events\CallUpdated;

class TestCallBroadcast extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:test-call-broadcast';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Test call status broadcast functionality';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        // Create a test call or use an existing one
        $call = Call::firstOrCreate(
            ['linkedid' => 'test-call-' . time()],
            [
                'other_party' => '+1234567890',
                'direction' => 'incoming',
                'started_at' => now(),
                'agent_exten' => '1001'
            ]
        );

        $this->info("Created/found test call with ID: {$call->id}");

        // Broadcast the call update
        broadcast(new CallUpdated($call));

        $this->info("📡 CallUpdated event broadcasted to 'call-console' channel");
        $this->info("Check your frontend console for the real-time update!");

        return Command::SUCCESS;
    }
}
