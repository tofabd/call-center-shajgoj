<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\Ami\AmiServiceProvider;
use Illuminate\Support\Facades\Log;

class RefreshExtensionsFromAsterisk extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'extensions:refresh-from-asterisk 
                            {--test : Test connection without refreshing}
                            {--status : Show connection status}
                            {--debug : Enable debug output}';

    /**
     * The console command description.
     */
    protected $description = 'Refresh extension statuses from Asterisk AMI using the new AMI service';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $startTime = microtime(true);

        // Handle test option
        if ($this->option('test')) {
            return $this->handleTest();
        }

        // Handle status option
        if ($this->option('status')) {
            return $this->handleStatus();
        }

        $this->info('🔄 Starting extension refresh from Asterisk AMI...');
        
        try {
            $amiService = new AmiServiceProvider();
            
            $result = $amiService->executeWithConnection(function($ami) {
                $this->line('📡 Connected to AMI, executing extension refresh...');
                return $ami->extensions()->refreshAll();
            });

            $processingTime = round((microtime(true) - $startTime) * 1000, 2);

            if ($result['success']) {
                $this->displaySuccessResults($result, $processingTime);
                return 0;
            } else {
                $this->displayErrorResults($result, $processingTime);
                return 1;
            }

        } catch (\Exception $e) {
            $processingTime = round((microtime(true) - $startTime) * 1000, 2);
            
            $this->error('❌ Extension refresh failed: ' . $e->getMessage());
            $this->line("⏱️ Failed after: {$processingTime}ms");
            
            if ($this->option('debug')) {
                $this->line('🐛 Debug info:');
                $this->line('  Exception: ' . get_class($e));
                $this->line('  File: ' . $e->getFile() . ':' . $e->getLine());
                $this->line('  Trace: ' . $e->getTraceAsString());
            }

            return 1;
        }
    }

    private function handleTest(): int
    {
        $this->info('🧪 Testing AMI connection...');
        
        try {
            $amiService = new AmiServiceProvider();
            
            if ($amiService->testConnection()) {
                $this->info('✅ AMI connection test successful');
                
                $status = $amiService->getConnectionStatus();
                $this->displayConnectionInfo($status);
                
                return 0;
            } else {
                $this->error('❌ AMI connection test failed');
                return 1;
            }

        } catch (\Exception $e) {
            $this->error('❌ AMI connection test error: ' . $e->getMessage());
            return 1;
        }
    }

    private function handleStatus(): int
    {
        $this->info('📊 AMI Connection Status');
        $this->line('=======================');
        
        try {
            $amiService = new AmiServiceProvider();
            $status = $amiService->getConnectionStatus();
            
            $this->displayConnectionInfo($status);
            
            return 0;

        } catch (\Exception $e) {
            $this->error('❌ Failed to get connection status: ' . $e->getMessage());
            return 1;
        }
    }

    private function displayConnectionInfo(array $status): void
    {
        $connected = $status['connected'] ? '✅ Connected' : '❌ Not Connected';
        $this->line("Connection Status: {$connected}");
        $this->line("Host: {$status['config']['host']}");
        $this->line("Port: {$status['config']['port']}");
        $this->line("Timeout: {$status['config']['timeout']}ms");
        
        if (isset($status['statistics'])) {
            $stats = $status['statistics'];
            $this->line('');
            $this->line('Statistics:');
            if (isset($stats['connection'])) {
                $connStats = $stats['connection'];
                $this->line("  Connected: " . ($connStats['connected'] ? 'Yes' : 'No'));
                $this->line("  Authenticated: " . ($connStats['authenticated'] ? 'Yes' : 'No'));
            }
        }
    }

    private function displaySuccessResults(array $result, float $processingTime): void
    {
        $this->info('✅ Extension refresh completed successfully!');
        $this->line('');
        
        $this->line('📊 Summary:');
        $this->line("  ⏱️  Duration: {$result['duration_ms']}ms (Total: {$processingTime}ms)");
        $this->line("  📞 Extensions Checked: {$result['extensionsChecked']}");
        $this->line("  🕒 Last Query: {$result['lastQueryTime']}");
        $this->line('');
        
        if (isset($result['statistics'])) {
            $stats = $result['statistics'];
            $this->line('📈 Statistics:');
            $this->line("  ✅ Successful Queries: {$stats['successfulQueries']}");
            $this->line("  ❌ Failed Queries: {$stats['failedQueries']}");
            $this->line("  🔄 Status Changes: {$stats['statusChanges']}");
            $this->line("  📝 No Changes: {$stats['noChanges']}");
        }
        
        if (isset($result['details'])) {
            $details = $result['details'];
            $this->line('');
            $this->line('🔍 Details:');
            $this->line("  📡 AMI Extensions Found: {$details['ami_extensions_found']}");
            $this->line("  ✨ Created: {$details['created']}");
            $this->line("  ✅ Updated: {$details['updated']}");
            $this->line("  📝 Unchanged: {$details['unchanged']}");
            $this->line("  🔴 Marked Offline: {$details['marked_offline']}");
            $this->line("  ❌ Errors: {$details['errors']}");
        }
    }

    private function displayErrorResults(array $result, float $processingTime): void
    {
        $this->error('❌ Extension refresh failed!');
        $this->line('');
        
        if (isset($result['error'])) {
            $this->line('Error: ' . $result['error']);
        }
        
        $this->line("Duration: {$processingTime}ms");
        
        if ($this->option('debug') && isset($result['debug_info'])) {
            $this->line('');
            $this->line('🐛 Debug Information:');
            foreach ($result['debug_info'] as $key => $value) {
                $this->line("  {$key}: {$value}");
            }
        }
    }
}