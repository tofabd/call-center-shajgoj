<?php

namespace App\Console\Commands;

use App\Events\CallUpdated;
use App\Events\ExtensionStatusUpdated;
use App\Models\Call;
use App\Models\Extension;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Queue;

/**
 * Queue Performance Tester
 * 
 * Tests queue performance with realistic call center workloads
 * Usage: php artisan queue:test-performance
 */
class QueuePerformanceTest extends Command
{
    protected $signature = 'queue:test-performance
                            {--connection=database : Queue connection to test (database|redis)}
                            {--jobs=100 : Number of test jobs to dispatch}
                            {--concurrent=10 : Number of concurrent broadcasts}
                            {--type=mixed : Test type (calls|extensions|mixed)}';

    protected $description = 'Test queue performance with realistic call center workloads';

    public function handle()
    {
        $connection = $this->option('connection');
        $jobCount = (int) $this->option('jobs');
        $concurrent = (int) $this->option('concurrent');
        $testType = $this->option('type');

        $this->info("🚀 Starting Queue Performance Test");
        $this->line("Connection: {$connection}");
        $this->line("Jobs: {$jobCount}");
        $this->line("Concurrent: {$concurrent}");
        $this->line("Type: {$testType}");
        $this->newLine();

        $startTime = microtime(true);

        switch ($testType) {
            case 'calls':
                $this->testCallUpdates($connection, $jobCount, $concurrent);
                break;
            case 'extensions':
                $this->testExtensionUpdates($connection, $jobCount, $concurrent);
                break;
            case 'mixed':
                $this->testMixedWorkload($connection, $jobCount, $concurrent);
                break;
        }

        $endTime = microtime(true);
        $duration = round(($endTime - $startTime) * 1000, 2);
        $jobsPerSecond = round($jobCount / (($endTime - $startTime)), 2);

        $this->newLine();
        $this->info("✅ Performance Test Completed");
        $this->line("Total time: {$duration}ms");
        $this->line("Jobs per second: {$jobsPerSecond}");
        $this->line("Average job time: " . round($duration / $jobCount, 2) . "ms");
    }

    private function testCallUpdates(string $connection, int $jobCount, int $concurrent)
    {
        $this->info("📞 Testing CallUpdated broadcasts...");

        // Create test call data
        $testCalls = $this->createTestCalls($jobCount);

        $progressBar = $this->output->createProgressBar($jobCount);
        $progressBar->start();

        foreach (array_chunk($testCalls, $concurrent) as $chunk) {
            foreach ($chunk as $call) {
                Queue::connection($connection)->push(function() use ($call) {
                    broadcast(new CallUpdated($call));
                });
                $progressBar->advance();
            }
        }

        $progressBar->finish();
        $this->newLine();
    }

    private function testExtensionUpdates(string $connection, int $jobCount, int $concurrent)
    {
        $this->info("📱 Testing ExtensionStatusUpdated broadcasts...");

        // Create test extension data
        $testExtensions = $this->createTestExtensions($jobCount);

        $progressBar = $this->output->createProgressBar($jobCount);
        $progressBar->start();

        foreach (array_chunk($testExtensions, $concurrent) as $chunk) {
            foreach ($chunk as $extension) {
                Queue::connection($connection)->push(function() use ($extension) {
                    broadcast(new ExtensionStatusUpdated($extension));
                });
                $progressBar->advance();
            }
        }

        $progressBar->finish();
        $this->newLine();
    }

    private function testMixedWorkload(string $connection, int $jobCount, int $concurrent)
    {
        $this->info("🔄 Testing mixed workload (70% calls, 30% extensions)...");

        $callJobs = (int) ($jobCount * 0.7);
        $extensionJobs = $jobCount - $callJobs;

        $testCalls = $this->createTestCalls($callJobs);
        $testExtensions = $this->createTestExtensions($extensionJobs);

        $progressBar = $this->output->createProgressBar($jobCount);
        $progressBar->start();

        // Interleave call and extension updates
        $allJobs = array_merge(
            array_map(fn($call) => ['type' => 'call', 'data' => $call], $testCalls),
            array_map(fn($ext) => ['type' => 'extension', 'data' => $ext], $testExtensions)
        );

        shuffle($allJobs);

        foreach (array_chunk($allJobs, $concurrent) as $chunk) {
            foreach ($chunk as $job) {
                if ($job['type'] === 'call') {
                    Queue::connection($connection)->push(function() use ($job) {
                        broadcast(new CallUpdated($job['data']));
                    });
                } else {
                    Queue::connection($connection)->push(function() use ($job) {
                        broadcast(new ExtensionStatusUpdated($job['data']));
                    });
                }
                $progressBar->advance();
            }
        }

        $progressBar->finish();
        $this->newLine();
    }

    private function createTestCalls(int $count): array
    {
        $calls = [];
        for ($i = 0; $i < $count; $i++) {
            $calls[] = (object) [
                'id' => $i + 1000,
                'linkedid' => 'test-call-' . $i . '-' . time(),
                'agent_exten' => '100' . ($i % 50),
                'other_party' => '+88017' . str_pad($i % 10000000, 8, '0', STR_PAD_LEFT),
                'direction' => ['inbound', 'outbound'][rand(0, 1)],
                'status' => ['ringing', 'answered', 'ended'][rand(0, 2)],
                'started_at' => now()->subSeconds(rand(1, 300)),
                'answered_at' => rand(0, 1) ? now()->subSeconds(rand(1, 200)) : null,
                'ended_at' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }
        return $calls;
    }

    private function createTestExtensions(int $count): array
    {
        $extensions = [];
        $statuses = [1, 2, 4, 8, 16]; // Available, InUse, Unavailable, Ringing, OnHold
        
        for ($i = 0; $i < $count; $i++) {
            $extensions[] = (object) [
                'id' => $i + 2000,
                'extension' => '100' . ($i % 50),
                'status' => $statuses[rand(0, 4)],
                'state_description' => 'Test Status ' . $i,
                'status_changed_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }
        return $extensions;
    }
}