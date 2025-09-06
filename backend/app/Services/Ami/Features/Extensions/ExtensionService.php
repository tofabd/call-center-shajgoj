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
            $amiResult = $this->getAllExtensionsFromAmi();
            $amiExtensions = $amiResult['parsed_extensions'];
            $rawAmiResponse = $amiResult['raw_ami_response'];
            
            if ($amiExtensions->isEmpty()) {
                throw new \Exception('No extensions found in AMI response');
            }

            Log::info('✅ [Extension Service] Step 1 Complete: Found ' . $amiExtensions->count() . ' extensions from AMI');

            // STEP 2: Write separate JSON files for different data types
            Log::info('📄 [Extension Service] Step 2: Creating separate JSON files for raw, parsed, and filtered data...');
            
            // Get raw extension list (3-5 digits only, minimal fields)
            $rawExtensions = $this->parser->parseRawExtensionStateList($rawAmiResponse);
            
            // Create 3 separate JSON files
            $debugFiles = $this->createSeparateDebugFiles($amiExtensions, $rawAmiResponse, $rawExtensions, $startTime);
            Log::info('✅ [Extension Service] Step 2 Complete: 4 separate JSON debug files created', $debugFiles);

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
                'debug_files' => $debugFiles,
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
                'ami_parsed_data' => $amiExtensions->toArray() // Include parsed AMI extension data in response
            ];

            // STEP 4: Update the JSON files with final results
            $this->updateDebugFilesWithResults($debugFiles, $result);

            Log::info('✅ [Extension Service] All steps completed successfully', [
                'total_duration_ms' => $duration,
                'extensions_processed' => $amiExtensions->count(),
                'debug_files' => $debugFiles
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

    private function getAllExtensionsFromAmi(): array
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

        // Return both parsed extensions and raw response
        return [
            'parsed_extensions' => $extensions,
            'raw_ami_response' => $response
        ];
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
                        $stats['created']++;
                    } else {
                        $stats['errors']++;
                    }
                    continue;
                }

                // Extension exists - check if active
                if (!$dbExtension->is_active) {
                    continue;
                }

                // Check if status actually changed
                $statusChanged = (
                    $dbExtension->status_code !== $amiExt['status_code'] ||
                    $dbExtension->availability_status !== $amiExt['availability_status']
                );

                if ($statusChanged) {
                    $updateResult = $this->updateExtensionFromAmi($dbExtension, $amiExt);
                    
                    if ($updateResult) {
                        $stats['updated']++;
                    } else {
                        $stats['errors']++;
                    }
                } else {
                    $stats['unchanged']++;
                    // Still update last_seen timestamp
                    $dbExtension->update(['last_seen' => now()]);
                }

            } catch (\Exception $e) {
                Log::error('❌ [DB] Process error', [
                    'ext' => $amiExt['extension'],
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
                ->where('availability_status', '!=', 'offline')
                ->get();

            if ($dbExtensions->count() > 0) {
                Log::info('🔴 [DB] Marking offline', [
                    'count' => $dbExtensions->count(),
                    'extensions' => $dbExtensions->pluck('extension')->toArray()
                ]);
            }

            foreach ($dbExtensions as $dbExt) {
                $updateResult = $dbExt->update([
                    'availability_status' => 'offline',
                    'status_code' => 4,
                    'status_text' => 'Unavailable',
                    'status_changed_at' => now(),
                    'updated_at' => now()
                ]);
                
                if ($updateResult) {
                    $stats['marked_offline']++;
                }
            }

        } catch (\Exception $e) {
            Log::error('❌ [DB] Mark offline failed', [
                'error' => $e->getMessage()
            ]);
            $stats['errors']++;
        }

        // Database operations summary
        Log::info('📊 [DB] Operations complete', [
            'created' => $stats['created'],
            'updated' => $stats['updated'],
            'unchanged' => $stats['unchanged'],
            'offline' => $stats['marked_offline'],
            'errors' => $stats['errors']
        ]);

        return $stats;
    }

    private function createExtensionFromAmi(array $amiExt): ?Extension
    {
        try {
            $createData = [
                'extension' => $amiExt['extension'],
                'availability_status' => $amiExt['availability_status'],
                'status_code' => $amiExt['status_code'],
                'status_text' => $amiExt['status_text'] ?? null,
                'status_changed_at' => now(),
                'is_active' => true,
                'agent_name' => null,
                'team_id' => null
            ];
            
            $newExtension = Extension::create($createData);
            
            Log::info('✅ [DB] Created extension', [
                'ext' => $amiExt['extension'],
                'id' => $newExtension->id,
                'status' => $amiExt['status_code']
            ]);
            
            return $newExtension;
        } catch (\Exception $e) {
            Log::error('❌ [DB] Create failed', [
                'ext' => $amiExt['extension'],
                'error' => $e->getMessage()
            ]);
            return null;
        }
    }

    private function updateExtensionFromAmi(Extension $dbExtension, array $amiExt): bool
    {
        try {
            $oldStatus = $dbExtension->status_code;
            $updateData = [
                'availability_status' => $amiExt['availability_status'],
                'status_code' => $amiExt['status_code'],
                'status_text' => $amiExt['status_text'] ?? $dbExtension->status_text,
                'status_changed_at' => now()
            ];
            
            $updateResult = $dbExtension->update($updateData);
            
            Log::info('✅ [DB] Updated extension', [
                'ext' => $amiExt['extension'],
                'id' => $dbExtension->id,
                'change' => $oldStatus . '→' . $amiExt['status_code']
            ]);
            
            return true;
        } catch (\Exception $e) {
            Log::error('❌ [DB] Update failed', [
                'ext' => $amiExt['extension'],
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
     * Create 3 separate debug files for different data types
     */
    private function createSeparateDebugFiles(Collection $amiExtensions, $rawAmiResponse, Collection $rawExtensions, float $startTime): array
    {
        try {
            $currentTime = microtime(true);
            $parseTime = round(($currentTime - $startTime) * 1000, 2);
            $timestamp = now()->format('Y-m-d_H-i-s');
            $debugPath = base_path('debug');
            
            // Ensure debug directory exists
            if (!file_exists($debugPath)) {
                mkdir($debugPath, 0755, true);
            }
            
            $files = [];
            
            // FILE 1: Raw AMI Response Only
            $rawFileName = "raw_ami_response_{$timestamp}.json";
            $rawData = [
                'metadata' => [
                    'timestamp' => now()->toISOString(),
                    'ami_host' => config('ami.connection.host', 'unknown'),
                    'ami_port' => config('ami.connection.port', 'unknown'),
                    'query_type' => 'ExtensionStateList',
                    'type' => 'raw_ami_data',
                    'description' => 'Complete raw AMI response - unprocessed events and responses'
                ],
                'raw_events' => $rawAmiResponse->getEvents(),
                'final_response' => $rawAmiResponse->getFinalResponse(),
                'event_count' => $rawAmiResponse->getEventCount(),
                'duration_ms' => $rawAmiResponse->getDuration(),
                'errors' => $rawAmiResponse->getErrors(),
                'is_successful' => $rawAmiResponse->isSuccessful()
            ];
            file_put_contents($debugPath . '/' . $rawFileName, json_encode($rawData, JSON_PRETTY_PRINT));
            $files['raw'] = $rawFileName;
            
            // FILE 2: Parsed Extensions (minimal, no extra fields)
            $parsedFileName = "parsed_extensions_{$timestamp}.json";
            $parsedExtensions = $this->getMinimalParsedExtensions($rawAmiResponse);
            $parsedData = [
                'metadata' => [
                    'timestamp' => now()->toISOString(),
                    'type' => 'parsed_extensions',
                    'description' => 'All parsed extension events - minimal processing, core AMI fields only (no filtering)',
                    'total_ami_events' => $rawAmiResponse->getEventCount(),
                    'parsed_extensions_count' => count($parsedExtensions),
                    'parsing_duration_ms' => $parseTime
                ],
                'extensions' => $parsedExtensions,
                'count' => count($parsedExtensions),
                'summary' => [
                    'includes_all_extensions' => 'All extension types from AMI response',
                    'no_filtering_applied' => 'Includes SIP peers, trunks, and other non-user extensions'
                ]
            ];
            file_put_contents($debugPath . '/' . $parsedFileName, json_encode($parsedData, JSON_PRETTY_PRINT));
            $files['parsed'] = $parsedFileName;
            
            // FILE 3: Filtered 3-5 Digit Extensions Only
            $filteredFileName = "filtered_extensions_{$timestamp}.json";
            $filteredExtensions = $this->getFiltered3to5DigitExtensions($rawAmiResponse);
            $filteredData = [
                'metadata' => [
                    'timestamp' => now()->toISOString(),
                    'type' => 'filtered_extensions',
                    'description' => 'Only 3-5 digit numeric extensions in ext-local context',
                    'filter_criteria' => 'Extensions matching /^\\d{3,5}$/ in ext-local context',
                    'total_ami_events' => $rawAmiResponse->getEventCount(),
                    'filtered_count' => count($filteredExtensions),
                    'parsing_duration_ms' => $parseTime
                ],
                'extensions' => $filteredExtensions,
                'count' => count($filteredExtensions),
                'summary' => [
                    'criteria' => '3-5 digit numeric extensions only',
                    'context_filter' => 'ext-local',
                    'regex_pattern' => '^\\d{3,5}$'
                ]
            ];
            file_put_contents($debugPath . '/' . $filteredFileName, json_encode($filteredData, JSON_PRETTY_PRINT));
            $files['filtered'] = $filteredFileName;
            
            // FILE 4: Extension Refresh Results (placeholder - will be populated after database operations)
            $resultFileName = "extension_refresh_result_{$timestamp}.json";
            $resultData = [
                'metadata' => [
                    'timestamp' => now()->toISOString(),
                    'type' => 'extension_refresh_result',
                    'description' => 'Complete extension refresh operation results and statistics',
                    'status' => 'pending_completion',
                    'initial_parsing_duration_ms' => $parseTime
                ],
                'operation_summary' => [
                    'ami_query_completed' => true,
                    'parsing_completed' => true,
                    'database_update_status' => 'pending',
                    'ami_extensions_found' => $amiExtensions->count(),
                    'filtered_extensions_count' => count($filteredExtensions),
                    'raw_events_processed' => $rawAmiResponse->getEventCount()
                ],
                'database_operations' => [
                    'status' => 'pending',
                    'created' => 'TBD',
                    'updated' => 'TBD', 
                    'unchanged' => 'TBD',
                    'marked_offline' => 'TBD',
                    'errors' => 'TBD'
                ],
                'final_statistics' => [
                    'status' => 'will_be_populated_after_completion'
                ],
                'timing' => [
                    'start_time' => now()->subMilliseconds(intval($parseTime))->toISOString(),
                    'parsing_duration_ms' => $parseTime,
                    'total_duration_ms' => 'TBD'
                ],
                'debug_files_created' => [
                    'raw_ami' => $rawFileName,
                    'parsed_extensions' => $parsedFileName,
                    'filtered_extensions' => $filteredFileName,
                    'this_result_file' => $resultFileName
                ]
            ];
            file_put_contents($debugPath . '/' . $resultFileName, json_encode($resultData, JSON_PRETTY_PRINT));
            $files['result'] = $resultFileName;
            
            $files['base_name'] = "extension_debug_{$timestamp}";
            $files['path'] = $debugPath;
            
            Log::info('📄 [Extension Service] 4 separate debug files created successfully', [
                'raw_file' => $rawFileName,
                'parsed_file' => $parsedFileName,
                'filtered_file' => $filteredFileName,
                'result_file' => $resultFileName,
                'path' => $debugPath,
                'raw_events' => $rawAmiResponse->getEventCount(),
                'parsed_extensions' => count($this->getMinimalParsedExtensions($rawAmiResponse)),
                'filtered_extensions' => count($filteredExtensions),
                'parsing_duration_ms' => $parseTime
            ]);
            
            return $files;
            
        } catch (\Exception $e) {
            Log::warning('⚠️ [Extension Service] Failed to create separate debug files', [
                'error' => $e->getMessage()
            ]);
            return ['error' => $e->getMessage()];
        }
    }

    /**
     * Get minimal parsed extensions - only core AMI fields, no extra processing
     */
    private function getMinimalParsedExtensions($rawAmiResponse): array
    {
        $extensions = [];
        $events = $rawAmiResponse->getEvents();
        
        foreach ($events as $event) {
            if (isset($event['Event']) && $event['Event'] === 'ExtensionStatus') {
                // Only include core AMI fields - no extra processing
                $extensions[] = [
                    'Exten' => $event['Exten'] ?? null,
                    'Context' => $event['Context'] ?? null,
                    'Status' => $event['Status'] ?? null,
                    'StatusText' => $event['StatusText'] ?? null
                ];
            }
        }
        
        return $extensions;
    }

    /**
     * Get filtered 3-5 digit extensions - only numerical extensions with 3-5 digits
     */
    private function getFiltered3to5DigitExtensions($rawAmiResponse): array
    {
        $filteredExtensions = [];
        $events = $rawAmiResponse->getEvents();
        
        foreach ($events as $event) {
            if (isset($event['Event']) && $event['Event'] === 'ExtensionStatus') {
                $extension = $event['Exten'] ?? null;
                $context = $event['Context'] ?? null;
                
                // Filter: Only 3-5 digit numerical extensions in ext-local context
                if ($extension && $context && 
                    preg_match('/^\d{3,5}$/', $extension) && 
                    $context === 'ext-local') {
                    
                    $filteredExtensions[] = [
                        'extension' => $extension,
                        'context' => $context,
                        'status_code' => $event['Status'] ?? null,
                        'status_text' => $event['StatusText'] ?? null,
                        'raw_fields' => [
                            'Exten' => $event['Exten'] ?? null,
                            'Context' => $event['Context'] ?? null,
                            'Status' => $event['Status'] ?? null,
                            'StatusText' => $event['StatusText'] ?? null
                        ]
                    ];
                }
            }
        }
        
        // Sort by extension number for better readability
        usort($filteredExtensions, function($a, $b) {
            return (int)$a['extension'] <=> (int)$b['extension'];
        });
        
        return $filteredExtensions;
    }

    /**
     * Update all debug files with final results
     */
    private function updateDebugFilesWithResults(array $debugFiles, array $finalResult): void
    {
        if (isset($debugFiles['error'])) {
            return; // Skip if files weren't created successfully
        }
        
        try {
            $debugPath = $debugFiles['path'];
            $finalResults = [
                'final_results' => [
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
                ]
            ];
            
            // Update each file with final results
            foreach (['raw', 'parsed', 'filtered', 'result'] as $type) {
                if (isset($debugFiles[$type])) {
                    $filePath = $debugPath . '/' . $debugFiles[$type];
                    if (file_exists($filePath)) {
                        $existingData = json_decode(file_get_contents($filePath), true);
                        
                        if ($type === 'result') {
                            // For result file, update the placeholder data with complete results
                            $existingData['metadata']['status'] = 'completed';
                            $existingData['metadata']['completion_timestamp'] = now()->toISOString();
                            $existingData['operation_summary']['database_update_status'] = 'completed';
                            $existingData['database_operations'] = [
                                'status' => 'completed',
                                'created' => $finalResult['details']['created'],
                                'updated' => $finalResult['details']['updated'],
                                'unchanged' => $finalResult['details']['unchanged'],
                                'marked_offline' => $finalResult['details']['marked_offline'],
                                'errors' => $finalResult['details']['errors']
                            ];
                            $existingData['final_statistics'] = $finalResult['statistics'];
                            $existingData['timing']['total_duration_ms'] = $finalResult['duration_ms'];
                            $existingData['timing']['completion_time'] = now()->toISOString();
                            $existingData['operation_result'] = [
                                'success' => $finalResult['success'],
                                'extensions_processed' => $finalResult['extensionsChecked'],
                                'status_changes' => $finalResult['statistics']['statusChanges'],
                                'no_changes' => $finalResult['statistics']['noChanges'],
                                'total_queries' => $finalResult['statistics']['successfulQueries'] + $finalResult['statistics']['failedQueries']
                            ];
                        } else {
                            // For other files, append final results as before
                            $existingData = array_merge($existingData, $finalResults);
                        }
                        
                        file_put_contents($filePath, json_encode($existingData, JSON_PRETTY_PRINT));
                    }
                }
            }
            
            Log::info('📄 [Extension Service] All 4 debug files updated with final results');
            
        } catch (\Exception $e) {
            Log::warning('⚠️ [Extension Service] Failed to update debug files with results', [
                'error' => $e->getMessage()
            ]);
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