<?php

namespace App\Jobs;

use App\Events\CallUpdated;
use App\Models\Call;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * High Priority Call Update Job
 * 
 * For time-sensitive call events that need immediate processing
 * Usage: ProcessCallUpdate::dispatch($call)->onQueue('priority')
 */
class ProcessCallUpdate implements ShouldQueue
{
    use Queueable;

    public $tries = 3;
    public $timeout = 30;
    public $maxExceptions = 1;

    public function __construct(
        public Call $call,
        public string $eventType = 'status_change'
    ) {
        // Set queue based on urgency
        $this->onQueue($this->determineQueue());
    }

    public function handle(): void
    {
        // Broadcast the call update
        broadcast(new CallUpdated($this->call))->toOthers();
        
        // Additional processing based on event type
        match($this->eventType) {
            'answered' => $this->handleCallAnswered(),
            'ended' => $this->handleCallEnded(),
            'transferred' => $this->handleCallTransferred(),
            default => null,
        };
    }

    private function determineQueue(): string
    {
        // Priority queue for urgent events
        if (in_array($this->eventType, ['answered', 'ended', 'emergency'])) {
            return 'priority';
        }
        
        // Background for reporting/analytics
        if (in_array($this->eventType, ['statistics', 'reporting'])) {
            return 'background';
        }
        
        // Default queue for regular updates
        return 'call_center_queue';
    }

    private function handleCallAnswered(): void
    {
        // Update call statistics
        // Trigger agent performance metrics
        // Start call recording if enabled
    }

    private function handleCallEnded(): void
    {
        // Calculate call duration
        // Update agent availability
        // Process call disposition
    }

    private function handleCallTransferred(): void
    {
        // Update both old and new agent status
        // Log transfer details
        // Update call routing metrics
    }

    public function failed(\Throwable $exception): void
    {
        // Log failed call update
        logger()->error('Call update failed', [
            'call_id' => $this->call->id,
            'event_type' => $this->eventType,
            'error' => $exception->getMessage()
        ]);
    }
}