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
            'availability_status' => $this->mapToAvailabilityStatus((int)$finalResponse['Status']),
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

    /**
     * Parse raw extension state list - only real 3-5 digit extensions, no extra fields
     */
    public function parseRawExtensionStateList(AmiResponse $response): Collection
    {
        $extensions = collect();
        
        if (!$response->isSuccessful()) {
            Log::warning('⚠️ [Extension Parser] Raw parser - Response was not successful', [
                'errors' => $response->getErrors()
            ]);
            return $extensions;
        }

        $events = $response->getEvents();
        Log::debug('📋 [Extension Parser] Raw parser - Processing extension state list', [
            'total_events' => count($events)
        ]);

        foreach ($events as $event) {
            if (isset($event['Event']) && $event['Event'] === 'ExtensionStatus') {
                $parsed = $this->parseRawExtensionStatusEvent($event);
                if ($parsed) {
                    $extensions->push($parsed);
                }
            }
        }

        Log::info('✅ [Extension Parser] Raw parser completed', [
            'total_events' => count($events),
            'real_extensions_found' => $extensions->count(),
            'duration_ms' => $response->getDuration()
        ]);

        return $extensions;
    }

    /**
     * Parse individual extension status event - raw data only, 3-5 digit extensions only
     */
    private function parseRawExtensionStatusEvent(array $event): ?array
    {
        // Only get extension and context
        $extension = $event['Exten'] ?? null;
        $context = $event['Context'] ?? null;
        
        if (!$extension || !$context) {
            return null;
        }

        // Filter: Only 3-5 digit extensions in ext-local context
        if (!preg_match('/^\d{3,5}$/', $extension) || $context !== 'ext-local') {
            return null;
        }

        // Return only the raw AMI fields - no processing, no extra fields
        return [
            'Exten' => $extension,
            'Context' => $context,
            'Status' => $event['Status'] ?? null,
            'StatusText' => $event['StatusText'] ?? null
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
            'availability_status' => $this->mapToAvailabilityStatus($statusCode),
            'status_text' => $event['StatusText'] ?? null,
            'raw_status' => $event['Status'] ?? null,
            'parsed_at' => now()->toISOString()
        ];

        Log::debug('✅ [Extension Parser] Parsed extension', [
            'extension' => $extension,
            'status_code' => $statusCode,
            'availability_status' => $parsed['availability_status']
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

    /**
     * Map Asterisk status code to availability status
     */
    private function mapToAvailabilityStatus(int $statusCode): string
    {
        return match($statusCode) {
            0, 1, 2, 8, 16 => 'online',    // All online states
            4 => 'offline',                 // UNAVAILABLE
            32 => 'invalid',                // Invalid state
            -1 => 'unknown',                // Unknown state
            default => 'unknown'            // Others
        };
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

    public function getStatusCodeMapping(): array
    {
        return [
            -1 => ['status' => 'unknown', 'description' => 'Unknown'],
            0 => ['status' => 'online', 'description' => 'Not In Use'],
            1 => ['status' => 'online', 'description' => 'In Use'],
            2 => ['status' => 'online', 'description' => 'Busy'],
            4 => ['status' => 'offline', 'description' => 'Unavailable'],
            8 => ['status' => 'online', 'description' => 'Ringing'],
            16 => ['status' => 'online', 'description' => 'Ringing + In Use']
        ];
    }
}