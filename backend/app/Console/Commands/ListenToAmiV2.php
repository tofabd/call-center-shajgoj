<?php
namespace App\Console\Commands;


use Illuminate\Console\Command;
use App\Models\CallLog;
use App\Models\CallInstance;
use App\Models\User;
use App\Events\FetchCustomerAndNotifyExtension;
use App\Events\CallStatusUpdated;
use Illuminate\Support\Facades\Log;

/**
 * This is modified version of ListenToAmi
 */
 class ListenToAmiV2 extends Command
 {
     /**
      * The name and signature of the console command.
      *
      * @var string
      */
     protected $signature = 'app:listen-to-ami-v2';

     /**
      * The console command description.
      *
      * @var string
      */
     protected $description = 'Listen to Asterisk AMI for incoming calls';

     private $socket;
     private $connected = false;
     private $processedEvents = [];
     private $stateDescriptions = [
         0 => 'Down',
         1 => 'Down',
         2 => 'Reserved',
         3 => 'Off Hook',
         4 => 'Dialing',
         5 => 'Line Busy',
         6 => 'Ring',
         7 => 'In Use',
         8 => 'Busy',
         9 => 'Unavailable',
         10 => 'Ringing',
         11 => 'Ring In Use',
         12 => 'Hold',
         13 => 'Unknown',
         14 => 'Unknown',
         15 => 'Unknown',
         16 => 'Unknown',
         17 => 'Unknown',
         18 => 'Unknown',
         19 => 'Unknown',
         20 => 'Unknown'
     ];

     /**
      * Execute the console command.
      */
     public function handle()
     {
        //  Mellowhost server
        //  $host = env('AMI_HOST', '103.177.125.93');
        //  $port = env('AMI_PORT', 5038);
        //  $username = env('AMI_USERNAME', 'admin');
        //  $password = env('AMI_PASSWORD', 'talent1212');


        //  Shajgoj server
         $host = env('AMI_HOST', '202.83.126.140');
         $port = env('AMI_PORT', 5038);
         $username = env('AMI_USERNAME', 'admin');
         $password = env('AMI_PASSWORD', 'admin');

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

                 if (strpos($response, 'Event: Newchannel') !== false) {
                     $this->processEvent($response, 'Newchannel');
                 }
                 elseif (strpos($response, 'Event: Newstate') !== false) {
                     $this->processEvent($response, 'Newstate');
                 }
                 elseif (strpos($response, 'Event: Hangup') !== false) {
                     $this->processEvent($response, 'Hangup');
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

         // Debug: Log all available fields for troubleshooting
         $this->info("\n{$eventType} Event Fields:");
         foreach ($fields as $key => $value) {
             $this->line("$key: $value");
         }
         $this->line('------------------------');

         // Event deduplication for Asterisk 1.3
         $eventKey = ($fields['Uniqueid'] ?? $fields['Channel'] ?? 'unknown') . '_' . $eventType . '_' . time();
         if (in_array($eventKey, $this->processedEvents)) {
             $this->info("Skipping duplicate event: {$eventKey}");
             return;
         }
         $this->processedEvents[] = $eventKey;

         // $user = User::where('id', auth()->user()->id)->first();

         // broadcast(new DeleteArticleRequestReceived($user, $eventType));

         // Process all events for state tracking and caller info
         if ($eventType === 'Newchannel') {
             $this->handleNewchannel($fields);
         } elseif ($eventType === 'Newstate') {
             $this->handleNewstate($fields);
         } elseif ($eventType === 'Hangup') {
             $this->handleHangup($fields);
         } else {
             // For other events, just log the fields
             $this->info("\n{$eventType} Event Fields:");
             foreach ($fields as $key => $value) {
                 $this->line("$key: $value");
             }
             $this->line('------------------------');
         }
     }

          private function handleNewchannel(array $fields)
     {
         // Handle missing Uniqueid and Linkedid fields for older Asterisk versions
         $uniqueid = $fields['Uniqueid'] ?? $fields['UniqueID'] ?? $fields['Channel'] ?? null;
         $linkedid = $fields['Linkedid'] ?? $fields['LinkedID'] ?? $fields['Channel'] ?? null;

         // Enhanced master channel detection for Asterisk 1.3
         $isMasterChannel = $this->isMasterChannel($fields, $uniqueid, $linkedid);

         // Only process master channels to minimize database updates
         if (!$isMasterChannel) {
             $this->info("Skipping secondary channel: {$fields['Channel']}");
             return;
         }

         if (!$uniqueid || !$linkedid) {
             $this->error("Missing required fields: Uniqueid or Linkedid");
             $this->error("Available fields: " . implode(', ', array_keys($fields)));
             return;
         }

         try {
             // Check if CallInstance already exists to avoid duplicates
             $existingInstance = CallInstance::where('unique_id', $uniqueid)->first();
             if (!$existingInstance) {
                 // Create new CallInstance only if it doesn't exist
                 $callInstance = CallInstance::create([
                     'unique_id' => $uniqueid
                 ]);
                 $this->info("New CallInstance created with ID: {$callInstance->id}");
                 Log::info("CallInstance created", [
                     'id' => $callInstance->id,
                     'unique_id' => $uniqueid,
                     'channel' => $fields['Channel'] ?? 'unknown',
                     'event' => 'Newchannel',
                     'is_master' => true
                 ]);
             } else {
                 $callInstance = $existingInstance;
                 $this->info("Using existing CallInstance ID: {$callInstance->id}");
             }

             // Always capture caller information from any channel
             $this->captureCallerInfo($fields, $uniqueid);

             $callLog = CallLog::firstOrNew(['uniqueid' => $uniqueid]);

             // Find associated CallInstance if exists
             $callInstance = CallInstance::where('unique_id', $linkedid)->first();

             $updateData = [
                 'channel' => $fields['Channel'] ?? $callLog->channel,
                 'linkedid' => $linkedid,
                 'callerid_num' => $fields['CallerIDNum'] ?? $fields['CallerID'] ?? $callLog->callerid_num,
                 'callerid_name' => $fields['CallerIDName'] ?? $callLog->callerid_name,
                 'exten' => $fields['Exten'] ?? $callLog->exten,
                 'context' => $fields['Context'] ?? $callLog->context,
                 'channel_state' => $fields['ChannelState'] ?? $callLog->channel_state,
                 'channel_state_desc' => $this->getChannelStateDescription($fields['ChannelState'] ?? null, $fields['Channel'] ?? null, $fields['ChannelStateDesc'] ?? null),
                 'call_instance_id' => $callInstance ? $callInstance->id : null
             ];

                          if (!$callLog->exists) {
                 $updateData['start_time'] = now();
                 $updateData['status'] = $this->getStatusFromState($fields['ChannelState'] ?? null);
                 $callLog->fill($updateData)->save();
                 Log::info("New CallLog created", [
                     'id' => $callLog->id,
                     'uniqueid' => $uniqueid,
                     'status' => $updateData['status'],
                     'channel_state' => $fields['ChannelState'] ?? 'unknown'
                 ]);
             } else {
                 // Update state information even if status doesn't change
                 $currentStatus = $callLog->status;
                 $newStatus = $this->getStatusFromState($fields['ChannelState'] ?? null);

                 if ($currentStatus !== $newStatus) {
                     $updateData['status'] = $newStatus;
                     $callLog->fill($updateData)->save();
                     Log::info("CallLog status updated", [
                         'id' => $callLog->id,
                         'status_change' => "{$currentStatus} → {$newStatus}",
                         'channel_state' => $fields['ChannelState'] ?? 'unknown'
                     ]);
                 } else {
                     // Update channel state even if status doesn't change
                     $callLog->update([
                         'channel_state' => $fields['ChannelState'] ?? $callLog->channel_state,
                         'channel_state_desc' => $this->getChannelStateDescription($fields['ChannelState'] ?? null, $fields['Channel'] ?? null, $fields['ChannelStateDesc'] ?? null)
                     ]);
                     $this->info("CallLog state updated - status unchanged: {$currentStatus}");
                 }
             }



             // Only broadcast if this is a MASTER CHANNEL (uniqueid equals linkedid)
             $isMasterChannel = $uniqueid === $linkedid;

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
             $this->line("Unique ID: {$uniqueid}");
             $this->line("Master Channel: " . ($isMasterChannel ? "YES" : "NO"));
             if ($callInstance) {
                 $this->line("Call Instance ID: {$callInstance->id}");
             }
             $this->line('------------------------');
         } catch (\Exception $e) {
             $this->error("Failed to create/update call record: " . $e->getMessage());
             Log::error("Failed to create/update call record", [
                 'event' => 'Newchannel',
                 'uniqueid' => $uniqueid ?? 'unknown',
                 'linkedid' => $linkedid ?? 'unknown',
                 'channel' => $fields['Channel'] ?? 'unknown',
                 'error' => $e->getMessage(),
                 'trace' => $e->getTraceAsString()
             ]);
         }
     }

               private function handleNewstate(array $fields)
     {
         // Handle missing Uniqueid and Linkedid fields for older Asterisk versions
         $uniqueid = $fields['Uniqueid'] ?? $fields['UniqueID'] ?? $fields['Channel'] ?? null;
         $linkedid = $fields['Linkedid'] ?? $fields['LinkedID'] ?? $fields['Channel'] ?? null;

         // Enhanced master channel detection for Asterisk 1.3
         $isMasterChannel = $this->isMasterChannel($fields, $uniqueid, $linkedid);

         // Always capture caller information from any channel
         $this->captureCallerInfo($fields, $uniqueid);

         // Only process master channels for database updates
         if (!$isMasterChannel) {
             $this->info("Skipping secondary channel state update: {$fields['Channel']}");
             return;
         }

         try {
             // Update CallLog with state changes
             $callLog = CallLog::where('uniqueid', $uniqueid)->first();
             if ($callLog) {
                 $currentStatus = $callLog->status;
                 $newStatus = $this->getStatusFromState($fields['ChannelState'] ?? null);

                 $updateData = [
                     'channel_state' => $fields['ChannelState'] ?? $callLog->channel_state,
                     'channel_state_desc' => $this->getChannelStateDescription($fields['ChannelState'] ?? null, $fields['Channel'] ?? null, $fields['ChannelStateDesc'] ?? null),
                     'connected_line_num' => $fields['ConnectedLineNum'] ?? $callLog->connected_line_num,
                     'connected_line_name' => $fields['ConnectedLineName'] ?? $callLog->connected_line_name,
                     'exten' => $fields['Exten'] ?? $callLog->exten,
                     'state' => $fields['State'] ?? $callLog->state
                 ];

                 if ($currentStatus !== $newStatus) {
                     $updateData['status'] = $newStatus;
                     $callLog->fill($updateData)->save();
                     Log::info("CallLog state and status updated", [
                         'id' => $callLog->id,
                         'status_change' => "{$currentStatus} → {$newStatus}",
                         'channel_state' => $fields['ChannelState'] ?? 'unknown',
                         'channel' => $fields['Channel'] ?? 'unknown'
                     ]);
                 } else {
                     // Update state information even if status doesn't change
                     $callLog->update($updateData);
                     Log::info("CallLog state updated", [
                         'id' => $callLog->id,
                         'status' => $currentStatus,
                         'channel_state' => $fields['ChannelState'] ?? 'unknown',
                         'channel' => $fields['Channel'] ?? 'unknown'
                     ]);
                 }
             }

             // Handle user notifications
             $exten = $fields['Exten'] ?? null;
             $connectedLineNum = $fields['ConnectedLineNum'] ?? null;

             if ($exten) {
                 $user = User::where('extension', $exten)->first();
                 if ($user && $connectedLineNum) {
                     broadcast(new FetchCustomerAndNotifyExtension($user, $connectedLineNum));
                     Log::info("User notification sent", [
                         'extension' => $exten,
                         'connected_line' => $connectedLineNum,
                         'user_id' => $user->id
                     ]);
                 }
             }

             $this->info("Call state updated for channel: {$fields['Channel']}");
             $this->line("Extension: {$exten}");
             $this->line("Connected Line: {$connectedLineNum}");
             $this->line("Channel State: {$fields['ChannelState']} ({$this->getChannelStateDescription($fields['ChannelState'] ?? null, $fields['Channel'] ?? null, $fields['ChannelStateDesc'] ?? null)})");
             $this->line("Status: " . ($newStatus ?? $currentStatus));
             $this->line('------------------------');
         } catch (\Exception $e) {
             $this->error("Failed to update call state: " . $e->getMessage());
             Log::error("Failed to update call state", [
                 'event' => 'Newstate',
                 'uniqueid' => $uniqueid ?? 'unknown',
                 'linkedid' => $linkedid ?? 'unknown',
                 'channel' => $fields['Channel'] ?? 'unknown',
                 'error' => $e->getMessage(),
                 'trace' => $e->getTraceAsString()
             ]);
         }
     }

          private function handleHangup(array $fields)
     {
         // Handle missing Uniqueid and Linkedid fields for older Asterisk versions
         $uniqueid = $fields['Uniqueid'] ?? $fields['UniqueID'] ?? $fields['Channel'] ?? null;
         $linkedid = $fields['Linkedid'] ?? $fields['LinkedID'] ?? $fields['Channel'] ?? null;

         // Enhanced master channel detection for Asterisk 1.3
         $isMasterChannel = $this->isMasterChannel($fields, $uniqueid, $linkedid);

         // Always capture caller information from any channel
         $this->captureCallerInfo($fields, $uniqueid);

         // Only process master channels to minimize database updates
         if (!$isMasterChannel) {
             $this->info("Skipping secondary channel hangup: {$fields['Channel']}");
             return;
         }

         if (!$uniqueid || !$linkedid) {
             $this->error("Missing required fields: Uniqueid or Linkedid");
             $this->error("Available fields: " . implode(', ', array_keys($fields)));
             return;
         }

                  try {
             // Check if CallInstance already exists to avoid duplicates
             $existingInstance = CallInstance::where('unique_id', $uniqueid)->first();
             if (!$existingInstance) {
                 // Create new CallInstance only if it doesn't exist
                 $callInstance = CallInstance::create([
                     'unique_id' => $uniqueid
                 ]);
                 Log::info("CallInstance created in hangup", [
                     'id' => $callInstance->id,
                     'unique_id' => $uniqueid,
                     'channel' => $fields['Channel'] ?? 'unknown',
                     'event' => 'Hangup',
                     'is_master' => true
                 ]);
             } else {
                 $callInstance = $existingInstance;
                 $this->info("Using existing CallInstance for hangup ID: {$callInstance->id}");
             }

             $callLog = CallLog::firstOrNew(['uniqueid' => $uniqueid]);

             // Find associated CallInstance if exists
             $callInstance = CallInstance::where('unique_id', $linkedid)->first();

             $updateData = [
                 'channel' => $fields['Channel'] ?? $callLog->channel,
                 'linkedid' => $linkedid,
                 'channel_state' => $fields['ChannelState'] ?? $callLog->channel_state,
                 'channel_state_desc' => $this->getChannelStateDescription($fields['ChannelState'] ?? null, $fields['Channel'] ?? null, $fields['ChannelStateDesc'] ?? null),
                 'callerid_num' => $fields['CallerIDNum'] ?? $fields['CallerID'] ?? $callLog->callerid_num,
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
                 $updateData['duration'] = now()->diffInSeconds($callLog->start_time);
             }

             // Always update CallLog for hangup (completion)
             $callLog->fill($updateData)->save();
             Log::info("CallLog completed", [
                 'id' => $callLog->id,
                 'uniqueid' => $uniqueid,
                 'duration' => $updateData['duration'] ?? 'N/A',
                 'cause' => $fields['Cause'] ?? 'N/A'
             ]);



             // Only broadcast if this is a MASTER CHANNEL (uniqueid equals linkedid)
             $isMasterChannel = $uniqueid === $linkedid;

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
             $this->line("Unique ID: {$uniqueid}");
             $this->line("Master Channel: " . ($isMasterChannel ? "YES" : "NO"));
             if ($callInstance) {
                 $this->line("Call Instance ID: {$callInstance->id}");
             }
             $this->line('------------------------');
         } catch (\Exception $e) {
             $this->error("Failed to update call hangup state: " . $e->getMessage());
             Log::error("Failed to update call hangup state", [
                 'event' => 'Hangup',
                 'uniqueid' => $uniqueid ?? 'unknown',
                 'linkedid' => $linkedid ?? 'unknown',
                 'channel' => $fields['Channel'] ?? 'unknown',
                 'error' => $e->getMessage(),
                 'trace' => $e->getTraceAsString()
             ]);
         }
     }

     /**
      * Capture caller information from any channel
      */
     private function captureCallerInfo(array $fields, $uniqueid)
     {
         $callerIDNum = $fields['CallerIDNum'] ?? $fields['CallerID'] ?? null;
         $callerIDName = $fields['CallerIDName'] ?? null;

         if ($callerIDNum && $uniqueid) {
             $callLog = CallLog::where('uniqueid', $uniqueid)->first();
             if ($callLog) {
                 $callLog->update([
                     'callerid_num' => $callerIDNum,
                     'callerid_name' => $callerIDName
                 ]);
                 Log::info("Caller info captured", [
                     'uniqueid' => $uniqueid,
                     'caller_num' => $callerIDNum,
                     'caller_name' => $callerIDName
                 ]);
             }
         }
     }

     /**
      * Map channel state to call status
      */
     private function getStatusFromState($channelState)
     {
         switch ($channelState) {
             case 1: return 'down';
             case 2: return 'reserved';
             case 3: return 'off_hook';
             case 4: return 'dialing';
             case 5: return 'line_busy';
             case 6: return 'ringing';
             case 7: return 'answered';
             case 8: return 'busy';
             case 9: return 'unavailable';
             case 10: return 'ringing';
             case 11: return 'ring_in_use';
             case 12: return 'hold';
             default: return 'unknown';
         }
     }

     /**
      * Get channel-specific state description
      */
     private function getChannelStateDescription($stateNumber, $channel = null, $asteriskDesc = null)
     {
         $baseDesc = $this->getStateDescription($stateNumber, $asteriskDesc);

         // Add channel-specific context for better debugging
         if ($channel) {
             if (strpos($channel, 'SIP/') === 0) {
                 return "SIP: {$baseDesc}";
             } elseif (strpos($channel, 'PRI/') === 0) {
                 return "PRI: {$baseDesc}";
             } elseif (strpos($channel, 'DAHDI/') === 0) {
                 return "DAHDI: {$baseDesc}";
             } elseif (strpos($channel, 'IAX2/') === 0) {
                 return "IAX2: {$baseDesc}";
             } elseif (strpos($channel, 'Local/') === 0) {
                 return "Local: {$baseDesc}";
             }
         }

         return $baseDesc;
     }

     /**
      * Enhanced master channel detection for Asterisk 1.3
      */
     private function isMasterChannel(array $fields, $uniqueid, $linkedid)
     {
         // Method 1: Check if uniqueid equals linkedid (newer Asterisk)
         if ($uniqueid === $linkedid) {
             return true;
         }

         // Method 2: Channel name pattern for Asterisk 1.3
         $channel = $fields['Channel'] ?? '';
         if (preg_match('/^(SIP|PRI|DAHDI)\/\d+-\d+$/', $channel)) {
             return true;
         }

         // Method 3: Context analysis for master channels
         $context = $fields['Context'] ?? '';
         $masterContexts = ['from-internal', 'from-external', 'from-trunk'];
         if (in_array($context, $masterContexts)) {
             return true;
         }

         // Method 4: CallerID completeness check
         $callerIDNum = $fields['CallerIDNum'] ?? '';
         $callerIDName = $fields['CallerIDName'] ?? '';
         if (!empty($callerIDNum) && !empty($callerIDName)) {
             return true;
         }

         return false;
     }

          /**
      * Get state description for Asterisk 1.3 compatibility
      */
     private function getStateDescription($stateNumber, $asteriskDesc = null)
     {
         if ($stateNumber === null) {
             return 'Unknown';
         }

         // Use Asterisk's description if available and not empty
         if ($asteriskDesc && !empty(trim($asteriskDesc))) {
             return $asteriskDesc;
         }

         // Use our mapping for known states
         if (isset($this->stateDescriptions[$stateNumber])) {
             return $this->stateDescriptions[$stateNumber];
         }

         // Log unknown states for debugging
         Log::warning("Unknown channel state detected", [
             'state_number' => $stateNumber,
             'asterisk_description' => $asteriskDesc
         ]);

         return "State {$stateNumber}";
     }

     public function __destruct()
     {
         if ($this->connected && $this->socket) {
             $this->sendCommand("Action: Logoff");
             fclose($this->socket);
         }
     }
 }
