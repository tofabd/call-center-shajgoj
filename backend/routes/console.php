<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;
use Illuminate\Support\Facades\Log;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Schedule the stuck calls cleanup command to run every 5 minutes
Schedule::command('app:cleanup-stuck-calls')
    ->everyFiveMinutes()
    ->withoutOverlapping()
    ->runInBackground()
    ->onSuccess(function () {
        Log::info('Stuck calls cleanup completed successfully');
    })
    ->onFailure(function () {
        Log::error('Stuck calls cleanup failed');
    });
