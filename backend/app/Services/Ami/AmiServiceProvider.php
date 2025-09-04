<?php

namespace App\Services\Ami;

use App\Services\Ami\Core\AmiManager;
use Illuminate\Support\Facades\Log;

class AmiServiceProvider
{
    private ?AmiManager $manager = null;
    private array $config;

    public function __construct()
    {
        $this->config = config('ami.connection', [
            'host' => env('AMI_HOST', '103.177.125.83'),
            'port' => env('AMI_PORT', 5038),
            'username' => env('AMI_USERNAME', 'admin'),
            'password' => env('AMI_PASSWORD', 'admin123'),
            'timeout' => env('AMI_TIMEOUT', 15000),
        ]);
    }

    public function connect(): bool
    {
        if ($this->isConnected()) {
            return true;
        }

        try {
            $this->manager = new AmiManager($this->config);
            
            if (!$this->manager->connect()) {
                $this->manager = null;
                return false;
            }

            Log::info('✅ [AMI Service] Successfully connected to AMI', [
                'host' => $this->config['host'],
                'port' => $this->config['port']
            ]);

            return true;

        } catch (\Exception $e) {
            Log::error('❌ [AMI Service] Failed to connect to AMI', [
                'error' => $e->getMessage(),
                'config' => [
                    'host' => $this->config['host'],
                    'port' => $this->config['port']
                ]
            ]);

            $this->manager = null;
            return false;
        }
    }

    public function disconnect(): void
    {
        if ($this->manager) {
            $this->manager->disconnect();
            $this->manager = null;
            
            Log::info('🔌 [AMI Service] Disconnected from AMI');
        }
    }

    public function isConnected(): bool
    {
        return $this->manager && $this->manager->isConnected() && $this->manager->isAuthenticated();
    }

    public function testConnection(): bool
    {
        if (!$this->isConnected() && !$this->connect()) {
            return false;
        }

        return $this->manager->testConnection();
    }

    public function extensions()
    {
        $this->ensureConnected();
        return $this->manager->extensions();
    }

    public function sip()
    {
        $this->ensureConnected();
        return $this->manager->sip();
    }

    public function channels()
    {
        $this->ensureConnected();
        return $this->manager->channels();
    }

    public function system()
    {
        $this->ensureConnected();
        return $this->manager->system();
    }

    public function getManager(): ?AmiManager
    {
        return $this->manager;
    }

    public function getStatistics(): array
    {
        if (!$this->manager) {
            return [
                'connected' => false,
                'authenticated' => false,
                'error' => 'No active connection'
            ];
        }

        return $this->manager->getStatistics();
    }

    public function getConnectionStatus(): array
    {
        return [
            'connected' => $this->isConnected(),
            'config' => [
                'host' => $this->config['host'],
                'port' => $this->config['port'],
                'timeout' => $this->config['timeout']
            ],
            'manager_available' => $this->manager !== null,
            'statistics' => $this->getStatistics()
        ];
    }

    private function ensureConnected(): void
    {
        if (!$this->isConnected()) {
            if (!$this->connect()) {
                throw new \Exception('Failed to establish AMI connection');
            }
        }
    }

    public function executeWithConnection(callable $callback)
    {
        $wasConnected = $this->isConnected();
        
        try {
            if (!$wasConnected && !$this->connect()) {
                throw new \Exception('Failed to connect to AMI');
            }

            $result = $callback($this);
            
            return $result;

        } catch (\Exception $e) {
            Log::error('❌ [AMI Service] Operation failed', [
                'error' => $e->getMessage()
            ]);
            throw $e;
        } finally {
            // Only disconnect if we made the connection
            if (!$wasConnected && $this->isConnected()) {
                $this->disconnect();
            }
        }
    }

    public function __destruct()
    {
        $this->disconnect();
    }
}