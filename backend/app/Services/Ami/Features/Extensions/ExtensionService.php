<?php

namespace App\Services\Ami\Features\Extensions;

use App\Services\Ami\Core\AmiManager;
use App\Services\Ami\Features\Extensions\ExtensionStateListCommand;
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
            // STEP 1: Query ExtensionStateList from AMI
            Log::info('📡 [Extension Service] Step 1: Querying ExtensionStateList from AMI...');
            $amiExtensions = $this->getAllExtensionsFromAmi();
            
            if ($amiExtensions->isEmpty()) {
                throw new \Exception('No extensions found in AMI response');
            }

            Log::info('✅ [Extension Service] Step 1 Complete: Found ' . $amiExtensions->count() . ' extensions from AMI');

            // STEP 2: Write ALL parsed extensions to JSON file FIRST (before database update)
            Log::info('📄 [Extension Service] Step 2: Writing parsed extensions to JSON debug file...');
            $debugFileName = $this->createDebugFileFirst($amiExtensions, $startTime);
            Log::info('✅ [Extension Service] Step 2 Complete: JSON debug file created: ' . $debugFileName);

            // STEP 3: Update database with AMI data (after JSON file is saved)
            Log::info('🗄️ [Extension Service] Step 3: Updating database with parsed extension data...');
            $updateStats = $this->updateDatabaseExtensions($amiExtensions);
            Log::info('✅ [Extension Service] Step 3 Complete: Database updated with statistics', $updateStats);
            
            // Calculate final statistics
            $endTime = microtime(true);
            $duration = round(($endTime - $startTime) * 1000, 2);
            
            $result = [
                'success' => true,
                'timestamp' => now()->toISOString(),
                'duration_ms' => $duration,
                'extensionsChecked' => $amiExtensions->count() + ($updateStats['marked_offline'] ?? 0),
                'lastQueryTime' => now()->toISOString(),
                'debug_file' => $debugFileName,
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
                ],
                'ami_raw_data' => $amiExtensions->toArray() // Include raw AMI data in response
            ];

            // STEP 4: Update the JSON file with final results
            $this->updateDebugFileWithResults($debugFileName, $result);

            Log::info('✅ [Extension Service] All steps completed successfully', [
                'total_duration_ms' => $duration,
                'extensions_processed' => $amiExtensions->count(),
                'debug_file' => $debugFileName
            ]);
            
            return $result;

        } catch (\Exception $e) {
            $duration = round((microtime(true) - $startTime) * 1000, 2);
            
            Log::error('❌ [Extension Service] Extension refresh failed', [
                'error' => $e->getMessage(),
                'duration_ms' => $duration,
                'trace' => $e->getTraceAsString()
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
                'status_text' => $amiExt['status_text'] ?? null,
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
                'status_text' => $amiExt['status_text'] ?? $dbExtension->status_text,
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

            // Use debug directory instead of storage
            $timestamp = now()->format('Y-m-d_H-i-s');
            $filename = "extension_refresh_{$timestamp}.json";
            $debugPath = base_path('debug');
            
            // Ensure debug directory exists
            if (!file_exists($debugPath)) {
                mkdir($debugPath, 0755, true);
            }
            
            file_put_contents($debugPath . '/' . $filename, json_encode($debugData, JSON_PRETTY_PRINT));

            Log::info('📄 [Extension Service] Debug file created', [
                'filename' => $filename,
                'path' => $debugPath . '/' . $filename,
                'extension_count' => $amiExtensions->count(),
                'size_bytes' => filesize($debugPath . '/' . $filename)
            ]);

        } catch (\Exception $e) {
            Log::warning('⚠️ [Extension Service] Failed to create debug file', [
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Create initial debug file with parsed AMI extensions (Step 2)
     */
    private function createDebugFileFirst(Collection $amiExtensions, float $startTime): string
    {
        try {
            $currentTime = microtime(true);
            $parseTime = round(($currentTime - $startTime) * 1000, 2);
            
            $debugData = [
                'metadata' => [
                    'timestamp' => now()->toISOString(),
                    'ami_host' => config('ami.connection.host', 'unknown'),
                    'ami_port' => config('ami.connection.port', 'unknown'),
                    'query_type' => 'ExtensionStateList',
                    'total_extensions' => $amiExtensions->count(),
                    'parsing_duration_ms' => $parseTime,
                    'status' => 'parsed_extensions_ready',
                    'next_step' => 'database_update_pending'
                ],
                'raw_ami_response' => [
                    'parsed_extensions' => $amiExtensions->toArray(),
                    'parsing_timestamp' => now()->toISOString(),
                    'notes' => 'This is the raw parsed data from AMI ExtensionStateList before database updates'
                ],
                'database_operations' => [
                    'status' => 'pending',
                    'message' => 'Database operations will be performed after this file is created'
                ]
            ];

            // Create filename with timestamp
            $timestamp = now()->format('Y-m-d_H-i-s');
            $filename = "extension_refresh_{$timestamp}.json";
            $debugPath = base_path('debug');
            
            // Ensure debug directory exists
            if (!file_exists($debugPath)) {
                mkdir($debugPath, 0755, true);
            }
            
            // Write initial debug file
            $fullPath = $debugPath . '/' . $filename;
            file_put_contents($fullPath, json_encode($debugData, JSON_PRETTY_PRINT));

            Log::info('📄 [Extension Service] Initial debug file created with parsed extensions', [
                'filename' => $filename,
                'path' => $fullPath,
                'extension_count' => $amiExtensions->count(),
                'parsing_duration_ms' => $parseTime,
                'size_bytes' => filesize($fullPath)
            ]);

            return $filename;

        } catch (\Exception $e) {
            Log::warning('⚠️ [Extension Service] Failed to create initial debug file', [
                'error' => $e->getMessage()
            ]);
            return 'debug_file_creation_failed.json';
        }
    }

    /**
     * Update debug file with final results after database operations (Step 4)
     */
    private function updateDebugFileWithResults(string $filename, array $finalResult): void
    {
        try {
            $debugPath = base_path('debug');
            $fullPath = $debugPath . '/' . $filename;
            
            // Read existing debug file
            if (!file_exists($fullPath)) {
                Log::warning('⚠️ [Extension Service] Debug file not found for update', ['filename' => $filename]);
                return;
            }
            
            $existingData = json_decode(file_get_contents($fullPath), true);
            
            // Update with final results
            $existingData['final_results'] = [
                'timestamp' => now()->toISOString(),
                'total_duration_ms' => $finalResult['duration_ms'],
                'database_operations' => [
                    'status' => 'completed',
                    'created' => $finalResult['details']['created'],
                    'updated' => $finalResult['details']['updated'],
                    'unchanged' => $finalResult['details']['unchanged'],
                    'marked_offline' => $finalResult['details']['marked_offline'],
                    'errors' => $finalResult['details']['errors']
                ],
                'statistics' => $finalResult['statistics'],
                'success' => $finalResult['success']
            ];
            
            $existingData['metadata']['status'] = 'completed';
            $existingData['metadata']['total_duration_ms'] = $finalResult['duration_ms'];
            $existingData['database_operations']['status'] = 'completed';
            
            // Write updated debug file
            file_put_contents($fullPath, json_encode($existingData, JSON_PRETTY_PRINT));

            Log::info('📄 [Extension Service] Debug file updated with final results', [
                'filename' => $filename,
                'path' => $fullPath,
                'total_duration_ms' => $finalResult['duration_ms'],
                'final_size_bytes' => filesize($fullPath)
            ]);

        } catch (\Exception $e) {
            Log::warning('⚠️ [Extension Service] Failed to update debug file with results', [
                'filename' => $filename,
                'error' => $e->getMessage()
            ]);
        }
    }
}