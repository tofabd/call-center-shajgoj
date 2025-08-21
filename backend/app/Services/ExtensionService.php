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

            // 1. Get SIP peers using SIPpeers command with robust response reading
            Log::info("Getting SIP peers...");
            $command = "Action: SIPpeers\r\n\r\n";
            fwrite($socket, $command);

            // Read response with multiple attempts and longer timeout
            $response = '';
            $startTime = time();
            $timeout = 10; // 10 seconds timeout

            while (time() - $startTime < $timeout) {
                $buffer = fgets($socket);
                if ($buffer === false) {
                    break;
                }
                $response .= $buffer;

                // Check if we have a complete response
                if (strpos($response, 'Event: PeerEntry') !== false &&
                    strpos($response, 'Event: PeerlistComplete') !== false) {
                    break;
                }

                // Also check for other completion indicators
                if (strpos($response, 'Event: PeerlistComplete') !== false) {
                    break;
                }

                usleep(100000); // 100ms delay
            }

            Log::debug("SIPpeers raw response", ['response' => $response, 'length' => strlen($response)]);
            $sipPeers = $this->parseSIPPeersResponse($response);
            Log::debug("Parsed SIP peers", ['count' => count($sipPeers), 'peers' => $sipPeers]);
            $allExtensions = array_merge($allExtensions, $sipPeers);

            // 2. Get SIP registry (currently registered extensions)
            Log::info("Getting SIP registry...");
            $command = "Action: SIPshowregistry\r\n\r\n";
            fwrite($socket, $command);
            $response = $this->readResponse($socket);
            Log::debug("SIPshowregistry raw response", ['response' => $response, 'length' => strlen($response)]);
            $sipRegistry = $this->parseSIPRegistryResponse($response);
            Log::debug("Parsed SIP registry", ['count' => count($sipRegistry), 'registry' => $sipRegistry]);

            // Merge registry info with peers info
            $allExtensions = $this->mergeExtensionInfo($allExtensions, $sipRegistry);

            // 3. Get SIP status using SIPshowstatus command
            Log::info("Getting SIP status...");
            $command = "Action: SIPshowstatus\r\n\r\n";
            fwrite($socket, $command);
            $response = $this->readResponse($socket);
            Log::debug("SIPshowstatus raw response", ['response' => $response, 'length' => strlen($response)]);
            $sipStatus = $this->parseSIPStatusResponse($response);
            Log::debug("Parsed SIP status", ['count' => count($sipStatus), 'status' => $sipStatus]);

            // Merge status info
            $allExtensions = $this->mergeExtensionInfo($allExtensions, $sipStatus);

            Log::debug("Final merged extensions", ['count' => count($allExtensions), 'extensions' => $allExtensions]);

            fclose($socket);

            return $allExtensions;

        } catch (\Exception $e) {
            Log::error("Error getting all SIP extensions: " . $e->getMessage());
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
        $ext = Extension::where('extension', $extension)->first();

        if ($ext) {
            return $ext->updateStatus($status);
        }

        return false;
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

        while (!feof($socket) && time() < $timeout) {
            $buffer = fgets($socket);
            if ($buffer === false) {
                break;
            }
            $response .= $buffer;
            $lastData = $buffer;

            // Check if we've received the complete response
            // AMI responses end with a blank line after the last event
            if (strpos($response, "\r\n\r\n") !== false &&
                (strpos($lastData, "\r\n") !== false && trim($lastData) === '')) {
                // Wait a bit more to ensure we get all data
                usleep(100000); // 100ms
                break;
            }
        }

        return $response;
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

        if ($currentPeer && isset($currentPeer['extension'])) {
            $peers[] = $currentPeer;
        }

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
}
