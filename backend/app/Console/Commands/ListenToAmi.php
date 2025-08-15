<?php
namespace App\Console\Commands;


use Illuminate\Console\Command;
use App\Models\CallLog;
use App\Models\CallInstance;
use App\Events\CallStatusUpdated;
use Illuminate\Support\Facades\Log;

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
         if (!isset($fields['Uniqueid']) || !isset($fields['Linkedid'])) {
             $this->error("Missing required fields: Uniqueid or Linkedid");
             return;
         }

         try {
             // Check if this is a new call (uniqueid equals linkedid)
             if ($fields['Uniqueid'] === $fields['Linkedid']) {
                 // Create new CallInstance
                 $callInstance = CallInstance::create([
                     'unique_id' => $fields['Uniqueid']
                 ]);
                 $this->info("New CallInstance created with ID: {$callInstance->id}");
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

             if (!$callLog->exists) {
                 $updateData['start_time'] = now();
                 $updateData['status'] = 'ringing';
             } else {
                 $updateData['status'] = 'answered';
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

     public function __destruct()
     {
         if ($this->connected && $this->socket) {
             $this->sendCommand("Action: Logoff");
             fclose($this->socket);
         }
     }
 }
