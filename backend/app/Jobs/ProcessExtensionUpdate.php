<?php

namespace App\Jobs;

use App\Events\ExtensionStatusUpdated;
use App\Models\Extension;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Extension Status Update Job
 * 
 * Handles real-time extension status changes
 * Usage: ProcessExtensionUpdate::dispatch($extension)
 */
class ProcessExtensionUpdate implements ShouldQueue
{
    use Queueable;

    public $tries = 3;
    public $timeout = 15; // Short timeout for extension updates
    public $queue = 'priority'; // Always high priority for extensions

    public function __construct(
        public Extension $extension,
        public int $previousStatus = null
    ) {
        //
    }

    public function handle(): void
    {
        // Broadcast extension status update
        broadcast(new ExtensionStatusUpdated($this->extension))->toOthers();
        
        // Handle status-specific logic
        $this->handleStatusChange();
        
        // Update extension metrics
        $this->updateMetrics();
    }

    private function handleStatusChange(): void
    {
        match($this->extension->status) {
            1 => $this->handleAvailable(),      // Available
            2 => $this->handleInUse(),          // InUse  
            4 => $this->handleUnavailable(),    // Unavailable
            8 => $this->handleRinging(),        // Ringing
            16 => $this->handleOnHold(),        // OnHold
            default => null,
        };
    }

    private function handleAvailable(): void
    {
        // Extension became available - update call routing
        // Potentially assign waiting calls
        // Update agent dashboard
    }

    private function handleInUse(): void
    {
        // Extension is busy - update call routing tables
        // Start call timer for performance tracking
    }

    private function handleUnavailable(): void
    {
        // Extension went unavailable - redistribute calls
        // Update supervisor dashboard
    }

    private function handleRinging(): void
    {
        // Call is ringing - start ring timeout tracking
        // Update real-time call displays
    }

    private function handleOnHold(): void
    {
        // Call on hold - start hold timer
        // Update call quality metrics
    }

    private function updateMetrics(): void
    {
        // Update extension utilization statistics
        // Track status change frequency
        // Generate availability reports
    }

    public function failed(\Throwable $exception): void
    {
        logger()->error('Extension update failed', [
            'extension' => $this->extension->extension,
            'status' => $this->extension->status,
            'error' => $exception->getMessage()
        ]);
    }
}