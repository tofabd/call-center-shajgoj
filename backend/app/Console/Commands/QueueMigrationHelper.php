<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\DB;

/**
 * Migration Helper Command
 * 
 * Helps with queue migration tasks
 * Usage: php artisan queue:migrate-helper
 */
class QueueMigrationHelper extends Command
{
    protected $signature = 'queue:migrate-helper 
                            {action : Action to perform (status|switch|rollback|drain)}
                            {--to=redis : Switch to connection (redis|database)}';

    protected $description = 'Helper for queue migration between database and Redis';

    public function handle()
    {
        $action = $this->argument('action');

        switch ($action) {
            case 'status':
                $this->showMigrationStatus();
                break;
            case 'switch':
                $this->switchQueue();
                break;
            case 'rollback':
                $this->rollbackQueue();
                break;
            case 'drain':
                $this->drainQueues();
                break;
            default:
                $this->error("Unknown action: {$action}");
                $this->line("Available actions: status, switch, rollback, drain");
        }
    }

    private function showMigrationStatus()
    {
        $this->info('📊 Queue Migration Status');
        $this->line(str_repeat('=', 40));

        // Current configuration
        $currentQueue = config('queue.default');
        $this->line("Current Queue Driver: {$currentQueue}");

        // Database queue status
        try {
            $dbPending = DB::table('jobs')->count();
            $dbFailed = DB::table('failed_jobs')->count();
            $this->line("Database Queue - Pending: {$dbPending}, Failed: {$dbFailed}");
        } catch (\Exception $e) {
            $this->warn("Database queue status unavailable: " . $e->getMessage());
        }

        // Redis queue status
        try {
            $redis = Redis::connection('queue');
            $redisQueues = ['call_center_queue', 'priority', 'background'];
            $redisPending = 0;
            
            foreach ($redisQueues as $queue) {
                $count = $redis->llen($queue);
                $redisPending += $count;
                $this->line("Redis Queue '{$queue}': {$count} jobs");
            }
            
            $this->line("Redis Total Pending: {$redisPending}");
            
        } catch (\Exception $e) {
            $this->warn("Redis queue status unavailable: " . $e->getMessage());
        }
    }

    private function switchQueue()
    {
        $to = $this->option('to');
        
        if (!$this->confirm("Switch queue driver to {$to}?", false)) {
            $this->info('Migration cancelled.');
            return;
        }

        // Update environment file
        $envPath = base_path('.env');
        $envContent = file_get_contents($envPath);
        
        if ($to === 'redis') {
            $envContent = preg_replace('/QUEUE_CONNECTION=database/', 'QUEUE_CONNECTION=redis', $envContent);
        } else {
            $envContent = preg_replace('/QUEUE_CONNECTION=redis/', 'QUEUE_CONNECTION=database', $envContent);
        }
        
        file_put_contents($envPath, $envContent);
        
        $this->info("✅ Queue connection switched to {$to}");
        $this->warn("⚠️ You need to restart queue workers!");
        $this->line("Run: php artisan config:cache");
        $this->line("Then restart: php artisan queue:work {$to}");
    }

    private function rollbackQueue()
    {
        $this->warn('🔄 Rolling back to database queue...');
        
        if (!$this->confirm('This will switch back to database queue. Continue?', false)) {
            return;
        }

        // Switch back to database
        $envPath = base_path('.env');
        $envContent = file_get_contents($envPath);
        $envContent = preg_replace('/QUEUE_CONNECTION=redis/', 'QUEUE_CONNECTION=database', $envContent);
        file_put_contents($envPath, $envContent);
        
        $this->info('✅ Rolled back to database queue');
        $this->warn('⚠️ Restart queue workers with: php artisan queue:work database');
    }

    private function drainQueues()
    {
        $this->info('🔄 Draining all queues...');
        
        // Drain database queue
        $dbPending = DB::table('jobs')->count();
        if ($dbPending > 0) {
            $this->warn("Database queue has {$dbPending} pending jobs");
            if ($this->confirm('Process all database queue jobs?', true)) {
                $this->info('Start a queue worker to process: php artisan queue:work database --stop-when-empty');
            }
        } else {
            $this->info('✅ Database queue is empty');
        }

        // Check Redis queue
        try {
            $redis = Redis::connection('queue');
            $redisQueues = ['call_center_queue', 'priority', 'background'];
            
            foreach ($redisQueues as $queue) {
                $count = $redis->llen($queue);
                if ($count > 0) {
                    $this->warn("Redis queue '{$queue}' has {$count} pending jobs");
                    if ($this->confirm("Clear Redis queue '{$queue}'?", false)) {
                        $redis->del($queue);
                        $this->info("✅ Cleared Redis queue '{$queue}'");
                    }
                } else {
                    $this->info("✅ Redis queue '{$queue}' is empty");
                }
            }
            
        } catch (\Exception $e) {
            $this->warn("Could not check Redis queues: " . $e->getMessage());
        }
    }
}