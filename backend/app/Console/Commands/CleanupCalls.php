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
 * 1. Finding calls in database that exceed time thresholds (ringing > 2min, answered > 3min)
 * 2. Querying AMI to get active channels
 * 3. Cross-referencing to find calls with no active channels
 * 4. Cleaning up orphaned calls in database
 * 5. Broadcasting updates to frontend
 * 
 * Usage Examples:
 * - php artisan calls:cleanup-stuck --dry-run                    # Preview cleanup
 * - php artisan calls:cleanup-stuck                              # Actual cleanup  
 * - php artisan calls:cleanup-stuck --dry-run -v                 # Verbose preview
 * - php artisan calls:cleanup-stuck --ringing-threshold=5        # Custom threshold
 * - php artisan calls:cleanup-stuck --force                      # Skip confirmation
 */
class CleanupCalls extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'calls:cleanup-stuck
                            {--dry-run : Show what would be cleaned without making changes}
                            {--ringing-threshold=2 : Override ringing threshold in minutes}
                            {--answered-threshold=3 : Override answered threshold in minutes}
                            {--force : Skip confirmation prompts}
                            {--fast : Use minimal timeouts for immediate execution (fail-fast)}';

    /**
     * The console command description.
     */
    protected $description = 'Cleanup stuck calls by querying AMI and updating database';

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
        $this->isFast = $this->option('fast'); // Fast fail-fast mode
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

            // Phase 2: Query active channels from AMI
            $this->info('📡 Phase 2: Querying active channels from AMI...');
            $activeChannels = $this->queryAmiChannels();
            
            $this->info("📞 Found {$this->colorize(count($activeChannels), 'info')} active channels from AMI");

            // Phase 3: Cross-reference calls with channels
            $this->info('🔗 Phase 3: Cross-referencing calls with active channels...');
            $callsToCleanup = $this->crossReferenceCallsWithChannels($stuckCalls, $activeChannels);

            if (empty($callsToCleanup)) {
                $this->info('✅ All stuck calls still have active channels - no cleanup needed');
                return 0;
            }

            $this->info("🧹 Identified {$this->colorize(count($callsToCleanup), 'info')} calls for cleanup");

            // Show confirmation for actual cleanup
            if (!$this->isDryRun && !$this->option('force')) {
                if (!$this->confirm('Do you want to proceed with cleaning up these calls?')) {
                    $this->info('🚫 Cleanup cancelled by user');
                    return 0;
                }
            }

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

            return 0;

        } catch (\Exception $e) {
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

    private function queryAmiChannels(): array
    {
        $socket = null;

        try {
            // Connect to AMI
            $connectionTimeout = $this->isFast ? 1 : 2; // 1s for fast mode, 2s normal
            $socket = fsockopen($this->host, $this->port, $errno, $errstr, $connectionTimeout);
            if (!$socket) {
                throw new \Exception("Failed to connect to AMI: $errstr ($errno)");
            }

            if ($this->isVerbose) {
                $this->line('✅ Socket connected to AMI');
            }

            // Login to AMI
            if (!$this->loginToAmi($socket)) {
                throw new \Exception('AMI authentication failed');
            }

            if ($this->isVerbose) {
                $this->line('🔐 AMI authentication successful');
            }

            // Query active channels
            $channels = $this->queryActiveChannels($socket);

            // Logout and close
            $this->sendLogoff($socket);
            fclose($socket);

            return $channels;

        } catch (\Exception $e) {
            if ($socket) {
                fclose($socket);
            }
            
            $this->warn("⚠️ AMI query failed: {$e->getMessage()}");
            $this->warn('   Continuing with database-only cleanup...');
            
            return [];
        }
    }

    private function loginToAmi($socket): bool
    {
        // Wait for initial AMI banner
        $this->readResponse($socket);

        $loginCmd = "Action: Login\r\n"
                 . "Username: {$this->username}\r\n"
                 . "Secret: {$this->password}\r\n\r\n";

        fwrite($socket, $loginCmd);
        $response = $this->readResponse($socket);

        return strpos($response, 'Response: Success') !== false;
    }

    private function queryActiveChannels($socket): array
    {
        $actionId = 'CleanupScript-' . time() . '-' . rand(1000, 9999);
        $command = "Action: CoreShowChannels\r\n"
                 . "Events: off\r\n"
                 . "ActionID: {$actionId}\r\n\r\n";

        fwrite($socket, $command);
        $response = $this->readCompleteResponse($socket, 'Event: CoreShowChannelsComplete');

        return $this->parseCoreShowChannelsResponse($response);
    }

    private function sendLogoff($socket): void
    {
        $logoffAction = "Action: Logoff\r\n\r\n";
        fwrite($socket, $logoffAction);
        if (!$this->isFast) {
            usleep(50000); // Skip delay in fast mode, reduce to 50ms in normal mode
        }
    }

    private function readResponse($socket): string
    {
        $response = '';
        $responseTimeout = $this->isFast ? 2 : 5; // 2s for fast mode, 5s normal
        $timeout = time() + $responseTimeout;

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
        $mainTimeout = $this->isFast ? 3 : ($this->timeout / 1000); // 3s for fast mode
        $timeout = time() + $mainTimeout;

        while (!feof($socket) && time() < $timeout) {
            $buffer = fgets($socket);
            if ($buffer === false) {
                $waitTime = $this->isFast ? 10000 : 50000; // 10ms for fast mode, 50ms normal
                usleep($waitTime);
                continue;
            }

            $response .= $buffer;

            if (strpos($response, $completionEvent) !== false) {
                // Read a bit more to ensure we get the complete response
                $additionalTimeout = $this->isFast ? 0.5 : 1; // Minimal additional wait in fast mode
                $additionalTimeoutEnd = time() + $additionalTimeout;
                while (!feof($socket) && time() < $additionalTimeoutEnd) {
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
                $currentChannel = [];
                continue;
            }

            if (!$currentChannel) continue;

            // Parse channel fields we care about
            if (strpos($line, 'Channel: ') !== false) {
                $currentChannel['channel'] = trim(substr($line, 9));
            } elseif (strpos($line, 'Uniqueid: ') !== false) {
                $currentChannel['uniqueid'] = trim(substr($line, 10));
            } elseif (strpos($line, 'Linkedid: ') !== false) {
                $currentChannel['linkedid'] = trim(substr($line, 10));
            }
        }

        // Add the last channel if exists
        if ($currentChannel) {
            $channels[] = $currentChannel;
        }

        return $channels;
    }

    private function crossReferenceCallsWithChannels(array $stuckCalls, array $activeChannels): array
    {
        $callsToCleanup = [];

        foreach ($stuckCalls as $stuckCallData) {
            $call = $stuckCallData['call'];
            $hasActiveChannel = false;

            // Get call legs for this call
            $callLegs = CallLeg::where('linkedid', $call->linkedid)
                ->whereNull('hangup_at')
                ->get();

            if ($this->isVerbose) {
                $this->line("   Checking call {$call->linkedid}: {$callLegs->count()} active legs");
            }

            // Check if any call leg has matching active channel
            foreach ($callLegs as $leg) {
                foreach ($activeChannels as $channel) {
                    if (isset($channel['uniqueid']) && $leg->uniqueid === $channel['uniqueid']) {
                        $hasActiveChannel = true;
                        if ($this->isVerbose) {
                            $this->line("     ✓ Found active channel: {$channel['channel']}");
                        }
                        break 2;
                    }
                    if (isset($channel['linkedid']) && $leg->linkedid === $channel['linkedid']) {
                        $hasActiveChannel = true;
                        if ($this->isVerbose) {
                            $this->line("     ✓ Found active linked channel: {$channel['channel']}");
                        }
                        break 2;
                    }
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
        
        if ($this->isDryRun) {
            $this->line("🔍 Mode: DRY RUN (no changes will be made)");
        }
        
        if ($this->isFast) {
            $this->line("⚡ Mode: FAST (minimal timeouts - fail-fast)");
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