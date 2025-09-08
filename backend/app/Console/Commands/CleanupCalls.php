<?php

namespace App\Console\Commands;

use App\Events\CallUpdated;
use App\Models\BridgeSegment;
use App\Models\Call;
use App\Models\CallLeg;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

/**
 * CleanupCalls Command
 *
 * This command identifies stuck calls by:
 * 1. Finding calls in database that exceed time thresholds (ringing > 1min, answered > 2min)
 * 2. Querying AMI to get active channels (REQUIRED for safety - will abort if AMI fails)
 * 3. Cross-referencing to find calls with no active channels
 * 4. Cleaning up orphaned calls in database
 * 5. Broadcasting updates to frontend
 *
 * SAFETY: If AMI connection fails, cleanup will be aborted to prevent cleaning active calls
 *
     * Usage Examples:
     * - php artisan calls:cleanup --dry-run                    # Preview cleanup
     * - php artisan calls:cleanup                              # Safe cleanup with AMI verification
     * - php artisan calls:cleanup --skip-ami                   # FORCE database-only cleanup (bypasses AMI verification)
     * - php artisan calls:cleanup --dry-run -v                 # Verbose preview
     * - php artisan calls:cleanup --ringing-threshold=3        # Custom threshold
     *
     * Note: Use --skip-ami ONLY when you're certain AMI is down and want to force cleanup
     */
class CleanupCalls extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'calls:cleanup
                            {--dry-run : Show what would be cleaned without making changes}
                            {--ringing-threshold=1 : Override ringing threshold in minutes}
                            {--answered-threshold=2 : Override answered threshold in minutes}
                            {--force : Deprecated - cleanup now runs without confirmation by default}
                            {--fast : Deprecated - all operations now use minimal timeouts}
                            {--skip-ami : FORCE database-only cleanup - bypasses AMI verification (use with caution)}';

    /**
     * The console command description.
     */
     protected $description = 'Cleanup stuck calls with AMI verification (aborts if AMI fails - use --skip-ami to force)';

    private $host;
    private $port;
    private $username;
    private $password;
    private $timeout;
    private $isDryRun = false;
    private $isVerbose = false;
    private $isFast = false;
    private $ringingThreshold;
    private $answeredThreshold;
    private $cleanedCount = 0;
    private $failedCount = 0;
    private $startTime;
    private $amiConnection = null; // Reusable connection
    private $detailedResults = []; // Store detailed cleanup results for JSON logging
    private $rawAmiResponse = ''; // Store raw AMI response for debugging
    private $lastRawResponse = ''; // Store last raw socket response

    public function __construct()
    {
        parent::__construct();

        // Use the same configuration source as the frontend AMI service
        $config = config('ami.connection', [
            'host' => env('AMI_HOST', '103.177.125.83'),
            'port' => env('AMI_PORT', 5038),
            'username' => env('AMI_USERNAME', 'admin'),
            'password' => env('AMI_PASSWORD', 'admin123'),
        ]);

        $this->host = $config['host'];
        $this->port = $config['port'];
        $this->username = $config['username'];
        $this->password = $config['password'];
        $this->timeout = config('ami.commands.timeouts.CoreShowChannels', 30000);
    }

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->startTime = microtime(true);
        $this->isDryRun = $this->option('dry-run');
        $this->isVerbose = $this->option('verbose'); // Use Laravel's built-in verbose option
        $this->isFast = true; // Always use fast mode for minimal timeouts
        $this->ringingThreshold = intval($this->option('ringing-threshold'));
        $this->answeredThreshold = intval($this->option('answered-threshold'));

        $this->displayStartupBanner();

        try {
            // Validate configuration
            if (!$this->validateConfiguration()) {
                return 1;
            }

            // Phase 1: Find stuck calls in database
            $this->info('🔍 Phase 1: Finding stuck calls in database...');
            $stuckCalls = $this->findStuckCalls();

            $this->info("📞 Found {$this->colorize(count($stuckCalls), 'info')} stuck calls");

            if ($this->isVerbose && !empty($stuckCalls)) {
                $this->displayStuckCallsDetails($stuckCalls);
            }

            // Phase 2: Query active channels from AMI (always query for monitoring)
            if ($this->option('skip-ami')) {
                $this->info('⚡ Phase 2: Skipping AMI verification for instant cleanup...');
                $activeChannels = [];

                // Write JSON file even when skipping AMI
                $actionId = 'CleanupScript-SKIPPED-' . time() . '-' . rand(1000, 9999);
                $response = "AMI verification skipped by user request (--skip-ami flag)\r\n"
                          . "Timestamp: " . date('Y-m-d H:i:s') . "\r\n"
                          . "Mode: Database-only cleanup\r\n";
                $this->rawAmiResponse = $response; // Store for JSON
                $this->info('📞 AMI verification skipped - proceeding with database-only cleanup');
            } else {
                $this->info('📡 Phase 2: Querying active channels from AMI...');
                try {
                    $activeChannels = $this->queryAmiChannels($stuckCalls);
                    $this->info("📞 Found {$this->colorize(count($activeChannels), 'info')} active channels from AMI");

                    // Display channel list in console
                    $this->displayActiveChannels($activeChannels);

                } catch (\Exception $e) {
                    // AMI connection failed - stop cleanup for safety if we have stuck calls
                    if (!empty($stuckCalls)) {
                        $this->error('❌ Cleanup aborted due to AMI connection failure');
                        return 1;
                    } else {
                        $this->warn('⚠️ AMI connection failed but no stuck calls found - continuing...');
                        $activeChannels = [];
                    }
                }
            }

            // Early exit if no stuck calls found (after AMI query for monitoring)
            if (empty($stuckCalls)) {
                // Write elegant final report and display summary even when no stuck calls found
                $this->writeElegantCleanupReport($stuckCalls, $activeChannels ?? [], []);
                $this->displayElegantSummary($activeChannels ?? [], $stuckCalls, []);
                $this->closeAmiConnection();

                return 0;
            }

            // Phase 3: Cross-reference calls with channels (or skip if AMI skipped)
            if ($this->option('skip-ami')) {
                $this->info('⚡ Phase 3: Skipping cross-reference - cleaning all stuck calls...');
                $callsToCleanup = $stuckCalls; // Clean all stuck calls without verification
            } else {
                $this->info('🔗 Phase 3: Cross-referencing calls with active channels...');
                $callsToCleanup = $this->crossReferenceCallsWithChannels($stuckCalls, $activeChannels);
            }

            if (empty($callsToCleanup)) {
                if ($this->option('skip-ami')) {
                    $this->info('✅ No stuck calls found in database');
                } else {
                    $this->info('✅ All stuck calls still have active channels - no cleanup needed');
                }
                return 0;
            }

            $this->info("🧹 Identified {$this->colorize(count($callsToCleanup), 'info')} calls for cleanup");

            // Skip confirmation - proceed directly with cleanup

            // Phase 4: Cleanup calls
            if ($this->isDryRun) {
                $this->info('🔍 DRY RUN: Showing what would be cleaned...');
                $this->displayDryRunResults($callsToCleanup);
            } else {
                $this->info('🧹 Phase 4: Cleaning up stuck calls...');
                $this->cleanupStuckCalls($callsToCleanup);
            }

            // Phase 5: Write elegant final report and display summary
            $this->writeElegantCleanupReport($stuckCalls, $activeChannels ?? [], $callsToCleanup);
            $this->displayElegantSummary($activeChannels ?? [], $stuckCalls, $callsToCleanup);

            // Clean up AMI connection
            $this->closeAmiConnection();

            return 0;

        } catch (\Exception $e) {
            // Clean up connection on error
            $this->closeAmiConnection();

            $this->error('❌ Cleanup failed: ' . $e->getMessage());
            Log::error('CleanupCalls command error: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString()
            ]);
            return 1;
        }
    }

    private function validateConfiguration(): bool
    {
        if (!$this->host || !$this->port || !$this->username || !$this->password) {
            $this->error('❌ Missing AMI configuration. Check config/ami.php or environment variables.');
            return false;
        }

        if ($this->ringingThreshold <= 0 || $this->answeredThreshold <= 0) {
            $this->error('❌ Invalid thresholds. Both ringing and answered thresholds must be positive integers.');
            return false;
        }

        // Test database connection
        try {
            DB::connection()->getPdo();
            if ($this->isVerbose) {
                $this->line('✅ Database connection validated');
            }
        } catch (\Exception $e) {
            $this->error('❌ Database connection failed: ' . $e->getMessage());
            return false;
        }

        return true;
    }

    private function findStuckCalls(): array
    {
        $now = Carbon::now();
        $ringingCutoff = $now->copy()->subMinutes($this->ringingThreshold);
        $answeredCutoff = $now->copy()->subMinutes($this->answeredThreshold);

        $stuckCalls = [];

        // Find stuck ringing calls (no answered_at, started > threshold)
        $stuckRingingCalls = Call::whereNull('ended_at')
            ->whereNull('answered_at')
            ->where('started_at', '<=', $ringingCutoff)
            ->get();

        foreach ($stuckRingingCalls as $call) {
            $duration = $call->started_at->diffInMinutes($now); // Fixed: call->started_at->diffInMinutes($now)
            $stuckCalls[] = [
                'call' => $call,
                'reason' => "Ringing too long: {$duration} minutes",
                'type' => 'ringing'
            ];
        }

        // Find stuck answered calls (answered > threshold)
        $stuckAnsweredCalls = Call::whereNull('ended_at')
            ->whereNotNull('answered_at')
            ->where('answered_at', '<=', $answeredCutoff)
            ->get();

        foreach ($stuckAnsweredCalls as $call) {
            $duration = $call->answered_at->diffInMinutes($now); // Fixed: call->answered_at->diffInMinutes($now)
            $stuckCalls[] = [
                'call' => $call,
                'reason' => "Answered too long: {$duration} minutes",
                'type' => 'answered'
            ];
        }

        if ($this->isVerbose) {
            $this->line("   - Stuck ringing calls: {$stuckRingingCalls->count()}");
            $this->line("   - Stuck answered calls: {$stuckAnsweredCalls->count()}");
        }

        return $stuckCalls;
    }

    /**
     * Get or create reusable AMI connection
     */
    private function getAmiConnection()
    {
        if (!$this->amiConnection) {
            $this->amiConnection = $this->createOptimizedSocket();
            if (!$this->loginToAmi($this->amiConnection)) {
                $this->closeSocket($this->amiConnection);
                $this->amiConnection = null;
                throw new \Exception('AMI authentication failed');
            }

            if ($this->isVerbose) {
                $this->line('🔗 Created reusable AMI connection');
            }
        }

        return $this->amiConnection;
    }

    /**
     * Close AMI connection if open
     */
    private function closeAmiConnection(): void
    {
        if ($this->amiConnection) {
            $this->sendLogoff($this->amiConnection);
            $this->closeSocket($this->amiConnection);
            $this->amiConnection = null;

            if ($this->isVerbose) {
                $this->line('🔌 Closed AMI connection');
            }
        }
    }

    private function queryAmiChannels(?array $stuckCalls = null): array
    {
        $actionId = 'CleanupScript-' . time() . '-' . rand(1000, 9999);
        $response = '';
        $channels = [];

        try {
            // Try to get raw AMI response using direct socket connection for debugging
            $rawResponse = '';
            try {
                $socket = $this->createOptimizedSocket();
                if ($this->loginToAmi($socket)) {
                    $rawChannels = $this->queryActiveChannels($socket);
                    $rawResponse = $this->lastRawResponse ?? '';
                    $this->closeSocket($socket);
                    
                    if (!empty($rawChannels)) {
                        $channels = $rawChannels;
                        $response = $rawResponse;
                        $this->rawAmiResponse = $rawResponse; // Store for JSON
                        
                        if ($this->isVerbose) {
                            $this->line('✅ Successfully queried AMI using direct socket connection');
                        }
                    } else {
                        throw new \Exception('No channels returned from direct socket query');
                    }
                } else {
                    throw new \Exception('AMI authentication failed');
                }
            } catch (\Exception $socketError) {
                // Fallback to AmiServiceProvider if direct socket fails
                if ($this->isVerbose) {
                    $this->line('⚠️ Direct socket query failed, falling back to AmiServiceProvider');
                }
                
                $amiService = new \App\Services\Ami\AmiServiceProvider();
                $result = $amiService->executeWithConnection(function($ami) use ($actionId) {
                    return $ami->channels()->getActiveChannels();
                });

                if ($result && is_array($result) && count($result) > 0) {
                    $channels = $result;
                    $response = "AMI Service Provider Response (raw response not available)\r\n"
                              . "Channels returned: " . count($result) . "\r\n"
                              . "Timestamp: " . date('Y-m-d H:i:s') . "\r\n"
                              . "Data: " . json_encode($result, JSON_PRETTY_PRINT);
                    $this->rawAmiResponse = $response;
                } else {
                    $channels = [];
                    $response = "AMI query completed but no channels returned\r\n"
                              . "Result: " . json_encode($result) . "\r\n"
                              . "Timestamp: " . date('Y-m-d H:i:s') . "\r\n";
                    $this->rawAmiResponse = $response;
                }

                if ($this->isVerbose) {
                    $this->line('✅ Successfully queried AMI using fallback service');
                }
            }

        } catch (\Exception $e) {
            // Create error response for JSON logging
            $response = "Error: AMI service failed - " . $e->getMessage() . "\r\n"
                      . "Service: Direct socket + AmiServiceProvider fallback\r\n" 
                      . "Timestamp: " . date('Y-m-d H:i:s') . "\r\n";
            
            $this->rawAmiResponse = $response;
            $this->error("❌ AMI connection failed: {$e->getMessage()}");
            $this->error('❌ Cannot verify active channels - aborting cleanup for safety');
            $this->line('💡 Use --skip-ami flag to force database-only cleanup without AMI verification');
            
            // Re-throw exception to stop cleanup process
            throw new \Exception("AMI connection failed - cannot safely verify active channels: " . $e->getMessage());
        }

        return $channels;
    }

    /**
     * Create optimized socket connection with performance tuning
     */
    private function createOptimizedSocket()
    {
        $socket = socket_create(AF_INET, SOCK_STREAM, SOL_TCP);
        if (!$socket) {
            throw new \Exception("Socket creation failed: " . socket_strerror(socket_last_error()));
        }

        // Optimize socket for performance
        socket_set_option($socket, SOL_SOCKET, SO_RCVTIMEO, ['sec' => 10, 'usec' => 0]); // Increased from 5 to 10 seconds
        socket_set_option($socket, SOL_SOCKET, SO_SNDTIMEO, ['sec' => 10, 'usec' => 0]); // Add send timeout
        socket_set_option($socket, SOL_SOCKET, SO_SNDBUF, 65536); // 64KB send buffer
        socket_set_option($socket, SOL_SOCKET, SO_RCVBUF, 65536); // 64KB receive buffer
        socket_set_option($socket, SOL_TCP, TCP_NODELAY, 1);      // Disable Nagle algorithm

        if (!socket_connect($socket, $this->host, $this->port)) {
            $error = socket_strerror(socket_last_error($socket));
            throw new \Exception("Socket connection failed to {$this->host}:{$this->port} - {$error}");
        }

        return $socket;
    }

    /**
     * Close socket properly
     */
    private function closeSocket($socket): void
    {
        if (is_resource($socket)) {
            socket_close($socket);
        }
    }

    private function loginToAmi($socket): bool
    {
        // Wait for initial AMI banner
        $this->readSocketResponse($socket);

        $loginCmd = "Action: Login\r\n"
                 . "Username: {$this->username}\r\n"
                 . "Secret: {$this->password}\r\n\r\n";

        socket_write($socket, $loginCmd, strlen($loginCmd));
        $response = $this->readSocketResponse($socket);

        return strpos($response, 'Response: Success') !== false;
    }

    private function queryActiveChannels($socket): array
    {
        $actionId = 'CleanupScript-' . time() . '-' . rand(1000, 9999);
        $response = '';
        $channels = [];

        try {
            // Use CoreShowChannels and wait for CoreShowChannelsComplete
            $command = "Action: CoreShowChannels\r\n"
                     . "ActionID: {$actionId}\r\n\r\n";

            socket_write($socket, $command, strlen($command));
            $response = $this->readCompleteSocketResponse($socket, 'Event: CoreShowChannelsComplete');
            
            // Store the raw response for JSON logging
            $this->lastRawResponse = $response;
            
            // Parse response with optimized parsing
            $channels = $this->parseChannelsOptimized($response);
            
        } catch (\Exception $e) {
            $response = "Error: " . $e->getMessage() . "\r\n";
            $this->lastRawResponse = $response;
            $this->warn("⚠️ AMI query error: {$e->getMessage()}");
        }

        // ALWAYS write JSON file after query - success or failure
        $this->info("📄 Writing AMI events to JSON file...");
        $this->writeEventsToJsonImmediate($response, $actionId);

        return $channels;
    }

    private function sendLogoff($socket): void
    {
        $logoffAction = "Action: Logoff\r\n\r\n";
        socket_write($socket, $logoffAction, strlen($logoffAction));
        // Remove delay - immediate execution
    }

    /**
     * Optimized socket response reading with better buffering
     */
    private function readSocketResponse($socket): string
    {
        $response = '';
        $bufferSize = 1024;

        while (true) {
            $buffer = socket_read($socket, $bufferSize);
            if ($buffer === false || $buffer === '') {
                break;
            }

            $response .= $buffer;

            // Return when we reach end of response (empty line)
            if (str_ends_with($response, "\r\n\r\n")) {
                return $response;
            }
        }

        return $response;
    }

    /**
     * Optimized complete response reading with chunked buffers
     */
    private function readCompleteSocketResponse($socket, string $completionEvent): string
    {
        $response = '';
        $startTime = time();
        $timeout = 30; // 30 second timeout
        $bufferSize = 8192; // 8KB chunks for better performance

        while (true) {
            // Check for timeout every few iterations, not every read
            if ((time() - $startTime) > $timeout) {
                throw new \Exception("AMI query timeout after {$timeout} seconds - no completion event received");
            }

            $buffer = socket_read($socket, $bufferSize);
            if ($buffer === false || $buffer === '') {
                break;
            }

            $response .= $buffer;

            // Check for completion less frequently for better performance
            if (strpos($response, $completionEvent) !== false) {
                return $response;
            }
        }

        return $response;
    }

    /**
     * Optimized channel parsing - only parse required fields
     */
    private function parseChannelsOptimized(string $response): array
    {
        $channels = [];
        $lines = explode("\r\n", $response);
        $currentChannel = null;

        // Only parse essential fields for performance
        $fieldMap = [
            'Channel: ' => 'channel',
            'UniqueID: ' => 'uniqueid',
            'LinkedID: ' => 'linkedid',
            'Context: ' => 'context',
            'Extension: ' => 'extension',
            'State: ' => 'state'
        ];

        foreach ($lines as $line) {
            if (str_starts_with($line, 'Event: CoreShowChannel')) {
                if ($currentChannel && isset($currentChannel['channel'])) { // Check for essential channel field
                    $channels[] = $currentChannel;
                }
                $currentChannel = [];
                continue;
            }

            if (!$currentChannel) continue;

            // Fast field parsing - only check required fields
            foreach ($fieldMap as $prefix => $key) {
                if (str_starts_with($line, $prefix)) {
                    $currentChannel[$key] = trim(substr($line, strlen($prefix)));
                    break; // Stop after first match for performance
                }
            }
        }

        // Add final channel if exists
        if ($currentChannel && isset($currentChannel['channel'])) { // Check for essential channel field
            $channels[] = $currentChannel;
        }

        return $channels;
    }

    private function parseCoreShowChannelsResponse(string $response): array
    {
        // This method is deprecated - use parseChannelsOptimized() instead
        return $this->parseChannelsOptimized($response);
    }

    /**
     * Write all AMI events to JSON file with comprehensive cleanup information
     */
    private function writeEventsToJsonImmediate(string $response, string $actionId, ?array $stuckCalls = null, ?array $activeChannels = null): void
    {
        $timestamp = Carbon::now()->format('Y-m-d_H-i-s');
        // Write to backend/debug/ directory - using base_path() points to the backend/ directory root
        $filename = base_path("debug/ami_events_{$timestamp}_{$actionId}.json");

        // Create debug directory if it doesn't exist
        $debugDir = base_path('debug');
        if (!is_dir($debugDir)) {
            mkdir($debugDir, 0755, true);
            $this->info("📁 Created debug directory: {$debugDir}");
        }

        // Parse response into structured events with memory optimization
        $events = $this->parseAllEventsFromResponse($response);

        $logData = [
            'timestamp' => Carbon::now()->toISOString(),
            'action_id' => $actionId,
            'command' => 'CoreShowChannels',
            'cleanup_phase' => $this->determineCleanupPhase($stuckCalls, $activeChannels),
            'execution_info' => [
                'ringing_threshold_minutes' => $this->ringingThreshold,
                'answered_threshold_minutes' => $this->answeredThreshold,
                'dry_run' => $this->isDryRun,
                'skip_ami' => $this->option('skip-ami'),
                'execution_time_ms' => $this->startTime ? round((microtime(true) - $this->startTime) * 1000, 2) : null
            ],
            'ami_response' => [
                'total_events' => count($events),
                'raw_response_size' => strlen($response),
                'events' => $events
            ]
        ];

        // Add stuck calls information if provided
        if ($stuckCalls !== null) {
            $logData['stuck_calls_found'] = [
                'total_count' => count($stuckCalls),
                'calls' => array_map(function($callData) {
                    $call = $callData['call'];
                    return [
                        'linkedid' => $call->linkedid,
                        'agent_exten' => $call->agent_exten,
                        'other_party' => $call->other_party,
                        'direction' => $call->direction,
                        'started_at' => $call->started_at?->toISOString(),
                        'answered_at' => $call->answered_at?->toISOString(),
                        'reason' => $callData['reason'],
                        'type' => $callData['type'],
                        'duration_minutes' => $this->calculateCallDuration($call)
                    ];
                }, $stuckCalls)
            ];
        }

        // Add active channels information if provided
        if ($activeChannels !== null) {
            $logData['active_channels'] = [
                'total_count' => count($activeChannels),
                'channels' => $activeChannels
            ];
        }

        // Remove raw response from JSON - only keep structured events and metadata

        // Use streaming JSON write for better memory usage
        $jsonFlags = JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES;
        if (version_compare(PHP_VERSION, '7.3.0', '>=')) {
            $jsonFlags |= JSON_THROW_ON_ERROR;
        }

        try {
            $jsonContent = json_encode($logData, $jsonFlags);
            $result = file_put_contents($filename, $jsonContent, LOCK_EX);

            if ($result !== false) {
                $this->info("✅ Events logged to: {$filename}");
                $this->info("📊 Total events captured: " . count($events));
                if ($stuckCalls !== null) {
                    $this->info("🔍 Stuck calls logged: " . count($stuckCalls));
                }
                if ($activeChannels !== null) {
                    $this->info("📡 Active channels logged: " . count($activeChannels));
                }
                $this->info("📦 File size: " . number_format(strlen($jsonContent)) . " bytes");

                // Clear memory for large responses
                if (strlen($response) > 524288) { // 512KB
                    unset($jsonContent, $logData, $events);
                    if (function_exists('gc_collect_cycles')) {
                        gc_collect_cycles();
                    }
                }
            } else {
                $this->error("❌ Failed to write JSON file: {$filename}");
            }
        } catch (\Exception $e) {
            $this->error("❌ JSON encoding failed: {$e->getMessage()}");
        }
    }

    /**
     * Parse all events from AMI response into structured array
     */
    private function parseAllEventsFromResponse(string $response): array
    {
        $lines = explode("\r\n", $response);
        $events = [];
        $currentEvent = null;

        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line)) {
                // Empty line indicates end of current event
                if ($currentEvent) {
                    $events[] = $currentEvent;
                    $currentEvent = null;
                }
                continue;
            }

            // Check if this line starts a new event
            if (strpos($line, 'Event: ') === 0) {
                // Save previous event if exists
                if ($currentEvent) {
                    $events[] = $currentEvent;
                }
                // Start new event
                $currentEvent = [
                    'event_type' => trim(substr($line, 7)),
                    'fields' => [],
                    'timestamp' => Carbon::now()->toISOString()
                ];
                continue;
            }

            // Check if this is a response line (not an event)
            if (strpos($line, 'Response: ') === 0) {
                if ($currentEvent) {
                    $events[] = $currentEvent;
                    $currentEvent = null;
                }
                // Create response entry
                $events[] = [
                    'event_type' => 'Response',
                    'fields' => ['Response' => trim(substr($line, 10))],
                    'timestamp' => Carbon::now()->toISOString()
                ];
                continue;
            }

            // Parse field if we're in an event
            if ($currentEvent && strpos($line, ': ') !== false) {
                list($key, $value) = explode(': ', $line, 2);
                $currentEvent['fields'][trim($key)] = trim($value);
            }
        }

        // Add final event if exists
        if ($currentEvent) {
            $events[] = $currentEvent;
        }

        return $events;
    }

    private function crossReferenceCallsWithChannels(array $stuckCalls, array $activeChannels): array
    {
        // Extract all linkedids for bulk query - fix N+1 problem
        $linkedIds = array_column(array_column($stuckCalls, 'call'), 'linkedid');

        // Single optimized query instead of N+1 queries
        $callLegsGrouped = CallLeg::whereIn('linkedid', $linkedIds)
            ->whereNull('hangup_at')
            ->select(['linkedid', 'uniqueid']) // Only select needed fields
            ->get()
            ->groupBy('linkedid');

        // Build optimized channel lookup maps for O(1) access instead of nested loops
        $uniqueIdMap = [];
        $linkedIdMap = [];
        foreach ($activeChannels as $channel) {
            if (isset($channel['uniqueid'])) {
                $uniqueIdMap[$channel['uniqueid']] = true;
            }
            if (isset($channel['linkedid'])) {
                $linkedIdMap[$channel['linkedid']] = true;
            }
        }

        $callsToCleanup = [];
        foreach ($stuckCalls as $stuckCallData) {
            $call = $stuckCallData['call'];
            $callLegs = $callLegsGrouped->get($call->linkedid, collect());

            if ($this->isVerbose) {
                $this->line("   Checking call {$call->linkedid}: {$callLegs->count()} active legs");
            }

            $hasActiveChannel = false;
            // Fast O(1) lookup instead of nested loops
            foreach ($callLegs as $leg) {
                if (isset($uniqueIdMap[$leg->uniqueid]) || isset($linkedIdMap[$leg->linkedid])) {
                    $hasActiveChannel = true;
                    if ($this->isVerbose) {
                        $this->line("     ✓ Found active channel for leg: {$leg->uniqueid}");
                    }
                    break;
                }
            }

            if (!$hasActiveChannel) {
                $callsToCleanup[] = $stuckCallData;
                if ($this->isVerbose) {
                    $this->line("     ❌ No active channels found - marked for cleanup");
                }
            }
        }

        return $callsToCleanup;
    }

    private function cleanupStuckCalls(array $callsToCleanup): void
    {
        foreach ($callsToCleanup as $callData) {
            try {
                $this->cleanupStuckCall($callData);
                $this->cleanedCount++;
            } catch (\Exception $e) {
                $this->failedCount++;
                $this->error("   ❌ Failed to cleanup call {$callData['call']->linkedid}: {$e->getMessage()}");
                Log::error('Failed to cleanup stuck call', [
                    'linkedid' => $callData['call']->linkedid,
                    'error' => $e->getMessage()
                ]);
            }
        }
    }

    private function cleanupStuckCall(array $callData): void
    {
        $call = $callData['call'];
        $reason = $callData['reason'];
        $type = $callData['type'];

        DB::beginTransaction();

        try {
            $now = Carbon::now();

            // Calculate talk_seconds for answered calls
            $talkSeconds = null;
            if ($type === 'answered' && $call->answered_at) {
                $talkSeconds = $call->answered_at->diffInSeconds($now);
            }

            // Update Call
            $call->update([
                'ended_at' => $now,
                'disposition' => 'canceled',
                'hangup_cause' => 'Stuck call cleanup - ' . $reason,
                'talk_seconds' => $talkSeconds
            ]);

            // Update CallLegs
            $updatedLegs = CallLeg::where('linkedid', $call->linkedid)
                ->whereNull('hangup_at')
                ->update([
                    'hangup_at' => $now,
                    'hangup_cause' => 'Stuck call cleanup'
                ]);

            // Update BridgeSegments
            $updatedSegments = BridgeSegment::where('linkedid', $call->linkedid)
                ->whereNull('left_at')
                ->update([
                    'left_at' => $now
                ]);

            DB::commit();

            // Store detailed results for JSON logging
            $this->detailedResults[] = [
                'linkedid' => $call->linkedid,
                'agent_exten' => $call->agent_exten,
                'other_party' => $call->other_party,
                'reason' => $reason,
                'type' => $type,
                'cleanup_timestamp' => $now->toISOString(),
                'talk_seconds' => $talkSeconds,
                'updated_call_legs' => $updatedLegs,
                'updated_bridge_segments' => $updatedSegments,
                'status' => 'success'
            ];

            // Broadcast update
            broadcast(new CallUpdated($call->fresh()));

            $this->info("   ✅ Cleaned call {$call->linkedid} - {$reason}");

            if ($this->isVerbose) {
                $this->line("      - Updated Call record");
                $this->line("      - Updated {$updatedLegs} CallLeg records");
                $this->line("      - Updated {$updatedSegments} BridgeSegment records");
                $this->line("      - Broadcasted update event");
            }

        } catch (\Exception $e) {
            DB::rollBack();

            // Store failed result for JSON logging
            $this->detailedResults[] = [
                'linkedid' => $call->linkedid,
                'agent_exten' => $call->agent_exten,
                'other_party' => $call->other_party,
                'reason' => $reason,
                'type' => $type,
                'error' => $e->getMessage(),
                'status' => 'failed'
            ];

            throw $e;
        }
    }

    private function displayActiveChannels(array $activeChannels): void
    {
        if (empty($activeChannels)) {
            $this->line("   📞 No active channels found");
            return;
        }

        $this->line("\n📞 ACTIVE CHANNELS:");
        $this->line('==================');

        foreach ($activeChannels as $index => $channel) {
            $channelName = $channel['channel'] ?? 'Unknown';
            $uniqueId = $channel['uniqueid'] ?? 'N/A';
            $linkedId = $channel['linkedid'] ?? 'N/A';
            $context = $channel['context'] ?? 'N/A';
            $extension = $channel['extension'] ?? 'N/A';
            $state = $channel['state'] ?? 'N/A';

            $this->line(sprintf(
                "%d. Channel: %s",
                $index + 1,
                $this->colorize($channelName, 'info')
            ));

            if ($this->isVerbose) {
                $this->line("     UniqueID: {$uniqueId}");
                $this->line("     LinkedID: {$linkedId}");
                $this->line("     Context: {$context}");
                $this->line("     Extension: {$extension}");
                $this->line("     State: {$state}");
                $this->line("");
            }
        }

        if (!$this->isVerbose) {
            $this->line("   💡 Use -v flag to see detailed channel information");
        }
        $this->line("");
    }

    private function displayStuckCallsDetails(array $stuckCalls): void
    {
        $this->line("\n📋 STUCK CALLS DETAILS:");
        $this->line('======================');

        foreach ($stuckCalls as $index => $callData) {
            $call = $callData['call'];
            $reason = $callData['reason'];

            $this->line(sprintf(
                "%d. LinkedID: %s | Agent: %s | Other: %s | %s",
                $index + 1,
                $call->linkedid,
                $call->agent_exten ?? 'N/A',
                $call->other_party ?? 'N/A',
                $reason
            ));
        }
    }

    private function displayDryRunResults(array $callsToCleanup): void
    {
        $this->line("\n🔍 DRY RUN RESULTS - CALLS THAT WOULD BE CLEANED:");
        $this->line('================================================');

        foreach ($callsToCleanup as $index => $callData) {
            $call = $callData['call'];
            $reason = $callData['reason'];

            $this->line(sprintf(
                "%d. LinkedID: %s | Agent: %s | Other: %s | %s",
                $index + 1,
                $call->linkedid,
                $call->agent_exten ?? 'N/A',
                $call->other_party ?? 'N/A',
                $reason
            ));

            if ($this->isVerbose) {
                $activeLegs = CallLeg::where('linkedid', $call->linkedid)
                    ->whereNull('hangup_at')
                    ->count();

                $activeSegments = BridgeSegment::where('linkedid', $call->linkedid)
                    ->whereNull('left_at')
                    ->count();

                $this->line("     - Would update Call record (set ended_at, disposition, hangup_cause)");
                $this->line("     - Would update {$activeLegs} CallLeg records");
                $this->line("     - Would update {$activeSegments} BridgeSegment records");
                $this->line("     - Would broadcast CallUpdated event");
            }
        }

        $this->line("\n🔍 DRY RUN SUMMARY:");
        $this->line("   - Calls that would be cleaned: " . count($callsToCleanup));
        $this->line("   - No actual changes were made to the database");
        $this->line("   - Run without --dry-run to perform actual cleanup");
    }

    private function displayStartupBanner(): void
    {
        $mode = $this->isDryRun ? 'DRY RUN' : 'CLEANUP';

        $this->info("🧹 Starting Stuck Calls {$mode} Script...");
        $this->line("🔌 AMI: {$this->host}:{$this->port}");
        $this->line("👤 User: {$this->username}");
        $this->line("⏰ Ringing threshold: {$this->ringingThreshold} minutes");
        $this->line("⏰ Answered threshold: {$this->answeredThreshold} minutes");

        if ($this->option('skip-ami')) {
            $this->line("⚡ Mode: INSTANT (database-only, no AMI verification)");
        } else {
            $this->line("⚡ Mode: FAST (minimal timeouts, no confirmations)");
        }

        if ($this->isDryRun) {
            $this->line("🔍 Mode: DRY RUN (no changes will be made)");
        }

        $this->line('');
    }

    private function displaySummary(): void
    {
        $executionTime = round((microtime(true) - $this->startTime) * 1000, 2);

        $this->line("\n✅ CLEANUP SUMMARY:");
        $this->line('==================');

        if ($this->isDryRun) {
            $this->line("🔍 DRY RUN completed");
        } else {
            $this->line("🧹 Cleaned calls: {$this->colorize($this->cleanedCount, 'info')}");
            $this->line("❌ Failed calls: {$this->colorize($this->failedCount, 'error')}");
        }

        $this->line("⏱️ Execution time: {$executionTime}ms");
        $this->line("📅 Completed at: " . Carbon::now()->format('Y-m-d H:i:s'));
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

    /**
     * Write elegant final cleanup report with complete results
     */
    private function writeElegantCleanupReport(array $stuckCalls, array $activeChannels, array $callsToCleanup): ?string
    {
        $timestamp = Carbon::now()->format('Y-m-d_H-i-s');
        $filename = base_path("debug/cleanup_report_{$timestamp}.json");

        // Create debug directory if it doesn't exist
        $debugDir = base_path('debug');
        if (!is_dir($debugDir)) {
            mkdir($debugDir, 0755, true);
        }

        $executionTimeMs = round((microtime(true) - $this->startTime) * 1000, 2);

        // Create elegant, comprehensive report
        $report = [
            'cleanup_report' => [
                'timestamp' => Carbon::now()->toISOString(),
                'execution_time_ms' => $executionTimeMs,
                'mode' => $this->isDryRun ? 'dry_run' : 'cleanup',
                'ami_verification' => !$this->option('skip-ami'),
                'thresholds' => [
                    'ringing_minutes' => $this->ringingThreshold,
                    'answered_minutes' => $this->answeredThreshold
                ]
            ],
            'active_channels' => [
                'total_count' => count($activeChannels),
                'raw_ami_response' => $this->rawAmiResponse,
                'channels' => array_map(function($channel, $index) {
                    return [
                        'id' => $index + 1,
                        'channel' => $channel['channel'] ?? 'Unknown',
                        'unique_id' => $channel['uniqueid'] ?? null,
                        'linked_id' => $channel['linkedid'] ?? null,
                        'context' => $channel['context'] ?? null,
                        'extension' => $channel['extension'] ?? null,
                        'state' => $channel['state'] ?? null,
                        'state_description' => $this->getChannelStateDescription($channel['state'] ?? null)
                    ];
                }, $activeChannels, array_keys($activeChannels))
            ],
            'stuck_calls_analysis' => [
                'total_found' => count($stuckCalls),
                'ringing_calls' => count(array_filter($stuckCalls, fn($c) => $c['type'] === 'ringing')),
                'answered_calls' => count(array_filter($stuckCalls, fn($c) => $c['type'] === 'answered')),
                'calls' => array_map(function($callData, $index) use ($callsToCleanup) {
                    $call = $callData['call'];
                    // Check if this call is marked for cleanup by comparing linkedids
                    $cleanupLinkedIds = array_column(array_column($callsToCleanup, 'call'), 'linkedid');
                    $isMarkedForCleanup = in_array($call->linkedid, $cleanupLinkedIds);
                    
                    return [
                        'id' => $index + 1,
                        'linked_id' => $call->linkedid,
                        'agent_extension' => $call->agent_exten,
                        'other_party' => $call->other_party,
                        'direction' => $call->direction,
                        'type' => $callData['type'],
                        'started_at' => $call->started_at?->toISOString(),
                        'answered_at' => $call->answered_at?->toISOString(),
                        'duration_minutes' => $this->calculateCallDuration($call),
                        'reason' => $callData['reason'],
                        'status' => $isMarkedForCleanup ? 'marked_for_cleanup' : 'has_active_channels'
                    ];
                }, $stuckCalls, array_keys($stuckCalls))
            ],
            'cleanup_results' => [
                'total_marked_for_cleanup' => count($callsToCleanup),
                'successfully_cleaned' => $this->cleanedCount,
                'failed_cleanups' => $this->failedCount,
                'calls_with_active_channels' => count($stuckCalls) - count($callsToCleanup),
                'detailed_results' => $this->detailedResults
            ]
        ];

        try {
            $jsonContent = json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
            file_put_contents($filename, $jsonContent, LOCK_EX);

            $this->info("📋 Elegant cleanup report: {$filename}");
            return $filename;

        } catch (\Exception $e) {
            $this->error("❌ Failed to write elegant report: {$e->getMessage()}");
            return null;
        }
    }

    /**
     * Get human-readable channel state description
     */
    private function getChannelStateDescription(?string $state): string
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

        return $stateMap[$state] ?? 'Unknown';
    }

    /**
     * Display elegant summary in console
     */
    private function displayElegantSummary(array $activeChannels, array $stuckCalls, array $callsToCleanup): void
    {
        $this->line("\n" . str_repeat('=', 60));
        $this->info("🎯 CALL CENTER CLEANUP REPORT");
        $this->line(str_repeat('=', 60));

        // Execution Info
        $executionTime = round((microtime(true) - $this->startTime) * 1000, 2);
        $this->line("⏱️  Execution Time: {$this->colorize($executionTime . 'ms', 'info')}");
        $this->line("🕐 Completed At: " . Carbon::now()->format('Y-m-d H:i:s'));
        $this->line("🔧 Mode: " . ($this->isDryRun ? $this->colorize('DRY RUN', 'comment') : $this->colorize('CLEANUP', 'info')));
        $this->line("📡 AMI Verification: " . ($this->option('skip-ami') ? $this->colorize('SKIPPED', 'error') : $this->colorize('ENABLED', 'info')));

        $this->line("\n" . str_repeat('-', 30) . " CHANNELS " . str_repeat('-', 30));

        // Active Channels Summary
        $channelCount = count($activeChannels);
        if ($channelCount > 0) {
            $this->line("📞 Active Channels: {$this->colorize($channelCount, 'info')}");

            // Group channels by state
            $channelsByState = [];
            foreach ($activeChannels as $channel) {
                $state = $this->getChannelStateDescription($channel['state'] ?? null);
                $channelsByState[$state] = ($channelsByState[$state] ?? 0) + 1;
            }

            foreach ($channelsByState as $state => $count) {
                $this->line("   └─ {$state}: {$this->colorize($count, 'comment')}");
            }
        } else {
            $this->line("📞 Active Channels: {$this->colorize('None', 'comment')}");
        }

        $this->line("\n" . str_repeat('-', 30) . " ANALYSIS " . str_repeat('-', 30));

        // Stuck Calls Analysis
        $stuckCount = count($stuckCalls);
        if ($stuckCount > 0) {
            $this->line("🔍 Stuck Calls Found: {$this->colorize($stuckCount, 'error')}");

            $ringingCount = count(array_filter($stuckCalls, fn($c) => $c['type'] === 'ringing'));
            $answeredCount = count(array_filter($stuckCalls, fn($c) => $c['type'] === 'answered'));

            if ($ringingCount > 0) {
                $this->line("   └─ Ringing too long: {$this->colorize($ringingCount, 'error')}");
            }
            if ($answeredCount > 0) {
                $this->line("   └─ Answered too long: {$this->colorize($answeredCount, 'error')}");
            }
        } else {
            $this->line("🔍 Stuck Calls Found: {$this->colorize('None', 'info')}");
        }

        // Cleanup Results
        if ($stuckCount > 0) {
            $this->line("\n" . str_repeat('-', 30) . " RESULTS " . str_repeat('-', 30));

            $cleanupCount = count($callsToCleanup);
            $activeCallsCount = $stuckCount - $cleanupCount;

            if ($this->isDryRun) {
                $this->line("🔍 Would Clean: {$this->colorize($cleanupCount, 'comment')}");
                $this->line("✅ Has Active Channels: {$this->colorize($activeCallsCount, 'info')}");
            } else {
                $this->line("🧹 Cleaned Successfully: {$this->colorize($this->cleanedCount, 'info')}");
                if ($this->failedCount > 0) {
                    $this->line("❌ Failed to Clean: {$this->colorize($this->failedCount, 'error')}");
                }
                if ($activeCallsCount > 0) {
                    $this->line("✅ Preserved (Active): {$this->colorize($activeCallsCount, 'info')}");
                }
            }
        }

        $this->line("\n" . str_repeat('=', 60));

        if ($stuckCount === 0 && $channelCount > 0) {
            $this->info("🎉 System is healthy - all channels are functioning normally!");
        } elseif ($stuckCount === 0) {
            $this->info("✨ No active calls or stuck calls - system is idle");
        } elseif (!$this->isDryRun && $this->cleanedCount > 0) {
            $this->info("🎯 Cleanup completed successfully!");
        }
    }

    /**
     * Determine which phase of cleanup this log represents
     */
    private function determineCleanupPhase(?array $stuckCalls, ?array $activeChannels): string
    {
        if ($stuckCalls !== null && $activeChannels !== null) {
            return 'cross_reference_phase';
        } elseif ($stuckCalls !== null) {
            return 'stuck_calls_identification';
        } elseif ($activeChannels !== null) {
            return 'ami_channel_query';
        } else {
            return 'ami_query_only';
        }
    }

    /**
     * Calculate call duration in minutes for display
     */
    private function calculateCallDuration($call): ?float
    {
        $now = Carbon::now();
        if ($call->answered_at) {
            return round($call->answered_at->diffInMinutes($now, true), 2);
        } elseif ($call->started_at) {
            return round($call->started_at->diffInMinutes($now, true), 2);
        }
        return null;
    }

    /**
     * Write final comprehensive cleanup report
     */
    private function writeFinalCleanupReport(array $stuckCalls, array $activeChannels, array $callsToCleanup): void
    {
        $timestamp = Carbon::now()->format('Y-m-d_H-i-s');
        $filename = base_path("debug/cleanup_final_report_{$timestamp}.json");

        $reportData = [
            'timestamp' => Carbon::now()->toISOString(),
            'execution_summary' => [
                'ringing_threshold_minutes' => $this->ringingThreshold,
                'answered_threshold_minutes' => $this->answeredThreshold,
                'dry_run' => $this->isDryRun,
                'skip_ami' => $this->option('skip-ami'),
                'execution_time_ms' => round((microtime(true) - $this->startTime) * 1000, 2),
                'total_stuck_calls_found' => count($stuckCalls),
                'total_active_channels' => count($activeChannels),
                'total_calls_cleaned' => $this->cleanedCount,
                'total_failed_cleanups' => $this->failedCount,
                'calls_marked_for_cleanup' => count($callsToCleanup)
            ],
            'stuck_calls_found' => array_map(function($callData) {
                $call = $callData['call'];
                return [
                    'linkedid' => $call->linkedid,
                    'agent_exten' => $call->agent_exten,
                    'other_party' => $call->other_party,
                    'direction' => $call->direction,
                    'started_at' => $call->started_at?->toISOString(),
                    'answered_at' => $call->answered_at?->toISOString(),
                    'reason' => $callData['reason'],
                    'type' => $callData['type'],
                    'duration_minutes' => $this->calculateCallDuration($call)
                ];
            }, $stuckCalls),
            'active_channels' => $activeChannels,
            'calls_marked_for_cleanup' => array_map(function($callData) {
                $call = $callData['call'];
                return [
                    'linkedid' => $call->linkedid,
                    'agent_exten' => $call->agent_exten,
                    'other_party' => $call->other_party,
                    'reason' => $callData['reason'],
                    'type' => $callData['type']
                ];
            }, $callsToCleanup),
            'cleanup_results' => $this->detailedResults
        ];

        try {
            $jsonContent = json_encode($reportData, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
            file_put_contents($filename, $jsonContent, LOCK_EX);
            $this->info("📋 Final cleanup report written to: {$filename}");
        } catch (\Exception $e) {
            $this->error("❌ Failed to write final report: {$e->getMessage()}");
        }
    }
}
