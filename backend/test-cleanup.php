<?php

/**
 * Test script for the stuck calls cleanup command
 * Run this to test: php test-cleanup.php
 */

require_once 'vendor/autoload.php';

// Bootstrap Laravel
$app = require_once 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

echo "🧪 Testing Stuck Calls Cleanup Command...\n\n";

// Test 1: Dry run to see what would be cleaned up
echo "📋 Test 1: Dry Run (no changes made)\n";
echo "Running: php artisan app:cleanup-stuck-calls --dry-run\n\n";

$output = shell_exec('php artisan app:cleanup-stuck-calls --dry-run 2>&1');
echo $output;

echo "\n" . str_repeat("=", 50) . "\n\n";

// Test 2: Check current call statuses
echo "📊 Test 2: Current Call Statuses\n";
echo "Checking database for calls...\n\n";

use App\Models\Call;

try {
    $totalCalls = Call::count();
    $activeCalls = Call::whereNotNull('answered_at')->whereNull('ended_at')->count();
        $stuckCalls = Call::whereNotNull('answered_at')
        ->whereNull('ended_at')
        ->where('answered_at', '<', now()->subMinutes(5))
        ->count();

    echo "📈 Total calls in database: {$totalCalls}\n";
    echo "📞 Active calls (answered but not ended): {$activeCalls}\n";
    echo "⚠️  Potentially stuck calls (>5 min): {$stuckCalls}\n";

    if ($stuckCalls > 0) {
        echo "\n🔍 Stuck calls details:\n";
                $stuckCallDetails = Call::whereNotNull('answered_at')
            ->whereNull('ended_at')
            ->where('answered_at', '<', now()->subMinutes(5))
            ->get(['id', 'agent_exten', 'answered_at', 'started_at']);

        foreach ($stuckCallDetails as $call) {
            $stuckDuration = now()->diffInMinutes($call->answered_at);
            echo "   • Call ID: {$call->id}, Ext: {$call->agent_exten}, Stuck: {$stuckDuration} min\n";
        }
    }

} catch (Exception $e) {
    echo "❌ Error checking database: " . $e->getMessage() . "\n";
}

echo "\n" . str_repeat("=", 50) . "\n\n";

echo "🎯 To actually clean up stuck calls, run:\n";
echo "   php artisan app:cleanup-stuck-calls\n\n";

echo "🔄 To run the scheduler manually:\n";
echo "   php artisan schedule:run\n\n";

echo "📝 To see scheduled tasks:\n";
echo "   php artisan schedule:list\n\n";

echo "✅ Test completed!\n";
