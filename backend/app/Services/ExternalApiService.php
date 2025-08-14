<?php

namespace App\Services;

use App\Models\ExternalApiConfig;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class ExternalApiService
{
    private $config;
    private $baseUrl;

    public function __construct(string $configName = 'shajgoj_api')
    {
        $this->config = ExternalApiConfig::where('name', $configName)->first();

        // Get base URL from environment variable
        $this->baseUrl = env('BASE_URL');

        if (!$this->baseUrl) {
            // Log warning but don't throw exception during construction
            Log::warning('BASE_URL environment variable is not set');
            $this->baseUrl = null;
        } else {
            // Remove trailing slash if present
            $this->baseUrl = rtrim($this->baseUrl, '/');
        }
    }

    /**
     * Get the base URL from environment
     */
    public function getBaseUrl(): string
    {
        if (!$this->baseUrl) {
            throw new \Exception('BASE_URL or EXTERNAL_API_BASE_URL environment variable is required');
        }
        return $this->baseUrl;
    }

    /**
     * Get or create the external API configuration (for token storage only)
     */
    public function getConfig(): ?ExternalApiConfig
    {
        return $this->config;
    }

    /**
     * Initialize or update the external API configuration (stores credentials and tokens)
     */
    public function initializeConfig(array $data): ExternalApiConfig
    {
        // Encrypt password for secure storage
        $encryptedPassword = null;
        if (isset($data['password'])) {
            $encryptedPassword = encrypt($data['password']);
        }

        $configData = [
            'base_url' => $this->baseUrl, // Store env URL for reference
            'email' => $data['email'] ?? null,
            'is_active' => true,
        ];

        // Only update password if provided
        if ($encryptedPassword) {
            $configData['password'] = $encryptedPassword;
        }

        // Only update CRM token if provided
        if (isset($data['crm_token'])) {
            $configData['crm_token'] = $data['crm_token'];
        }

        $this->config = ExternalApiConfig::updateOrCreate(
            ['name' => 'shajgoj_api'],
            $configData
        );

        Log::info('External API configuration initialized/updated', [
            'config_id' => $this->config->id,
            'email' => $data['email'] ?? 'not provided',
            'password_updated' => isset($data['password']),
            'crm_token_updated' => isset($data['crm_token']),
        ]);

        return $this->config;
    }

    /**
     * Get the current authentication token (CRM token or access token)
     */
    public function getCurrentAuthToken(): ?string
    {
        if (!$this->config) {
            return null;
        }

        // Prioritize CRM token from configuration
        if (!empty($this->config->crm_token)) {
            return $this->config->crm_token;
        }

        // Fall back to access token if available
        return $this->config->access_token;
    }

    /**
     * Check if using CRM token from configuration
     */
    public function isUsingCrmTokenConfig(): bool
    {
        return !empty($this->config?->crm_token);
    }

    /**
     * Set the provided CRM token directly
     */
    public function setCrmToken(string $crmToken, ?string $refreshToken = null): array
    {
        if (!$this->config) {
            throw new \Exception('External API configuration not found');
        }

        Log::info('Setting CRM token directly', [
            'config_id' => $this->config->id,
            'token_length' => strlen($crmToken),
            'has_refresh_token' => !empty($refreshToken)
        ]);

        // Try to decode JWT to get expiration
        $expiresAt = $this->parseJwtExpiration($crmToken);

        // Update tokens in database
        $this->config->update([
            'access_token' => $crmToken,
            'refresh_token' => $refreshToken, // Now stores refresh token if provided
            'token_expires_at' => $expiresAt,
        ]);

        Log::info('CRM token set successfully', [
            'expires_at' => $expiresAt ? $expiresAt->toISOString() : 'unknown',
            'has_refresh_token' => !empty($refreshToken)
        ]);

        return [
            'success' => true,
            'message' => 'CRM token set successfully',
            'expires_at' => $expiresAt ? $expiresAt->toISOString() : null,
            'has_refresh_token' => !empty($refreshToken),
        ];
    }

    /**
     * Set full authentication data (access token, refresh token, user info)
     */
    public function setFullAuthData(array $authData): array
    {
        if (!$this->config) {
            throw new \Exception('External API configuration not found');
        }

        Log::info('Setting full authentication data', [
            'config_id' => $this->config->id,
            'has_access_token' => isset($authData['access_token']),
            'has_refresh_token' => isset($authData['refresh_token']),
            'has_user' => isset($authData['user'])
        ]);

        // Parse expiration time
        $expiresAt = null;
        if (isset($authData['expires_in'])) {
            try {
                $expiresAt = Carbon::parse($authData['expires_in']);
            } catch (\Exception $e) {
                Log::warning('Failed to parse expires_in from auth data', [
                    'expires_in' => $authData['expires_in'],
                    'error' => $e->getMessage()
                ]);
                $expiresAt = $this->parseJwtExpiration($authData['access_token']);
            }
        } else {
            $expiresAt = $this->parseJwtExpiration($authData['access_token']);
        }

        // Update tokens in database
        $this->config->update([
            'access_token' => $authData['access_token'],
            'refresh_token' => $authData['refresh_token'] ?? null,
            'token_expires_at' => $expiresAt,
        ]);

        Log::info('Full authentication data set successfully', [
            'expires_at' => $expiresAt ? $expiresAt->toISOString() : 'unknown',
            'user_id' => $authData['user']['id'] ?? 'unknown'
        ]);

        return [
            'success' => true,
            'message' => 'Full authentication data set successfully',
            'user' => $authData['user'] ?? null,
            'expires_at' => $expiresAt ? $expiresAt->toISOString() : null,
            'has_refresh_token' => !empty($authData['refresh_token']),
        ];
    }

    /**
     * Parse JWT token to extract expiration time
     */
    private function parseJwtExpiration(string $token): ?Carbon
    {
        try {
            $parts = explode('.', $token);
            if (count($parts) !== 3) {
                Log::warning('Invalid JWT format');
                return Carbon::now()->addDays(30); // Default to 30 days
            }

            $payload = json_decode(base64_decode($parts[1]), true);

            if (isset($payload['exp'])) {
                return Carbon::createFromTimestamp($payload['exp']);
            }

            Log::warning('No expiration found in JWT', ['payload_keys' => array_keys($payload ?? [])]);
            return Carbon::now()->addDays(30); // Default to 30 days

        } catch (\Exception $e) {
            Log::error('Failed to parse JWT expiration', ['error' => $e->getMessage()]);
            return Carbon::now()->addDays(30); // Default to 30 days
        }
    }

    /**
     * Authenticate with external API using database credentials
     * Always fetches fresh tokens from API and updates database
     */
    public function authenticate(): array
    {
        if (!$this->config) {
            throw new \Exception('External API configuration not found. Please configure the API first.');
        }

        // Get credentials from database configuration
        $email = $this->config->email;
        $password = $this->config->password;

        if (!$email || !$password) {
            throw new \Exception('Email and password must be configured in the database before authentication');
        }

        // Decrypt password if it's encrypted
        try {
            $decryptedPassword = decrypt($password);
        } catch (\Exception $e) {
            // If decryption fails, assume it's plain text (for backward compatibility)
            $decryptedPassword = $password;
        }

        // Check if we have a CRM token in configuration
        if (!empty($this->config->crm_token)) {
            Log::info('Using existing CRM token from configuration');
            return [
                'success' => true,
                'message' => 'Using existing CRM token',
                'token_type' => 'crm_config',
                'expires_at' => $this->parseJwtExpiration($this->config->crm_token),
            ];
        }

        try {
            Log::info('Authenticating with external API using database credentials', [
                'base_url' => $this->baseUrl,
                'email' => $email,
                'config_id' => $this->config->id,
                'login_url' => $this->baseUrl . '/crm/login'
            ]);

            $response = Http::timeout(30)
                ->withOptions(['verify' => false])
                ->post($this->baseUrl . '/crm/login', [
                    'email' => $email,
                    'password' => $decryptedPassword,
                ]);

            if (!$response->successful()) {
                Log::error('Authentication request failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                    'url' => $this->baseUrl . '/crm/login'
                ]);

                // Handle specific error cases
                if ($response->status() === 404) {
                    throw new \Exception('Login endpoint not found. The external API might not have a /login endpoint or the base URL is incorrect. Please verify the BASE_URL environment variable.');
                } elseif ($response->status() === 401 || $response->status() === 422) {
                    throw new \Exception('Invalid credentials. Please check the email and password in the configuration.');
                } else {
                    throw new \Exception('Authentication request failed with status ' . $response->status() . ': ' . $response->body());
                }
            }

            $data = $response->json();

            if (!isset($data['access_token'])) {
                Log::error('Invalid authentication response', [
                    'response_keys' => array_keys($data ?? []),
                    'response_body' => $response->body()
                ]);
                throw new \Exception('Invalid authentication response: missing access_token. Response: ' . $response->body());
            }

            // Parse expiration time
            $expiresAt = $this->parseJwtExpiration($data['access_token']);

            // Update tokens in database
            $this->config->update([
                'access_token' => $data['access_token'],
                'refresh_token' => $data['refresh_token'] ?? null,
                'token_expires_at' => $expiresAt,
            ]);

            Log::info('Authentication successful, tokens saved to database', [
                'config_id' => $this->config->id,
                'expires_at' => $expiresAt ? $expiresAt->toISOString() : 'unknown',
                'has_refresh_token' => !empty($data['refresh_token'])
            ]);

            return [
                'success' => true,
                'message' => 'Authentication successful',
                'user' => $data['user'] ?? null,
                'expires_at' => $expiresAt ? $expiresAt->toISOString() : null,
            ];

        } catch (\Exception $e) {
            Log::error('Authentication failed', [
                'error' => $e->getMessage(),
                'base_url' => $this->baseUrl,
                'email' => $email,
                'config_id' => $this->config->id
            ]);

            throw new \Exception('Authentication failed: ' . $e->getMessage());
        }
    }

    /**
     * Refresh the access token
     */
    public function refreshToken(): array
    {
        if (!$this->config || !$this->config->refresh_token) {
            throw new \Exception('No refresh token available. CRM tokens are long-lived and do not require refreshing.');
        }

        // Check if this looks like a CRM token (JWT format)
        if ($this->isCrmToken($this->config->access_token)) {
            throw new \Exception('CRM tokens are long-lived and do not support refresh. Token is valid until July 4, 2025.');
        }

        $response = Http::timeout(30)
            ->withOptions(['verify' => false]) // Disable SSL verification for development
            ->post($this->config->base_url . '/crm/refresh', [
            'refresh_token' => $this->config->refresh_token,
        ]);

        if (!$response->successful()) {
            Log::error('Token refresh failed', [
                'status' => $response->status(),
                'body' => $response->body(),
                'endpoint' => $this->config->base_url . '/crm/refresh'
            ]);

            // Check if it's a 404 (endpoint doesn't exist)
            if ($response->status() === 404) {
                throw new \Exception('Refresh endpoint not available. The API may not support token refresh, or CRM tokens may be long-lived.');
            }

            // If refresh fails, try re-authentication
            return $this->authenticate();
        }

        $data = $response->json();

        // Update tokens
        $this->config->update([
            'access_token' => $data['access_token'],
            'refresh_token' => $data['refresh_token'] ?? $this->config->refresh_token,
            'token_expires_at' => isset($data['expires_in']) ? Carbon::parse($data['expires_in']) : null,
        ]);

        return [
            'success' => true,
            'message' => 'Token refreshed successfully',
            'expires_at' => $this->config->token_expires_at ? $this->config->token_expires_at->toISOString() : null,
        ];
    }

    /**
     * Check if a token is a CRM token (JWT format)
     */
    private function isCrmToken(?string $token): bool
    {
        if (!$token) return false;

        // CRM tokens are JWT format (3 parts separated by dots)
        $parts = explode('.', $token);
        return count($parts) === 3 && strlen($token) > 500; // JWT tokens are typically long
    }

    /**
     * Ensure we have a valid access token
     */
    public function ensureValidToken(): string
    {
        if (!$this->config) {
            throw new \Exception('External API configuration not found');
        }

        // Get the current token (CRM config or access token)
        $currentToken = $this->getCurrentAuthToken();

        if (!$currentToken) {
            // No token available, need to authenticate
            $this->authenticate();
            return $this->config->access_token;
        }

        // If using CRM token from config, it's always valid
        if ($this->isUsingCrmTokenConfig()) {
            return $currentToken;
        }

        // For regular tokens, check expiration and refresh if needed
        if ($this->config->isTokenExpired()) {
            $this->authenticate();
        } elseif ($this->config->needsTokenRefresh()) {
            try {
                $this->refreshToken();
            } catch (\Exception $e) {
                Log::warning('Token refresh failed, re-authenticating', ['error' => $e->getMessage()]);
                $this->authenticate();
            }
        }

        return $this->config->access_token;
    }

    /**
     * Get token status
     */
    public function getTokenStatus(): array
    {
        if (!$this->config) {
            return [
                'has_token' => false,
                'is_expired' => true,
                'needs_refresh' => true,
                'expires_at' => null,
                'has_refresh_token' => false,
                'is_crm_token' => false,
                'has_crm_config' => false,
            ];
        }

        $currentToken = $this->getCurrentAuthToken();
        $isCrmToken = $this->isCrmToken($currentToken);
        $hasCrmConfig = !empty($this->config->crm_token);

        // Get the appropriate expires_at date
        $expiresAt = null;
        if ($hasCrmConfig) {
            // For CRM config tokens, parse the JWT expiration
            $expiresAt = $this->parseJwtExpiration($this->config->crm_token);
        } else {
            // For regular tokens, use the database stored expiration
            $expiresAt = $this->config->token_expires_at;
        }

        return [
            'has_token' => !empty($currentToken),
            'is_expired' => $hasCrmConfig ? false : $this->config->isTokenExpired(), // CRM tokens from config are considered always valid
            'needs_refresh' => $hasCrmConfig ? false : $this->config->needsTokenRefresh(),
            'expires_at' => $expiresAt ? $expiresAt->toISOString() : null, // Always return ISO format
            'has_refresh_token' => !empty($this->config->refresh_token),
            'is_crm_token' => $isCrmToken,
            'has_crm_config' => $hasCrmConfig,
            'can_refresh' => !$isCrmToken && !empty($this->config->refresh_token) && !$hasCrmConfig,
        ];
    }

    /**
     * Make a generic GET request to the external API with authentication
     */
    public function getData(string $endpoint, array $params = []): array
    {
        try {
            // Ensure we have a valid token
            $token = $this->ensureValidToken();

            // Build the full URL
            $url = $this->getBaseUrl() . $endpoint;

            Log::info('Making external API request', [
                'url' => $url,
                'params' => $params,
                'has_token' => !empty($token)
            ]);

            // Make the HTTP request with authentication
            $response = Http::timeout(30)
                ->withOptions(['verify' => false])
                ->withHeaders([
                    'Authorization' => 'Bearer ' . $token,
                    'Accept' => 'application/json',
                    'Content-Type' => 'application/json',
                ])
                ->get($url, $params);

            if (!$response->successful()) {
                Log::error('External API request failed', [
                    'url' => $url,
                    'status' => $response->status(),
                    'body' => $response->body(),
                    'params' => $params
                ]);

                // Handle specific error cases
                if ($response->status() === 401) {
                    // Token might be invalid, try to re-authenticate and retry once
                    Log::info('Received 401, attempting re-authentication');
                    $this->authenticate();
                    $newToken = $this->config->access_token;

                    $retryResponse = Http::timeout(30)
                        ->withOptions(['verify' => false])
                        ->withHeaders([
                            'Authorization' => 'Bearer ' . $newToken,
                            'Accept' => 'application/json',
                            'Content-Type' => 'application/json',
                        ])
                        ->get($url, $params);

                    if (!$retryResponse->successful()) {
                        throw new \Exception('API request failed after re-authentication. Status: ' . $retryResponse->status() . ', Response: ' . $retryResponse->body());
                    }

                    $response = $retryResponse;
                } else if ($response->status() === 404) {
                    throw new \Exception('API endpoint not found: ' . $endpoint . '. Please verify the endpoint URL.');
                } else {
                    throw new \Exception('API request failed with status ' . $response->status() . ': ' . $response->body());
                }
            }

            $data = $response->json();

            Log::info('External API request successful', [
                'url' => $url,
                'response_keys' => array_keys($data ?? [])
            ]);

            return $data;

        } catch (\Exception $e) {
            Log::error('getData method failed', [
                'endpoint' => $endpoint,
                'params' => $params,
                'error' => $e->getMessage()
            ]);

            throw new \Exception('Failed to fetch data from external API: ' . $e->getMessage());
        }
    }

    /**
     * Create data via external API (POST request)
     */
    public function createData(string $endpoint, array $data): array
    {
        try {
            // Ensure we have a valid token
            $token = $this->ensureValidToken();

            // Build the full URL
            $url = $this->getBaseUrl() . $endpoint;

            Log::info('Making external API create request', [
                'url' => $url,
                'data_keys' => array_keys($data),
                'has_token' => !empty($token)
            ]);

            // Make the HTTP POST request with authentication
            $response = Http::timeout(30)
                ->withOptions(['verify' => false])
                ->withHeaders([
                    'Authorization' => 'Bearer ' . $token,
                    'Accept' => 'application/json',
                    'Content-Type' => 'application/json',
                ])
                ->post($url, $data);

            if (!$response->successful()) {
                Log::error('External API create request failed', [
                    'url' => $url,
                    'status' => $response->status(),
                    'body' => $response->body(),
                    'data' => $data
                ]);

                if ($response->status() === 401) {
                    // Token might be invalid, try to re-authenticate and retry once
                    Log::info('Received 401, attempting re-authentication');
                    $this->authenticate();
                    $newToken = $this->config->access_token;

                    $retryResponse = Http::timeout(30)
                        ->withOptions(['verify' => false])
                        ->withHeaders([
                            'Authorization' => 'Bearer ' . $newToken,
                            'Accept' => 'application/json',
                            'Content-Type' => 'application/json',
                        ])
                        ->post($url, $data);

                    if (!$retryResponse->successful()) {
                        throw new \Exception('API create request failed after re-authentication. Status: ' . $retryResponse->status() . ', Response: ' . $retryResponse->body());
                    }

                    $response = $retryResponse;
                } else {
                    throw new \Exception('API create request failed with status ' . $response->status() . ': ' . $response->body());
                }
            }

            $responseData = $response->json();

            Log::info('External API create request successful', [
                'url' => $url,
                'response_keys' => array_keys($responseData ?? [])
            ]);

            return $responseData;

        } catch (\Exception $e) {
            Log::error('createData method failed', [
                'endpoint' => $endpoint,
                'data' => $data,
                'error' => $e->getMessage()
            ]);

            throw new \Exception('Failed to create data via external API: ' . $e->getMessage());
        }
    }

    /**
     * Update data via external API (PUT request)
     */
    public function updateData(string $endpoint, array $data): array
    {
        try {
            // Ensure we have a valid token
            $token = $this->ensureValidToken();

            // Build the full URL
            $url = $this->getBaseUrl() . $endpoint;

            Log::info('Making external API update request', [
                'url' => $url,
                'data_keys' => array_keys($data),
                'has_token' => !empty($token)
            ]);

            // Make the HTTP PUT request with authentication
            $response = Http::timeout(30)
                ->withOptions(['verify' => false])
                ->withHeaders([
                    'Authorization' => 'Bearer ' . $token,
                    'Accept' => 'application/json',
                    'Content-Type' => 'application/json',
                ])
                ->put($url, $data);

            if (!$response->successful()) {
                Log::error('External API update request failed', [
                    'url' => $url,
                    'status' => $response->status(),
                    'body' => $response->body(),
                    'data' => $data
                ]);

                if ($response->status() === 401) {
                    // Token might be invalid, try to re-authenticate and retry once
                    Log::info('Received 401, attempting re-authentication');
                    $this->authenticate();
                    $newToken = $this->config->access_token;

                    $retryResponse = Http::timeout(30)
                        ->withOptions(['verify' => false])
                        ->withHeaders([
                            'Authorization' => 'Bearer ' . $newToken,
                            'Accept' => 'application/json',
                            'Content-Type' => 'application/json',
                        ])
                        ->put($url, $data);

                    if (!$retryResponse->successful()) {
                        throw new \Exception('API update request failed after re-authentication. Status: ' . $retryResponse->status() . ', Response: ' . $retryResponse->body());
                    }

                    $response = $retryResponse;
                } else {
                    throw new \Exception('API update request failed with status ' . $response->status() . ': ' . $response->body());
                }
            }

            $responseData = $response->json();

            Log::info('External API update request successful', [
                'url' => $url,
                'response_keys' => array_keys($responseData ?? [])
            ]);

            return $responseData;

        } catch (\Exception $e) {
            Log::error('updateData method failed', [
                'endpoint' => $endpoint,
                'data' => $data,
                'error' => $e->getMessage()
            ]);

            throw new \Exception('Failed to update data via external API: ' . $e->getMessage());
        }
    }

    /**
     * Delete data via external API (DELETE request)
     */
    public function deleteData(string $endpoint, array $params = []): array
    {
        try {
            // Ensure we have a valid token
            $token = $this->ensureValidToken();

            // Build the full URL
            $url = $this->getBaseUrl() . $endpoint;

            Log::info('Making external API delete request', [
                'url' => $url,
                'params' => $params,
                'has_token' => !empty($token)
            ]);

            // Make the HTTP DELETE request with authentication
            $response = Http::timeout(30)
                ->withOptions(['verify' => false])
                ->withHeaders([
                    'Authorization' => 'Bearer ' . $token,
                    'Accept' => 'application/json',
                    'Content-Type' => 'application/json',
                ])
                ->delete($url, $params);

            if (!$response->successful()) {
                Log::error('External API delete request failed', [
                    'url' => $url,
                    'status' => $response->status(),
                    'body' => $response->body(),
                    'params' => $params
                ]);

                if ($response->status() === 401) {
                    // Token might be invalid, try to re-authenticate and retry once
                    Log::info('Received 401, attempting re-authentication');
                    $this->authenticate();
                    $newToken = $this->config->access_token;

                    $retryResponse = Http::timeout(30)
                        ->withOptions(['verify' => false])
                        ->withHeaders([
                            'Authorization' => 'Bearer ' . $newToken,
                            'Accept' => 'application/json',
                            'Content-Type' => 'application/json',
                        ])
                        ->delete($url, $params);

                    if (!$retryResponse->successful()) {
                        throw new \Exception('API delete request failed after re-authentication. Status: ' . $retryResponse->status() . ', Response: ' . $retryResponse->body());
                    }

                    $response = $retryResponse;
                } else {
                    throw new \Exception('API delete request failed with status ' . $response->status() . ': ' . $response->body());
                }
            }

            $responseData = $response->json();

            Log::info('External API delete request successful', [
                'url' => $url,
                'response_keys' => array_keys($responseData ?? [])
            ]);

            return $responseData;

        } catch (\Exception $e) {
            Log::error('deleteData method failed', [
                'endpoint' => $endpoint,
                'params' => $params,
                'error' => $e->getMessage()
            ]);

            throw new \Exception('Failed to delete data via external API: ' . $e->getMessage());
        }
    }
}
