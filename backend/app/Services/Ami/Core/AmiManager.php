<?php

namespace App\Services\Ami\Core;

use App\Services\Ami\Support\AmiCommand;
use App\Services\Ami\Support\AmiResponse;
use App\Services\Ami\Features\Extensions\ExtensionService;
use App\Services\Ami\Features\Sip\SipService;
use App\Services\Ami\Features\Channels\ChannelService;
use App\Services\Ami\Features\System\SystemService;
use Illuminate\Support\Facades\Log;

class AmiManager
{
    private Connection $connection;
    private ResponseCollector $responseCollector;
    private array $config;
    
    // Feature services
    private ?ExtensionService $extensionService = null;
    private ?SipService $sipService = null;
    private ?ChannelService $channelService = null;
    private ?SystemService $systemService = null;

    public function __construct(array $config)
    {
        $this->config = $config;
        $this->connection = new Connection($config);
        $this->responseCollector = new ResponseCollector();
    }

    public function connect(): bool
    {
        Log::info('🚀 [AMI Manager] Initializing connection...');
        
        if (!$this->connection->connect()) {
            Log::error('❌ [AMI Manager] Failed to connect to AMI');
            return false;
        }

        if (!$this->connection->authenticate()) {
            Log::error('❌ [AMI Manager] Failed to authenticate with AMI');
            $this->connection->disconnect();
            return false;
        }

        Log::info('✅ [AMI Manager] Successfully connected and authenticated');
        return true;
    }

    public function disconnect(): void
    {
        Log::info('👋 [AMI Manager] Disconnecting...');
        
        $this->connection->disconnect();
        $this->responseCollector->cleanup();
        
        // Reset feature services
        $this->extensionService = null;
        $this->sipService = null;
        $this->channelService = null;
        $this->systemService = null;
        
        Log::info('🔌 [AMI Manager] Disconnected successfully');
    }

    public function executeCommand(AmiCommand $command): AmiResponse
    {
        if (!$this->connection->isAuthenticated()) {
            throw new \Exception('AMI connection not authenticated');
        }

        Log::info('📤 [AMI Manager] Executing command', [
            'action' => $command->getAction(),
            'action_id' => $command->getActionId(),
            'expects_multiple' => $command->expectsMultipleEvents()
        ]);

        try {
            // Send command
            if (!$this->connection->sendCommand($command)) {
                throw new \Exception('Failed to send command');
            }

            // Collect response
            $response = $this->connection->collectResponse($command);

            Log::info('📥 [AMI Manager] Command completed', [
                'action' => $command->getAction(),
                'action_id' => $command->getActionId(),
                'successful' => $response->isSuccessful(),
                'event_count' => $response->getEventCount(),
                'duration_ms' => $response->getDuration()
            ]);

            return $response;

        } catch (\Exception $e) {
            Log::error('❌ [AMI Manager] Command execution failed', [
                'action' => $command->getAction(),
                'action_id' => $command->getActionId(),
                'error' => $e->getMessage()
            ]);

            $response = new AmiResponse();
            $response->addError($e->getMessage());
            $response->markComplete(false);
            
            return $response;
        }
    }

    public function executeMultipleCommands(array $commands): array
    {
        $results = [];

        foreach ($commands as $command) {
            if (!$command instanceof AmiCommand) {
                Log::warning('⚠️ [AMI Manager] Skipping invalid command in batch');
                continue;
            }

            $results[$command->getActionId()] = $this->executeCommand($command);
        }

        Log::info('📊 [AMI Manager] Batch execution completed', [
            'total_commands' => count($commands),
            'executed_commands' => count($results)
        ]);

        return $results;
    }

    public function isConnected(): bool
    {
        return $this->connection->isConnected();
    }

    public function isAuthenticated(): bool
    {
        return $this->connection->isAuthenticated();
    }

    public function testConnection(): bool
    {
        if (!$this->isAuthenticated()) {
            return false;
        }

        try {
            $systemService = $this->system();
            $result = $systemService->ping();
            
            return $result !== null && isset($result['success']) && $result['success'];
            
        } catch (\Exception $e) {
            Log::error('❌ [AMI Manager] Connection test failed', ['error' => $e->getMessage()]);
            return false;
        }
    }

    public function getConnectionStatus(): array
    {
        return [
            'connected' => $this->isConnected(),
            'authenticated' => $this->isAuthenticated(),
            'config' => [
                'host' => $this->config['host'],
                'port' => $this->config['port'],
                'timeout' => $this->config['timeout'] ?? 15000
            ],
            'statistics' => $this->responseCollector->getStatistics()
        ];
    }

    // Feature service getters with lazy loading
    public function extensions(): ExtensionService
    {
        if ($this->extensionService === null) {
            $this->extensionService = new ExtensionService($this);
        }
        
        return $this->extensionService;
    }

    public function sip(): SipService
    {
        if ($this->sipService === null) {
            $this->sipService = new SipService($this);
        }
        
        return $this->sipService;
    }

    public function channels(): ChannelService
    {
        if ($this->channelService === null) {
            $this->channelService = new ChannelService($this);
        }
        
        return $this->channelService;
    }

    public function system(): SystemService
    {
        if ($this->systemService === null) {
            $this->systemService = new SystemService($this);
        }
        
        return $this->systemService;
    }

    public function getStatistics(): array
    {
        return [
            'connection' => $this->getConnectionStatus(),
            'response_collector' => $this->responseCollector->getStatistics()
        ];
    }

    public function __destruct()
    {
        $this->disconnect();
    }
}