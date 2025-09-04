<?php

namespace App\Services\Ami\Core;

use App\Services\Ami\Support\AmiCommand;
use App\Services\Ami\Support\AmiResponse;
use Illuminate\Support\Facades\Log;

class Connection
{
    private $socket;
    private bool $connected = false;
    private bool $authenticated = false;
    private string $buffer = '';
    private array $config;
    private int $timeout;

    public function __construct(array $config)
    {
        $this->config = $config;
        $this->timeout = $config['timeout'] ?? 15000;
    }

    public function connect(): bool
    {
        try {
            Log::info('🔌 [AMI] Connecting to AMI', [
                'host' => $this->config['host'],
                'port' => $this->config['port']
            ]);

            $this->socket = socket_create(AF_INET, SOCK_STREAM, SOL_TCP);
            
            if (!$this->socket) {
                throw new \Exception('Failed to create socket: ' . socket_strerror(socket_last_error()));
            }

            // Set socket timeout
            socket_set_option($this->socket, SOL_SOCKET, SO_RCVTIMEO, [
                'sec' => intval($this->timeout / 1000),
                'usec' => ($this->timeout % 1000) * 1000
            ]);

            socket_set_option($this->socket, SOL_SOCKET, SO_SNDTIMEO, [
                'sec' => 10,
                'usec' => 0
            ]);

            $result = socket_connect($this->socket, $this->config['host'], $this->config['port']);
            
            if (!$result) {
                throw new \Exception('Failed to connect: ' . socket_strerror(socket_last_error($this->socket)));
            }

            $this->connected = true;
            
            // Wait for Asterisk banner
            usleep(500000); // 0.5 second delay
            $this->readBuffer(); // Clear any welcome message
            
            Log::info('✅ [AMI] Socket connected successfully');
            
            return true;

        } catch (\Exception $e) {
            Log::error('❌ [AMI] Connection failed', ['error' => $e->getMessage()]);
            $this->cleanup();
            return false;
        }
    }

    public function authenticate(): bool
    {
        if (!$this->connected) {
            return false;
        }

        try {
            Log::info('🔐 [AMI] Authenticating...');

            $loginCommand = [
                'Action: Login',
                'Username: ' . $this->config['username'],
                'Secret: ' . $this->config['password'],
                '',
                ''
            ];

            $this->send(implode("\r\n", $loginCommand));

            // Read authentication response
            $response = $this->readUntilComplete(5000); // 5 second timeout for auth
            
            if (strpos($response, 'Authentication accepted') !== false || 
                strpos(strtolower($response), 'success') !== false) {
                $this->authenticated = true;
                Log::info('✅ [AMI] Authentication successful');
                return true;
            }

            Log::error('❌ [AMI] Authentication failed', ['response' => $response]);
            return false;

        } catch (\Exception $e) {
            Log::error('❌ [AMI] Authentication error', ['error' => $e->getMessage()]);
            return false;
        }
    }

    public function send(string $data): bool
    {
        if (!$this->connected) {
            return false;
        }

        try {
            $bytesWritten = socket_write($this->socket, $data, strlen($data));
            return $bytesWritten !== false;
        } catch (\Exception $e) {
            Log::error('❌ [AMI] Send failed', ['error' => $e->getMessage()]);
            return false;
        }
    }

    public function sendCommand(AmiCommand $command): bool
    {
        Log::debug('📤 [AMI] Sending command', [
            'action' => $command->getAction(),
            'action_id' => $command->getActionId()
        ]);

        return $this->send($command->toString());
    }

    public function readUntilComplete(int $timeoutMs = null): string
    {
        $timeout = $timeoutMs ?? $this->timeout;
        $startTime = microtime(true);
        $response = '';

        while ((microtime(true) - $startTime) * 1000 < $timeout) {
            $data = $this->readBuffer();
            if ($data) {
                $response .= $data;
                
                // Check for complete response (double CRLF)
                if (strpos($response, "\r\n\r\n") !== false) {
                    break;
                }
            }
            usleep(10000); // 10ms sleep
        }

        return $response;
    }

    public function collectResponse(AmiCommand $command): AmiResponse
    {
        $response = new AmiResponse();
        $response->addMetadata('command', $command->getAction());
        $response->addMetadata('action_id', $command->getActionId());

        try {
            $buffer = '';
            $startTime = microtime(true);
            $timeout = $command->getTimeout();
            $expectsMultiple = $command->expectsMultipleEvents();
            $completionEvent = $command->getCompletionEventName();

            while ((microtime(true) - $startTime) * 1000 < $timeout) {
                $data = $this->readBuffer();
                if ($data) {
                    $buffer .= $data;

                    // Process complete messages
                    $messages = explode("\r\n\r\n", $buffer);
                    $buffer = array_pop($messages); // Keep incomplete message

                    foreach ($messages as $message) {
                        if (trim($message)) {
                            $event = $this->parseEvent($message);
                            
                            if ($expectsMultiple) {
                                $response->addEvent($event);
                                
                                // Check for completion event
                                if ($completionEvent && isset($event['Event']) && 
                                    $event['Event'] === $completionEvent) {
                                    $response->markComplete(true);
                                    return $response;
                                }
                            } else {
                                // Single response command
                                $response->setFinalResponse($event);
                                $response->markComplete(true);
                                return $response;
                            }
                        }
                    }
                }
                usleep(10000); // 10ms sleep
            }

            // Timeout reached
            if (!$response->isComplete()) {
                $response->addError('Response timeout after ' . $timeout . 'ms');
                $response->markComplete(false);
            }

        } catch (\Exception $e) {
            $response->addError('Collection error: ' . $e->getMessage());
            $response->markComplete(false);
        }

        return $response;
    }

    public function logout(): bool
    {
        if (!$this->authenticated) {
            return true;
        }

        try {
            Log::info('👋 [AMI] Logging out...');
            
            $logoutCommand = "Action: Logoff\r\n\r\n";
            $this->send($logoutCommand);
            
            // Small delay to ensure logoff is sent
            usleep(100000); // 0.1 second
            
            $this->authenticated = false;
            return true;

        } catch (\Exception $e) {
            Log::error('❌ [AMI] Logout error', ['error' => $e->getMessage()]);
            return false;
        }
    }

    public function disconnect(): void
    {
        $this->logout();
        $this->cleanup();
    }

    public function isConnected(): bool
    {
        return $this->connected;
    }

    public function isAuthenticated(): bool
    {
        return $this->authenticated;
    }

    private function readBuffer(): ?string
    {
        if (!$this->connected) {
            return null;
        }

        try {
            $data = socket_read($this->socket, 8192);
            return $data === false ? null : $data;
        } catch (\Exception $e) {
            Log::warning('⚠️ [AMI] Read buffer error', ['error' => $e->getMessage()]);
            return null;
        }
    }

    private function parseEvent(string $eventText): array
    {
        $event = [];
        $lines = explode("\r\n", trim($eventText));

        foreach ($lines as $line) {
            $colonPos = strpos($line, ':');
            if ($colonPos > 0) {
                $key = trim(substr($line, 0, $colonPos));
                $value = trim(substr($line, $colonPos + 1));
                $event[$key] = $value;
            }
        }

        return $event;
    }

    private function cleanup(): void
    {
        if ($this->socket) {
            socket_close($this->socket);
            $this->socket = null;
        }
        
        $this->connected = false;
        $this->authenticated = false;
        $this->buffer = '';
        
        Log::info('🔌 [AMI] Connection cleaned up');
    }

    public function __destruct()
    {
        $this->cleanup();
    }
}