<?php

namespace App\Services\Ami\Features\Extensions;

use App\Services\Ami\Core\AmiManager;
use App\Models\Extension;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class ExtensionService
{
    private AmiManager $amiManager;
    private ExtensionParser $parser;

    public function __construct(AmiManager $amiManager)
    {
        $this->amiManager = $amiManager;
        $this->parser = new ExtensionParser();
    }

    public function refreshAll(): array
    {
        Log::info('🔄 [Extension Service] Starting extension refresh from Asterisk...');
        
        $startTime = microtime(true);
        
        try {
            // Get all extensions from AMI
            $amiExtensions = $this->getAllExtensionsFromAmi();
            
            if ($amiExtensions->isEmpty()) {
                throw new \Exception('No extensions found in AMI response');
            }

            // Update database with AMI data
            $updateStats = $this->updateDatabaseExtensions($amiExtensions);
            
            // Calculate final statistics
            $endTime = microtime(true);
            $duration = round(($endTime - $startTime) * 1000, 2);
            
            $result = [
                'success' => true,
                'timestamp' => now()->toISOString(),
                'duration_ms' => $duration,
                'extensionsChecked' => $amiExtensions->count() + ($updateStats['marked_offline'] ?? 0),
                'lastQueryTime' => now()->toISOString(),
                'statistics' => [
                    'successfulQueries' => ($updateStats['created'] ?? 0) + ($updateStats['updated'] ?? 0) + ($updateStats['unchanged'] ?? 0),
                    'failedQueries' => $updateStats['errors'] ?? 0,
                    'statusChanges' => ($updateStats['created'] ?? 0) + ($updateStats['updated'] ?? 0) + ($updateStats['marked_offline'] ?? 0),
                    'noChanges' => $updateStats['unchanged'] ?? 0,
                ],
                'details' => [
                    'ami_extensions_found' => $amiExtensions->count(),
                    'created' => $updateStats['created'] ?? 0,
                    'updated' => $updateStats['updated'] ?? 0,
                    'unchanged' => $updateStats['unchanged'] ?? 0,
                    'marked_offline' => $updateStats['marked_offline'] ?? 0,
                    'errors' => $updateStats['errors'] ?? 0,
                ]
            ];

            // Create debug file
            $this->createDebugFile($amiExtensions, $result);

            Log::info('✅ [Extension Service] Extension refresh completed', $result);
            
            return $result;

        } catch (\Exception $e) {
            $duration = round((microtime(true) - $startTime) * 1000, 2);
            
            Log::error('❌ [Extension Service] Extension refresh failed', [
                'error' => $e->getMessage(),
                'duration_ms' => $duration
            ]);
            
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'timestamp' => now()->toISOString(),
                'duration_ms' => $duration
            ];
        }
    }

    public function getStatus(string $extension, string $context = 'ext-local'): ?array
    {
        try {
            $command = new ExtensionStateCommand($extension, $context);
            $response = $this->amiManager->executeCommand($command);
            
            return $this->parser->parseExtensionState($response);
            
        } catch (\Exception $e) {
            Log::error('❌ [Extension Service] Failed to get extension status', [
                'extension' => $extension,
                'error' => $e->getMessage()
            ]);
            return null;
        }
    }

    public function getDeviceState(string $device): ?array
    {
        try {
            $command = new DeviceStateCommand($device);
            $response = $this->amiManager->executeCommand($command);
            
            return $this->parser->parseDeviceState($response);
            
        } catch (\Exception $e) {
            Log::error('❌ [Extension Service] Failed to get device state', [
                'device' => $device,
                'error' => $e->getMessage()
            ]);
            return null;
        }
    }

    public function bulkCheck(array $extensions): Collection
    {
        $results = collect();
        
        foreach ($extensions as $extension) {
            $status = $this->getStatus($extension);
            if ($status) {
                $results->push($status);
            }
        }
        
        return $results;
    }

    private function getAllExtensionsFromAmi(): Collection
    {
        Log::info('📡 [Extension Service] Querying all extensions from AMI...');
        
        $command = new ExtensionStateListCommand();
        $response = $this->amiManager->executeCommand($command);
        
        if (!$response->isSuccessful()) {
            throw new \Exception('AMI ExtensionStateList query failed: ' . implode(', ', $response->getErrors()));
        }

        $extensions = $this->parser->parseExtensionStateList($response);
        
        Log::info('📊 [Extension Service] AMI extensions parsed', [
            'total_events' => $response->getEventCount(),
            'parsed_extensions' => $extensions->count(),
            'duration_ms' => $response->getDuration()
        ]);

        return $extensions;
    }

    private function updateDatabaseExtensions(Collection $amiExtensions): array
    {
        $stats = [
            'updated' => 0,
            'unchanged' => 0,
            'created' => 0,
            'errors' => 0,
            'marked_offline' => 0
        ];

        Log::info('📊 [Extension Service] Starting database updates with auto-creation...');

        // 1. Update or create extensions found in AMI
        foreach ($amiExtensions as $amiExt) {
            try {
                $dbExtension = Extension::where('extension', $amiExt['extension'])->first();

                if (!$dbExtension) {
                    // Extension not found - create new one
                    $newExt = $this->createExtensionFromAmi($amiExt);
                    
                    if ($newExt) {
                        Log::debug('✨ [Extension Service] Created new extension', [
                            'extension' => $amiExt['extension'],
                            'status_code' => $amiExt['status_code'],
                            'device_state' => $amiExt['device_state']
                        ]);
                        $stats['created']++;
                    } else {
                        $stats['errors']++;
                    }
                    continue;
                }

                // Extension exists - check if active
                if (!$dbExtension->is_active) {
                    Log::debug('🚫 [Extension Service] Extension inactive, skipping', [
                        'extension' => $amiExt['extension']
                    ]);
                    continue;
                }

                // Check if status actually changed
                $statusChanged = (
                    $dbExtension->status_code !== $amiExt['status_code'] ||
                    $dbExtension->device_state !== $amiExt['device_state']
                );

                if ($statusChanged) {
                    $this->updateExtensionFromAmi($dbExtension, $amiExt);
                    
                    Log::debug('✅ [Extension Service] Updated extension', [
                        'extension' => $amiExt['extension'],
                        'old_status_code' => $dbExtension->status_code,
                        'new_status_code' => $amiExt['status_code'],
                        'old_device_state' => $dbExtension->device_state,
                        'new_device_state' => $amiExt['device_state']
                    ]);
                    $stats['updated']++;
                } else {
                    Log::debug('📝 [Extension Service] Extension unchanged', [
                        'extension' => $amiExt['extension'],
                        'status_code' => $amiExt['status_code']
                    ]);
                    $stats['unchanged']++;
                    
                    // Still update last_seen timestamp
                    $dbExtension->update(['last_seen' => now()]);
                }

            } catch (\Exception $e) {
                Log::error('❌ [Extension Service] Error processing extension', [
                    'extension' => $amiExt['extension'],
                    'error' => $e->getMessage()
                ]);
                $stats['errors']++;
            }
        }

        // 2. Mark extensions as offline if they exist in DB but not in AMI response
        try {
            $amiExtensionNumbers = $amiExtensions->pluck('extension')->toArray();
            $dbExtensions = Extension::where('is_active', true)
                ->whereNotIn('extension', $amiExtensionNumbers)
                ->where('status', '!=', 'offline')
                ->get();

            foreach ($dbExtensions as $dbExt) {
                $dbExt->update([
                    'status' => 'offline',
                    'status_code' => 4, // Unavailable
                    'device_state' => 'UNAVAILABLE',
                    'last_status_change' => now(),
                    'last_seen' => now()
                ]);
                
                Log::debug('🔴 [Extension Service] Marked extension offline', [
                    'extension' => $dbExt->extension
                ]);
                $stats['marked_offline']++;
            }

        } catch (\Exception $e) {
            Log::error('❌ [Extension Service] Error marking missing extensions offline', [
                'error' => $e->getMessage()
            ]);
            $stats['errors']++;
        }

        return $stats;
    }

    private function createExtensionFromAmi(array $amiExt): ?Extension
    {
        try {
            return Extension::create([
                'extension' => $amiExt['extension'],
                'status' => $amiExt['status'],
                'status_code' => $amiExt['status_code'],
                'device_state' => $amiExt['device_state'],
                'last_status_change' => now(),
                'last_seen' => now(),
                'is_active' => true,
                'agent_name' => null, // Will be set manually later
                'team' => null
            ]);
        } catch (\Exception $e) {
            Log::error('❌ [Extension Service] Failed to create extension', [
                'extension' => $amiExt['extension'],
                'error' => $e->getMessage()
            ]);
            return null;
        }
    }

    private function updateExtensionFromAmi(Extension $dbExtension, array $amiExt): bool
    {
        try {
            $dbExtension->update([
                'status' => $amiExt['status'],
                'status_code' => $amiExt['status_code'],
                'device_state' => $amiExt['device_state'],
                'last_status_change' => now(),
                'last_seen' => now()
            ]);
            return true;
        } catch (\Exception $e) {
            Log::error('❌ [Extension Service] Failed to update extension', [
                'extension' => $amiExt['extension'],
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    private function createDebugFile(Collection $amiExtensions, array $result): void
    {
        try {
            $debugData = [
                'metadata' => [
                    'timestamp' => now()->toISOString(),
                    'ami_host' => config('ami.connection.host'),
                    'ami_port' => config('ami.connection.port'),
                    'query_type' => 'ExtensionStateList',
                    'total_extensions' => $amiExtensions->count()
                ],
                'extensions' => $amiExtensions->toArray(),
                'statistics' => $result['details'] ?? [],
                'summary' => $result
            ];

            $filename = 'extension-refresh/refresh-' . now()->format('Y-m-d-H-i-s') . '.json';
            Storage::disk('local')->put($filename, json_encode($debugData, JSON_PRETTY_PRINT));

            Log::info('📄 [Extension Service] Debug file created', [
                'filename' => $filename,
                'extension_count' => $amiExtensions->count()
            ]);

        } catch (\Exception $e) {
            Log::warning('⚠️ [Extension Service] Failed to create debug file', [
                'error' => $e->getMessage()
            ]);
        }
    }
}