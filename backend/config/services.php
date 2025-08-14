<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'resend' => [
        'key' => env('RESEND_KEY'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],
    'woocommerce' => [
        'base_url' => env('WOOCOMMERCE_BASE_URL', 'https://stage.luxotix.com'),
        'consumer_key' => env('WOOCOMMERCE_CONSUMER_KEY', 'ck_2e7c40d7c23becc02a3e8358d8fec1292dcd7326'),
        'consumer_secret' => env('WOOCOMMERCE_CONSUMER_SECRET', 'cs_5d318850f3ab4deb524d2a6858522fb575d944b3'),
    ],

   // 'facebook' removed


];
