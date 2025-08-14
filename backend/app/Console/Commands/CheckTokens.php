<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\ExternalApiConfig;

class CheckTokens extends Command
{
    protected $signature = 'check:tokens';
    protected $description = 'Check the current token status in the database';

    public function handle()
    {
        $this->info('=== External API Token Status ===');

        $config = ExternalApiConfig::first();

        if (!$config) {
            $this->error('❌ No configuration found in database');
            return;
        }

        $this->info('✅ Configuration found:');
        $this->line("  ID: {$config->id}");
        $this->line("  Name: {$config->name}");
        $this->line("  Base URL: {$config->base_url}");
        $this->line("  Email: {$config->email}");
        $this->line("  Is Active: " . ($config->is_active ? 'Yes' : 'No'));
        $this->line("");

        $this->info('=== Token Status ===');

        $accessTokenStatus = is_null($config->access_token) ?
            '❌ NULL' :
            '✅ Present (' . strlen($config->access_token) . ' chars)';

        $refreshTokenStatus = is_null($config->refresh_token) ?
            '❌ NULL' :
            '✅ Present (' . strlen($config->refresh_token) . ' chars)';

        $this->line("  Access Token: {$accessTokenStatus}");
        $this->line("  Refresh Token: {$refreshTokenStatus}");
        $this->line("  Token Expires At: " . ($config->token_expires_at ?? '❌ NULL'));
        $this->line("  Created At: {$config->created_at}");
        $this->line("  Updated At: {$config->updated_at}");
        $this->line("");

        if (is_null($config->refresh_token)) {
            $this->warn('🔍 ISSUE IDENTIFIED: Refresh Token is NULL');
            $this->line('');
            $this->info('=== Why Refresh Token is NULL ===');
            $this->line('1. You have only set an access token (CRM token)');
            $this->line('2. No refresh token was provided when setting the token');
            $this->line('3. This is expected if you used the old CRM token workflow');
            $this->line('');
            $this->info('=== How to Fix ===');
            $this->line('1. Use the frontend "Full Authentication" mode');
            $this->line('2. Or get both tokens from a fresh login');
            $this->line('3. Or use the "Access Token Only" mode with optional refresh token');
        } else {
            $this->info('✅ Both tokens are present!');
        }

        // Show token previews
        if ($config->access_token) {
            $token = $config->access_token;
            $preview = substr($token, 0, 50) . "..." . substr($token, -20);
            $this->line("");
            $this->line("Access Token Preview: {$preview}");
        }

        if ($config->refresh_token) {
            $refresh = $config->refresh_token;
            $preview = substr($refresh, 0, 50) . "..." . substr($refresh, -20);
            $this->line("Refresh Token Preview: {$preview}");
        }
    }
}
