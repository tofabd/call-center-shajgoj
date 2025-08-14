<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class CheckBroadcastConfig extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:check-broadcast-config';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Check current broadcast configuration';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('🔍 Current Broadcast Configuration:');
        $this->line('');

        // Check broadcast connection
        $broadcastConnection = config('broadcasting.default');
        $this->line("Default Broadcast Connection: <fg=yellow>{$broadcastConnection}</>");

        if ($broadcastConnection === 'null') {
            $this->error('❌ Broadcasting is DISABLED (set to null)');
            $this->line('');
            $this->warn('To enable real-time features, add this to your .env file:');
            $this->line('BROADCAST_CONNECTION=reverb');
        } else {
            $this->info("✅ Broadcasting is enabled with: {$broadcastConnection}");
        }

        $this->line('');
        $this->info('🔧 Required Reverb Environment Variables:');

        $reverbVars = [
            'REVERB_APP_ID' => env('REVERB_APP_ID'),
            'REVERB_APP_KEY' => env('REVERB_APP_KEY'),
            'REVERB_APP_SECRET' => env('REVERB_APP_SECRET'),
            'REVERB_HOST' => env('REVERB_HOST'),
            'REVERB_PORT' => env('REVERB_PORT', '8080'),
            'REVERB_SCHEME' => env('REVERB_SCHEME', 'http'),
        ];

        foreach ($reverbVars as $var => $value) {
            if ($value) {
                $this->line("<fg=green>✅ {$var}:</> {$value}");
            } else {
                $this->line("<fg=red>❌ {$var}:</> Not set");
            }
        }

        $this->line('');

        if ($broadcastConnection === 'null') {
            $this->warn('📝 Add these lines to your .env file to enable real-time features:');
            $this->line('');
            $this->line('BROADCAST_CONNECTION=reverb');
            $this->line('REVERB_APP_ID=app-id');
            $this->line('REVERB_APP_KEY=app-key');
            $this->line('REVERB_APP_SECRET=app-secret');
            $this->line('REVERB_HOST=127.0.0.1');
            $this->line('REVERB_PORT=8080');
            $this->line('REVERB_SCHEME=http');
            $this->line('');
            $this->warn('After updating .env, restart your servers!');
        }

        return Command::SUCCESS;
    }
}
