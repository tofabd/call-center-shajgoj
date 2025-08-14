<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CallLogController;
use App\Http\Controllers\FollowUpController;
use App\Http\Controllers\FollowUpTemplateController;

use App\Http\Controllers\WooComController;
use App\Http\Controllers\WooComUserController;


// Public routes (no authentication required)
Route::post('/login', [AuthController::class, 'login']);

// (removed) Facebook webhook routes

// Protected routes (authentication required)
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/profile', [AuthController::class, 'profile']);
    Route::post('/refresh', [AuthController::class, 'refresh']);

    // Call logs routes
    Route::get('/call-logs', [CallLogController::class, 'index']);
    Route::get('/call-logs/today-stats', [CallLogController::class, 'getTodayStats']);
    Route::get('/call-logs/{id}/details', [CallLogController::class, 'getCallDetails']);

    // Follow-up routes
    Route::prefix('follow-ups')->group(function () {
        // CRUD operations
        Route::get('/', [FollowUpController::class, 'index']);
        Route::post('/', [FollowUpController::class, 'store']);
        Route::get('/{id}', [FollowUpController::class, 'show']);
        Route::put('/{id}', [FollowUpController::class, 'update']);
        Route::delete('/{id}', [FollowUpController::class, 'destroy']);

        // Dashboard and analytics
        Route::get('/dashboard/stats', [FollowUpController::class, 'getDashboardStats']);
        Route::get('/calendar/data', [FollowUpController::class, 'getCalendarData']);
        Route::get('/overdue', [FollowUpController::class, 'getOverdue']);

        // Bulk operations
        Route::post('/bulk-update', [FollowUpController::class, 'bulkUpdate']);

        // Notes
        Route::post('/{id}/notes', [FollowUpController::class, 'addNote']);

        // Actions
        Route::post('/{id}/complete', [FollowUpController::class, 'markCompleted']);
        Route::post('/{id}/reschedule', [FollowUpController::class, 'reschedule']);

        // Customer specific
        Route::get('/customer/history', [FollowUpController::class, 'getCustomerFollowUps']);
    });

    // Follow-up templates
    Route::prefix('follow-up-templates')->group(function () {
        Route::get('/', [FollowUpTemplateController::class, 'index']);
        Route::post('/', [FollowUpTemplateController::class, 'store']);
        Route::get('/active', [FollowUpTemplateController::class, 'getActive']);
        Route::get('/type/{type}', [FollowUpTemplateController::class, 'getByType']);
        Route::get('/{id}', [FollowUpTemplateController::class, 'show']);
        Route::put('/{id}', [FollowUpTemplateController::class, 'update']);
        Route::delete('/{id}', [FollowUpTemplateController::class, 'destroy']);
        Route::post('/{id}/toggle-active', [FollowUpTemplateController::class, 'toggleActive']);
        Route::post('/{id}/duplicate', [FollowUpTemplateController::class, 'duplicate']);
    });

    // WooCommerce routes
    Route::prefix('woocom')->group(function () {
        // Order management
        Route::post('/update-order', [WooComController::class, 'updateOrder']);
        Route::post('/create-order', [WooComController::class, 'createOrder']);
        Route::get('/orders/{phoneNumber}', [WooComController::class, 'getOrdersByPhoneNumber']);
        Route::get('/orders-paginated', [WooComController::class, 'getPaginatedOrders']);
        Route::get('/orders/{orderId}/notes', [WooComController::class, 'getOrderNotes']);
        Route::post('/orders/{orderId}/notes', [WooComController::class, 'addOrderNote']);
        Route::get('/search-products', [WooComController::class, 'searchProducts']);

        // Customer management
        Route::post('/create-customer', [WooComController::class, 'createCustomer']);
        Route::post('/update-customer', [WooComController::class, 'updateCustomer']);
        Route::get('/customers/{phoneNumber}', [WooComController::class, 'getCustomersByPhone']);

        // Payment and shipping methods
        Route::get('/payment-methods', [WooComController::class, 'getPaymentMethods']);
        Route::get('/shipping-methods', [WooComController::class, 'getShippingMethods']);
        Route::get('/shipping-zones-methods', [WooComController::class, 'getShippingZonesWithMethods']);

        // User management
        Route::get('/customers-paginated', [WooComUserController::class, 'getPaginatedUsers']);
        Route::put('/customers/{id}', [WooComUserController::class, 'updateUser']);
        Route::delete('/customers/{id}', [WooComUserController::class, 'deleteUser']);

    });

    // Test route to verify authentication
    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    // (removed) Facebook routes and webhooks
});
