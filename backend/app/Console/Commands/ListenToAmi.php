<?php
namespace App\Console\Commands;


use Illuminate\Console\Command;
use App\Models\CallLog;
use App\Models\CallInstance;
use App\Events\CallStatusUpdated;
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
        $candidateOrder = [
            $fields['Exten'] ?? null,               // often dialed digits at start
            $fields['ConnectedLineNum'] ?? null,    // becomes the real B-party after bridge
            $fields['CallerIDNum'] ?? null,         // sometimes trunk leg reports dest here on hangup
        ];
        foreach ($candidateOrder as $cand) {
            if ($this->isLikelyExternalNumber($cand)) {
                return $this->normalizeNumber($cand);
            }
        }
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
                 $fields[$key] = $value;
             }
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

         if (!$call->exists) {
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

         if ($changed) {
             $call->save();
         }

         return $call;
     }

     /** Upsert CallLeg row for this uniqueid. */
     private function upsertCallLeg(array $fields, array $extra = []): void
     {
         $uniqueid = $fields['Uniqueid'] ?? null;
         if (!$uniqueid) {
             return;
         }
         $leg = CallLeg::firstOrNew(['uniqueid' => $uniqueid]);
         $leg->linkedid = $fields['Linkedid'] ?? $leg->linkedid;
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

         $leg->save();
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
                 // Create new CallInstance
                 $callInstance = CallInstance::create([
                     'unique_id' => $fields['Uniqueid']
                 ]);
                 $this->info("New CallInstance created with ID: {$callInstance->id}");
                 // Also broadcast call created/ringing for the clean calls API
                 $masterCall = Call::firstOrNew(['linkedid' => $fields['Linkedid']]);
                 if ($masterCall->exists) {
                     broadcast(new CallUpdated($masterCall));
                 }
             }

             $callLog = CallLog::firstOrNew(['uniqueid' => $fields['Uniqueid']]);

             // Find associated CallInstance if exists
             $callInstance = CallInstance::where('unique_id', $fields['Linkedid'])->first();

             $updateData = [
                 'channel' => $fields['Channel'] ?? $callLog->channel,
                 'linkedid' => $fields['Linkedid'] ?? $callLog->linkedid,
                 'callerid_num' => $fields['CallerIDNum'] ?? $callLog->callerid_num,
                 'callerid_name' => $fields['CallerIDName'] ?? $callLog->callerid_name,
                 'exten' => $fields['Exten'] ?? $callLog->exten,
                 'context' => $fields['Context'] ?? $callLog->context,
                 'channel_state' => $fields['ChannelState'] ?? $callLog->channel_state,
                 'channel_state_desc' => $fields['ChannelStateDesc'] ?? $callLog->channel_state_desc,
                 'call_instance_id' => $callInstance ? $callInstance->id : null
             ];

             if (!$callLog->exists) {
                 $updateData['start_time'] = now();
                 $updateData['status'] = 'started';
                 // Determine direction on first master event
                 $context = $updateData['context'] ?? '';
                 if (is_string($context)) {
                     if (strpos($context, 'from-trunk') !== false) {
                         $updateData['direction'] = 'incoming';
                         // Prefer real external caller number
                         $incoming = $this->extractIncomingNumber($fields);
                         if ($incoming !== null) {
                             $updateData['other_party'] = $incoming;
                         } else {
                             $updateData['other_party'] = $updateData['callerid_num'] ?? null;
                         }
                     } elseif (strpos($context, 'macro-dialout-trunk') !== false || strpos($context, 'from-internal') !== false) {
                         $updateData['direction'] = 'outgoing';
                     }
                 }
                 // For outgoing calls, try to capture agent extension from Channel (e.g., SIP/2001-xxxx)
                 if (($updateData['direction'] ?? null) === 'outgoing') {
                     $channel = $updateData['channel'] ?? '';
                     if (is_string($channel) && preg_match('/SIP\/(\d{3,5})/', $channel, $cm)) {
                         $updateData['agent_exten'] = $cm[1];
                     }
                     // Dialed other party might be in Exten at this point
                     $outgoing = $this->extractOutgoingNumber($fields);
                     if ($outgoing !== null) {
                         $updateData['other_party'] = $outgoing;
                     }
                 }
             }

             $callLog->fill($updateData)->save();

             // Only broadcast if this is a MASTER CHANNEL (uniqueid equals linkedid)
             $isMasterChannel = $fields['Uniqueid'] === $fields['Linkedid'];

             // If this is a secondary (agent) channel, propagate agent extension to master
             if (!$isMasterChannel) {
                 $agentExt = null;
                 $ch = (string)($fields['Channel'] ?? '');
                 if (preg_match('/SIP\/(\d{3,5})/', $ch, $m)) {
                     $agentExt = $m[1];
                 } elseif (preg_match('/Local\/(\d{3,5})@/', $ch, $m)) {
                     $agentExt = $m[1];
                 }
                 if ($agentExt) {
                     $master = CallLog::where('uniqueid', $fields['Linkedid'])->first();
                     if ($master && empty($master->agent_exten)) {
                         $master->agent_exten = $agentExt;
                         $master->save();
                         broadcast(new CallStatusUpdated($master));
                     }
                 }
             }

             if ($isMasterChannel) {
                 broadcast(new CallStatusUpdated($callLog));
                 $this->info("📡 Broadcasting MASTER channel update: {$callLog->status}");
             } else {
                 $this->info("ℹ️ Skipping broadcast: Secondary channel (uniqueid ≠ linkedid)");
             }

             $this->info($callLog->wasRecentlyCreated ? "New call created" : "Call updated" . " with ID: {$callLog->id}");
             $this->line("Caller: {$updateData['callerid_num']} ({$updateData['callerid_name']})");
             $this->line("Extension: {$updateData['exten']}");
             $this->line("Linked ID: {$updateData['linkedid']}");
             $this->line("Unique ID: {$fields['Uniqueid']}");
             $this->line("Master Channel: " . ($isMasterChannel ? "YES" : "NO"));
             if ($callInstance) {
                 $this->line("Call Instance ID: {$callInstance->id}");
             }
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
             // Check if this is a new call (uniqueid equals linkedid)
             if ($fields['Uniqueid'] === $fields['Linkedid']) {
                 $callInstance = CallInstance::firstOrCreate([
                     'unique_id' => $fields['Uniqueid']
                 ]);
             }

             // Option B (clean model): update leg state and fallback mark answered
             $this->upsertCallLeg($fields);
             $call = $this->ensureCall($fields);
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

             $callLog = CallLog::firstOrNew(['uniqueid' => $fields['Uniqueid']]);

             // Find associated CallInstance if exists
             $callInstance = CallInstance::where('unique_id', $fields['Linkedid'])->first();

            // Skipping user extension lookup and targeted notifications

             $updateData = [
                 'channel' => $fields['Channel'] ?? $callLog->channel,
                 'linkedid' => $fields['Linkedid'] ?? $callLog->linkedid,
                 'channel_state' => $fields['ChannelState'] ?? $callLog->channel_state,
                 'channel_state_desc' => $fields['ChannelStateDesc'] ?? $callLog->channel_state_desc,
                 'callerid_num' => $fields['CallerIDNum'] ?? $callLog->callerid_num,
                 'callerid_name' => $fields['CallerIDName'] ?? $callLog->callerid_name,
                 'connected_line_num' => $fields['ConnectedLineNum'] ?? $callLog->connected_line_num,
                 'connected_line_name' => $fields['ConnectedLineName'] ?? $callLog->connected_line_name,
                 'context' => $fields['Context'] ?? $callLog->context,
                 'exten' => $fields['Exten'] ?? $callLog->exten,
                 'state' => $fields['State'] ?? $callLog->state,
                 'call_instance_id' => $callInstance ? $callInstance->id : null
             ];

             // Map status using ChannelStateDesc
             $stateDesc = strtolower((string)($updateData['channel_state_desc'] ?? ''));
             if (!$callLog->exists) {
                 $updateData['start_time'] = now();
             }
             if (strpos($stateDesc, 'ring') !== false) {
                 $updateData['status'] = 'ringing';
             } elseif ($stateDesc === 'up') {
                 $updateData['status'] = 'answered';
             } elseif ($stateDesc === 'busy') {
                 $updateData['status'] = 'busy';
             }

             // Determine direction if not set
             if (empty($callLog->direction) && !empty($updateData['context'])) {
                 $ctx = (string)$updateData['context'];
                 if (strpos($ctx, 'from-trunk') !== false) {
                     $updateData['direction'] = 'incoming';
                 } elseif (strpos($ctx, 'macro-dialout-trunk') !== false || strpos($ctx, 'from-internal') !== false) {
                     $updateData['direction'] = 'outgoing';
                 }
             }

             // Try to determine agent extension and other party as info becomes available
             // If outgoing and agent not set, parse from Channel
             if ((($callLog->direction ?? $updateData['direction'] ?? null) === 'outgoing') && empty($callLog->agent_exten)) {
                 $ch = $updateData['channel'] ?? '';
                 if (is_string($ch) && preg_match('/SIP\/(\d{3,5})/', $ch, $mm)) {
                     $updateData['agent_exten'] = $mm[1];
                 }
             }
             // If incoming and agent not set, sometimes ConnectedLineNum will hold the agent ext after bridge
             if ((($callLog->direction ?? $updateData['direction'] ?? null) === 'incoming') && empty($callLog->agent_exten)) {
                 $connected = $updateData['connected_line_num'] ?? '';
                 $norm = $this->normalizeNumber($connected);
                 if ($norm !== null && $this->isLikelyExtension($norm)) {
                     $updateData['agent_exten'] = ltrim($norm, '+');
                 }
             }
             // Set or refine other party if available, prefer real external numbers
             if (empty($callLog->other_party)) {
                 $dir = $callLog->direction ?? $updateData['direction'] ?? null;
                 if ($dir === 'outgoing') {
                     $outgoing = $this->extractOutgoingNumber($fields);
                     if ($outgoing !== null) {
                         $updateData['other_party'] = $outgoing;
                     }
                 } elseif ($dir === 'incoming') {
                     $incoming = $this->extractIncomingNumber($fields);
                     if ($incoming !== null) {
                         $updateData['other_party'] = $incoming;
                     }
                 }
             }

             $callLog->fill($updateData)->save();

             // Only broadcast if this is a MASTER CHANNEL (uniqueid equals linkedid)
             $isMasterChannel = $fields['Uniqueid'] === $fields['Linkedid'];

             // For secondary (agent) channels, propagate agent ext to master as soon as we know
             if (!$isMasterChannel) {
                 $agentExt = null;
                 $ch = (string)($fields['Channel'] ?? '');
                 if (preg_match('/SIP\/(\d{3,5})/', $ch, $m)) {
                     $agentExt = $m[1];
                 } elseif (preg_match('/Local\/(\d{3,5})@/', $ch, $m)) {
                     $agentExt = $m[1];
                 }
                 if ($agentExt) {
                     $master = CallLog::where('uniqueid', $fields['Linkedid'])->first();
                     if ($master && empty($master->agent_exten)) {
                         $master->agent_exten = $agentExt;
                         $master->save();
                         broadcast(new CallStatusUpdated($master));
                     }
                 }
             }

             if ($isMasterChannel) {
                 broadcast(new CallStatusUpdated($callLog));
                 $this->info("📡 Broadcasting MASTER channel update: {$callLog->status}");
             } else {
                 $this->info("ℹ️ Skipping broadcast: Secondary channel (uniqueid ≠ linkedid)");
             }

             $this->info("Call state updated for ID: {$callLog->id}");
             $this->line("Channel: {$updateData['channel']}");
             $this->line("Extension: {$updateData['exten']}");
             $this->line("Caller: {$updateData['connected_line_num']} ({$updateData['connected_line_name']})");
             $this->line("Linked ID: {$updateData['linkedid']}");
             $this->line("Unique ID: {$fields['Uniqueid']}");
             $this->line("Master Channel: " . ($isMasterChannel ? "YES" : "NO"));
             if ($callInstance) {
                 $this->line("Call Instance ID: {$callInstance->id}");
             }
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
             // Check if this is a new call (uniqueid equals linkedid)
             if ($fields['Uniqueid'] === $fields['Linkedid']) {
                 $callInstance = CallInstance::firstOrCreate([
                     'unique_id' => $fields['Uniqueid']
                 ]);
             }

             // Option B (clean model): update leg hangup and finalize master call
             $this->upsertCallLeg($fields, [
                 'hangup_at' => now(),
                 'hangup_cause' => $fields['Cause'] ?? null,
             ]);
             if ($fields['Uniqueid'] === $fields['Linkedid']) {
                 $call = Call::firstOrNew(['linkedid' => $fields['Linkedid']]);
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

             $callLog = CallLog::firstOrNew(['uniqueid' => $fields['Uniqueid']]);

             // Find associated CallInstance if exists
             $callInstance = CallInstance::where('unique_id', $fields['Linkedid'])->first();

             $updateData = [
                 'channel' => $fields['Channel'] ?? $callLog->channel,
                 'linkedid' => $fields['Linkedid'] ?? $callLog->linkedid,
                 'channel_state' => $fields['ChannelState'] ?? $callLog->channel_state,
                 'channel_state_desc' => $fields['ChannelStateDesc'] ?? $callLog->channel_state_desc,
                 'callerid_num' => $fields['CallerIDNum'] ?? $callLog->callerid_num,
                 'callerid_name' => $fields['CallerIDName'] ?? $callLog->callerid_name,
                 'connected_line_num' => $fields['ConnectedLineNum'] ?? $callLog->connected_line_num,
                 'connected_line_name' => $fields['ConnectedLineName'] ?? $callLog->connected_line_name,
                 'context' => $fields['Context'] ?? $callLog->context,
                 'exten' => $fields['Exten'] ?? $callLog->exten,
                 'state' => $fields['State'] ?? $callLog->state,
                 'call_instance_id' => $callInstance ? $callInstance->id : null,
                 'end_time' => now(),
                 'status' => 'completed'
             ];

            if ($callLog->start_time) {
                $start = $callLog->start_time;
                $end = now();
                $updateData['duration'] = max(0, $start->diffInSeconds($end, true));
            }

             // If we still don't have external party, try to finalize it on hangup
             $dir = $callLog->direction ?? null;
             if (empty($callLog->other_party) && $dir) {
                 $final = $dir === 'outgoing' ? $this->extractOutgoingNumber($fields) : $this->extractIncomingNumber($fields);
                 if ($final !== null) {
                     $updateData['other_party'] = $final;
                 }
             }

             $callLog->fill($updateData)->save();

             // Only broadcast if this is a MASTER CHANNEL (uniqueid equals linkedid)
             $isMasterChannel = $fields['Uniqueid'] === $fields['Linkedid'];

             if ($isMasterChannel) {
                 broadcast(new CallStatusUpdated($callLog));
                 $this->info("📡 Broadcasting MASTER channel update: {$callLog->status}");
             } else {
                 $this->info("ℹ️ Skipping broadcast: Secondary channel (uniqueid ≠ linkedid)");
             }

             $this->info("Call ended for ID: {$callLog->id}");
             $this->line("Extension: {$updateData['exten']}");
             $this->line("Duration: " . ($updateData['duration'] ?? 'N/A') . " seconds");
             $this->line("Cause: " . ($fields['Cause'] ?? 'N/A'));
             $this->line("Linked ID: {$updateData['linkedid']}");
             $this->line("Unique ID: {$fields['Uniqueid']}");
             $this->line("Master Channel: " . ($isMasterChannel ? "YES" : "NO"));
             if ($callInstance) {
                 $this->line("Call Instance ID: {$callInstance->id}");
             }
             $this->line('------------------------');
         } catch (\Exception $e) {
             $this->error("Failed to update call hangup state: " . $e->getMessage());
         }
     }

    private function handleDialBegin(array $fields): void
    {
        // Outgoing best-effort number capture
        $this->ensureCall($fields, ['direction' => 'outgoing']);
        $dialed = $fields['DialString'] ?? ($fields['DestCallerIDNum'] ?? ($fields['Exten'] ?? null));
        $linkedid = $fields['Linkedid'] ?? null;
        if ($linkedid && $dialed) {
            $call = Call::firstOrNew(['linkedid' => $linkedid]);
            if ($call->exists) {
                $num = $this->normalizeNumber($dialed);
                if ($num) {
                    $call->other_party = $num;
                    $call->save();
                }
            }
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

        BridgeSegment::create([
            'linkedid' => $linkedid,
            'agent_exten' => $call->agent_exten,
            'party_channel' => $fields['Channel'] ?? null,
            'entered_at' => $now,
        ]);
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
