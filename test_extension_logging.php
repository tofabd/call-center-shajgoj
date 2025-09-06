<?php

require_once __DIR__ . '/backend/vendor/autoload.php';

// Bootstrap Laravel
$app = require_once __DIR__ . '/backend/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

// Test database operations logging
use App\Services\Ami\Features\Extensions\ExtensionService;
use App\Services\Ami\Core\AmiManager;
use Illuminate\Support\Facades\Log;

echo "🧪 Testing Enhanced Database Operation Logging...\n";

try {
    // Clear existing logs for clean test
    $logPath = __DIR__ . '/backend/storage/logs/laravel.log';
    if (file_exists($logPath)) {
        file_put_contents($logPath, ''); // Clear log file
        echo "✅ Cleared existing logs\n";
    }
    
    // Initialize the extension service
    $amiManager = new AmiManager();
    $extensionService = new ExtensionService($amiManager);
    
    echo "⏳ Running extension refresh with enhanced logging...\n";
    
    // Call the refresh method (this will trigger all our enhanced logging)
    $result = $extensionService->refreshAll();
    
    echo "✅ Extension refresh completed\n";
    echo "📄 Result: " . json_encode($result, JSON_PRETTY_PRINT) . "\n";
    
    // Read and display the new logs
    if (file_exists($logPath)) {
        $logs = file_get_contents($logPath);
        $logLines = explode("\n", $logs);
        
        echo "\n📋 Database Operation Logs Generated:\n";
        echo str_repeat("=", 80) . "\n";
        
        $dbOperationLogs = array_filter($logLines, function($line) {
            return strpos($line, '[DB Operation]') !== false;
        });
        
        if (count($dbOperationLogs) > 0) {
            foreach ($dbOperationLogs as $log) {
                echo $log . "\n";
            }
            echo "\n✅ Found " . count($dbOperationLogs) . " database operation log entries\n";
        } else {
            echo "❌ No database operation logs found\n";
        }
        
        echo str_repeat("=", 80) . "\n";
    }
    
    echo "\n🎯 Test completed! Check backend/storage/logs/laravel.log for detailed database operation logs.\n";
    
} catch (Exception $e) {
    echo "❌ Test failed: " . $e->getMessage() . "\n";
    echo "📍 Error in: " . $e->getFile() . ":" . $e->getLine() . "\n";
}