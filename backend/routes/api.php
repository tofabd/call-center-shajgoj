<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CallController;
use App\Http\Controllers\ExtensionController;
use App\Http\Controllers\TeamController;

// Public routes (no authentication required)
Route::post('/login', [AuthController::class, 'login']);

// Protected routes (authentication required)
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/profile', [AuthController::class, 'profile']);
    Route::post('/refresh', [AuthController::class, 'refresh']);

    // Clean calls routes
    Route::get('/calls', [CallController::class, 'index']);
    Route::get('/calls/live', [CallController::class, 'getLiveCalls']);
    Route::get('/calls/today-stats', [CallController::class, 'getTodayStats']);
    Route::get('/calls/{id}/details', [CallController::class, 'getCallDetails']);
    Route::get('/calls/{id}/debug-status', [CallController::class, 'debugCallStatus']);

    // Test route to verify authentication
    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    // Extension routes
    Route::get('/extensions', [ExtensionController::class, 'index']);
    Route::get('/extensions/statistics', [ExtensionController::class, 'statistics']);
    Route::post('/extensions/refresh', [ExtensionController::class, 'refresh']);
    Route::post('/extensions', [ExtensionController::class, 'store']);
    Route::get('/extensions/{extension}', [ExtensionController::class, 'show']);
    Route::put('/extensions/{extension}', [ExtensionController::class, 'update']);
    Route::delete('/extensions/{extension}', [ExtensionController::class, 'destroy']);
    Route::post('/extensions/sync', [ExtensionController::class, 'sync']);
    Route::put('/extensions/status', [ExtensionController::class, 'updateStatus']);

    // Team routes
    Route::get('/teams', [TeamController::class, 'index']);
    Route::get('/teams/statistics', [TeamController::class, 'statistics']);
    Route::post('/teams', [TeamController::class, 'store']);
    Route::get('/teams/{team}', [TeamController::class, 'show']);
    Route::put('/teams/{team}', [TeamController::class, 'update']);
    Route::delete('/teams/{team}', [TeamController::class, 'destroy']);
    Route::post('/teams/{team}/toggle-active', [TeamController::class, 'toggleActive']);
});
