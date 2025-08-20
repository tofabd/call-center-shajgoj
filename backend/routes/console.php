<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;
use Illuminate\Support\Facades\Log;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Schedule the automatic stuck calls cleanup job to run every 5 minutes
Schedule::job(new \App\Jobs\CleanupStuckCallsJob(5))
    ->everyFiveMinutes()
    ->withoutOverlapping()
    ->onSuccess(function () {
        Log::info('Queue-based cleanup: CleanupStuckCallsJob dispatched successfully');
    })
    ->onFailure(function () {
        Log::error('Queue-based cleanup: CleanupStuckCallsJob dispatch failed');
    });
