<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class ExtensionList extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'app:extension-list
                            {--format=table : Output format (table, json, csv)}
                            {--status : Include extension status information}
                            {--raw : Show raw AMI responses}
                            {--context=* : Filter by specific contexts}
                            {--all : Show all extensions (not just registered ones)}
                            {--numeric-only : Show only numeric extensions (1001, 1002, etc.)}
                            {--states-only : Show extension states directly (bypasses SIP peers)}';

    /**
     * The console command description.
     */
    protected $description = 'List all SIP registered extensions from Asterisk AMI';

    private $host;
    private $port;
    private $username;
    private $password;

    public function __construct()
    {
        parent::__construct();

        // Get AMI credentials from environment
        $this->host = env('AMI_HOST');
        $this->port = env('AMI_PORT');
        $this->username = env('AMI_USERNAME');
        $this->password = env('AMI_PASSWORD');
    }

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('📋 Retrieving extension list from Asterisk AMI...');
        $this->line("🔗 Connecting to: {$this->host}:{$this->port}");

        try {
            $socket = fsockopen($this->host, $this->port, $errno, $errstr, 10);

            if (!$socket) {
                $this->error("❌ Failed to connect to AMI: $errstr ($errno)");
                return 1;
            }

            // Login to AMI
            if (!$this->login($socket)) {
                $this->error("❌ Failed to login to AMI");
                fclose($socket);
                return 1;
            }

            $this->line("✅ Connected to Asterisk AMI");

            // Get extensions using multiple methods
            $extensions = $this->getAllExtensions($socket);

            fclose($socket);

            if (empty($extensions)) {
                $this->warn("⚠️ No extensions found in Asterisk");
                return 0;
            }

            // Display results based on format option
            $this->displayExtensions($extensions);

            return 0;

        } catch (\Exception $e) {
            $this->error("❌ Error: " . $e->getMessage());
            Log::error("ExtensionList command error: " . $e->getMessage());
            return 1;
        }
    }

    private function login($socket): bool
    {
        $loginCmd = "Action: Login\r\n"
                 . "Username: {$this->username}\r\n"
                 . "Secret: {$this->password}\r\n\r\n";

        fwrite($socket, $loginCmd);
        $response = $this->readResponse($socket);

        $success = strpos($response, 'Response: Success') !== false;

        if ($this->option('raw')) {
            $this->line("📥 Login response:");
            $this->line($response);
            $this->line("------------------------");
        }

        return $success;
    }

    private function getAllExtensions($socket): array
    {
        $extensions = [];

        // If --states-only is specified, get extension states directly
        if ($this->option('states-only')) {
            return $this->getExtensionStatesOnly($socket);
        }

        // Method 1: Get SIP peers
        $this->line("🔍 Retrieving SIP peers...");
        $sipExtensions = $this->getSIPPeers($socket);
        $extensions = array_merge($extensions, $sipExtensions);

        // Filter extensions based on options
        if ($this->option('numeric-only')) {
            // Filter to show only numeric extensions (1001, 1002, 2001, etc.)
            $extensions = $this->filterNumericExtensions($extensions);
        } elseif (!$this->option('all')) {
            // Default: Show only registered extensions (SIP status OK)
            $extensions = $this->filterRegisteredExtensions($extensions);
        }
        // If --all is specified, show all extensions without filtering

        // Method 2: Get extension states if status option is enabled
        if ($this->option('status')) {
            $this->line("🔍 Retrieving extension states...");
            $extensions = $this->enrichWithExtensionStates($socket, $extensions);
        }

        // Filter by contexts if specified
        $contexts = $this->option('context');
        if (!empty($contexts)) {
            $extensions = array_filter($extensions, function($ext) use ($contexts) {
                return in_array($ext['context'] ?? '', $contexts);
            });
        }

        return $extensions;
    }

    /**
     * Get extension states directly (bypassing SIP peers)
     */
    private function getExtensionStatesOnly($socket): array
    {
        $this->line("🚀 Getting extension states directly from ExtensionStateList...");
        $allStates = [];

        // Get from multiple contexts
        $contexts = $this->option('context');
        if (empty($contexts)) {
            $contexts = ['ext-local', 'from-internal', 'default'];
        }

        foreach ($contexts as $context) {
            $contextStates = $this->getExtensionStateList($socket, $context);
            foreach ($contextStates as $ext => $state) {
                $allStates[] = [
                    'type' => 'Extension',
                    'extension' => $ext,
                    'status' => 'Extension State',
                    'ip_address' => 'N/A',
                    'port' => 'N/A',
                    'dynamic' => 'N/A',
                    'extension_status' => $state['status'],
                    'extension_status_text' => $state['status_text'],
                    'hint' => $state['hint'],
                    'context' => $state['context'] ?? $context,
                ];
            }
        }

        // Apply filtering
        if ($this->option('numeric-only')) {
            $allStates = $this->filterNumericExtensions($allStates);
        }

        return $allStates;
    }

    /**
     * Filter to show only numeric extensions (1001, 1002, 2001, etc.)
     */
    private function filterNumericExtensions(array $extensions): array
    {
        return array_filter($extensions, function($extension) {
            $extNumber = $extension['extension'] ?? '';

            // Check if extension is purely numeric and typically 3-5 digits
            if (preg_match('/^\d{3,5}$/', $extNumber)) {
                return true;
            }

            return false;
        });
    }

    /**
     * Filter to show only registered SIP extensions (status contains OK)
     */
    private function filterRegisteredExtensions(array $extensions): array
    {
        return array_filter($extensions, function($extension) {
            $status = $extension['status'] ?? '';

            // Check if extension is registered (status contains 'OK')
            return strpos($status, 'OK') !== false;
        });
    }

    private function getSIPPeers($socket): array
    {
        $command = "Action: SIPpeers\r\n\r\n";
        fwrite($socket, $command);
        $response = $this->readCompleteResponse($socket, 'Event: PeerlistComplete');

        if ($this->option('raw')) {
            $this->line("📥 SIPpeers response:");
            $this->line($response);
            $this->line("------------------------");
        }

        return $this->parseSIPPeersResponse($response);
    }

    private function enrichWithExtensionStates($socket, array $extensions): array
    {
        // Try ExtensionStateList for multiple contexts
        $this->line("🚀 Using ExtensionStateList for bulk status retrieval...");
        $allStates = [];

        // Try multiple contexts
        $contexts = ['ext-local', 'from-internal', 'default'];
        foreach ($contexts as $context) {
            $contextStates = $this->getExtensionStateList($socket, $context);
            $allStates = array_merge($allStates, $contextStates);
        }

        if (!empty($allStates)) {
            $this->line("📊 Total extensions found: " . count($allStates));

            // Merge bulk states with extensions
            foreach ($extensions as &$extension) {
                $extNum = $extension['extension'] ?? '';
                if (isset($allStates[$extNum])) {
                    $extension['extension_status'] = $allStates[$extNum]['status'];
                    $extension['extension_status_text'] = $allStates[$extNum]['status_text'];
                    $extension['hint'] = $allStates[$extNum]['hint'];
                    $extension['context'] = $allStates[$extNum]['context'] ?? 'ext-local';
                }
            }
            return $extensions;
        }

        // Fallback to individual queries if ExtensionStateList doesn't work
        $this->line("🔍 Fallback: Using individual ExtensionState queries...");

        foreach ($extensions as &$extension) {
            if (!isset($extension['extension'])) continue;

            $extNum = $extension['extension'];

            // Try different contexts to get extension state
            foreach ($contexts as $context) {
                $state = $this->getExtensionState($socket, $extNum, $context);
                if ($state !== null) {
                    $extension['extension_status'] = $state['status'];
                    $extension['extension_status_text'] = $state['status_text'];
                    $extension['hint'] = $state['hint'];
                    $extension['context'] = $context;
                    break;
                }
            }
        }

        return $extensions;
    }

    private function getExtensionState($socket, string $extension, string $context): ?array
    {
        $actionId = 'ext_list_' . $extension . '_' . $context . '_' . time() . '_' . rand(1000, 9999);
        $command = "Action: ExtensionState\r\n"
                 . "Exten: {$extension}\r\n"
                 . "Context: {$context}\r\n"
                 . "ActionID: {$actionId}\r\n\r\n";

        fwrite($socket, $command);
        $response = $this->readResponseForActionId($socket, $actionId);

        return $this->parseExtensionStateResponse($response, $extension, $actionId);
    }

    /**
     * Get all extension states using ExtensionStateList action (more efficient)
     */
    private function getExtensionStateList($socket, string $context): array
    {
        $actionId = 'ext_state_list_' . $context . '_' . time() . '_' . rand(1000, 9999);
        $command = "Action: ExtensionStateList\r\n"
                 . "Context: {$context}\r\n"
                 . "ActionID: {$actionId}\r\n\r\n";

        if ($this->option('raw')) {
            $this->line("📤 Sending ExtensionStateList command:");
            $this->line("   Context: {$context}");
            $this->line("   ActionID: {$actionId}");
        }

        fwrite($socket, $command);
        $response = $this->readCompleteResponse($socket, 'Event: ExtensionStateListComplete');

        if ($this->option('raw')) {
            $this->line("📥 ExtensionStateList response:");
            $this->line("------------------------");
            $this->line($response);
            $this->line("------------------------");
        }

        return $this->parseExtensionStateListResponse($response, $actionId);
    }

    private function readResponse($socket): string
    {
        $response = '';
        $timeout = time() + 10;

        while (!feof($socket) && time() < $timeout) {
            $buffer = fgets($socket);
            if ($buffer === false) {
                break;
            }
            $response .= $buffer;

            if (strpos($response, "\r\n\r\n") !== false) {
                break;
            }
        }

        return $response;
    }

    private function readCompleteResponse($socket, string $completionEvent): string
    {
        $response = '';
        $timeout = time() + 30; // Longer timeout for complete responses

        while (!feof($socket) && time() < $timeout) {
            $buffer = fgets($socket);
            if ($buffer === false) {
                usleep(50000); // 50ms wait
                continue;
            }

            $response .= $buffer;

            // Check for completion event
            if (strpos($response, $completionEvent) !== false) {
                // Read a bit more to ensure we get the complete response
                $additionalTimeout = time() + 2;
                while (!feof($socket) && time() < $additionalTimeout) {
                    $additionalBuffer = fgets($socket);
                    if ($additionalBuffer === false || trim($additionalBuffer) === '') {
                        break;
                    }
                    $response .= $additionalBuffer;
                }
                break;
            }
        }

        return $response;
    }

    private function readResponseForActionId($socket, string $actionId): string
    {
        $response = '';
        $timeout = time() + 15;

        while (!feof($socket) && time() < $timeout) {
            $buffer = fgets($socket);
            if ($buffer === false) {
                usleep(50000);
                continue;
            }

            $response .= $buffer;

            // Check if we have our ActionID in the response
            if (strpos($response, "ActionID: {$actionId}") !== false) {
                // Continue reading until we get the complete response
                $additionalTimeout = time() + 3;
                while (!feof($socket) && time() < $additionalTimeout) {
                    $additionalBuffer = fgets($socket);
                    if ($additionalBuffer === false) {
                        break;
                    }
                    $response .= $additionalBuffer;

                    if (strpos($additionalBuffer, "\r\n") !== false && trim($additionalBuffer) === '') {
                        break;
                    }
                }
                break;
            }
        }

        return $response;
    }

    private function parseSIPPeersResponse(string $response): array
    {
        $lines = explode("\r\n", $response);
        $extensions = [];
        $currentPeer = null;

        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line)) continue;

            if (strpos($line, 'Event: PeerEntry') !== false) {
                if ($currentPeer) {
                    $extensions[] = $currentPeer;
                }
                $currentPeer = [
                    'type' => 'SIP',
                    'extension' => null,
                    'status' => null,
                    'ip_address' => null,
                    'port' => null,
                    'dynamic' => null,
                    'nat' => null,
                    'acl' => null,
                    'videosupport' => null,
                ];
                continue;
            }

            if (!$currentPeer) continue;

            // Parse peer fields
            if (strpos($line, 'ObjectName: ') !== false) {
                $currentPeer['extension'] = trim(substr($line, 12));
            } elseif (strpos($line, 'Status: ') !== false) {
                $currentPeer['status'] = trim(substr($line, 8));
            } elseif (strpos($line, 'IPaddress: ') !== false) {
                $currentPeer['ip_address'] = trim(substr($line, 11));
            } elseif (strpos($line, 'IPport: ') !== false) {
                $currentPeer['port'] = trim(substr($line, 8));
            } elseif (strpos($line, 'Dynamic: ') !== false) {
                $currentPeer['dynamic'] = trim(substr($line, 9));
            } elseif (strpos($line, 'AutoForcerport: ') !== false) {
                $currentPeer['nat'] = trim(substr($line, 16));
            } elseif (strpos($line, 'ACL: ') !== false) {
                $currentPeer['acl'] = trim(substr($line, 5));
            } elseif (strpos($line, 'VideoSupport: ') !== false) {
                $currentPeer['videosupport'] = trim(substr($line, 14));
            }
        }

        // Add the last peer if exists
        if ($currentPeer) {
            $extensions[] = $currentPeer;
        }

        return $extensions;
    }

    private function parseExtensionStateResponse(string $response, string $extension, string $actionId): ?array
    {
        $lines = explode("\r\n", $response);
        $foundResponse = false;
        $result = null;

        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line)) continue;

            if (strpos($line, 'Response: Success') !== false ||
                strpos($line, 'Event: ExtensionStatus') !== false) {
                $foundResponse = true;
                $result = [
                    'status' => null,
                    'status_text' => null,
                    'hint' => null,
                ];
                continue;
            }

            if (!$foundResponse) continue;

            if (strpos($line, 'Status: ') !== false) {
                $result['status'] = trim(substr($line, 8));
            } elseif (strpos($line, 'StatusText: ') !== false) {
                $result['status_text'] = trim(substr($line, 12));
            } elseif (strpos($line, 'Hint: ') !== false) {
                $result['hint'] = trim(substr($line, 6));
            }
        }

        return $result;
    }

    /**
     * Parse ExtensionStateList response to get all extension states
     */
    private function parseExtensionStateListResponse(string $response, string $actionId): array
    {
        $lines = explode("\r\n", $response);
        $extensions = [];
        $currentExtension = null;
        $foundActionId = false;

        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line)) continue;

            // Check for our ActionID
            if (strpos($line, "ActionID: {$actionId}") !== false) {
                $foundActionId = true;
                continue;
            }

            // Look for ExtensionStatus events
            if (strpos($line, 'Event: ExtensionStatus') !== false) {
                if ($currentExtension && isset($currentExtension['extension'])) {
                    $extensions[$currentExtension['extension']] = $currentExtension;
                }
                $currentExtension = [
                    'extension' => null,
                    'status' => null,
                    'status_text' => null,
                    'hint' => null,
                    'context' => null,
                ];
                continue;
            }

            if (!$currentExtension) continue;

            // Parse extension fields
            if (strpos($line, 'Exten: ') !== false) {
                $currentExtension['extension'] = trim(substr($line, 7));
            } elseif (strpos($line, 'Context: ') !== false) {
                $currentExtension['context'] = trim(substr($line, 9));
            } elseif (strpos($line, 'Status: ') !== false) {
                $currentExtension['status'] = trim(substr($line, 8));
            } elseif (strpos($line, 'StatusText: ') !== false) {
                $currentExtension['status_text'] = trim(substr($line, 12));
            } elseif (strpos($line, 'Hint: ') !== false) {
                $currentExtension['hint'] = trim(substr($line, 6));
            }
        }

        // Add the last extension if exists
        if ($currentExtension && isset($currentExtension['extension'])) {
            $extensions[$currentExtension['extension']] = $currentExtension;
        }

        if ($this->option('raw') && !empty($extensions)) {
            $this->line("📊 Found " . count($extensions) . " extensions via ExtensionStateList");
        }

        return $extensions;
    }

    private function displayExtensions(array $extensions): void
    {
        $format = $this->option('format');
        $includeStatus = $this->option('status');

        switch ($format) {
            case 'json':
                $this->displayAsJson($extensions);
                break;
            case 'csv':
                $this->displayAsCsv($extensions);
                break;
            case 'table':
            default:
                $this->displayAsTable($extensions, $includeStatus);
                break;
        }

        $this->displaySummary($extensions);
    }

    private function displayAsTable(array $extensions, bool $includeStatus): void
    {
        if ($includeStatus) {
            $headers = ['Extension', 'Type', 'Status', 'IP Address', 'Port', 'Dynamic', 'Ext Status', 'Status Text', 'Context'];
            $rows = array_map(function($ext) {
                return [
                    $ext['extension'] ?? 'N/A',
                    $ext['type'] ?? 'N/A',
                    $this->formatSipStatus($ext['status'] ?? 'N/A'),
                    $ext['ip_address'] ?? 'N/A',
                    $ext['port'] ?? 'N/A',
                    $ext['dynamic'] ?? 'N/A',
                    $this->formatExtensionStatus($ext['extension_status'] ?? null),
                    $ext['extension_status_text'] ?? 'N/A',
                    $ext['context'] ?? 'N/A',
                ];
            }, $extensions);
        } else {
            $headers = ['Extension', 'Type', 'Status', 'IP Address', 'Port', 'Dynamic'];
            $rows = array_map(function($ext) {
                return [
                    $ext['extension'] ?? 'N/A',
                    $ext['type'] ?? 'N/A',
                    $this->formatSipStatus($ext['status'] ?? 'N/A'),
                    $ext['ip_address'] ?? 'N/A',
                    $ext['port'] ?? 'N/A',
                    $ext['dynamic'] ?? 'N/A',
                ];
            }, $extensions);
        }

        $this->line("\n📋 Extensions from Asterisk:");
        $this->table($headers, $rows);
    }

    private function displayAsJson(array $extensions): void
    {
        $this->line(json_encode($extensions, JSON_PRETTY_PRINT));
    }

    private function displayAsCsv(array $extensions): void
    {
        $includeStatus = $this->option('status');

        if ($includeStatus) {
            $this->line('Extension,Type,Status,IP Address,Port,Dynamic,Extension Status,Status Text,Context');
            foreach ($extensions as $ext) {
                $this->line(sprintf(
                    '%s,%s,%s,%s,%s,%s,%s,%s,%s',
                    $ext['extension'] ?? '',
                    $ext['type'] ?? '',
                    $ext['status'] ?? '',
                    $ext['ip_address'] ?? '',
                    $ext['port'] ?? '',
                    $ext['dynamic'] ?? '',
                    $ext['extension_status'] ?? '',
                    $ext['extension_status_text'] ?? '',
                    $ext['context'] ?? ''
                ));
            }
        } else {
            $this->line('Extension,Type,Status,IP Address,Port,Dynamic');
            foreach ($extensions as $ext) {
                $this->line(sprintf(
                    '%s,%s,%s,%s,%s,%s',
                    $ext['extension'] ?? '',
                    $ext['type'] ?? '',
                    $ext['status'] ?? '',
                    $ext['ip_address'] ?? '',
                    $ext['port'] ?? '',
                    $ext['dynamic'] ?? ''
                ));
            }
        }
    }

    private function displaySummary(array $extensions): void
    {
        $total = count($extensions);
        $online = count(array_filter($extensions, function($ext) {
            return strpos($ext['status'] ?? '', 'OK') !== false;
        }));
        $offline = $total - $online;

        $this->line("\n📊 Summary:");
        $this->line("  📱 Total extensions: {$total}");
        $this->line("  ✅ Online: {$online}");
        $this->line("  ❌ Offline: {$offline}");

        if ($this->option('status')) {
            $withExtensionStatus = count(array_filter($extensions, function($ext) {
                return isset($ext['extension_status']);
            }));
            $this->line("  🔍 With extension status: {$withExtensionStatus}");
        }

        // Show verification statistics if status checking was performed
    }

    private function formatSipStatus(string $status): string
    {
        if (strpos($status, 'OK') !== false) {
            return "✅ {$status}";
        } elseif (strpos($status, 'UNREACHABLE') !== false) {
            return "❌ {$status}";
        } elseif (strpos($status, 'UNKNOWN') !== false) {
            return "⚠️ {$status}";
        }
        return $status;
    }

    private function formatExtensionStatus(?string $status): string
    {
        if ($status === null) return 'N/A';

        switch ($status) {
            case '0':
                return '🟢 Idle';
            case '1':
                return '🔵 InUse';
            case '2':
                return '🟡 Busy';
            case '4':
                return '🔴 Unavailable';
            case '8':
                return '🟣 Ringing';
            default:
                return $status;
        }
    }
}
