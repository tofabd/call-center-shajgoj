<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class ChannelList extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'app:channel-list
                            {--format=table : Output format (table, json, csv)}
                            {--raw : Show raw AMI responses}
                            {--summary : Show channel summary statistics}
                            {--state=* : Filter by channel states (0-10)}
                            {--context=* : Filter by specific contexts}';

    /**
     * The console command description.
     */
    protected $description = 'List all active channels from Asterisk AMI using CoreShowChannels';

    private $host;
    private $port;
    private $username;
    private $password;
    private $timeout;

    public function __construct()
    {
        parent::__construct();

        // Get AMI credentials from configuration
        $this->host = config('ami.connection.host');
        $this->port = config('ami.connection.port');
        $this->username = config('ami.connection.username');
        $this->password = config('ami.connection.password');
        $this->timeout = config('ami.commands.timeouts.CoreShowChannels', 15000) / 1000; // Convert to seconds
    }

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('🚀 Starting AMI Active Channels Query...');
        $this->line("🔌 Connecting to: {$this->host}:{$this->port}");
        $this->line("👤 Username: {$this->username}");

        try {
            // Validate configuration
            if (!$this->host || !$this->port || !$this->username || !$this->password) {
                $this->error('❌ Missing AMI configuration. Check config/ami.php or environment variables.');
                return 1;
            }

            $socket = fsockopen($this->host, $this->port, $errno, $errstr, 10);

            if (!$socket) {
                $this->error("❌ Failed to connect to AMI: $errstr ($errno)");
                return 1;
            }

            $this->line('✅ Socket connected to AMI');

            // Login to AMI
            if (!$this->login($socket)) {
                $this->error('❌ Authentication failed');
                fclose($socket);
                return 1;
            }

            $this->line('🔐 Authentication successful');

            // Query active channels
            $channels = $this->queryActiveChannels($socket);

            // Send logoff before closing
            $this->sendLogoff($socket);
            fclose($socket);

            if (empty($channels)) {
                $this->warn('📞 No active channels found');
                $this->line('   - All calls may have ended');
                $this->line('   - Asterisk may be idle');
                $this->line('   - Check if phones are registered');
                return 0;
            }

            // Filter channels if options are specified
            $channels = $this->filterChannels($channels);

            // Display results based on format option
            $this->displayChannels($channels);

            return 0;

        } catch (\Exception $e) {
            $this->error('❌ Error: ' . $e->getMessage());
            Log::error('ChannelList command error: ' . $e->getMessage());
            
            if (strpos($e->getMessage(), 'AMI') !== false || 
                strpos($e->getMessage(), 'connect') !== false || 
                strpos($e->getMessage(), 'Authentication') !== false) {
                $this->error('');
                $this->error('🔌 AMI Connection Issue:');
                $this->error('   - Check if Asterisk is running');
                $this->error('   - Verify AMI credentials in config/ami.php');
                $this->error('   - Check network connectivity to Asterisk server');
                $this->error('   - Ensure AMI is enabled in manager.conf');
                $this->error('   - Verify CoreShowChannels permission in AMI user configuration');
            }
            
            return 1;
        }
    }

    private function login($socket): bool
    {
        // Wait for initial AMI banner
        $this->readResponse($socket);

        $loginCmd = "Action: Login\r\n"
                 . "Username: {$this->username}\r\n"
                 . "Secret: {$this->password}\r\n\r\n";

        fwrite($socket, $loginCmd);
        $response = $this->readResponse($socket);

        if ($this->option('raw')) {
            $this->line('📥 Login response:');
            $this->line($response);
            $this->line('------------------------');
        }

        return strpos($response, 'Response: Success') !== false;
    }

    private function queryActiveChannels($socket): array
    {
        $this->line('📡 Sending CoreShowChannels query...');
        
        $actionId = 'ChannelQueryScript-' . time() . '-' . rand(1000, 9999);
        $command = "Action: CoreShowChannels\r\n"
                 . "Events: off\r\n"
                 . "ActionID: {$actionId}\r\n\r\n";

        fwrite($socket, $command);
        $response = $this->readCompleteResponse($socket, 'Event: CoreShowChannelsComplete');

        if ($this->option('raw')) {
            $this->line('📥 CoreShowChannels response:');
            $this->line($response);
            $this->line('------------------------');
        }

        return $this->parseCoreShowChannelsResponse($response);
    }

    private function sendLogoff($socket): void
    {
        $this->line('👋 Sending AMI Logoff...');
        $logoffAction = "Action: Logoff\r\n\r\n";
        fwrite($socket, $logoffAction);
        
        // Small delay to ensure logoff is sent
        usleep(100000); // 100ms
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
        $timeout = time() + $this->timeout;

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

    private function parseCoreShowChannelsResponse(string $response): array
    {
        $lines = explode("\r\n", $response);
        $channels = [];
        $currentChannel = null;

        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line)) continue;

            if (strpos($line, 'Event: CoreShowChannel') !== false) {
                if ($currentChannel) {
                    $channels[] = $currentChannel;
                }
                $currentChannel = [
                    'channel' => null,
                    'context' => null,
                    'extension' => null,
                    'priority' => null,
                    'state' => null,
                    'state_text' => null,
                    'application' => null,
                    'application_data' => null,
                    'duration' => null,
                    'account_code' => null,
                    'caller_id_num' => null,
                    'caller_id_name' => null,
                    'connected_line_num' => null,
                    'connected_line_name' => null,
                    'unique_id' => null,
                    'linked_id' => null,
                ];
                continue;
            }

            if (!$currentChannel) continue;

            // Parse channel fields
            if (strpos($line, 'Channel: ') !== false) {
                $currentChannel['channel'] = trim(substr($line, 9));
            } elseif (strpos($line, 'Context: ') !== false) {
                $currentChannel['context'] = trim(substr($line, 9));
            } elseif (strpos($line, 'Extension: ') !== false) {
                $currentChannel['extension'] = trim(substr($line, 11));
            } elseif (strpos($line, 'Priority: ') !== false) {
                $currentChannel['priority'] = trim(substr($line, 10));
            } elseif (strpos($line, 'ChannelState: ') !== false) {
                $state = trim(substr($line, 14));
                $currentChannel['state'] = $state;
                $currentChannel['state_text'] = $this->formatChannelState($state);
            } elseif (strpos($line, 'Application: ') !== false) {
                $currentChannel['application'] = trim(substr($line, 13));
            } elseif (strpos($line, 'ApplicationData: ') !== false) {
                $currentChannel['application_data'] = trim(substr($line, 17));
            } elseif (strpos($line, 'Duration: ') !== false) {
                $currentChannel['duration'] = trim(substr($line, 10));
            } elseif (strpos($line, 'AccountCode: ') !== false) {
                $currentChannel['account_code'] = trim(substr($line, 13));
            } elseif (strpos($line, 'CallerIDNum: ') !== false) {
                $currentChannel['caller_id_num'] = trim(substr($line, 13));
            } elseif (strpos($line, 'CallerIDName: ') !== false) {
                $currentChannel['caller_id_name'] = trim(substr($line, 14));
            } elseif (strpos($line, 'ConnectedLineNum: ') !== false) {
                $currentChannel['connected_line_num'] = trim(substr($line, 18));
            } elseif (strpos($line, 'ConnectedLineName: ') !== false) {
                $currentChannel['connected_line_name'] = trim(substr($line, 19));
            } elseif (strpos($line, 'Uniqueid: ') !== false) {
                $currentChannel['unique_id'] = trim(substr($line, 10));
            } elseif (strpos($line, 'Linkedid: ') !== false) {
                $currentChannel['linked_id'] = trim(substr($line, 10));
            }
        }

        // Add the last channel if exists
        if ($currentChannel) {
            $channels[] = $currentChannel;
        }

        return $channels;
    }

    private function formatChannelState(string $state): string
    {
        $stateMap = [
            '0' => 'Down',
            '1' => 'Reserved',
            '2' => 'Off Hook',
            '3' => 'Dialing',
            '4' => 'Ring',
            '5' => 'Ringing',
            '6' => 'Up',
            '7' => 'Busy',
            '8' => 'Dialing Offhook',
            '9' => 'Pre-ring',
            '10' => 'Unknown'
        ];

        return $stateMap[$state] ?? "State {$state}";
    }

    private function filterChannels(array $channels): array
    {
        $states = $this->option('state');
        $contexts = $this->option('context');

        if (!empty($states)) {
            $channels = array_filter($channels, function($channel) use ($states) {
                return in_array($channel['state'], $states);
            });
        }

        if (!empty($contexts)) {
            $channels = array_filter($channels, function($channel) use ($contexts) {
                return in_array($channel['context'], $contexts);
            });
        }

        return array_values($channels); // Re-index array
    }

    private function displayChannels(array $channels): void
    {
        $format = $this->option('format');

        switch ($format) {
            case 'json':
                $this->displayAsJson($channels);
                break;
            case 'csv':
                $this->displayAsCsv($channels);
                break;
            case 'table':
            default:
                $this->displayAsTable($channels);
                break;
        }

        if ($this->option('summary')) {
            $this->displaySummary($channels);
        }
    }

    private function displayAsTable(array $channels): void
    {
        $this->line("\n📞 ACTIVE CHANNELS:");
        $this->line('==================');

        if (empty($channels)) {
            $this->line('No channels found');
            return;
        }

        $headers = ['#', 'Channel', 'State', 'Context', 'Extension', 'Application', 'Duration', 'Caller ID'];
        $rows = [];

        foreach ($channels as $index => $channel) {
            $rows[] = [
                $index + 1,
                $channel['channel'] ?? 'Unknown',
                $this->formatStateForDisplay($channel['state_text'] ?? 'Unknown'),
                $channel['context'] ?? 'Unknown',
                $channel['extension'] ?? 'Unknown',
                $channel['application'] ?? 'N/A',
                $channel['duration'] ?? '0',
                $this->formatCallerId($channel),
            ];
        }

        $this->table($headers, $rows);

        $this->line("\n📊 Found {$this->colorize(count($channels), 'info')} active channels");
    }

    private function displayAsJson(array $channels): void
    {
        $this->line(json_encode($channels, JSON_PRETTY_PRINT));
    }

    private function displayAsCsv(array $channels): void
    {
        $this->line('Channel,State,Context,Extension,Priority,Application,Duration,CallerIDNum,CallerIDName,UniqueID');
        
        foreach ($channels as $channel) {
            $this->line(sprintf(
                '%s,%s,%s,%s,%s,%s,%s,%s,%s,%s',
                $channel['channel'] ?? '',
                $channel['state_text'] ?? '',
                $channel['context'] ?? '',
                $channel['extension'] ?? '',
                $channel['priority'] ?? '',
                $channel['application'] ?? '',
                $channel['duration'] ?? '',
                $channel['caller_id_num'] ?? '',
                $channel['caller_id_name'] ?? '',
                $channel['unique_id'] ?? ''
            ));
        }
    }

    private function displaySummary(array $channels): void
    {
        if (empty($channels)) {
            return;
        }

        // Channel state distribution
        $stateCount = [];
        foreach ($channels as $channel) {
            $state = $channel['state_text'] ?? 'Unknown';
            $stateCount[$state] = ($stateCount[$state] ?? 0) + 1;
        }

        $this->line("\n📊 CHANNEL STATE DISTRIBUTION:");
        $this->line('==============================');
        foreach ($stateCount as $state => $count) {
            $this->line("{$state}: {$count} channels");
        }

        // Context distribution
        $contextCount = [];
        foreach ($channels as $channel) {
            $context = $channel['context'] ?? 'Unknown';
            $contextCount[$context] = ($contextCount[$context] ?? 0) + 1;
        }

        $this->line("\n📋 CHANNEL CONTEXT DISTRIBUTION:");
        $this->line('================================');
        foreach ($contextCount as $context => $count) {
            $this->line("{$context}: {$count} channels");
        }

        // Application distribution
        $appCount = [];
        foreach ($channels as $channel) {
            $app = $channel['application'] ?? 'No Application';
            $appCount[$app] = ($appCount[$app] ?? 0) + 1;
        }

        $this->line("\n📱 CHANNEL APPLICATION DISTRIBUTION:");
        $this->line('===================================');
        foreach ($appCount as $app => $count) {
            $this->line("{$app}: {$count} channels");
        }
    }

    private function formatStateForDisplay(string $state): string
    {
        switch ($state) {
            case 'Down':
                return "🔴 {$state}";
            case 'Up':
                return "🟢 {$state}";
            case 'Ringing':
                return "🔔 {$state}";
            case 'Busy':
                return "🟡 {$state}";
            case 'Dialing':
                return "📞 {$state}";
            default:
                return "⚪ {$state}";
        }
    }

    private function formatCallerId(array $channel): string
    {
        $num = $channel['caller_id_num'] ?? '';
        $name = $channel['caller_id_name'] ?? '';

        if ($num && $name && $num !== $name) {
            return "{$num} ({$name})";
        } elseif ($num) {
            return $num;
        } elseif ($name) {
            return $name;
        }

        return 'N/A';
    }

    private function colorize(string $text, string $color): string
    {
        switch ($color) {
            case 'info':
                return "<info>{$text}</info>";
            case 'comment':
                return "<comment>{$text}</comment>";
            case 'question':
                return "<question>{$text}</question>";
            case 'error':
                return "<error>{$text}</error>";
            default:
                return $text;
        }
    }
}