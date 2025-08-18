<?php
namespace App\Console\Commands;


use Illuminate\Console\Command;

use Illuminate\Support\Facades\Log;
use App\Models\Call;
use App\Models\CallLeg;
use App\Models\BridgeSegment;
use App\Events\CallUpdated;

/**
 * This is modified version of ListenToAmi
 */
 class ListenToAmi extends Command
 {
     /**
      * The name and signature of the console command.
      *
      * @var string
      */
     protected $signature = 'app:listen-to-ami';

     /**
      * The console command description.
      *
      * @var string
      */
     protected $description = 'Listen to Asterisk AMI for incoming calls';

     private $socket;
     private $connected = false;

     /**
      * Execute the console command.
      */
     public function handle()
     {

        // Mellowhost Server

        //  $host = env('AMI_HOST', '103.177.125.93');
        //  $port = env('AMI_PORT', 5038);
        //  $username = env('AMI_USERNAME', 'admin');
        //  $password = env('AMI_PASSWORD', 'talent1212');


        //  Shajgoj Server

         $host = env('AMI_HOST', '103.177.125.83');
         $port = env('AMI_PORT', 5038);
         $username = env('AMI_USERNAME', 'admin');
         $password = env('AMI_PASSWORD', 'Tractor@0152');

         try {
             // Connect to Asterisk AMI
             $this->socket = fsockopen($host, $port, $errno, $errstr, 10);

             if (!$this->socket) {
                 throw new \Exception("Connection failed: $errstr ($errno)");
             }

             // Login to AMI
             $this->login($username, $password);

             if (!$this->connected) {
                 throw new \Exception("Authentication failed");
             }

             $this->info('Connected to Asterisk AMI. Listening for calls...');

             // Enable event monitoring
             $this->sendCommand("Events: on");

             // Main event loop
             while ($this->connected && !feof($this->socket)) {
                 $response = $this->readResponse();

                 if (!$response) {
                     continue;
                 }

                 // Extract exact Event name
                 $eventName = null;
                 if (preg_match('/^Event:\\s*(.+)$/m', $response, $m)) {
                     $eventName = trim($m[1]);
                 }

                 if (!$eventName) {
                     continue;
                 }

                 // Only process specific events; avoid treating HangupRequest as Hangup
                 if (
                     $eventName === 'Newchannel' ||
                     $eventName === 'Newstate' ||
                     $eventName === 'Hangup' ||
                     $eventName === 'DialBegin' ||
                     $eventName === 'DialEnd' ||
                     $eventName === 'BridgeEnter' ||
                     $eventName === 'BridgeLeave'
                 ) {
                     $this->processEvent($response, $eventName);
                 } else {
                     // Optionally log but do not process
                     // $this->info("Ignoring AMI event: {$eventName}");
                 }
             }

         } catch (\Exception $e) {
             $this->error("AMI Error: " . $e->getMessage());
             return 1;
         } finally {
             if ($this->socket) {
                 fclose($this->socket);
             }
         }
     }

     private function login($username, $password)
     {
         $loginCmd = "Action: Login\r\n"
                  . "Username: $username\r\n"
                  . "Secret: $password\r\n"
                  . "Events: on\r\n\r\n";

         fwrite($this->socket, $loginCmd);
         $response = $this->readResponse();

         if (strpos($response, 'Response: Success') !== false) {
             $this->connected = true;
         }
     }

     private function sendCommand($command)
     {
         if ($this->connected) {
             fwrite($this->socket, $command . "\r\n\r\n");
         }
     }

     private function readResponse()
     {
         $response = '';
         $timeout = time() + 1; // 1 second timeout

         while (!feof($this->socket) && time() < $timeout) {
             $buffer = fgets($this->socket);
             if ($buffer === false) {
                 break;
             }
             $response .= $buffer;

             // Check if we've reached the end of the response
             if ($buffer === "\r\n") {
                 break;
             }
         }

         return $response;
     }

    /**
     * Normalize a phone-like string to a canonical form, keeping leading '+' if present.
     */
    private function normalizeNumber($value): ?string
    {
        if (!is_string($value)) {
            return null;
        }
        $raw = trim($value);
        if ($raw === '' || stripos($raw, 'unknown') !== false) {
            return null;
        }
        if (substr($raw, 0, 1) === '+') {
            $digits = preg_replace('/\D+/', '', substr($raw, 1));
            return $digits !== '' ? ('+' . $digits) : null;
        }
        $digits = preg_replace('/\D+/', '', $raw);
        return $digits !== '' ? $digits : null;
    }

    /** Determine if the value looks like an agent extension (3-5 digits). */
    private function isLikelyExtension(?string $value): bool
    {
        $norm = $this->normalizeNumber($value);
        if ($norm === null) {
            return false;
        }
        return (bool)preg_match('/^\d{3,5}$/', ltrim($norm, '+'));
    }

    /** Determine if the value looks like an external phone number (>= 6 digits). */
    private function isLikelyExternalNumber(?string $value): bool
    {
        $norm = $this->normalizeNumber($value);
        if ($norm === null) {
            return false;
        }
        return strlen(ltrim($norm, '+')) >= 6;
    }

    /** Extract best-guess customer number for an incoming call. */
    private function extractIncomingNumber(array $fields): ?string
    {
        $candidateOrder = [
            $fields['CallerIDNum'] ?? null,
            $fields['ConnectedLineNum'] ?? null,
        ];
        foreach ($candidateOrder as $cand) {
            if ($this->isLikelyExternalNumber($cand)) {
                return $this->normalizeNumber($cand);
            }
        }
        return null;
    }

    /** Extract best-guess dialed party for an outgoing call. */
    private function extractOutgoingNumber(array $fields): ?string
    {
        // Priority order for outgoing calls - prefer actual dialed numbers
        $candidateOrder = [
            $this->extractNumberFromDialString($fields['DialString'] ?? null), // Best: extract from DialString
            $fields['DestCallerIDNum'] ?? null,     // Good: destination from dial events
            $fields['ConnectedLineNum'] ?? null,    // OK: becomes the real B-party after bridge
            $fields['Exten'] ?? null,               // Last resort: might be extension or number
            $fields['CallerIDNum'] ?? null,         // Fallback: sometimes trunk leg reports dest here
        ];

        foreach ($candidateOrder as $cand) {
            if ($this->isLikelyExternalNumber($cand)) {
                $normalized = $this->normalizeNumber($cand);
                if ($normalized) {
                    return $normalized;
                }
            }
        }
        return null;
    }

    /** Extract phone number from DialString (removes trunk prefix like "BDCOM75/") */
    private function extractNumberFromDialString(?string $dialString): ?string
    {
        if (!$dialString) {
            return null;
        }

        // Handle patterns like:
        // "BDCOM75/01831317738" -> "01831317738"
        // "SIP/trunk/01234567890" -> "01234567890" (take last part)
        // "Local/1002@from-queue/n" -> ignore (not external number)

        // First, handle simple trunk/number pattern
        if (preg_match('/^[A-Z0-9]+\/([0-9+]+)$/', $dialString, $matches)) {
            return $matches[1];
        }

        // Handle complex patterns - take the last numeric part
        if (preg_match('/\/([0-9+]{6,})(?:\/|$)/', $dialString, $matches)) {
            return $matches[1];
        }

        // If it's all digits or starts with +, use as-is
        if (preg_match('/^[+]?[0-9]{6,}$/', $dialString)) {
            return $dialString;
        }

        // For other patterns, return null (probably not a phone number)
        return null;
    }

     private function processEvent($response, $eventType)
     {
         // Parse the response into fields
         $lines = explode("\r\n", $response);
         $fields = [];

         foreach ($lines as $line) {
             if (strpos($line, ': ') !== false) {
                 list($key, $value) = explode(': ', $line, 2);
                 $fields[trim($key)] = trim($value);
             }
         }

         // Skip events that don't have required fields
         if (!isset($fields['Uniqueid']) && !isset($fields['Linkedid'])) {
             return;
         }

         // Log all parsed fields to laravel.log
         Log::info("AMI {$eventType} fields", $fields);

         // $user = User::where('id', auth()->user()->id)->first();

         // broadcast(new DeleteArticleRequestReceived($user, $eventType));

         if ($eventType === 'Newchannel') {
             $this->handleNewchannel($fields);
         } elseif ($eventType === 'Newstate') {
             $this->handleNewstate($fields);
         } elseif ($eventType === 'Hangup') {
             $this->handleHangup($fields);
         } elseif ($eventType === 'DialBegin') {
             $this->handleDialBegin($fields);
         } elseif ($eventType === 'DialEnd') {
             $this->handleDialEnd($fields);
         } elseif ($eventType === 'BridgeEnter') {
             $this->handleBridgeEnter($fields);
         } elseif ($eventType === 'BridgeLeave') {
             $this->handleBridgeLeave($fields);
         } else {
             // For other events, just log the fields
             $this->info("\n{$eventType} Event Fields:");
             foreach ($fields as $key => $value) {
                 $this->line("$key: $value");
             }
             $this->line('------------------------');
         }
     }

     /**
      * Ensure a Call row exists for this linkedid and set basic fields if provided.
      */
     private function ensureCall(array $fields, array $hints = []): ?Call
     {
         $linkedid = $fields['Linkedid'] ?? null;
         if (!$linkedid) {
             return null;
         }
         $call = Call::firstOrNew(['linkedid' => $linkedid]);
         $changed = false;

         $isNewCall = !$call->exists;
         if ($isNewCall) {
             $call->started_at = $call->started_at ?? now();
             $changed = true;
         }

         // Direction from context or hint
         $direction = $hints['direction'] ?? null;
         if (!$direction) {
             $ctx = (string)($fields['Context'] ?? '');
             if (strpos($ctx, 'from-trunk') !== false) {
                 $direction = 'incoming';
             } elseif (strpos($ctx, 'macro-dialout-trunk') !== false || strpos($ctx, 'from-internal') !== false) {
                 $direction = 'outgoing';
             }
         }
         if ($direction && $call->direction !== $direction) {
             $call->direction = $direction;
             $changed = true;
         }

         // Other party (best effort here; refined by Dial/Bridge handlers)
         if (empty($call->other_party)) {
             if (($direction ?? null) === 'incoming') {
                 $num = $this->extractIncomingNumber($fields);
                 if ($num !== null) {
                     $call->other_party = $num;
                     $changed = true;
                 }
             } elseif (($direction ?? null) === 'outgoing') {
                 $num = $this->extractOutgoingNumber($fields);
                 if ($num !== null) {
                     $call->other_party = $num;
                     $changed = true;
                 }
             }
         }

         // Agent exten if visible on channel
         if (empty($call->agent_exten)) {
             $ch = (string)($fields['Channel'] ?? '');
             if (preg_match('/(?:SIP|PJSIP|Local)\/(\d{3,5})/', $ch, $m)) {
                 $call->agent_exten = $m[1];
                 $changed = true;
             }
         }

         // CRITICAL: Always save new calls to ensure foreign key constraint
         if ($changed || $isNewCall) {
             try {
             $call->save();
             } catch (\Exception $e) {
                 // Handle duplicate key gracefully - call might already exist from another event
                 if (strpos($e->getMessage(), 'Duplicate entry') !== false && strpos($e->getMessage(), 'linkedid') !== false) {
                     // Call already exists, fetch it
                     $call = Call::where('linkedid', $call->linkedid)->first();
                     if (!$call) {
                         throw $e; // Re-throw if we still can't find it
                     }
                 } else {
                     throw $e; // Re-throw other types of errors
                 }
             }
         }

         return $call;
     }

     /** Upsert CallLeg row for this uniqueid. */
     private function upsertCallLeg(array $fields, array $extra = []): void
     {
         $uniqueid = $fields['Uniqueid'] ?? null;
         $linkedid = $fields['Linkedid'] ?? null;

         if (!$uniqueid || !$linkedid) {
             $this->error("Cannot create CallLeg: missing uniqueid or linkedid");
             return;
         }

         // Verify master Call exists before creating leg
         $callExists = Call::where('linkedid', $linkedid)->exists();
         if (!$callExists) {
             $this->error("Cannot create CallLeg: master Call with linkedid {$linkedid} does not exist");
             return;
         }

         $leg = CallLeg::firstOrNew(['uniqueid' => $uniqueid]);
         $leg->linkedid = $linkedid;
         $leg->channel = $fields['Channel'] ?? $leg->channel;
         $leg->exten = $fields['Exten'] ?? $leg->exten;
         $leg->context = $fields['Context'] ?? $leg->context;
         $leg->channel_state = $fields['ChannelState'] ?? $leg->channel_state;
         $leg->channel_state_desc = $fields['ChannelStateDesc'] ?? $leg->channel_state_desc;
         $leg->state = $fields['State'] ?? $leg->state;
         $leg->callerid_num = $fields['CallerIDNum'] ?? $leg->callerid_num;
         $leg->callerid_name = $fields['CallerIDName'] ?? $leg->callerid_name;
         $leg->connected_line_num = $fields['ConnectedLineNum'] ?? $leg->connected_line_num;
         $leg->connected_line_name = $fields['ConnectedLineName'] ?? $leg->connected_line_name;

         foreach ($extra as $k => $v) {
             $leg->{$k} = $v;
         }

         try {
         $leg->save();
         } catch (\Exception $e) {
             $this->error("Failed to save CallLeg for uniqueid {$uniqueid}: " . $e->getMessage());
         }
     }

     private function handleNewchannel(array $fields)
     {
         if (!isset($fields['Uniqueid']) || !isset($fields['Linkedid'])) {
             $this->error("Missing required fields: Uniqueid or Linkedid");
             return;
         }

         try {
             // Option B (clean model): ensure master Call and CallLeg are tracked
             $this->ensureCall($fields);
             $this->upsertCallLeg($fields, [
                 'start_time' => now(),
             ]);
                         // Check if this is a new call (uniqueid equals linkedid)
            if ($fields['Uniqueid'] === $fields['Linkedid']) {
                // Also broadcast call created/ringing for the clean calls API
                $masterCall = Call::where('linkedid', $fields['Linkedid'])->first();
                if ($masterCall) {
                    broadcast(new CallUpdated($masterCall));
                    $this->info("📡 New call broadcasted (linkedid: {$masterCall->linkedid})");
                }
            }

            $this->info("New call tracked with Linkedid: {$fields['Linkedid']}");
            $this->line("Caller: {$fields['CallerIDNum']} ({$fields['CallerIDName']})");
            $this->line("Extension: {$fields['Exten']}");
            $this->line("Linked ID: {$fields['Linkedid']}");
             $this->line("Unique ID: {$fields['Uniqueid']}");
             $this->line('------------------------');
         } catch (\Exception $e) {
             $this->error("Failed to create/update call record: " . $e->getMessage());
         }
     }

     private function handleNewstate(array $fields)
     {
         if (!isset($fields['Uniqueid']) || !isset($fields['Linkedid'])) {
             $this->error("Missing required fields: Uniqueid or Linkedid");
             return;
         }

         try {
             // CRITICAL: Ensure Call exists BEFORE creating CallLeg
             $call = $this->ensureCall($fields);
             if (!$call) {
                 $this->error("Failed to create/find master call for linkedid: " . ($fields['Linkedid'] ?? 'unknown'));
                 return;
             }

             // Now safely create CallLeg
             $this->upsertCallLeg($fields);

             if ($call && empty($call->answered_at)) {
                 $stateDesc = strtolower((string)($fields['ChannelStateDesc'] ?? ''));
                 if ($stateDesc === 'up') {
                     $call->answered_at = now();
                     if ($call->started_at) {
                         $call->ring_seconds = max(0, $call->started_at->diffInSeconds($call->answered_at, true));
                     }
                     $call->save();
                     broadcast(new CallUpdated($call));
                 }
             }

            $this->info("Call state updated for Linkedid: {$fields['Linkedid']}");
            $this->line("Channel: {$fields['Channel']}");
            $this->line("Extension: {$fields['Exten']}");
            $this->line("State: {$fields['ChannelStateDesc']}");
            $this->line("Linked ID: {$fields['Linkedid']}");
             $this->line("Unique ID: {$fields['Uniqueid']}");
             $this->line('------------------------');
         } catch (\Exception $e) {
             $this->error("Failed to update call state: " . $e->getMessage());
         }
     }

     private function handleHangup(array $fields)
     {
         if (!isset($fields['Uniqueid']) || !isset($fields['Linkedid'])) {
             $this->error("Missing required fields: Uniqueid or Linkedid");
             return;
         }

         try {
             // CRITICAL: Ensure Call exists BEFORE creating CallLeg
             $call = $this->ensureCall($fields);
             if (!$call) {
                 $this->error("Failed to create/find master call for linkedid: " . ($fields['Linkedid'] ?? 'unknown'));
                 return;
             }

             // Clean model: update leg hangup and finalize master call
             $this->upsertCallLeg($fields, [
                 'hangup_at' => now(),
                 'hangup_cause' => $fields['Cause'] ?? null,
             ]);

             if ($fields['Uniqueid'] === $fields['Linkedid']) {
                 $call->ended_at = now();
                 if (!empty($fields['Cause'])) {
                     $call->hangup_cause = (string)$fields['Cause'];
                 }
                 if ($call->answered_at && $call->ended_at && empty($call->talk_seconds)) {
                     $call->talk_seconds = max(0, $call->answered_at->diffInSeconds($call->ended_at, true));
                 }
                 $call->save();
                 broadcast(new CallUpdated($call));
             }

            $this->info("Call ended for Linkedid: {$fields['Linkedid']}");
            $this->line("Extension: {$fields['Exten']}");
             $this->line("Cause: " . ($fields['Cause'] ?? 'N/A'));
            $this->line("Linked ID: {$fields['Linkedid']}");
             $this->line("Unique ID: {$fields['Uniqueid']}");
             $this->line('------------------------');
         } catch (\Exception $e) {
             $this->error("Failed to update call hangup state: " . $e->getMessage());
         }
     }

    private function handleDialBegin(array $fields): void
    {
        // Ensure outgoing call exists first
        $call = $this->ensureCall($fields, ['direction' => 'outgoing']);
        if (!$call) {
            return;
        }

                // Extract the best outgoing number from dial event
        $outgoingNumber = $this->extractOutgoingNumber($fields);
        if ($outgoingNumber) {
            $call->other_party = $outgoingNumber;
                    $call->save();

            // Broadcast the updated call with phone number
            broadcast(new CallUpdated($call));

            $this->info("📞 Outgoing call to: {$outgoingNumber} (linkedid: {$call->linkedid})");
        } else {
            // Debug: Log available fields for troubleshooting
            $extractedFromDialString = $this->extractNumberFromDialString($fields['DialString'] ?? null);
            $this->warn("⚠️ Could not extract outgoing number from DialBegin. Available fields:");
            $this->line("DialString: " . ($fields['DialString'] ?? 'N/A') . " -> Extracted: " . ($extractedFromDialString ?? 'N/A'));
            $this->line("DestCallerIDNum: " . ($fields['DestCallerIDNum'] ?? 'N/A'));
            $this->line("Exten: " . ($fields['Exten'] ?? 'N/A'));
            $this->line("ConnectedLineNum: " . ($fields['ConnectedLineNum'] ?? 'N/A'));
        }
    }

    private function handleDialEnd(array $fields): void
    {
        $status = (string)($fields['DialStatus'] ?? '');
        $linkedid = $fields['Linkedid'] ?? null;
        if (!$linkedid) {
            return;
        }
        $call = Call::firstOrNew(['linkedid' => $linkedid]);
        if ($call->exists) {
            $call->dial_status = $status;
            $map = [
                'ANSWER' => 'answered',
                'BUSY' => 'busy',
                'NOANSWER' => 'no_answer',
                'CANCEL' => 'canceled',
                'CONGESTION' => 'congestion',
            ];
            if (isset($map[$status])) {
                $call->disposition = $map[$status];
            }
            $call->save();

            // Broadcast the call status update in real-time
            broadcast(new CallUpdated($call));

            $this->info("📡 Call disposition updated: {$status} -> {$call->disposition} (linkedid: {$call->linkedid})");
        }
    }

    private function handleBridgeEnter(array $fields): void
    {
        $linkedid = $fields['Linkedid'] ?? null;
        if (!$linkedid && isset($fields['Uniqueid'])) {
            $leg = CallLeg::where('uniqueid', $fields['Uniqueid'])->first();
            $linkedid = $leg ? $leg->linkedid : null;
        }
        if (!$linkedid) {
            return;
        }
        $call = Call::firstOrNew(['linkedid' => $linkedid]);
        $now = now();
        if (empty($call->answered_at)) {
            $call->answered_at = $now;
            if ($call->started_at) {
                $call->ring_seconds = max(0, $call->started_at->diffInSeconds($now, true));
            }
        }
        if (empty($call->agent_exten)) {
            $ch = (string)($fields['Channel'] ?? '');
            if (preg_match('/(?:SIP|PJSIP|Local)\/(\d{3,5})/', $ch, $m)) {
                $call->agent_exten = $m[1];
            }
        }
        $call->save();

        broadcast(new CallUpdated($call));

        // Ensure Call exists before creating BridgeSegment
        if ($call->exists) {
        BridgeSegment::create([
            'linkedid' => $linkedid,
            'agent_exten' => $call->agent_exten,
            'party_channel' => $fields['Channel'] ?? null,
            'entered_at' => $now,
        ]);
        } else {
            $this->error("Cannot create BridgeSegment: master Call with linkedid {$linkedid} does not exist");
        }
    }

    private function handleBridgeLeave(array $fields): void
    {
        $linkedid = $fields['Linkedid'] ?? null;
        if (!$linkedid && isset($fields['Uniqueid'])) {
            $leg = CallLeg::where('uniqueid', $fields['Uniqueid'])->first();
            $linkedid = $leg ? $leg->linkedid : null;
        }
        if (!$linkedid) {
            return;
        }
        $channel = (string)($fields['Channel'] ?? '');
        $segment = BridgeSegment::where('linkedid', $linkedid)
            ->whereNull('left_at')
            ->when($channel !== '', function ($q) use ($channel) {
                $q->where('party_channel', $channel);
            })
            ->latest('entered_at')
            ->first();
        if ($segment) {
            $segment->left_at = now();
            $segment->save();
        }
    }

     public function __destruct()
     {
         if ($this->connected && $this->socket) {
             $this->sendCommand("Action: Logoff");
             fclose($this->socket);
         }
     }
 }
