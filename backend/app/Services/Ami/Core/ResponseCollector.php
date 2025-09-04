<?php

namespace App\Services\Ami\Core;

use App\Services\Ami\Support\AmiResponse;
use Illuminate\Support\Facades\Log;

class ResponseCollector
{
    private array $pendingResponses = [];
    private array $completedResponses = [];

    public function startCollection(string $actionId): AmiResponse
    {
        $response = new AmiResponse();
        $response->addMetadata('action_id', $actionId);
        
        $this->pendingResponses[$actionId] = $response;
        
        Log::debug('📋 [AMI] Started response collection', ['action_id' => $actionId]);
        
        return $response;
    }

    public function addEvent(string $actionId, array $event): bool
    {
        if (!isset($this->pendingResponses[$actionId])) {
            Log::warning('⚠️ [AMI] Event for unknown ActionID', [
                'action_id' => $actionId,
                'event' => $event['Event'] ?? 'Unknown'
            ]);
            return false;
        }

        $this->pendingResponses[$actionId]->addEvent($event);
        
        Log::debug('📨 [AMI] Added event to collection', [
            'action_id' => $actionId,
            'event_type' => $event['Event'] ?? 'Response',
            'event_count' => $this->pendingResponses[$actionId]->getEventCount()
        ]);

        return true;
    }

    public function addResponse(string $actionId, array $response): bool
    {
        if (!isset($this->pendingResponses[$actionId])) {
            Log::warning('⚠️ [AMI] Response for unknown ActionID', [
                'action_id' => $actionId
            ]);
            return false;
        }

        $this->pendingResponses[$actionId]->setFinalResponse($response);
        
        Log::debug('📥 [AMI] Added final response to collection', [
            'action_id' => $actionId,
            'response_type' => $response['Response'] ?? 'Unknown'
        ]);

        return true;
    }

    public function completeCollection(string $actionId, bool $successful = true, ?string $completionEvent = null): ?AmiResponse
    {
        if (!isset($this->pendingResponses[$actionId])) {
            Log::warning('⚠️ [AMI] Completion for unknown ActionID', ['action_id' => $actionId]);
            return null;
        }

        $response = $this->pendingResponses[$actionId];
        $response->markComplete($successful);
        
        if ($completionEvent) {
            $response->addMetadata('completion_event', $completionEvent);
        }

        // Move to completed
        $this->completedResponses[$actionId] = $response;
        unset($this->pendingResponses[$actionId]);

        Log::info('✅ [AMI] Response collection completed', [
            'action_id' => $actionId,
            'successful' => $successful,
            'event_count' => $response->getEventCount(),
            'duration_ms' => $response->getDuration(),
            'completion_event' => $completionEvent
        ]);

        return $response;
    }

    public function failCollection(string $actionId, string $error): ?AmiResponse
    {
        if (!isset($this->pendingResponses[$actionId])) {
            return null;
        }

        $response = $this->pendingResponses[$actionId];
        $response->addError($error);
        $response->markComplete(false);

        // Move to completed
        $this->completedResponses[$actionId] = $response;
        unset($this->pendingResponses[$actionId]);

        Log::error('❌ [AMI] Response collection failed', [
            'action_id' => $actionId,
            'error' => $error,
            'event_count' => $response->getEventCount()
        ]);

        return $response;
    }

    public function getResponse(string $actionId): ?AmiResponse
    {
        return $this->completedResponses[$actionId] ?? 
               $this->pendingResponses[$actionId] ?? 
               null;
    }

    public function isPending(string $actionId): bool
    {
        return isset($this->pendingResponses[$actionId]);
    }

    public function isCompleted(string $actionId): bool
    {
        return isset($this->completedResponses[$actionId]);
    }

    public function getPendingCount(): int
    {
        return count($this->pendingResponses);
    }

    public function getCompletedCount(): int
    {
        return count($this->completedResponses);
    }

    public function getPendingActionIds(): array
    {
        return array_keys($this->pendingResponses);
    }

    public function cleanup(): void
    {
        $pendingCount = count($this->pendingResponses);
        $completedCount = count($this->completedResponses);

        $this->pendingResponses = [];
        $this->completedResponses = [];

        Log::info('🧹 [AMI] Response collector cleanup', [
            'pending_cleared' => $pendingCount,
            'completed_cleared' => $completedCount
        ]);
    }

    public function getStatistics(): array
    {
        $stats = [
            'pending_responses' => count($this->pendingResponses),
            'completed_responses' => count($this->completedResponses),
            'total_responses' => count($this->pendingResponses) + count($this->completedResponses)
        ];

        // Calculate average duration for completed responses
        $durations = array_map(function($response) {
            return $response->getDuration();
        }, $this->completedResponses);

        if (!empty($durations)) {
            $stats['average_duration_ms'] = round(array_sum($durations) / count($durations), 2);
            $stats['max_duration_ms'] = max($durations);
            $stats['min_duration_ms'] = min($durations);
        }

        return $stats;
    }
}