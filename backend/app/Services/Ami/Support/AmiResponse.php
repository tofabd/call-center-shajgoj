<?php

namespace App\Services\Ami\Support;

class AmiResponse
{
    protected array $events = [];
    protected array $finalResponse = [];
    protected bool $isComplete = false;
    protected bool $isSuccessful = false;
    protected array $errors = [];
    protected array $metadata = [];
    protected float $startTime;
    protected ?float $endTime = null;

    public function __construct()
    {
        $this->startTime = microtime(true);
        $this->metadata = [
            'start_time' => $this->startTime,
            'timestamp' => now()->toISOString(),
        ];
    }

    public function addEvent(array $event): static
    {
        $this->events[] = $event;
        return $this;
    }

    public function setFinalResponse(array $response): static
    {
        $this->finalResponse = $response;
        return $this;
    }

    public function markComplete(bool $successful = true): static
    {
        $this->isComplete = true;
        $this->isSuccessful = $successful;
        $this->endTime = microtime(true);
        
        $this->metadata['end_time'] = $this->endTime;
        $this->metadata['duration_ms'] = round(($this->endTime - $this->startTime) * 1000, 2);
        $this->metadata['completed_at'] = now()->toISOString();
        
        return $this;
    }

    public function addError(string $error): static
    {
        $this->errors[] = $error;
        return $this;
    }

    public function addMetadata(string $key, $value): static
    {
        $this->metadata[$key] = $value;
        return $this;
    }

    public function getEvents(): array
    {
        return $this->events;
    }

    public function getFinalResponse(): array
    {
        return $this->finalResponse;
    }

    public function isComplete(): bool
    {
        return $this->isComplete;
    }

    public function isSuccessful(): bool
    {
        return $this->isSuccessful;
    }

    public function getErrors(): array
    {
        return $this->errors;
    }

    public function hasErrors(): bool
    {
        return !empty($this->errors);
    }

    public function getMetadata(): array
    {
        return $this->metadata;
    }

    public function getDuration(): float
    {
        return $this->metadata['duration_ms'] ?? 0;
    }

    public function getEventCount(): int
    {
        return count($this->events);
    }

    public function getFirstEvent(): ?array
    {
        return $this->events[0] ?? null;
    }

    public function getLastEvent(): ?array
    {
        return end($this->events) ?: null;
    }

    public function getEventsByType(string $eventType): array
    {
        return array_filter($this->events, function($event) use ($eventType) {
            return isset($event['Event']) && $event['Event'] === $eventType;
        });
    }

    public function toArray(): array
    {
        return [
            'events' => $this->events,
            'final_response' => $this->finalResponse,
            'is_complete' => $this->isComplete,
            'is_successful' => $this->isSuccessful,
            'errors' => $this->errors,
            'metadata' => $this->metadata,
        ];
    }
}