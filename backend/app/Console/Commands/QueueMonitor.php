<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\DB;

/**
 * Queue Monitoring Command
 * 
 * Monitors both database and Redis queue performance
 * Usage: php artisan queue:monitor
 */
class QueueMonitor extends Command
{
    protected $signature = 'queue:monitor 
                            {--interval=5 : Monitoring interval in seconds}
                            {--redis : Monitor Redis queue}
                            {--database : Monitor Database queue}
                            {--all : Monitor all queues}';

    protected $description = 'Monitor queue performance and statistics';

    public function handle()
    {
        $interval = $this->option('interval');
        $monitorRedis = $this->option('redis') || $this->option('all');
        $monitorDatabase = $this->option('database') || $this->option('all');
        
        if (!$monitorRedis && !$monitorDatabase) {
            $monitorRedis = $monitorDatabase = true;
        }

        $this->info('🔍 Starting Queue Monitor...');
        $this->info("📊 Monitoring interval: {$interval} seconds");
        
        if ($monitorRedis) $this->line('✅ Redis monitoring: ON');
        if ($monitorDatabase) $this->line('✅ Database monitoring: ON');
        
        $this->newLine();

        while (true) {
            $this->displayHeader();
            
            if ($monitorDatabase) {
                $this->monitorDatabaseQueue();
            }
            
            if ($monitorRedis) {
                $this->monitorRedisQueue();
            }
            
            sleep($interval);
        }
    }

    private function displayHeader()
    {
        $timestamp = now()->format('Y-m-d H:i:s');
        $this->info("📈 Queue Status Report - {$timestamp}");
        $this->line(str_repeat('=', 60));
    }

    private function monitorDatabaseQueue()
    {
        try {
            $stats = [
                'pending' => DB::table('jobs')->count(),
                'failed' => DB::table('failed_jobs')->count(),
                'batches' => DB::table('job_batches')->count(),
            ];
            
            $this->line("📊 DATABASE QUEUE:");
            $this->line("   Pending Jobs: {$stats['pending']}");
            $this->line("   Failed Jobs:  {$stats['failed']}");
            $this->line("   Job Batches:  {$stats['batches']}");
            
            if ($stats['pending'] > 100) {
                $this->warn("   ⚠️ High pending job count!");
            }
            
        } catch (\Exception $e) {
            $this->error("❌ Database monitoring failed: " . $e->getMessage());
        }
    }

    private function monitorRedisQueue()
    {
        try {
            $redis = Redis::connection('queue');
            
            $queues = ['call_center_queue', 'priority', 'background', 'default'];
            $totalJobs = 0;
            
            $this->line("📊 REDIS QUEUE:");
            
            foreach ($queues as $queue) {
                $length = $redis->llen($queue);
                $totalJobs += $length;
                
                $status = $length > 0 ? "📦" : "✅";
                $this->line("   {$status} {$queue}: {$length} jobs");
                
                if ($length > 1000) {
                    $this->warn("     ⚠️ Queue backlog detected!");
                }
            }
            
            // Redis memory info
            $info = $redis->info('memory');
            $memory = isset($info['used_memory_human']) ? $info['used_memory_human'] : 'N/A';
            $this->line("   💾 Memory Usage: {$memory}");
            
            // Connection info
            $clients = $redis->info('clients')['connected_clients'] ?? 'N/A';
            $this->line("   🔗 Connected Clients: {$clients}");
            
        } catch (\Exception $e) {
            $this->error("❌ Redis monitoring failed: " . $e->getMessage());
            $this->line("   Ensure Redis server is running and configured");
        }
        
        $this->newLine();
    }
}