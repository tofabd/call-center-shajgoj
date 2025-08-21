<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;

use App\Http\Controllers\CallController;

// Public routes (no authentication required)
Route::post('/login', [AuthController::class, 'login']);

// Protected routes (authentication required)
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/profile', [AuthController::class, 'profile']);
    Route::post('/refresh', [AuthController::class, 'refresh']);

    // Clean calls routes
    Route::get('/calls', [CallController::class, 'index']);
    Route::get('/calls/today-stats', [CallController::class, 'getTodayStats']);
    Route::get('/calls/{id}/details', [CallController::class, 'getCallDetails']);
    Route::get('/calls/{id}/debug-status', [CallController::class, 'debugCallStatus']);

    // Test route to verify authentication
    Route::get('/user', function (Request $request) {
        return $request->user();
    });
});
