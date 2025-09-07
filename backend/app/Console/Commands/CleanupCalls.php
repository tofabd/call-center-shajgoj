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
 * 2. Querying AMI to get active channels
 * 3. Cross-referencing to find calls with no active channels
 * 4. Cleaning up orphaned calls in database
 * 5. Broadcasting updates to frontend
 * 
     * Usage Examples:
     * - php artisan calls:cleanup-stuck --dry-run                    # Preview cleanup
     * - php artisan calls:cleanup-stuck                              # Fast cleanup with AMI verification
     * - php artisan calls:cleanup-stuck --skip-ami                   # INSTANT database-only cleanup (no network delays)
     * - php artisan calls:cleanup-stuck --dry-run -v                 # Verbose preview
     * - php artisan calls:cleanup-stuck --ringing-threshold=3        # Custom threshold
     * 
     * Note: Use --skip-ami for truly instant execution (skips AMI network calls)
     */
class CleanupCalls extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'calls:cleanup-stuck
                            {--dry-run : Show what would be cleaned without making changes}
                            {--ringing-threshold=1 : Override ringing threshold in minutes}
                            {--answered-threshold=2 : Override answered threshold in minutes}
                            {--force : Deprecated - cleanup now runs without confirmation by default}
                            {--fast : Deprecated - all operations now use minimal timeouts}
                            {--skip-ami : Skip AMI verification - database-only cleanup (instant)}';

    /**
     * The console command description.
     */
    protected $description = 'Cleanup stuck calls by querying AMI and updating database (fast execution, no confirmations)';

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

    public function __construct()
    {
        parent::__construct();

        // Get AMI credentials from configuration
        $this->host = config('ami.connection.host');
        $this->port = config('ami.connection.port');
        $this->username = config('ami.connection.username');
        $this->password = config('ami.connection.password');
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

            if (empty($stuckCalls)) {
                $this->info('✅ No stuck calls found in database');
                return 0;
            }

            $this->info("📞 Found {$this->colorize(count($stuckCalls), 'info')} stuck calls");
            
            if ($this->isVerbose) {
                $this->displayStuckCallsDetails($stuckCalls);
            }

            // Phase 2: Query active channels from AMI (or skip for instant cleanup)
            if ($this->option('skip-ami')) {
                $this->info('⚡ Phase 2: Skipping AMI verification for instant cleanup...');
                $activeChannels = [];
                
                // Write JSON file even when skipping AMI
                $actionId = 'CleanupScript-SKIPPED-' . time() . '-' . rand(1000, 9999);
                $response = "AMI verification skipped by user request (--skip-ami flag)\r\n"
                          . "Timestamp: " . date('Y-m-d H:i:s') . "\r\n"
                          . "Mode: Database-only cleanup\r\n";
                $this->info("📄 Writing AMI skip status to JSON file...");
                $this->writeEventsToJsonImmediate($response, $actionId);
                
                $this->info('📞 AMI verification skipped - proceeding with database-only cleanup');
            } else {
                $this->info('📡 Phase 2: Querying active channels from AMI...');
                $activeChannels = $this->queryAmiChannels();
                $this->info("📞 Found {$this->colorize(count($activeChannels), 'info')} active channels from AMI");
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

            // Phase 5: Display summary
            $this->displaySummary();

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
            $duration = $now->diffInMinutes($call->started_at);
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
            $duration = $now->diffInMinutes($call->answered_at);
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

    private function queryAmiChannels(): array
    {
        $actionId = 'CleanupScript-' . time() . '-' . rand(1000, 9999);
        $response = '';
        $channels = [];

        try {
            // Use reusable connection for better performance
            $socket = $this->getAmiConnection();

            if ($this->isVerbose) {
                $this->line('✅ Using optimized AMI connection');
            }

            // Query active channels
            $channels = $this->queryActiveChannels($socket);

            // Keep connection open for potential reuse (closed in cleanup)

        } catch (\Exception $e) {
            // Close connection on error
            $this->closeAmiConnection();
            
            // Create error response for JSON logging
            $response = "Error: Connection failed - " . $e->getMessage() . "\r\n"
                      . "Host: {$this->host}:{$this->port}\r\n" 
                      . "Timestamp: " . date('Y-m-d H:i:s') . "\r\n";
            
            $this->warn("⚠️ AMI query failed: {$e->getMessage()}");
            $this->warn('   Continuing with database-only cleanup...');
            
            // ALWAYS write JSON file even on connection failure
            $this->info("📄 Writing AMI error to JSON file...");
            $this->writeEventsToJsonImmediate($response, $actionId);
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
        socket_set_option($socket, SOL_SOCKET, SO_RCVTIMEO, ['sec' => 5, 'usec' => 0]);
        socket_set_option($socket, SOL_SOCKET, SO_SNDBUF, 65536); // 64KB send buffer
        socket_set_option($socket, SOL_SOCKET, SO_RCVBUF, 65536); // 64KB receive buffer
        socket_set_option($socket, SOL_TCP, TCP_NODELAY, 1);      // Disable Nagle algorithm
        
        if (!socket_connect($socket, $this->host, $this->port)) {
            throw new \Exception("Socket connection failed: " . socket_strerror(socket_last_error($socket)));
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
            
            // Parse response with optimized parsing
            $channels = $this->parseChannelsOptimized($response);
            
        } catch (\Exception $e) {
            $response = "Error: " . $e->getMessage() . "\r\n";
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
                if ($currentChannel && count($currentChannel) >= 3) { // Minimum required fields
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
        if ($currentChannel && count($currentChannel) >= 3) {
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
     * Write all AMI events to JSON file with streaming for large responses
     */
    private function writeEventsToJsonImmediate(string $response, string $actionId): void
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
            'total_events' => count($events),
            'raw_response_size' => strlen($response),
            'events' => $events
        ];
        
        // Only include raw response if it's not too large (< 1MB)
        if (strlen($response) < 1048576) {
            $logData['raw_response'] = $response;
        } else {
            $logData['raw_response'] = '[Response too large - omitted for performance]';
            $logData['raw_response_truncated'] = true;
        }

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
            CallLeg::where('linkedid', $call->linkedid)
                ->whereNull('hangup_at')
                ->update([
                    'hangup_at' => $now,
                    'hangup_cause' => 'Stuck call cleanup'
                ]);

            // Update BridgeSegments
            BridgeSegment::where('linkedid', $call->linkedid)
                ->whereNull('left_at')
                ->update([
                    'left_at' => $now
                ]);

            DB::commit();

            // Broadcast update
            broadcast(new CallUpdated($call->fresh()));

            $this->info("   ✅ Cleaned call {$call->linkedid} - {$reason}");

            if ($this->isVerbose) {
                $this->line("      - Updated Call record");
                $this->line("      - Updated CallLeg records");  
                $this->line("      - Updated BridgeSegment records");
                $this->line("      - Broadcasted update event");
            }

        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
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
}