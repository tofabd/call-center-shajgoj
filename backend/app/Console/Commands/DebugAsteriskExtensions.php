<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\ExtensionService;
use Illuminate\Support\Facades\Log;

class DebugAsteriskExtensions extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:debug-asterisk-extensions {--raw : Show raw AMI responses} {--test-all : Test all available AMI commands}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Debug Asterisk AMI extension fetching issues';

    /**
     * Execute the console command.
     */
    public function handle(ExtensionService $extensionService)
    {
        $this->info('🔍 Debugging Asterisk AMI Extension Fetching');
        $this->line('');

        // Test 1: Basic AMI connection
        $this->testAmiConnection($extensionService);

        // Test 2: Individual AMI commands
        $this->testIndividualCommands($extensionService);

        // Test 3: Comprehensive extension fetching
        $this->testComprehensiveFetching($extensionService);

        // Test 4: Alternative methods
        $this->testAlternativeMethods($extensionService);

        $this->info('✅ Debugging completed. Check logs for detailed information.');
    }

    private function testAmiConnection(ExtensionService $extensionService): void
    {
        $this->info('🔌 Test 1: AMI Connection Test');

        try {
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

            // Test socket connection
            $socket = @fsockopen($host, $port, $errno, $errstr, 5);
            if ($socket) {
                $this->info("  ✅ Socket connection successful");

                // Test AMI login
                $loginCmd = "Action: Login\r\nUsername: {$username}\r\nSecret: [HIDDEN]\r\n\r\n";
                fwrite($socket, $loginCmd);

                $response = '';
                $startTime = time();
                while (time() - $startTime < 5) {
                    $buffer = fgets($socket);
                    if ($buffer === false) break;
                    $response .= $buffer;
                    if (strpos($response, 'Response:') !== false) break;
                }

                if (strpos($response, 'Response: Success') !== false) {
                    $this->info("  ✅ AMI login successful");
                } else {
                    $this->error("  ❌ AMI login failed");
                    $this->line("    Response: " . trim($response));
                }

                fclose($socket);
            } else {
                $this->error("  ❌ Socket connection failed: {$errstr} ({$errno})");
            }
        } catch (\Exception $e) {
            $this->error("  ❌ Connection test failed: " . $e->getMessage());
        }

        $this->line('');
    }

    private function testIndividualCommands(ExtensionService $extensionService): void
    {
        $this->info('📡 Test 2: Individual AMI Commands Test');

        // Get connection details using reflection
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

        $commands = [
            'SIPpeers' => "Action: SIPpeers\r\n\r\n",
            'SIPshowregistry' => "Action: SIPshowregistry\r\n\r\n",
            'SIPshowpeer' => "Action: SIPshowpeer\r\n\r\n",
            'SIPshowstatus' => "Action: SIPshowstatus\r\n\r\n",
            'CoreStatus' => "Action: CoreStatus\r\n\r\n",
            'Command_sip_show_peers' => "Action: Command\r\nCommand: sip show peers\r\n\r\n",
            'Command_sip_show_registry' => "Action: Command\r\nCommand: sip show registry\r\n\r\n",
        ];

        foreach ($commands as $name => $command) {
            $this->line("  • Testing {$name}...");

            try {
                $socket = fsockopen(
                    $host,
                    $port,
                    $errno,
                    $errstr,
                    5
                );

                if (!$socket) {
                    $this->error("    ❌ Connection failed: {$errstr} ({$errno})");
                    continue;
                }

                // Login
                $loginCmd = "Action: Login\r\nUsername: {$username}\r\nSecret: [HIDDEN]\r\n\r\n";
                fwrite($socket, $loginCmd);

                $loginResponse = '';
                $startTime = time();
                while (time() - $startTime < 5) {
                    $buffer = fgets($socket);
                    if ($buffer === false) break;
                    $loginResponse .= $buffer;
                    if (strpos($loginResponse, 'Response:') !== false) break;
                }

                if (strpos($loginResponse, 'Response: Success') === false) {
                    $this->error("    ❌ Login failed");
                    fclose($socket);
                    continue;
                }

                // Send command
                fwrite($socket, $command);

                // Read response
                $response = '';
                $startTime = time();
                while (time() - $startTime < 10) {
                    $buffer = fgets($socket);
                    if ($buffer === false) break;
                    $response .= $buffer;

                    // Check for completion indicators
                    if (strpos($response, 'Event: PeerlistComplete') !== false ||
                        strpos($response, 'Event: RegistryComplete') !== false ||
                        strpos($response, 'Event: StatusComplete') !== false ||
                        strpos($response, 'Event: CommandComplete') !== false) {
                        break;
                    }
                }

                fclose($socket);

                $responseLength = strlen($response);
                $this->line("    📊 Response length: {$responseLength} characters");

                if ($responseLength > 0) {
                    $this->line("    📝 Response preview: " . substr($response, 0, 100) . "...");

                    // Check for specific patterns
                    if (strpos($response, 'Event: PeerEntry') !== false) {
                        $this->info("    ✅ Found PeerEntry events");
                    }
                    if (strpos($response, 'Event: RegistryEntry') !== false) {
                        $this->info("    ✅ Found RegistryEntry events");
                    }
                    if (strpos($response, 'Output:') !== false) {
                        $this->info("    ✅ Found CLI output");
                    }
                } else {
                    $this->warn("    ⚠️ Empty response");
                }

            } catch (\Exception $e) {
                $this->error("    ❌ Command failed: " . $e->getMessage());
            }
        }

        $this->line('');
    }

    private function testComprehensiveFetching(ExtensionService $extensionService): void
    {
        $this->info('🔄 Test 3: Comprehensive Extension Fetching Test');

        try {
            $this->line("  • Calling getAllSipExtensions()...");
            $extensions = $extensionService->getAllSipExtensions();

            $this->line("  📊 Result: " . count($extensions) . " extensions found");

            if (count($extensions) > 0) {
                $this->line("  📋 First few extensions:");
                foreach (array_slice($extensions, 0, 3) as $ext) {
                    $this->line("    - {$ext['extension']} ({$ext['status']})");
                }
            }

        } catch (\Exception $e) {
            $this->error("  ❌ Comprehensive fetching failed: " . $e->getMessage());
        }

        $this->line('');
    }

    private function testAlternativeMethods(ExtensionService $extensionService): void
    {
        $this->info('🔧 Test 4: Alternative Methods Test');

        try {
            // Test registered extensions only
            $this->line("  • Testing getRegisteredExtensions()...");
            $registered = $extensionService->getRegisteredExtensions();
            $this->line("    📊 Registered extensions: " . count($registered));

            // Test comprehensive method
            $this->line("  • Testing getComprehensiveSipExtensions()...");
            $comprehensive = $extensionService->getComprehensiveSipExtensions();
            $this->line("    📊 Comprehensive extensions: " . count($comprehensive));

            // Test debug method
            $this->line("  • Testing debugAmiResponses()...");
            $debug = $extensionService->debugAmiResponses();
            $this->line("    📊 Debug responses: " . count($debug));

        } catch (\Exception $e) {
            $this->error("  ❌ Alternative methods failed: " . $e->getMessage());
        }

        $this->line('');
    }
}
