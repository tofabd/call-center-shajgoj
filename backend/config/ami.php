<?php

return [
    /*
    |--------------------------------------------------------------------------
    | AMI Connection Configuration
    |--------------------------------------------------------------------------
    |
    | Configuration for Asterisk Manager Interface (AMI) connection
    |
    */
    'connection' => [
        'host' => env('AMI_HOST', '103.177.125.83'),
        'port' => env('AMI_PORT', 5038),
        'username' => env('AMI_USERNAME', 'admin'),
        'password' => env('AMI_PASSWORD', 'admin123'),
        'timeout' => env('AMI_TIMEOUT', 15000), // Connection timeout in milliseconds
    ],

    /*
    |--------------------------------------------------------------------------
    | Command Configuration
    |--------------------------------------------------------------------------
    |
    | Default settings for AMI commands
    |
    */
    'commands' => [
        'default_timeout' => 10000, // Default command timeout in milliseconds
        'retry_attempts' => 1, // Number of retry attempts for failed commands
        'batch_size' => 100, // Maximum number of commands in a batch
        
        // Command-specific timeouts
        'timeouts' => [
            'ExtensionStateList' => 20000,
            'DeviceStateList' => 20000,
            'SIPpeers' => 20000,
            'SIPshowregistry' => 15000,
            'CoreShowChannels' => 15000,
            'QueueStatus' => 15000,
            'ExtensionState' => 5000,
            'DeviceState' => 5000,
            'SIPshowpeer' => 5000,
            'Status' => 5000,
            'Ping' => 3000,
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Features Configuration
    |--------------------------------------------------------------------------
    |
    | Enable/disable specific AMI features
    |
    */
    'features' => [
        'extensions' => env('AMI_FEATURE_EXTENSIONS', true),
        'sip' => env('AMI_FEATURE_SIP', true),
        'channels' => env('AMI_FEATURE_CHANNELS', true),
        'queues' => env('AMI_FEATURE_QUEUES', false), // Enable when implemented
        'system' => env('AMI_FEATURE_SYSTEM', true),
    ],

    /*
    |--------------------------------------------------------------------------
    | Extension Configuration
    |--------------------------------------------------------------------------
    |
    | Configuration specific to extension operations
    |
    */
    'extensions' => [
        'context' => 'ext-local', // Default context for extensions
        'filter_pattern' => '/^\d{3,5}$/', // Regex pattern for valid extensions
        'auto_create' => env('AMI_EXTENSIONS_AUTO_CREATE', true), // Auto-create missing extensions
        'mark_offline_timeout' => 300, // Seconds before marking missing extensions offline
        'refresh_interval' => env('AMI_EXTENSIONS_REFRESH_INTERVAL', 300), // Auto-refresh interval in seconds
    ],

    /*
    |--------------------------------------------------------------------------
    | Debug Configuration
    |--------------------------------------------------------------------------
    |
    | Debug and logging settings for AMI operations
    |
    */
    'debug' => [
        'enabled' => env('AMI_DEBUG', false),
        'save_responses' => env('AMI_DEBUG_SAVE_RESPONSES', true),
        'log_level' => env('AMI_LOG_LEVEL', 'info'), // debug, info, warning, error
        'create_json_files' => env('AMI_DEBUG_JSON_FILES', true),
        'json_file_retention' => 7, // Days to keep debug JSON files
        
        // Debug file paths (relative to storage/app)
        'paths' => [
            'extension_refresh' => 'debug/ami/extension-refresh',
            'sip_responses' => 'debug/ami/sip-responses',
            'channel_responses' => 'debug/ami/channel-responses',
            'raw_responses' => 'debug/ami/raw-responses',
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Performance Configuration
    |--------------------------------------------------------------------------
    |
    | Performance-related settings
    |
    */
    'performance' => [
        'connection_pool_size' => 1, // Number of concurrent connections (future feature)
        'response_buffer_size' => 8192, // Socket read buffer size
        'max_response_events' => 1000, // Maximum events to collect per response
        'command_queue_size' => 50, // Maximum queued commands
    ],

    /*
    |--------------------------------------------------------------------------
    | Error Handling
    |--------------------------------------------------------------------------
    |
    | Error handling and retry configuration
    |
    */
    'error_handling' => [
        'max_connection_retries' => 3,
        'retry_delay_ms' => 1000, // Delay between retries
        'fail_fast' => env('AMI_FAIL_FAST', false), // Fail immediately on first error
        'log_errors' => true,
        'throw_exceptions' => env('AMI_THROW_EXCEPTIONS', true),
    ],

    /*
    |--------------------------------------------------------------------------
    | Security Configuration
    |--------------------------------------------------------------------------
    |
    | Security-related settings
    |
    */
    'security' => [
        'mask_passwords_in_logs' => true,
        'allowed_commands' => [
            // Extension commands
            'ExtensionStateList',
            'ExtensionState', 
            'DeviceStateList',
            'DeviceState',
            
            // SIP commands
            'SIPpeers',
            'SIPshowpeer',
            'SIPshowregistry',
            'SIPqualifypeer',
            
            // Channel commands
            'CoreShowChannels',
            'Status',
            'Hangup',
            
            // Queue commands (when enabled)
            'QueueStatus',
            'QueueSummary',
            'QueueAdd',
            'QueueRemove',
            
            // System commands
            'Ping',
            'CoreStatus',
            'Command',
        ],
        'blocked_commands' => [
            // Dangerous commands to never allow
            'Reload',
            'Restart',
            'ModuleLoad',
            'ModuleUnload',
        ],
    ],
];