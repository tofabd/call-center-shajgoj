<?php

namespace App\Services;

use App\Models\Extension;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;

class ExtensionService
{
    private $host;
    private $port;
    private $username;
    private $password;

    public function __construct()
    {
        $this->host = env('AMI_HOST', '103.177.125.83');
        $this->port = env('AMI_PORT', 5038);
        $this->username = env('AMI_USERNAME', 'admin');
        $this->password = env('AMI_PASSWORD', 'Tractor@0152');
    }

    /**
     * Get all registered extensions from Asterisk AMI
     */
    public function getRegisteredExtensions(): array
    {
        try {
            $socket = fsockopen($this->host, $this->port, $errno, $errstr, 10);

            if (!$socket) {
                Log::error("Failed to connect to AMI: $errstr ($errno)");
                return [];
            }

            // Login to AMI
            $this->login($socket);

            // Send SIPshowregistry command to get registered extensions
            $command = "Action: SIPshowregistry\r\n\r\n";
            fwrite($socket, $command);

            $response = $this->readResponse($socket);
            fclose($socket);

            return $this->parseSIPRegistryResponse($response);

        } catch (\Exception $e) {
            Log::error("Error getting registered extensions: " . $e->getMessage());
            return [];
        }
    }

    /**
     * Get ALL SIP extensions from Asterisk AMI (including unregistered, rejected, etc.)
     */
    public function getAllSipExtensions(): array
    {
        try {
            $socket = fsockopen($this->host, $this->port, $errno, $errstr, 10);

            if (!$socket) {
                Log::error("Failed to connect to AMI: $errstr ($errno)");
                return [];
            }

            // Login to AMI
            if (!$this->login($socket)) {
                Log::error("Failed to login to AMI");
                fclose($socket);
                return [];
            }

            $allExtensions = [];

            // 1. Try SIPpeers command first (most comprehensive)
            Log::info("Getting SIP peers using SIPpeers...");
            $sipPeers = $this->getSIPPeers($socket);
            Log::info("SIPpeers found: " . count($sipPeers) . " extensions");
            $allExtensions = array_merge($allExtensions, $sipPeers);

            // 2. Try alternative command if SIPpeers didn't work
            if (count($sipPeers) === 0) {
                Log::info("SIPpeers returned no results, trying SIPshowpeer...");
                $sipShowPeer = $this->getSIPShowPeer($socket);
                Log::info("SIPshowpeer found: " . count($sipShowPeer) . " extensions");
                $allExtensions = array_merge($allExtensions, $sipShowPeer);
            }

            // 3. Get SIP registry (currently registered extensions)
            Log::info("Getting SIP registry...");
            $sipRegistry = $this->getSIPRegistry($socket);
            Log::info("SIP registry found: " . count($sipRegistry) . " extensions");

            // Merge registry info with peers info
            $allExtensions = $this->mergeExtensionInfo($allExtensions, $sipRegistry);

            // 4. Get SIP status using SIPshowstatus command
            Log::info("Getting SIP status...");
            $sipStatus = $this->getSIPStatus($socket);
            Log::info("SIP status found: " . count($sipStatus) . " extensions");

            // Merge status info
            $allExtensions = $this->mergeExtensionInfo($allExtensions, $sipStatus);

            // 5. Try CLI command as fallback
            if (count($allExtensions) === 0) {
                Log::info("No extensions found via AMI, trying CLI command...");
                $cliExtensions = $this->getCLIExtensions($socket);
                Log::info("CLI command found: " . count($cliExtensions) . " extensions");
                $allExtensions = array_merge($allExtensions, $cliExtensions);
            }

            Log::info("Final merged extensions count: " . count($allExtensions));
            Log::debug("Final merged extensions", ['count' => count($allExtensions), 'extensions' => $allExtensions]);

            fclose($socket);

            return $allExtensions;

        } catch (\Exception $e) {
            Log::error("Error getting all SIP extensions: " . $e->getMessage());
            Log::error("Stack trace: " . $e->getTraceAsString());
            return [];
        }
    }

    /**
     * Get comprehensive SIP extension information
     */
    public function getComprehensiveSipExtensions(): array
    {
        try {
            $socket = fsockopen($this->host, $this->port, $errno, $errstr, 10);

            if (!$socket) {
                Log::error("Failed to connect to AMI: $errstr ($errno)");
                return [];
            }

            // Login to AMI
            if (!$this->login($socket)) {
                Log::error("Failed to login to AMI");
                fclose($socket);
                return [];
            }

            $allExtensions = [];

            // 1. Get all SIP peers with detailed information
            $command = "Action: SIPshowpeer\r\n\r\n";
            fwrite($socket, $command);
            $response = $this->readResponse($socket);
            $sipPeers = $this->parseDetailedSIPPeersResponse($response);
            $allExtensions = $sipPeers;

            // 2. Get current registration status
            $command = "Action: SIPshowregistry\r\n\r\n";
            fwrite($socket, $command);
            $response = $this->readResponse($socket);
            $sipRegistry = $this->parseSIPRegistryResponse($response);

            // Merge registry info
            $allExtensions = $this->mergeExtensionInfo($allExtensions, $sipRegistry);

            // 3. Get current SIP status
            $command = "Action: SIPshowstatus\r\n\r\n";
            fwrite($socket, $command);
            $response = $this->readResponse($socket);
            $sipStatus = $this->parseSIPStatusResponse($response);

            // Merge status info
            $allExtensions = $this->mergeExtensionInfo($allExtensions, $sipStatus);

            fclose($socket);

            return $allExtensions;

        } catch (\Exception $e) {
            Log::error("Error getting comprehensive SIP extensions: " . $e->getMessage());
            return [];
        }
    }

    /**
     * Debug method to get raw AMI responses
     */
    public function debugAmiResponses(): array
    {
        try {
            $socket = fsockopen($this->host, $this->port, $errno, $errstr, 10);

            if (!$socket) {
                Log::error("Failed to connect to AMI: $errstr ($errno)");
                return [];
            }

            // Login to AMI
            if (!$this->login($socket)) {
                Log::error("Failed to login to AMI");
                fclose($socket);
                return [];
            }

            $responses = [];

            // Test different AMI commands
            $commands = [
                'SIPpeers' => "Action: SIPpeers\r\n\r\n",
                'SIPshowregistry' => "Action: SIPshowregistry\r\n\r\n",
                'SIPshowpeer' => "Action: SIPshowpeer\r\n\r\n",
                'SIPshowstatus' => "Action: SIPshowstatus\r\n\r\n",
                'CoreStatus' => "Action: CoreStatus\r\n\r\n",
                'Command' => "Action: Command\r\nCommand: sip show peers\r\n\r\n"
            ];

            foreach ($commands as $name => $command) {
                Log::info("Testing AMI command: {$name}");
                fwrite($socket, $command);
                $response = $this->readResponse($socket);
                $responses[$name] = $response;

                // Log the response for debugging
                Log::debug("AMI command {$name} response", [
                    'command' => $name,
                    'response' => $response,
                    'response_length' => strlen($response)
                ]);
            }

            fclose($socket);

            return $responses;

        } catch (\Exception $e) {
            Log::error("Error debugging AMI responses: " . $e->getMessage());
            return [];
        }
    }

    /**
     * Sync extensions from Asterisk with local database
     */
    public function syncExtensions(): array
    {
        $amiExtensions = $this->getRegisteredExtensions();
        $synced = [];

        foreach ($amiExtensions as $amiExt) {
            $extension = Extension::firstOrNew(['extension' => $amiExt['extension']]);

            if (!$extension->exists) {
                $extension->agent_name = $amiExt['agent_name'] ?? null;
                $extension->status = $amiExt['status'] ?? 'unknown';
                $extension->last_seen = now();
                $extension->save();
                $synced[] = $extension;
            } else {
                // Update existing extension status
                $extension->updateStatus($amiExt['status'] ?? 'unknown');
                $synced[] = $extension;
            }
        }

        // Mark extensions not in AMI as offline
        $this->markOfflineExtensions($amiExtensions);

        return $synced;
    }

    /**
     * Update extension status
     */
    public function updateExtensionStatus(string $extension, string $status): bool
    {
        try {
            $ext = Extension::where('extension', $extension)->first();

            if (!$ext) {
                Log::warning("Extension not found for status update", [
                    'extension' => $extension,
                    'status' => $status
                ]);
                return false;
            }

            $oldStatus = $ext->status;
            $result = $ext->updateStatus($status);

            Log::info("Extension status update attempt", [
                'extension' => $extension,
                'old_status' => $oldStatus,
                'new_status' => $status,
                'result' => $result
            ]);

            // Broadcast status update if status actually changed
            if ($result && $oldStatus !== $status) {
                $ext->refresh(); // Refresh to get updated timestamps

                try {
                    broadcast(new \App\Events\ExtensionStatusUpdated($ext));
                    Log::info("Extension status broadcasted successfully", [
                        'extension' => $extension,
                        'status' => $status
                    ]);
                } catch (\Exception $e) {
                    Log::error("Failed to broadcast extension status update", [
                        'extension' => $extension,
                        'error' => $e->getMessage()
                    ]);
                }
            }

            return $result;
        } catch (\Exception $e) {
            Log::error("Error updating extension status", [
                'extension' => $extension,
                'status' => $status,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return false;
        }
    }

    /**
     * Get extension statistics
     */
    public function getExtensionStats(): array
    {
        $onlineCount = Extension::getOnlineCount();
        $totalCount = Extension::getTotalCount();

        // Get today's call statistics
        $todayCalls = \App\Models\Call::whereDate('started_at', today())->count();

        // Get average call duration for today
        $avgDuration = \App\Models\Call::whereDate('started_at', today())
            ->whereNotNull('answered_at')
            ->whereNotNull('ended_at')
            ->avg('talk_seconds') ?? 0;

        // Get success rate (answered calls vs total calls)
        $answeredCalls = \App\Models\Call::whereDate('started_at', today())
            ->whereNotNull('answered_at')
            ->count();

        $successRate = $totalCount > 0 ? round(($answeredCalls / $todayCalls) * 100, 1) : 0;

        return [
            'online_agents' => $onlineCount,
            'total_calls_today' => $todayCalls,
            'avg_call_duration' => $this->formatDuration($avgDuration),
            'success_rate' => $successRate,
            'total_extensions' => $totalCount,
        ];
    }

    /**
     * Get top performing agents
     */
    public function getTopPerformingAgents(int $limit = 5): array
    {
        return \App\Models\Call::whereDate('started_at', today())
            ->whereNotNull('agent_exten')
            ->whereNotNull('answered_at')
            ->selectRaw('
                agent_exten,
                COUNT(*) as call_count,
                AVG(talk_seconds) as avg_duration,
                COUNT(CASE WHEN talk_seconds > 0 THEN 1 END) as answered_calls,
                COUNT(*) as total_calls
            ')
            ->groupBy('agent_exten')
            ->orderBy('call_count', 'desc')
            ->limit($limit)
            ->get()
            ->map(function ($call) {
                $extension = Extension::where('extension', $call->agent_exten)->first();
                $successRate = $call->total_calls > 0 ?
                    round(($call->answered_calls / $call->total_calls) * 100, 1) : 0;

                return [
                    'name' => $extension ? ($extension->agent_name ?: "Agent {$call->agent_exten}") : "Agent {$call->agent_exten}",
                    'extension' => $call->agent_exten,
                    'calls' => $call->call_count,
                    'duration' => $this->formatDuration($call->avg_duration),
                    'success' => $successRate . '%'
                ];
            })
            ->toArray();
    }

    /**
     * Get status of a specific extension via Asterisk AMI using ExtensionState action
     * This uses the same approach as the successful CLI test
     */
    public function getExtensionStatus(string $extension): ?string
    {
        try {
            $socket = fsockopen($this->host, $this->port, $errno, $errstr, 10);

            if (!$socket) {
                Log::error("Failed to connect to AMI: $errstr ($errno)");
                return null;
            }

            // Login to AMI
            if (!$this->login($socket)) {
                Log::error("Failed to login to AMI");
                fclose($socket);
                return null;
            }

            // Use ExtensionState action exactly like the successful CLI test
            $actionId = 'ext_status_' . $extension . '_' . time();
            $command = "Action: ExtensionState\r\n"
                     . "Exten: {$extension}\r\n"
                     . "Context: ext-local\r\n"
                     . "ActionID: {$actionId}\r\n\r\n";

            Log::info("Sending ExtensionState command", [
                'extension' => $extension,
                'command' => $command,
                'action_id' => $actionId
            ]);

            fwrite($socket, $command);
            $response = $this->readResponseForActionId($socket, $actionId);

            Log::info("ExtensionState response received", [
                'extension' => $extension,
                'response' => $response
            ]);

            // Parse the ExtensionStatus event response
            $status = $this->parseExtensionStateResponse($response, $extension, $actionId);

            // If ExtensionState didn't work, fallback to SIPshowpeer method
            if ($status === null) {
                Log::info("ExtensionState failed, trying SIPshowpeer fallback", ['extension' => $extension]);
                $command = "Action: SIPshowpeer\r\nPeer: {$extension}\r\n\r\n";
                fwrite($socket, $command);
                $response = $this->readResponse($socket);
                $status = $this->parseSinglePeerStatus($response, $extension);
            }

            fclose($socket);

            Log::info("Final extension status result", [
                'extension' => $extension,
                'status' => $status
            ]);

            return $status;

        } catch (\Exception $e) {
            Log::error("Error getting extension status: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Private helper methods
     */
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
        $timeout = time() + 10; // Increased timeout for longer responses
        $lastData = '';
        $eventBuffer = '';

        while (!feof($socket) && time() < $timeout) {
            $buffer = fgets($socket);
            if ($buffer === false) {
                break;
            }
            $response .= $buffer;
            $eventBuffer .= $buffer;
            $lastData = $buffer;

            // Check if we have a complete event/response
            if (strpos($eventBuffer, "\r\n\r\n") !== false) {
                // We got a complete event, check if it's what we want
                if (strpos($eventBuffer, 'Response: Success') !== false ||
                    strpos($eventBuffer, 'Event: ExtensionStatus') !== false) {
                    // This is the response we want
                    break;
                } else {
                    // This is some other event, continue reading
                    $eventBuffer = '';
                    continue;
                }
            }

            // Legacy check for end of response
            if (strpos($response, "\r\n\r\n") !== false &&
                (strpos($lastData, "\r\n") !== false && trim($lastData) === '')) {
                // Wait a bit more to ensure we get all data
                usleep(100000); // 100ms
                break;
            }
        }

        return $response;
    }

    /**
     * Read AMI response looking specifically for a matching ActionID
     */
    private function readResponseForActionId($socket, string $actionId): string
    {
        $allData = '';
        $timeout = time() + 15; // Longer timeout for ActionID responses
        $foundResponse = false;

        while (!feof($socket) && time() < $timeout && !$foundResponse) {
            $buffer = fgets($socket);
            if ($buffer === false) {
                usleep(50000); // 50ms wait
                continue;
            }

            $allData .= $buffer;

            // Check if we have our ActionID in the response
            if (strpos($allData, "ActionID: {$actionId}") !== false) {
                $foundResponse = true;
                // Continue reading until we get the complete response for this ActionID
                $additionalTimeout = time() + 5;
                while (!feof($socket) && time() < $additionalTimeout) {
                    $additionalBuffer = fgets($socket);
                    if ($additionalBuffer === false) {
                        break;
                    }
                    $allData .= $additionalBuffer;

                    // Check if we reached the end of this response
                    if (strpos($additionalBuffer, "\r\n") !== false && trim($additionalBuffer) === '') {
                        break;
                    }
                }
                break;
            }

            // If we have too much data without finding our ActionID, something's wrong
            if (strlen($allData) > 50000) { // 50KB limit
                Log::warning("Large response without ActionID, truncating", [
                    'action_id' => $actionId,
                    'data_length' => strlen($allData)
                ]);
                break;
            }
        }

        if (!$foundResponse) {
            Log::warning("ActionID not found in response", [
                'action_id' => $actionId,
                'response_length' => strlen($allData)
            ]);
        }

        return $allData;
    }

    private function parseSIPRegistryResponse(string $response): array
    {
        $extensions = [];
        $lines = explode("\r\n", $response);
        $currentExt = null;

        foreach ($lines as $line) {
            if (strpos($line, 'Event: RegistryEntry') !== false) {
                if ($currentExt) {
                    $extensions[] = $currentExt;
                }
                $currentExt = ['status' => 'online'];
            } elseif (strpos($line, 'Username: ') !== false) {
                $currentExt['extension'] = trim(substr($line, 10));
            } elseif (strpos($line, 'State: ') !== false) {
                $state = trim(substr($line, 7));
                $currentExt['status'] = $state === 'Registered' ? 'online' : 'offline';
            }
        }

        if ($currentExt) {
            $extensions[] = $currentExt;
        }

        return $extensions;
    }

    private function parseSIPPeersResponse(string $response): array
    {
        $peers = [];
        $lines = explode("\r\n", $response);
        $currentPeer = null;

        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line)) continue;

            if (strpos($line, 'Event: PeerEntry') !== false) {
                if ($currentPeer && isset($currentPeer['extension'])) {
                    $peers[] = $currentPeer;
                }
                $currentPeer = ['status' => 'unknown'];
            } elseif (strpos($line, 'ObjectName: ') !== false) {
                $currentPeer['extension'] = trim(substr($line, 12));
            } elseif (strpos($line, 'Status: ') !== false) {
                $status = trim(substr($line, 8));
                $currentPeer['status'] = $this->mapSIPStatus($status);
            } elseif (strpos($line, 'Channeltype: ') !== false) {
                $currentPeer['channel_type'] = trim(substr($line, 13));
            } elseif (strpos($line, 'ChanObjectType: ') !== false) {
                $currentPeer['object_type'] = trim(substr($line, 16));
            } elseif (strpos($line, 'IPaddress: ') !== false) {
                $currentPeer['ip_address'] = trim(substr($line, 11));
            } elseif (strpos($line, 'IPport: ') !== false) {
                $currentPeer['ip_port'] = trim(substr($line, 8));
            } elseif (strpos($line, 'Dynamic: ') !== false) {
                $currentPeer['dynamic'] = trim(substr($line, 9));
            } elseif (strpos($line, 'Description: ') !== false) {
                $currentPeer['description'] = trim(substr($line, 12));
            }
        }

        // Don't forget the last peer
        if ($currentPeer && isset($currentPeer['extension'])) {
            $peers[] = $currentPeer;
        }

        Log::debug("Parsed SIP peers response", [
            'total_lines' => count($lines),
            'peers_found' => count($peers),
            'response_preview' => substr($response, 0, 200) . '...'
        ]);

        return $peers;
    }

    private function parseSIPStatusResponse(string $response): array
    {
        $status = [];
        $lines = explode("\r\n", $response);
        $currentExt = null;

        foreach ($lines as $line) {
            if (strpos($line, 'Event: Status') !== false) {
                if ($currentExt) {
                    $status[] = $currentExt;
                }
                $currentExt = ['status' => 'online'];
            } elseif (strpos($line, 'Username: ') !== false) {
                $currentExt['extension'] = trim(substr($line, 10));
            } elseif (strpos($line, 'State: ') !== false) {
                $state = trim(substr($line, 7));
                $currentExt['status'] = $state === 'Up' ? 'online' : 'offline';
            }
        }

        if ($currentExt) {
            $status[] = $currentExt;
        }

        return $status;
    }

    private function parseDetailedSIPPeersResponse(string $response): array
    {
        $peers = [];
        $lines = explode("\r\n", $response);
        $currentPeer = null;

        foreach ($lines as $line) {
            if (strpos($line, 'Event: PeerEntry') !== false) {
                if ($currentPeer) {
                    $peers[] = $currentPeer;
                }
                $currentPeer = ['status' => 'online'];
            } elseif (strpos($line, 'Peer: ') !== false) {
                $currentPeer['extension'] = trim(substr($line, 6));
            } elseif (strpos($line, 'State: ') !== false) {
                $state = trim(substr($line, 7));
                $currentPeer['status'] = $state === 'Up' ? 'online' : 'offline';
            }
        }

        if ($currentPeer) {
            $peers[] = $currentPeer;
        }

        return $peers;
    }

    private function parseCommandResponse(string $response): array
    {
        $extensions = [];
        $lines = explode("\r\n", $response);
        $inCommandOutput = false;
        $commandOutput = '';

        foreach ($lines as $line) {
            $line = trim($line);

            if (strpos($line, 'Output: ') !== false) {
                $inCommandOutput = true;
                $commandOutput .= substr($line, 8) . "\n";
            } elseif ($inCommandOutput && strpos($line, 'Event: ') !== false) {
                // End of command output
                $inCommandOutput = false;
                break;
            } elseif ($inCommandOutput) {
                $commandOutput .= $line . "\n";
            }
        }

        // Parse the command output
        if (!empty($commandOutput)) {
            $outputLines = explode("\n", trim($commandOutput));

            foreach ($outputLines as $line) {
                $line = trim($line);
                if (empty($line)) continue;

                // Parse lines like: "1001/1001    UNKNOWN    -none-:0    D"
                if (preg_match('/^(\d+)\/(\d+)\s+(\w+)\s+([^\s]+):(\d+)\s+(\w+)/', $line, $matches)) {
                    $extensions[] = [
                        'extension' => $matches[1],
                        'status' => $this->mapSIPStatus($matches[3]),
                        'ip_address' => $matches[4],
                        'ip_port' => $matches[5],
                        'dynamic' => $matches[6] === 'D' ? 'yes' : 'no'
                    ];
                }
                // Parse lines like: "1001/1001    UNKNOWN    -none-:0"
                elseif (preg_match('/^(\d+)\/(\d+)\s+(\w+)\s+([^\s]+):(\d+)/', $line, $matches)) {
                    $extensions[] = [
                        'extension' => $matches[1],
                        'status' => $this->mapSIPStatus($matches[3]),
                        'ip_address' => $matches[4],
                        'ip_port' => $matches[5]
                    ];
                }
            }
        }

        return $extensions;
    }

    private function mergeExtensionInfo(array $allExtensions, array $newInfo): array
    {
        foreach ($newInfo as $info) {
            $extensionNumber = $info['extension'];
            $found = false;

            foreach ($allExtensions as &$ext) {
                if ($ext['extension'] === $extensionNumber) {
                    $ext = array_merge($ext, $info);
                    $found = true;
                    break;
                }
            }

            if (!$found) {
                $allExtensions[] = $info;
            }
        }
        return $allExtensions;
    }

    private function markOfflineExtensions(array $amiExtensions): void
    {
        $amiExtensionNumbers = array_column($amiExtensions, 'extension');

        Extension::whereNotIn('extension', $amiExtensionNumbers)
            ->update(['status' => 'offline', 'last_seen' => now()]);
    }

    private function formatDuration(?float $seconds): string
    {
        if (!$seconds) return '0m 0s';

        $minutes = floor($seconds / 60);
        $remainingSeconds = $seconds % 60;

        return "{$minutes}m {$remainingSeconds}s";
    }

    /**
     * Map Asterisk SIP status to internal status
     */
    private function mapSIPStatus(string $asteriskStatus): string
    {
        return match(strtolower($asteriskStatus)) {
            'ok', 'up', 'registered' => 'online',
            'unreachable', 'down', 'unregistered' => 'offline',
            'rejected', 'failed' => 'rejected',
            'timeout' => 'timeout',
            default => 'unknown'
        };
    }

    /**
     * Get SIP peers using SIPpeers command
     */
    private function getSIPPeers($socket): array
    {
        $command = "Action: SIPpeers\r\n\r\n";
        fwrite($socket, $command);

        $response = $this->readCompleteResponse($socket, 'Event: PeerlistComplete');
        Log::debug("SIPpeers raw response", ['response' => $response, 'length' => strlen($response)]);

        return $this->parseSIPPeersResponse($response);
    }

    /**
     * Get SIP peers using SIPshowpeer command
     */
    private function getSIPShowPeer($socket): array
    {
        $command = "Action: SIPshowpeer\r\n\r\n";
        fwrite($socket, $command);

        $response = $this->readCompleteResponse($socket, 'Event: PeerlistComplete');
        Log::debug("SIPshowpeer raw response", ['response' => $response, 'length' => strlen($response)]);

        return $this->parseDetailedSIPPeersResponse($response);
    }

    /**
     * Get SIP registry
     */
    private function getSIPRegistry($socket): array
    {
        $command = "Action: SIPshowregistry\r\n\r\n";
        fwrite($socket, $command);

        $response = $this->readCompleteResponse($socket, 'Event: RegistryComplete');
        Log::debug("SIPshowregistry raw response", ['response' => $response, 'length' => strlen($response)]);

        return $this->parseSIPRegistryResponse($response);
    }

    /**
     * Get SIP status
     */
    private function getSIPStatus($socket): array
    {
        $command = "Action: SIPshowstatus\r\n\r\n";
        fwrite($socket, $command);

        $response = $this->readCompleteResponse($socket, 'Event: StatusComplete');
        Log::debug("SIPshowstatus raw response", ['response' => $response, 'length' => strlen($response)]);

        return $this->parseSIPStatusResponse($response);
    }

    /**
     * Get extensions using CLI command
     */
    private function getCLIExtensions($socket): array
    {
        $command = "Action: Command\r\nCommand: sip show peers\r\n\r\n";
        fwrite($socket, $command);

        $response = $this->readCompleteResponse($socket, 'Event: CommandComplete');
        Log::debug("CLI command raw response", ['response' => $response, 'length' => strlen($response)]);

        return $this->parseCommandResponse($response);
    }

    /**
     * Read complete AMI response with proper completion detection
     */
    private function readCompleteResponse($socket, string $completionEvent): string
    {
        $response = '';
        $startTime = time();
        $timeout = 15; // 15 seconds timeout
        $lastData = '';
        $consecutiveEmptyLines = 0;

        while (time() - $startTime < $timeout) {
            $buffer = fgets($socket);
            if ($buffer === false) {
                break;
            }

            $response .= $buffer;
            $lastData = $buffer;

            // Check for completion event
            if (strpos($response, $completionEvent) !== false) {
                Log::debug("Found completion event: {$completionEvent}");
                break;
            }

            // Check for consecutive empty lines (common AMI response end indicator)
            if (trim($buffer) === '') {
                $consecutiveEmptyLines++;
                if ($consecutiveEmptyLines >= 2) {
                    Log::debug("Found consecutive empty lines, assuming response complete");
                    break;
                }
            } else {
                $consecutiveEmptyLines = 0;
            }

            // Check for response end patterns
            if (strpos($response, "\r\n\r\n") !== false &&
                (strpos($lastData, "\r\n") !== false && trim($lastData) === '')) {
                Log::debug("Found response end pattern");
                break;
            }

            // Small delay to prevent busy waiting
            usleep(50000); // 50ms
        }

        if (time() - $startTime >= $timeout) {
            Log::warning("Response reading timed out after {$timeout} seconds");
        }

        Log::debug("Response reading completed", [
            'time_taken' => time() - $startTime,
            'response_length' => strlen($response),
            'completion_event_found' => strpos($response, $completionEvent) !== false
        ]);

        return $response;
    }

    /**
     * Parse a single peer entry from SIPshowpeer response
     */
    private function parseSinglePeerStatus(string $response, string $extension): ?string
    {
        $lines = explode("\r\n", $response);
        $currentPeer = null;
        $foundExtension = false;

        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line)) continue;

            if (strpos($line, 'Event: PeerEntry') !== false) {
                if ($currentPeer && $foundExtension) {
                    // We found our extension, return its status
                    return $currentPeer['status'];
                }
                $currentPeer = ['status' => 'unknown'];
                $foundExtension = false;
            } elseif (strpos($line, 'ObjectName: ') !== false) {
                $peerExtension = trim(substr($line, 12));
                $currentPeer['extension'] = $peerExtension;
                if ($peerExtension === $extension) {
                    $foundExtension = true;
                }
            } elseif (strpos($line, 'Status: ') !== false && $foundExtension) {
                $status = trim(substr($line, 8));
                $currentPeer['status'] = $this->mapSIPStatus($status);
            }
        }

        // Check if the last peer was our target extension
        if ($currentPeer && $foundExtension) {
            return $currentPeer['status'];
        }

        return null;
    }

    /**
     * Parse a single extension status from SIPshowstatus response
     */
    private function parseSingleExtensionStatus(string $response, string $extension): ?string
    {
        $lines = explode("\r\n", $response);
        $currentExt = null;
        $foundExtension = false;

        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line)) continue;

            if (strpos($line, 'Event: Status') !== false) {
                if ($currentExt && $foundExtension) {
                    // We found our extension, return its status
                    return $currentExt['status'];
                }
                $currentExt = ['status' => 'unknown'];
                $foundExtension = false;
            } elseif (strpos($line, 'Username: ') !== false) {
                $extUsername = trim(substr($line, 10));
                $currentExt['extension'] = $extUsername;
                if ($extUsername === $extension) {
                    $foundExtension = true;
                }
            } elseif (strpos($line, 'State: ') !== false && $foundExtension) {
                $state = trim(substr($line, 7));
                $currentExt['status'] = $state === 'Up' ? 'online' : 'offline';
            }
        }

        // Check if the last extension was our target extension
        if ($currentExt && $foundExtension) {
            return $currentExt['status'];
        }

        return null;
    }

    /**
     * Parse ExtensionStatus event response from ExtensionState action
     * This method handles both Response: Success and Event: ExtensionStatus formats
     */
    private function parseExtensionStateResponse(string $response, string $extension, string $actionId): ?string
    {
        Log::info("Parsing ExtensionState response", [
            'extension' => $extension,
            'action_id' => $actionId,
            'response_length' => strlen($response)
        ]);

        $lines = explode("\r\n", $response);
        $foundResponse = false;
        $foundExtension = false;
        $foundActionId = false;
        $status = null;
        $statusText = null;

        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line)) continue;

            Log::debug("Processing line", ['line' => $line]);

            // Look for either Response: Success or Event: ExtensionStatus
            if (strpos($line, 'Response: Success') !== false ||
                strpos($line, 'Event: ExtensionStatus') !== false) {
                $foundResponse = true;
                Log::info("Found ExtensionState response or event");
                continue;
            }

            if (!$foundResponse) continue;

            // Parse extension number
            if (strpos($line, 'Exten: ') !== false) {
                $eventExtension = trim(substr($line, 7));
                if ($eventExtension === $extension) {
                    $foundExtension = true;
                    Log::info("Found matching extension", ['extension' => $eventExtension]);
                }
                continue;
            }

            // Parse ActionID to make sure we get the right response
            if (strpos($line, 'ActionID: ') !== false) {
                $eventActionId = trim(substr($line, 10));
                if ($eventActionId === $actionId) {
                    $foundActionId = true;
                    Log::info("Found matching ActionID", ['action_id' => $eventActionId]);
                }
                continue;
            }

            // Parse Status (numeric value)
            if (strpos($line, 'Status: ') !== false) {
                $statusValue = trim(substr($line, 8));
                $status = $this->mapExtensionStatusValue($statusValue);
                Log::info("Found status value", ['raw_status' => $statusValue, 'mapped_status' => $status]);
                continue;
            }

            // Parse StatusText (descriptive text)
            if (strpos($line, 'StatusText: ') !== false) {
                $statusText = trim(substr($line, 12));
                Log::info("Found status text", ['status_text' => $statusText]);
                continue;
            }
        }

        // Return the status if we found all required fields
        if ($foundResponse && $foundExtension && $status !== null) {
            Log::info("Successfully parsed ExtensionState response", [
                'extension' => $extension,
                'status' => $status,
                'status_text' => $statusText,
                'action_id_matched' => $foundActionId
            ]);
            return $status;
        }

        // If we didn't find extension match but got a valid response, it might be for a different extension
        if ($foundResponse && $status !== null && !$foundExtension) {
            Log::info("Found valid response but for different extension", [
                'requested_extension' => $extension,
                'status' => $status
            ]);
        }

        Log::warning("Failed to parse ExtensionState response", [
            'extension' => $extension,
            'found_response' => $foundResponse,
            'found_extension' => $foundExtension,
            'found_action_id' => $foundActionId,
            'status' => $status
        ]);

        return null;
    }

    /**
     * Map Asterisk extension status numeric values to our status strings
     * Based on Asterisk documentation and your CLI test results
     */
    private function mapExtensionStatusValue(string $statusValue): string
    {
        switch ($statusValue) {
            case '0':
            case 'NotInUse':
                return 'online';  // Extension is registered and available

            case '1':
            case 'InUse':
                return 'online';  // Extension is registered and in use (still online)

            case '2':
            case 'Busy':
                return 'online';  // Extension is registered but busy (still online)

            case '4':
            case 'Unavailable':
                return 'offline'; // Extension is not available

            case '8':
            case 'Ringing':
                return 'online';  // Extension is ringing (still online)

            case '16':
            case 'Ringinuse':
                return 'online';  // Extension is ringing while in use

            case '-1':
            case 'Unknown':
            default:
                return 'unknown'; // Unknown status
        }
    }
}
