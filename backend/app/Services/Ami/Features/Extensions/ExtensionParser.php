<?php

namespace App\Services\Ami\Features\Extensions;

use App\Services\Ami\Support\AmiResponse;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

class ExtensionParser
{
    public function parseExtensionStateList(AmiResponse $response): Collection
    {
        $extensions = collect();
        
        if (!$response->isSuccessful()) {
            Log::warning('⚠️ [Extension Parser] Response was not successful', [
                'errors' => $response->getErrors()
            ]);
            return $extensions;
        }

        $events = $response->getEvents();
        Log::debug('📋 [Extension Parser] Parsing extension state list', [
            'total_events' => count($events)
        ]);

        foreach ($events as $event) {
            if (isset($event['Event']) && $event['Event'] === 'ExtensionStatus') {
                $parsed = $this->parseExtensionStatusEvent($event);
                if ($parsed) {
                    $extensions->push($parsed);
                }
            }
        }

        Log::info('✅ [Extension Parser] Parsed extension state list', [
            'total_events' => count($events),
            'parsed_extensions' => $extensions->count(),
            'duration_ms' => $response->getDuration()
        ]);

        return $extensions;
    }

    public function parseExtensionState(AmiResponse $response): ?array
    {
        if (!$response->isSuccessful()) {
            return null;
        }

        $finalResponse = $response->getFinalResponse();
        
        if (!isset($finalResponse['Status'])) {
            return null;
        }

        return [
            'extension' => $finalResponse['Exten'] ?? null,
            'context' => $finalResponse['Context'] ?? null,
            'status_code' => (int)$finalResponse['Status'],
            'status' => $this->mapStatusCodeToStatus((int)$finalResponse['Status']),
            'device_state' => $this->mapStatusCodeToDeviceState((int)$finalResponse['Status']),
            'hint' => $finalResponse['Hint'] ?? null,
            'status_text' => $finalResponse['StatusText'] ?? null
        ];
    }

    public function parseDeviceStateList(AmiResponse $response): Collection
    {
        $devices = collect();
        
        if (!$response->isSuccessful()) {
            return $devices;
        }

        foreach ($response->getEvents() as $event) {
            if (isset($event['Event']) && $event['Event'] === 'DeviceStateChange') {
                $parsed = $this->parseDeviceStateEvent($event);
                if ($parsed) {
                    $devices->push($parsed);
                }
            }
        }

        return $devices;
    }

    public function parseDeviceState(AmiResponse $response): ?array
    {
        if (!$response->isSuccessful()) {
            return null;
        }

        $finalResponse = $response->getFinalResponse();
        
        return [
            'device' => $finalResponse['Device'] ?? null,
            'state' => $finalResponse['State'] ?? null,
            'state_desc' => $finalResponse['StateDesc'] ?? null
        ];
    }

    private function parseExtensionStatusEvent(array $event): ?array
    {
        // Filter for valid extensions (3-5 digits in ext-local context)
        $extension = $event['Exten'] ?? null;
        $context = $event['Context'] ?? null;
        
        if (!$extension || !$context) {
            return null;
        }

        // Only process extensions that match our criteria
        if (!preg_match('/^\d{3,5}$/', $extension) || $context !== 'ext-local') {
            Log::debug('🚫 [Extension Parser] Skipping extension', [
                'extension' => $extension,
                'context' => $context,
                'reason' => 'Not matching criteria'
            ]);
            return null;
        }

        $statusCode = isset($event['Status']) ? (int)$event['Status'] : -1;
        
        $parsed = [
            'extension' => $extension,
            'context' => $context,
            'status_code' => $statusCode,
            'status' => $this->mapStatusCodeToStatus($statusCode),
            'device_state' => $this->mapStatusCodeToDeviceState($statusCode),
            'hint' => $event['Hint'] ?? null,
            'status_text' => $event['StatusText'] ?? null,
            'raw_status' => $event['Status'] ?? null,
            'parsed_at' => now()->toISOString()
        ];

        Log::debug('✅ [Extension Parser] Parsed extension', [
            'extension' => $extension,
            'status_code' => $statusCode,
            'status' => $parsed['status'],
            'device_state' => $parsed['device_state']
        ]);

        return $parsed;
    }

    private function parseDeviceStateEvent(array $event): ?array
    {
        return [
            'device' => $event['Device'] ?? null,
            'state' => $event['State'] ?? null,
            'state_desc' => $event['StateDesc'] ?? null,
            'parsed_at' => now()->toISOString()
        ];
    }

    private function mapStatusCodeToStatus(int $statusCode): string
    {
        $statusMap = [
            0 => 'online',    // NotInUse
            1 => 'online',    // InUse
            2 => 'online',    // Busy
            4 => 'offline',   // Unavailable
            8 => 'online',    // Ringing
            16 => 'online',   // Ringinuse
            -1 => 'unknown'   // Unknown
        ];

        return $statusMap[$statusCode] ?? 'unknown';
    }

    private function mapStatusCodeToDeviceState(int $statusCode): string
    {
        $deviceStateMap = [
            -1 => 'UNKNOWN',
            0 => 'NOT_INUSE',
            1 => 'INUSE',
            2 => 'BUSY',
            4 => 'UNAVAILABLE',
            8 => 'RINGING',
            16 => 'RING*INUSE'
        ];

        return $deviceStateMap[$statusCode] ?? 'UNKNOWN';
    }

    public function getStatusCodeMapping(): array
    {
        return [
            -1 => ['status' => 'unknown', 'device_state' => 'UNKNOWN', 'description' => 'Unknown'],
            0 => ['status' => 'online', 'device_state' => 'NOT_INUSE', 'description' => 'Not In Use'],
            1 => ['status' => 'online', 'device_state' => 'INUSE', 'description' => 'In Use'],
            2 => ['status' => 'online', 'device_state' => 'BUSY', 'description' => 'Busy'],
            4 => ['status' => 'offline', 'device_state' => 'UNAVAILABLE', 'description' => 'Unavailable'],
            8 => ['status' => 'online', 'device_state' => 'RINGING', 'description' => 'Ringing'],
            16 => ['status' => 'online', 'device_state' => 'RING*INUSE', 'description' => 'Ringing + In Use']
        ];
    }
}