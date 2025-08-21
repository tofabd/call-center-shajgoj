<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\ExtensionService;
use Illuminate\Support\Facades\Log;

class GetAsteriskExtensions extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:get-asterisk-extensions {--format=table : Output format (table, json, csv)} {--save : Save extensions to database} {--debug : Show raw AMI response for debugging}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Get ALL SIP extensions from Asterisk AMI (including unregistered, rejected, etc.)';

    /**
     * Execute the console command.
     */
    public function handle(ExtensionService $extensionService)
    {
        $startTime = microtime(true);
        $format = $this->option('format');
        $shouldSave = $this->option('save');
        $debug = $this->option('debug');

        $this->info('🔍 Fetching ALL SIP extensions from Asterisk AMI...');

        // Log the start of the command
        Log::info('Get Asterisk extensions command started', [
            'command' => 'app:get-asterisk-extensions',
            'format' => $format,
            'save_to_db' => $shouldSave,
            'debug' => $debug,
            'started_at' => now()->toISOString(),
            'user' => 'artisan_command'
        ]);

        try {
            // Test AMI connection
            $this->info('🔌 Testing AMI connection...');

            // Get ALL SIP extensions from AMI (including unregistered, rejected, etc.)
            $extensions = $extensionService->getAllSipExtensions();

            $this->info("📡 Found " . count($extensions) . " SIP extensions in Asterisk AMI");

            // Debug: Show raw response if requested
            if ($debug) {
                $this->info('🔍 Debug: Testing AMI Commands...');
                $this->line('Testing various AMI commands to find the right one for SIP extensions...');

                $debugResponses = $extensionService->debugAmiResponses();

                $this->info('📋 AMI Command Test Results:');
                foreach ($debugResponses as $command => $response) {
                    $this->line("  • {$command}: " . strlen($response) . " characters");
                    if (strlen($response) > 0) {
                        $this->line("    Response preview: " . substr($response, 0, 100) . "...");
                    }
                }

                $this->line('Check laravel.log for detailed responses.');
            }

            // Log the response
            Log::info('Asterisk AMI all SIP extensions response', [
                'command' => 'app:get-asterisk-extensions',
                'extensions_count' => count($extensions),
                'extensions' => $extensions,
                'response_time' => now()->toISOString()
            ]);

            if (count($extensions) === 0) {
                $this->warn('⚠️ No SIP extensions found in Asterisk AMI');
                $this->line('This could mean:');
                $this->line('  • No SIP extensions are configured');
                $this->line('  • AMI connection issues');
                $this->line('  • Different extension configuration method');

                // Show connection test
                $this->testAmiConnection($extensionService);
                return 0;
            }

            // Display extensions in requested format
            $this->displayExtensions($extensions, $format);

            // Show detailed information
            $this->showExtensionDetails($extensions);

            // Save to database if requested
            if ($shouldSave) {
                $this->info('💾 Saving extensions to database...');
                $saved = $extensionService->syncExtensions();
                $this->info("✅ Saved " . count($saved) . " extensions to database");

                Log::info('Extensions saved to database', [
                    'command' => 'app:get-asterisk-extensions',
                    'saved_count' => count($saved),
                    'saved_at' => now()->toISOString()
                ]);
            }

            // Calculate and display processing time
            $processingTime = round((microtime(true) - $startTime) * 1000, 2);
            $this->info("⏱️ Command completed in {$processingTime}ms");

            // Log successful completion
            Log::info('Get Asterisk extensions completed successfully', [
                'command' => 'app:get-asterisk-extensions',
                'extensions_count' => count($extensions),
                'format' => $format,
                'save_to_db' => $shouldSave,
                'processing_time_ms' => $processingTime,
                'completed_at' => now()->toISOString(),
                'user' => 'artisan_command'
            ]);

        } catch (\Exception $e) {
            $errorMessage = 'Failed to get Asterisk extensions: ' . $e->getMessage();
            $this->error("❌ {$errorMessage}");

            // Log the error
            Log::error('Get Asterisk extensions failed', [
                'command' => 'app:get-asterisk-extensions',
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
     * Display extensions in the requested format
     */
    private function displayExtensions(array $extensions, string $format): void
    {
        switch ($format) {
            case 'json':
                $this->displayAsJson($extensions);
                break;
            case 'csv':
                $this->displayAsCsv($extensions);
                break;
            case 'table':
            default:
                $this->displayAsTable($extensions);
                break;
        }
    }

    /**
     * Display extensions as a table
     */
    private function displayAsTable(array $extensions): void
    {
        $this->info('📋 All SIP Extensions:');

        if (count($extensions) > 0) {
            $this->table(
                ['Extension', 'Status', 'Registration Time', 'Host', 'Port'],
                collect($extensions)->map(function ($ext) {
                    return [
                        $ext['extension'] ?? 'N/A',
                        $this->getStatusIcon($ext['status'] ?? 'unknown') . ' ' . ($ext['status'] ?? 'unknown'),
                        $ext['registration_time'] ?? 'N/A',
                        $ext['host'] ?? 'N/A',
                        $ext['port'] ?? 'N/A'
                    ];
                })->toArray()
            );
        }
    }

    /**
     * Display extensions as JSON
     */
    private function displayAsJson(array $extensions): void
    {
        $this->info('📋 All SIP Extensions (JSON):');
        $this->line(json_encode($extensions, JSON_PRETTY_PRINT));
    }

    /**
     * Display extensions as CSV
     */
    private function displayAsCsv(array $extensions): void
    {
        $this->info('📋 All SIP Extensions (CSV):');

        if (count($extensions) > 0) {
            // CSV header
            $headers = array_keys($extensions[0]);
            $this->line(implode(',', $headers));

            // CSV data
            foreach ($extensions as $ext) {
                $row = array_map(function ($value) {
                    return is_string($value) ? '"' . str_replace('"', '""', $value) . '"' : $value;
                }, array_values($ext));
                $this->line(implode(',', $row));
            }
        }
    }

    /**
     * Show detailed extension information
     */
    private function showExtensionDetails(array $extensions): void
    {
        $this->info('📊 Extension Statistics:');

        // Status breakdown
        $statusCounts = collect($extensions)->groupBy('status')->map->count();
        $this->line("Status breakdown:");
        foreach ($statusCounts as $status => $count) {
            $icon = $this->getStatusIcon($status);
            $this->line("  {$icon} {$status}: {$count}");
        }

        // Extension number ranges
        $extNumbers = collect($extensions)->pluck('extension')->filter()->sort();
        if ($extNumbers->count() > 0) {
            $this->line("\nExtension ranges:");
            $this->line("  Min: " . $extNumbers->first());
            $this->line("  Max: " . $extNumbers->last());
            $this->line("  Total: " . $extNumbers->count());
        }

        // Registration patterns
        $this->line("\nRegistration patterns:");
        $this->line("  • All extensions are currently " . ($statusCounts->keys()->first() ?? 'unknown'));

        if (isset($extensions[0]['host'])) {
            $hosts = collect($extensions)->pluck('host')->unique()->filter();
            if ($hosts->count() > 0) {
                $this->line("  • Hosts: " . $hosts->implode(', '));
            }
        }
    }

    /**
     * Test AMI connection and show diagnostic information
     */
    private function testAmiConnection(ExtensionService $extensionService): void
    {
        $this->info('🔍 AMI Connection Diagnostics:');

        try {
            // Get connection details from service
            $reflection = new \ReflectionClass($extensionService);
            $hostProperty = $reflection->getProperty('host');
            $portProperty = $reflection->getProperty('port');
            $usernameProperty = $reflection->getProperty('username');

            $hostProperty->setAccessible(true);
            $portProperty->setAccessible(true);
            $usernameProperty->setAccessible(true);

            $host = $hostProperty->getValue($extensionService);
            $port = $portProperty->getValue($extensionService);
            $username = $usernameProperty->getValue($extensionService);

            $this->line("  • Host: {$host}");
            $this->line("  • Port: {$port}");
            $this->line("  • Username: {$username}");

            // Test basic socket connection
            $this->line("  • Testing socket connection...");
            $socket = @fsockopen($host, $port, $errno, $errstr, 5);

            if ($socket) {
                $this->info("    ✅ Socket connection successful");
                fclose($socket);
            } else {
                $this->error("    ❌ Socket connection failed: {$errstr} ({$errno})");
            }

        } catch (\Exception $e) {
            $this->error("    ❌ Connection test failed: " . $e->getMessage());
        }
    }

    /**
     * Get status icon for display
     */
    private function getStatusIcon(string $status): string
    {
        return match($status) {
            'Registered', 'online' => '🟢',
            'Unregistered', 'offline' => '🔴',
            'Rejected' => '⚠️',
            'Timeout' => '⏰',
            'unknown' => '🟡',
            default => '⚪'
        };
    }
}
