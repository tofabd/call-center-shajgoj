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
    protected $signature = 'app:get-asterisk-extensions
                            {--format=table : Output format (table, json, csv, simple)}
                            {--save : Save extensions to database}
                            {--debug : Show raw AMI response for debugging}
                            {--method=auto : Method to use (auto, ami, cli, both)}
                            {--fast : Fast mode - use only the most efficient method}
                            {--timeout=5 : Timeout in seconds for AMI responses (fast mode only)}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Get ALL SIP extensions from Asterisk using multiple methods (AMI + CLI fallback)';

    private $host;
    private $port;
    private $username;
    private $password;
    private $socket;

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $startTime = microtime(true);
        $format = $this->option('format');
        $shouldSave = $this->option('save');
        $debug = $this->option('debug');
        $method = $this->option('method');
        $fastMode = $this->option('fast');

        $this->info('🔍 Fetching ALL SIP extensions from Asterisk...');
        if ($fastMode) {
            $this->info('⚡ Fast mode enabled - using most efficient method only');
        }

        // Log the start of the command
        Log::info('Get Asterisk extensions command started', [
            'command' => 'app:get-asterisk-extensions',
            'format' => $format,
            'method' => $method,
            'save_to_db' => $shouldSave,
            'debug' => $debug,
            'started_at' => now()->toISOString(),
            'user' => 'artisan_command'
        ]);

        // Get connection details from environment
        $this->host = env('AMI_HOST');
        $this->port = env('AMI_PORT');
        $this->username = env('AMI_USERNAME');
        $this->password = env('AMI_PASSWORD');

        try {
            // Test connection
            $this->info('🔌 Testing AMI connection...');
            $this->line("  • Host: {$this->host}");
            $this->line("  • Port: {$this->port}");
            $this->line("  • Username: {$this->username}");

            // Get extensions using specified method
            $extensions = [];

            if ($method === 'auto' || $method === 'ami') {
                $this->info('📡 Trying AMI method...');
                if ($fastMode) {
                    $this->line('  ⚡ Fast mode: Using SIPpeers only (most efficient)');
                    $timeout = (int)$this->option('timeout');
                    $this->line("  ⏱️ Using timeout: {$timeout} seconds");
                    $amiExtensions = $this->getExtensionsViaAMIFast($timeout);
                } else {
                    $amiExtensions = $this->getExtensionsViaAMI();
                }
                if (!empty($amiExtensions)) {
                    $extensions = array_merge($extensions, $amiExtensions);
                    $this->info("✅ AMI method found " . count($amiExtensions) . " extensions");
                } else {
                    $this->warn("⚠️ AMI method returned no extensions");
                }
            }

            if (($method === 'auto' || $method === 'cli') && !$fastMode) {
                $this->info('💻 Trying CLI method...');
                $cliExtensions = $this->getExtensionsViaCLI();
                if (!empty($cliExtensions)) {
                    $extensions = array_merge($extensions, $cliExtensions);
                    $this->info("✅ CLI method found " . count($cliExtensions) . " extensions");
                } else {
                    $this->warn("⚠️ CLI method returned no extensions");
                }
            }

            // Remove duplicates based on extension number
            $uniqueExtensions = [];
            foreach ($extensions as $ext) {
                $extNum = $ext['extension'] ?? null;
                if ($extNum && !isset($uniqueExtensions[$extNum])) {
                    $uniqueExtensions[$extNum] = $ext;
                }
            }
            $extensions = array_values($uniqueExtensions);

            $this->info("📊 Total unique extensions found: " . count($extensions));

            if (count($extensions) === 0) {
                $this->warn('⚠️ No SIP extensions found using any method');
                $this->line('This could mean:');
                $this->line('  • No SIP extensions are configured');
                $this->line('  • AMI connection issues');
                $this->line('  • Different extension configuration method');
                $this->line('  • Firewall blocking connections');

                // Show connection test
                $this->testConnection();
                return 1;
            }

            // Debug: Show raw responses if requested
            if ($debug) {
                $this->showDebugInfo();
            }

            // Display extensions in requested format
            $this->displayExtensions($extensions, $format);

            // Show detailed information
            $this->showExtensionDetails($extensions);

            // Save to database if requested
            if ($shouldSave) {
                $this->info('💾 Saving extensions to database...');
                $extensionService = new ExtensionService();
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
                'method' => $method,
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
        } finally {
            if ($this->socket) {
                fclose($this->socket);
            }
        }

        return 0;
    }

    /**
     * Get extensions via AMI (Fast mode - SIPpeers only)
     */
    private function getExtensionsViaAMIFast(int $timeout): array
    {
        try {
            // Connect to AMI
            $this->socket = fsockopen($this->host, $this->port, $errno, $errstr, $timeout);
            if (!$this->socket) {
                throw new \Exception("Connection failed: $errstr ($errno)");
            }

            // Login to AMI
            if (!$this->login()) {
                throw new \Exception("AMI authentication failed");
            }

            // Use only SIPpeers command (most comprehensive and fastest)
            $this->line("  • Using SIPpeers (fast mode)...");
            $sipPeers = $this->sendAmiCommandFast("Action: SIPpeers\r\n\r\n", $timeout);
            $this->line("    Response length: " . strlen($sipPeers));

            $parsedPeers = $this->parseSIPPeersResponse($sipPeers);
            if (!empty($parsedPeers)) {
                $this->line("    ✅ Found " . count($parsedPeers) . " extensions via SIPpeers");
                return $parsedPeers;
            } else {
                $this->line("    ⚠️ No extensions parsed from SIPpeers");
                return [];
            }

        } catch (\Exception $e) {
            $this->warn("  ⚠️ AMI fast method failed: " . $e->getMessage());
            return [];
        }
    }

    /**
     * Send AMI command and get response with aggressive timeout (fast mode)
     */
    private function sendAmiCommandFast(string $command, int $timeout): string
    {
        fwrite($this->socket, $command);
        return $this->readResponseFast($timeout);
    }

    /**
     * Read AMI response with aggressive timeout (fast mode)
     */
    private function readResponseFast(int $timeout): string
    {
        $response = '';
        $startTime = time();
        $maxTime = $timeout;
        $lastDataTime = time();
        $emptyLineCount = 0;

        while (!feof($this->socket) && (time() - $startTime) < $maxTime) {
            $buffer = fgets($this->socket);
            if ($buffer === false) {
                // Very short wait if no data
                usleep(1000); // Only 1ms wait
                continue;
            }

            $response .= $buffer;
            $lastDataTime = time();

            // Check for completion events immediately
            if (strpos($response, 'Event: PeerlistComplete') !== false ||
                strpos($response, 'Event: RegistryComplete') !== false ||
                strpos($response, 'Event: StatusComplete') !== false ||
                strpos($response, 'Event: CommandComplete') !== false) {
                $this->line("      Found completion event, stopping read");
                break;
            }

            // Check for empty lines (reduced threshold)
            if (trim($buffer) === '') {
                $emptyLineCount++;
                if ($emptyLineCount >= 2) {
                    $this->line("      Found 2 empty lines, stopping read");
                    break;
                }
            } else {
                $emptyLineCount = 0;
            }

            // Minimal wait time
            usleep(1000); // Only 1ms wait
        }

        return $response;
    }

    /**
     * Get extensions via AMI (Asterisk Manager Interface)
     */
    private function getExtensionsViaAMI(): array
    {
        try {
            // Connect to AMI
            $this->socket = fsockopen($this->host, $this->port, $errno, $errstr, 10);
            if (!$this->socket) {
                throw new \Exception("Connection failed: $errstr ($errno)");
            }

            // Login to AMI
            if (!$this->login()) {
                throw new \Exception("AMI authentication failed");
            }

            $extensions = [];

            // Method 1: SIPpeers command (most comprehensive, try this first)
            $this->line("  • Trying SIPpeers (most comprehensive)...");
            $sipPeers = $this->sendAmiCommand("Action: SIPpeers\r\n\r\n");
            $this->line("    Raw response length: " . strlen($sipPeers));
            if (strlen($sipPeers) > 200) {
                $this->line("    Response preview: " . substr($sipPeers, 0, 200) . "...");
            } else {
                $this->line("    Full response: " . $sipPeers);
            }
            $parsedPeers = $this->parseSIPPeersResponse($sipPeers);
            if (!empty($parsedPeers)) {
                $extensions = array_merge($extensions, $parsedPeers);
                $this->info("✅ AMI method found " . count($parsedPeers) . " extensions");

                // If we got a good number of extensions, skip other methods to save time
                if (count($parsedPeers) >= 5) {
                    $this->line("    ⚡ Skipping other methods - SIPpeers provided sufficient data");
                    return $extensions;
                }
            } else {
                $this->line("    ⚠️ No extensions parsed from SIPpeers");
            }

            // Method 2: CLI command via AMI (fastest fallback)
            $this->line("  • Trying CLI command via AMI (fast fallback)...");
            $cliCommand = "Action: Command\r\nCommand: sip show peers\r\n\r\n";
            $cliResponse = $this->sendAmiCommand($cliCommand);
            $this->line("    Raw response length: " . strlen($cliResponse));
            if (strlen($cliResponse) > 200) {
                $this->line("    Response preview: " . substr($cliResponse, 0, 200) . "...");
            } else {
                $this->line("    Full response: " . $cliResponse);
            }
            $parsedCLI = $this->parseCLIResponse($cliResponse);
            if (!empty($parsedCLI)) {
                $extensions = array_merge($extensions, $parsedCLI);
                $this->info("✅ CLI method found " . count($parsedCLI) . " extensions");

                // If we have enough extensions, stop here
                if (count($extensions) >= 5) {
                    $this->line("    ⚡ Sufficient extensions found, stopping here");
                    return $extensions;
                }
            } else {
                $this->line("    ⚠️ No extensions parsed from CLI command");
            }

            // Only try additional methods if we still don't have enough extensions
            if (count($extensions) < 3) {
                $this->line("  • Trying additional methods for more extensions...");

                // Method 3: SIPshowregistry command
                $this->line("    - Trying SIPshowregistry...");
                $sipRegistry = $this->sendAmiCommand("Action: SIPshowregistry\r\n\r\n");
                $this->line("      Raw response length: " . strlen($sipRegistry));
                $parsedRegistry = $this->parseSIPRegistryResponse($sipRegistry);
                if (!empty($parsedRegistry)) {
                    $extensions = array_merge($extensions, $parsedRegistry);
                    $this->line("      ✅ Found " . count($parsedRegistry) . " extensions via SIPshowregistry");
                }
            }

            return $extensions;

        } catch (\Exception $e) {
            $this->warn("  ⚠️ AMI method failed: " . $e->getMessage());
            return [];
        }
    }

    /**
     * Get extensions via direct CLI command (fallback method)
     */
    private function getExtensionsViaCLI(): array
    {
        try {
            // Try to execute CLI command directly if possible
            $this->line("  • Trying direct CLI execution...");

            // Method 1: Try to execute asterisk command directly
            $output = shell_exec('asterisk -rx "sip show peers" 2>&1');
            if ($output && !str_contains($output, 'command not found')) {
                $parsed = $this->parseDirectCLIResponse($output);
                if (!empty($parsed)) {
                    $this->line("    ✅ Found " . count($parsed) . " extensions via direct CLI");
                    return $parsed;
                }
            }

            // Method 2: Try to connect via SSH if configured
            $this->line("  • CLI method not available on this system");
            return [];

        } catch (\Exception $e) {
            $this->warn("  ⚠️ CLI method failed: " . $e->getMessage());
            return [];
        }
    }

    /**
     * Login to AMI
     */
    private function login(): bool
    {
        $loginCmd = "Action: Login\r\n"
                 . "Username: {$this->username}\r\n"
                 . "Secret: {$this->password}\r\n\r\n";

        fwrite($this->socket, $loginCmd);
        $response = $this->readResponse();

        return strpos($response, 'Response: Success') !== false;
    }

    /**
     * Send AMI command and get response
     */
    private function sendAmiCommand(string $command): string
    {
        fwrite($this->socket, $command);
        return $this->readResponse();
    }

    /**
     * Read AMI response
     */
    private function readResponse(): string
    {
        $response = '';
        $timeout = time() + 8; // Reduced timeout from 15 to 8 seconds
        $lastData = '';
        $consecutiveEmptyLines = 0;
        $lastDataTime = time();

        while (!feof($this->socket) && time() < $timeout) {
            $buffer = fgets($this->socket);
            if ($buffer === false) {
                // Only wait if we haven't received data recently
                if (time() - $lastDataTime > 1) {
                    usleep(10000); // Reduced from 100ms to 10ms
                }
                continue;
            }

            $response .= $buffer;
            $lastData = $buffer;
            $lastDataTime = time();

            // Check for completion events immediately
            if (strpos($response, 'Event: PeerlistComplete') !== false ||
                strpos($response, 'Event: RegistryComplete') !== false ||
                strpos($response, 'Event: StatusComplete') !== false ||
                strpos($response, 'Event: CommandComplete') !== false) {
                $this->line("      Found completion event, stopping read");
                break;
            }

            // Check for consecutive empty lines (reduced from 3 to 2)
            if (trim($buffer) === '') {
                $consecutiveEmptyLines++;
                if ($consecutiveEmptyLines >= 2) {
                    $this->line("      Found 2 consecutive empty lines, assuming response complete");
                    break;
                }
            } else {
                $consecutiveEmptyLines = 0;
            }

            // Reduced wait time significantly
            usleep(5000); // Reduced from 50ms to 5ms
        }

        return $response;
    }

    /**
     * Parse SIPpeers response
     */
    private function parseSIPPeersResponse(string $response): array
    {
        $extensions = [];
        $lines = explode("\r\n", $response);
        $currentPeer = null;

        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line)) continue;

            if (strpos($line, 'Event: PeerEntry') !== false) {
                if ($currentPeer && isset($currentPeer['extension'])) {
                    $extensions[] = $currentPeer;
                }
                $currentPeer = ['status' => 'unknown', 'method' => 'sip_peers'];
            } elseif (strpos($line, 'ObjectName: ') !== false) {
                $currentPeer['extension'] = trim(substr($line, 12));
            } elseif (strpos($line, 'Status: ') !== false) {
                $status = trim(substr($line, 8));
                $currentPeer['status'] = $this->mapStatus($status);
            } elseif (strpos($line, 'Channeltype: ') !== false) {
                $currentPeer['channel_type'] = trim(substr($line, 13));
            } elseif (strpos($line, 'IPaddress: ') !== false) {
                $currentPeer['ip_address'] = trim(substr($line, 11));
            } elseif (strpos($line, 'Dynamic: ') !== false) {
                $currentPeer['dynamic'] = trim(substr($line, 9));
            }
        }

        // Don't forget the last peer
        if ($currentPeer && isset($currentPeer['extension'])) {
            $extensions[] = $currentPeer;
        }

        $this->line("      Parsed " . count($extensions) . " extensions from SIPpeers");
        return $extensions;
    }

    /**
     * Parse SIPshowpeer response
     */
    private function parseSIPShowPeerResponse(string $response): array
    {
        $extensions = [];
        $lines = explode("\r\n", $response);
        $currentPeer = null;

        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line)) continue;

            if (strpos($line, 'Event: PeerEntry') !== false) {
                if ($currentPeer && isset($currentPeer['extension'])) {
                    $extensions[] = $currentPeer;
                }
                $currentPeer = ['status' => 'unknown', 'method' => 'sip_show_peer'];
            } elseif (strpos($line, 'ObjectName: ') !== false) {
                $currentPeer['extension'] = trim(substr($line, 12));
            } elseif (strpos($line, 'Status: ') !== false) {
                $status = trim(substr($line, 8));
                $currentPeer['status'] = $this->mapStatus($status);
            } elseif (strpos($line, 'Channeltype: ') !== false) {
                $currentPeer['channel_type'] = trim(substr($line, 13));
            } elseif (strpos($line, 'IPaddress: ') !== false) {
                $currentPeer['ip_address'] = trim(substr($line, 11));
            }
        }

        // Don't forget the last peer
        if ($currentPeer && isset($currentPeer['extension'])) {
            $extensions[] = $currentPeer;
        }

        $this->line("      Parsed " . count($extensions) . " extensions from SIPshowpeer");
        return $extensions;
    }

    /**
     * Parse SIPshowregistry response
     */
    private function parseSIPRegistryResponse(string $response): array
    {
        $extensions = [];
        $lines = explode("\r\n", $response);
        $currentReg = null;

        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line)) continue;

            if (strpos($line, 'Event: PeerEntry') !== false) {
                if ($currentReg && isset($currentReg['extension'])) {
                    $extensions[] = $currentReg;
                }
                $currentReg = ['status' => 'online', 'method' => 'sip_registry'];
            } elseif (strpos($line, 'ObjectName: ') !== false) {
                $currentReg['extension'] = trim(substr($line, 12));
            } elseif (strpos($line, 'State: ') !== false) {
                $status = trim(substr($line, 7));
                $currentReg['status'] = $status === 'Registered' ? 'online' : 'offline';
            } elseif (strpos($line, 'Status: ') !== false) {
                $status = trim(substr($line, 8));
                $currentReg['status'] = $this->mapStatus($status);
            }
        }

        // Don't forget the last registration
        if ($currentReg && isset($currentReg['extension'])) {
            $extensions[] = $currentReg;
        }

        $this->line("      Parsed " . count($extensions) . " extensions from SIPshowregistry");
        return $extensions;
    }

    /**
     * Parse CLI command response
     */
    private function parseCLIResponse(string $response): array
    {
        $extensions = [];
        $lines = explode("\r\n", $response);

        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line)) continue;

            // Look for lines that contain extension numbers
            if (preg_match('/^(\d{3,5})\s+\S+\s+(\S+)\s+(\S+)/', $line, $matches)) {
                $extensions[] = [
                    'extension' => $matches[1],
                    'status' => $this->mapStatus($matches[2]),
                    'method' => 'cli'
                ];
            }
        }

        return $extensions;
    }

    /**
     * Parse direct CLI response
     */
    private function parseDirectCLIResponse(string $output): array
    {
        $extensions = [];
        $lines = explode("\n", $output);

        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line)) continue;

            // Look for lines that contain extension numbers
            if (preg_match('/^(\d{3,5})\s+\S+\s+(\S+)\s+(\S+)/', $line, $matches)) {
                $extensions[] = [
                    'extension' => $matches[1],
                    'status' => $this->mapStatus($matches[2]),
                    'method' => 'direct_cli'
                ];
            }
        }

        return $extensions;
    }

    /**
     * Map status values to standardized format
     */
    private function mapStatus(string $status): string
    {
        $status = strtolower(trim($status));

        $statusMap = [
            'registered' => 'online',
            'unregistered' => 'offline',
            'rejected' => 'offline',
            'timeout' => 'offline',
            'up' => 'online',
            'down' => 'offline',
            'ok' => 'online',
            'unknown' => 'unknown',
            'not in use' => 'online',
            'in use' => 'online',
            'busy' => 'online',
            'unavailable' => 'offline',
            'ringing' => 'online',
            'ringinuse' => 'online'
        ];

        return $statusMap[$status] ?? 'unknown';
    }

    /**
     * Test basic connection
     */
    private function testConnection(): void
    {
        $this->info('🔍 Connection Diagnostics:');

        // Test basic socket connection
        $this->line("  • Testing socket connection...");
        $socket = @fsockopen($this->host, $this->port, $errno, $errstr, 5);

        if ($socket) {
            $this->info("    ✅ Socket connection successful");
            fclose($socket);
        } else {
            $this->error("    ❌ Socket connection failed: {$errstr} ({$errno})");
        }

        // Test if asterisk command is available
        $this->line("  • Testing asterisk CLI command...");
        $output = shell_exec('which asterisk 2>&1');
        if ($output && !str_contains($output, 'no asterisk')) {
            $this->info("    ✅ Asterisk CLI available");
        } else {
            $this->warn("    ⚠️ Asterisk CLI not available");
        }
    }

    /**
     * Show debug information
     */
    private function showDebugInfo(): void
    {
        $this->info('🔍 Debug Information:');
        $this->line("  • AMI Host: {$this->host}");
        $this->line("  • AMI Port: {$this->port}");
        $this->line("  • AMI Username: {$this->username}");
        $this->line("  • Check laravel.log for detailed AMI responses");
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
            case 'simple':
                $this->displayAsSimple($extensions);
                break;
            case 'table':
            default:
                $this->displayAsTable($extensions);
                break;
        }
    }

    /**
     * Display extensions as a simple list
     */
    private function displayAsSimple(array $extensions): void
    {
        $this->info('📋 All SIP Extensions (Simple List):');

        // Extract just the extension numbers and sort them
        $extensionNumbers = collect($extensions)
            ->pluck('extension')
            ->filter()
            ->sort()
            ->values()
            ->toArray();

        // Display in a clean format
        $this->line(implode(' ', $extensionNumbers));

        $this->line('');
        $this->line("Total: " . count($extensionNumbers) . " extensions");
    }

    /**
     * Display extensions as a table
     */
    private function displayAsTable(array $extensions): void
    {
        $this->info('📋 All SIP Extensions:');

        if (count($extensions) > 0) {
            $this->table(
                ['Extension', 'Status', 'Method', 'Details'],
                collect($extensions)->map(function ($ext) {
                    return [
                        $ext['extension'] ?? 'N/A',
                        $this->getStatusIcon($ext['status'] ?? 'unknown') . ' ' . ($ext['status'] ?? 'unknown'),
                        $ext['method'] ?? 'ami',
                        $this->getExtensionDetails($ext)
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

        // Method breakdown
        $methodCounts = collect($extensions)->groupBy('method')->map->count();
        $this->line("\nDiscovery method breakdown:");
        foreach ($methodCounts as $method => $count) {
            $this->line("  • {$method}: {$count}");
        }
    }

    /**
     * Get extension details for display
     */
    private function getExtensionDetails(array $ext): string
    {
        $details = [];

        if (isset($ext['channel_type'])) {
            $details[] = "Type: " . $ext['channel_type'];
        }

        if (isset($ext['ip_address'])) {
            $details[] = "IP: " . $ext['ip_address'];
        }

        if (isset($ext['description'])) {
            $details[] = "Desc: " . substr($ext['description'], 0, 20);
        }

        return implode(', ', $details);
    }

    /**
     * Get status icon for display
     */
    private function getStatusIcon(string $status): string
    {
        return match($status) {
            'online' => '🟢',
            'offline' => '🔴',
            'unknown' => '🟡',
            default => '⚪'
        };
    }

    /**
     * Extract extensions from any AMI response using regex patterns
     */
    private function extractExtensionsFromAnyResponse(string $response): array
    {
        $extensions = [];

        // Look for extension patterns in the response
        $patterns = [
            // Pattern for SIP extensions: 1001, 1002, etc.
            '/\b(\d{3,5})\b/',
            // Pattern for extensions in context: [1001], [1002], etc.
            '/\[(\d{3,5})\]/',
            // Pattern for extensions in dialplan: exten => 1001, etc.
            '/exten\s*=>\s*(\d{3,5})/',
            // Pattern for extensions in hints: 1001 => SIP/1001, etc.
            '/(\d{3,5})\s*=>\s*SIP\/\1/'
        ];

        foreach ($patterns as $pattern) {
            if (preg_match_all($pattern, $response, $matches)) {
                foreach ($matches[1] as $extension) {
                    // Only add if it looks like a valid extension (3-5 digits)
                    if (strlen($extension) >= 3 && strlen($extension) <= 5) {
                        $extensions[] = [
                            'extension' => $extension,
                            'status' => 'unknown',
                            'method' => 'regex_extraction',
                            'source' => 'alternative_command'
                        ];
                    }
                }
            }
        }

        // Remove duplicates
        $uniqueExtensions = [];
        foreach ($extensions as $ext) {
            $extNum = $ext['extension'];
            if (!isset($uniqueExtensions[$extNum])) {
                $uniqueExtensions[$extNum] = $ext;
            }
        }

        return array_values($uniqueExtensions);
    }
}

