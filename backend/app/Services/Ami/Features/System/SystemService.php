<?php

namespace App\Services\Ami\Features\System;

use App\Services\Ami\Core\AmiManager;
use Illuminate\Support\Facades\Log;

class SystemService
{
    private AmiManager $amiManager;

    public function __construct(AmiManager $amiManager)
    {
        $this->amiManager = $amiManager;
    }

    public function ping(): ?array
    {
        try {
            Log::debug('🏓 [System Service] Sending ping...');
            
            $command = new PingCommand();
            $response = $this->amiManager->executeCommand($command);
            
            if (!$response->isSuccessful()) {
                return [
                    'success' => false,
                    'errors' => $response->getErrors()
                ];
            }

            $finalResponse = $response->getFinalResponse();
            
            return [
                'success' => true,
                'response' => $finalResponse,
                'duration_ms' => $response->getDuration(),
                'timestamp' => now()->toISOString()
            ];

        } catch (\Exception $e) {
            Log::error('❌ [System Service] Ping failed', [
                'error' => $e->getMessage()
            ]);
            
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    public function getCoreStatus(): ?array
    {
        try {
            $command = new CoreStatusCommand();
            $response = $this->amiManager->executeCommand($command);
            
            if (!$response->isSuccessful()) {
                return null;
            }

            return $response->getFinalResponse();

        } catch (\Exception $e) {
            Log::error('❌ [System Service] Failed to get core status', [
                'error' => $e->getMessage()
            ]);
            return null;
        }
    }

    public function executeCliCommand(string $cliCommand): ?array
    {
        try {
            $command = new CommandCommand($cliCommand);
            $response = $this->amiManager->executeCommand($command);
            
            if (!$response->isSuccessful()) {
                return null;
            }

            return $response->getFinalResponse();

        } catch (\Exception $e) {
            Log::error('❌ [System Service] Failed to execute CLI command', [
                'command' => $cliCommand,
                'error' => $e->getMessage()
            ]);
            return null;
        }
    }
}