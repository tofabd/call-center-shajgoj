<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\CallLog;
use App\Events\CallStatusUpdated;

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
        // Create a test call log or use an existing one
        $callLog = CallLog::firstOrCreate(
            ['uniqueid' => 'test-call-' . time()],
            [
                'callerid_num' => '+1234567890',
                'callerid_name' => 'Test Caller',
                'start_time' => now(),
                'status' => 'ringing',
                'exten' => '1001',
                'context' => 'from-internal',
                'channel' => 'SIP/test-channel'
            ]
        );

        $this->info("Created/found test call with ID: {$callLog->id}");

        // Broadcast the call status update
        broadcast(new CallStatusUpdated($callLog));

        $this->info("📡 CallStatusUpdated event broadcasted to 'call-console' channel");
        $this->info("Check your frontend console for the real-time update!");

        return Command::SUCCESS;
    }
}
