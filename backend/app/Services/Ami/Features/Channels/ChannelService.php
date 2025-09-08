<?php

namespace App\Services\Ami\Features\Channels;

use App\Services\Ami\Core\AmiManager;
use App\Services\Ami\Core\CommandBuilder;
use App\Services\Ami\Support\AmiCommand;
use App\Services\Ami\Support\CommandTypes;
use App\Services\Ami\Support\ResponseTypes;
use Illuminate\Support\Facades\Log;

class ChannelService
{
    private AmiManager $amiManager;

    public function __construct(AmiManager $amiManager)
    {
        $this->amiManager = $amiManager;
    }

    public function getActiveChannels(): array
    {
        try {
            Log::info('📡 [Channel Service] Querying active channels from AMI...');
            
            // Create CoreShowChannels command
            $command = new CoreShowChannelsCommand();
            
            $response = $this->amiManager->executeCommand($command);
            
            if (!$response->isSuccessful()) {
                Log::error('❌ [Channel Service] CoreShowChannels query failed', [
                    'errors' => $response->getErrors()
                ]);
                return [];
            }
            
            // Parse channels from response events
            $channels = $this->parseChannelsFromResponse($response);
            
            Log::info('✅ [Channel Service] Retrieved active channels', [
                'channel_count' => count($channels),
                'duration_ms' => $response->getDuration()
            ]);
            
            return $channels;
            
        } catch (\Exception $e) {
            Log::error('❌ [Channel Service] Failed to get active channels', [
                'error' => $e->getMessage()
            ]);
            return [];
        }
    }

    public function getChannelStatus(string $channel): ?array
    {
        // TODO: Implement individual channel status
        return null;
    }

    public function hangupChannel(string $channel): bool
    {
        // TODO: Implement channel hangup
        return false;
    }
    
    private function parseChannelsFromResponse($response): array
    {
        $channels = [];
        $events = $response->getEvents();
        
        foreach ($events as $event) {
            if (isset($event['Event']) && $event['Event'] === 'CoreShowChannel') {
                // Only include channels with essential data
                if (isset($event['Channel']) && !empty($event['Channel'])) {
                    $channels[] = [
                        'channel' => $event['Channel'],
                        'uniqueid' => $event['UniqueID'] ?? null,
                        'linkedid' => $event['LinkedID'] ?? null,
                        'context' => $event['Context'] ?? null,
                        'extension' => $event['Extension'] ?? null,
                        'state' => $event['State'] ?? null,
                        'priority' => $event['Priority'] ?? null,
                        'seconds' => $event['Seconds'] ?? null,
                        'application' => $event['Application'] ?? null,
                        'data' => $event['ApplicationData'] ?? null,
                        'callerid_num' => $event['CallerIDNum'] ?? null,
                        'callerid_name' => $event['CallerIDName'] ?? null,
                    ];
                }
            }
        }
        
        return $channels;
    }
}