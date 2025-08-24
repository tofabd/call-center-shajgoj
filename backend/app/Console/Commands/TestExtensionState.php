<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use App\Models\Extension;
use App\Services\ExtensionService;

class TestExtensionState extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'app:test-extension-state
                            {extension? : Specific extension to test (default: all DB extensions)}
                            {--all : Test all extensions in database}
                            {--raw : Show raw AMI responses}';

    /**
     * The console command description.
     */
    protected $description = 'Test ExtensionState queries using the same method as successful CLI test';

    private $host;
    private $port;
    private $username;
    private $password;

    public function __construct()
    {
        parent::__construct();

        $this->host = env('AMI_HOST', '103.177.125.83');
        $this->port = env('AMI_PORT', 5038);
        $this->username = env('AMI_USERNAME', 'admin');
        $this->password = env('AMI_PASSWORD', 'Tractor@0152');
    }

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('🧪 Testing ExtensionState queries...');

        $extension = $this->argument('extension');
        $testAll = $this->option('all');
        $showRaw = $this->option('raw');

        if ($extension) {
            // Test specific extension
            $this->testExtension($extension, $showRaw);
        } elseif ($testAll) {
            // Test all extensions in database
            $extensions = Extension::all();

            if ($extensions->count() === 0) {
                $this->warn('⚠️ No extensions found in database');
                return 1;
            }

            $this->info("📊 Testing {$extensions->count()} extensions from database...");

            foreach ($extensions as $ext) {
                $this->testExtension($ext->extension, $showRaw);
                $this->line(''); // Empty line between tests
            }
        } else {
            // Default: test extension 1001 like your CLI test
            $this->testExtension('1001', $showRaw);
        }

        return 0;
    }

    private function testExtension(string $extension, bool $showRaw = false): void
    {
        $this->info("🔍 Testing extension: {$extension}");

        try {
            $socket = fsockopen($this->host, $this->port, $errno, $errstr, 10);

            if (!$socket) {
                $this->error("❌ Failed to connect to AMI: $errstr ($errno)");
                return;
            }

            // Login to AMI
            if (!$this->login($socket)) {
                $this->error("❌ Failed to login to AMI");
                fclose($socket);
                return;
            }

            $this->line("✅ Connected and logged in to AMI");

            // Try multiple contexts that might exist
            $contexts = ['ext-local', 'from-internal', 'default', 'internal'];

            foreach ($contexts as $context) {
                $this->line("\n🔍 Trying context: {$context}");

                $result = $this->testExtensionInContext($socket, $extension, $context, $showRaw);

                if ($result) {
                    $this->info("✅ ExtensionState result for {$extension} in context {$context}:");
                    $this->table(
                        ['Field', 'Value'],
                        [
                            ['Extension', $result['extension']],
                            ['Context', $result['context']],
                            ['Status (numeric)', $result['status']],
                            ['StatusText', $result['status_text']],
                            ['Hint', $result['hint']],
                            ['Mapped Status', $result['mapped_status']],
                        ]
                    );
                    break; // Found a working context, stop trying others
                } else {
                    $this->warn("⚠️ No ExtensionStatus event for {$extension} in context {$context}");
                }
            }

            // Also try SIPshowpeer as fallback
            $this->line("\n🔍 Trying SIPshowpeer fallback...");
            $sipResult = $this->testSipShowPeer($socket, $extension, $showRaw);

            if ($sipResult) {
                $this->info("✅ SIPshowpeer result for {$extension}:");
                $this->table(
                    ['Field', 'Value'],
                    [
                        ['Extension', $sipResult['extension']],
                        ['Status', $sipResult['status']],
                        ['Dynamic', $sipResult['dynamic']],
                        ['Forcerport', $sipResult['forcerport']],
                        ['Comedia', $sipResult['comedia']],
                        ['Videosupport', $sipResult['videosupport']],
                        ['ACL', $sipResult['acl']],
                        ['DirectMedia', $sipResult['directmedia']],
                        ['Mapped Status', $sipResult['mapped_status']],
                    ]
                );
            } else {
                $this->warn("⚠️ No SIPshowpeer response for {$extension}");
            }

            fclose($socket);

        } catch (\Exception $e) {
            $this->error("❌ Error testing extension {$extension}: " . $e->getMessage());
        }
    }

    private function login($socket): bool
    {
        $loginCmd = "Action: Login\r\n"
                 . "Username: {$this->username}\r\n"
                 . "Secret: {$this->password}\r\n\r\n";

        fwrite($socket, $loginCmd);
        $response = $this->readResponse($socket);

        return strpos($response, 'Response: Success') !== false;
    }

    private function readResponse($socket): string
    {
        $response = '';
        $timeout = time() + 15; // Increased timeout to 15 seconds
        $consecutiveEmpty = 0;

        while (!feof($socket) && time() < $timeout) {
            $buffer = fgets($socket);
            if ($buffer === false) {
                break;
            }
            $response .= $buffer;

            // Check for multiple ways the response might end
            if (trim($buffer) === '') {
                $consecutiveEmpty++;
                if ($consecutiveEmpty >= 2) {
                    break; // Two consecutive empty lines usually means end
                }
            } else {
                $consecutiveEmpty = 0;
            }

            // Check if we've received a complete response with double CRLF
            if (strpos($response, "\r\n\r\n") !== false) {
                // Wait a bit more to ensure we get all data
                usleep(500000); // 500ms

                // Read any remaining data
                $additionalData = '';
                $additionalTimeout = time() + 2;
                while (!feof($socket) && time() < $additionalTimeout) {
                    $additionalBuffer = fgets($socket);
                    if ($additionalBuffer === false || trim($additionalBuffer) === '') {
                        break;
                    }
                    $additionalData .= $additionalBuffer;
                }
                $response .= $additionalData;
                break;
            }
        }

        return $response;
    }

    private function testExtensionInContext($socket, string $extension, string $context, bool $showRaw): ?array
    {
        $actionId = 'test_ext_' . $extension . '_' . $context . '_' . time();
        $command = "Action: ExtensionState\r\n"
                 . "Exten: {$extension}\r\n"
                 . "Context: {$context}\r\n"
                 . "ActionID: {$actionId}\r\n\r\n";

        $this->line("📤 Sending ExtensionState command:");
        $this->line("   Exten: {$extension}");
        $this->line("   Context: {$context}");
        $this->line("   ActionID: {$actionId}");

        fwrite($socket, $command);
        $response = $this->readResponse($socket);

        if ($showRaw) {
            $this->line("📥 Raw AMI response:");
            $this->line("------------------------");
            $this->line($response);
            $this->line("------------------------");
        }

        return $this->parseExtensionStateResponse($response, $extension, $actionId);
    }

    private function testSipShowPeer($socket, string $extension, bool $showRaw): ?array
    {
        $command = "Action: SIPshowpeer\r\n"
                 . "Peer: {$extension}\r\n\r\n";

        $this->line("📤 Sending SIPshowpeer command:");
        $this->line("   Peer: {$extension}");

        fwrite($socket, $command);
        $response = $this->readResponse($socket);

        if ($showRaw) {
            $this->line("📥 Raw SIPshowpeer response:");
            $this->line("------------------------");
            $this->line($response);
            $this->line("------------------------");
        }

        return $this->parseSipShowPeerResponse($response, $extension);
    }

    private function parseExtensionStateResponse(string $response, string $extension, string $actionId): ?array
    {
        $lines = explode("\r\n", $response);
        $foundResponse = false;
        $foundEvent = false;
        $result = null;

        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line)) continue;

            // Look for either Response: Success (synchronous) or Event: ExtensionStatus (asynchronous)
            if (strpos($line, 'Response: Success') !== false ||
                strpos($line, 'Event: ExtensionStatus') !== false) {
                $foundResponse = true;
                $foundEvent = true;
                $result = [
                    'extension' => null,
                    'status' => null,
                    'status_text' => null,
                    'hint' => null,
                    'context' => null,
                    'mapped_status' => null,
                ];
                continue;
            }

            if (!$foundResponse && !$foundEvent) continue;

            // Parse all fields (works for both Response and Event formats)
            if (strpos($line, 'Exten: ') !== false) {
                $result['extension'] = trim(substr($line, 7));
            } elseif (strpos($line, 'Context: ') !== false) {
                $result['context'] = trim(substr($line, 9));
            } elseif (strpos($line, 'Status: ') !== false) {
                $result['status'] = trim(substr($line, 8));
            } elseif (strpos($line, 'StatusText: ') !== false) {
                $result['status_text'] = trim(substr($line, 12));
            } elseif (strpos($line, 'Hint: ') !== false) {
                $result['hint'] = trim(substr($line, 6));
            }
        }

        // Map the status if we found it
        if ($result && $result['status'] !== null) {
            $result['mapped_status'] = $this->mapExtensionStatus($result['status']);
        }

        return $result;
    }

    private function parseSipShowPeerResponse(string $response, string $extension): ?array
    {
        $lines = explode("\r\n", $response);
        $foundResponse = false;
        $result = null;

        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line)) continue;

            // Look for Response: Success (synchronous response)
            if (strpos($line, 'Response: Success') !== false) {
                $foundResponse = true;
                $result = [
                    'extension' => null,
                    'status' => null,
                    'dynamic' => null,
                    'forcerport' => null,
                    'comedia' => null,
                    'videosupport' => null,
                    'acl' => null,
                    'directmedia' => null,
                    'mapped_status' => null,
                ];
                continue;
            }

            if (!$foundResponse) continue;

            // Parse all SIP peer fields (Response format uses different field names)
            if (strpos($line, 'ObjectName: ') !== false) {
                $result['extension'] = trim(substr($line, 12));
            } elseif (strpos($line, 'Status: ') !== false) {
                $result['status'] = trim(substr($line, 8));
            } elseif (strpos($line, 'Dynamic: ') !== false) {
                $result['dynamic'] = trim(substr($line, 9));
            } elseif (strpos($line, 'SIP-Forcerport: ') !== false) {
                $result['forcerport'] = trim(substr($line, 17));
            } elseif (strpos($line, 'SIP-Comedia: ') !== false) {
                $result['comedia'] = trim(substr($line, 14));
            } elseif (strpos($line, 'SIP-VideoSupport: ') !== false) {
                $result['videosupport'] = trim(substr($line, 19));
            } elseif (strpos($line, 'ACL: ') !== false) {
                $result['acl'] = trim(substr($line, 5));
            } elseif (strpos($line, 'SIP-DirectMedia: ') !== false) {
                $result['directmedia'] = trim(substr($line, 17));
            }
        }

        // Map the SIP status if we found it
        if ($result && $result['status'] !== null) {
            $result['mapped_status'] = $this->mapSipStatus($result['status']);
        }

        return $result;
    }

    private function mapSipStatus(string $sipStatus): string
    {
        // Map SIP status to our standard status
        if (strpos($sipStatus, 'OK') !== false) {
            return 'online';
        } elseif (strpos($sipStatus, 'UNREACHABLE') !== false || strpos($sipStatus, 'UNKNOWN') !== false) {
            return 'offline';
        } elseif (strpos($sipStatus, 'LAGGED') !== false) {
            return 'unknown';
        }

        return 'unknown';
    }

    private function mapExtensionStatus(string $asteriskStatus): string
    {
        $numericStatusMap = [
            '0' => 'online',    // NotInUse
            '1' => 'online',    // InUse
            '2' => 'online',    // Busy
            '4' => 'offline',   // Unavailable
            '8' => 'online',    // Ringing
            '16' => 'online',   // Ringinuse
            '-1' => 'unknown',  // Unknown
        ];

        return $numericStatusMap[$asteriskStatus] ?? 'unknown';
    }
}
