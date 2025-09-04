<?php

namespace App\Services\Ami\Support;

abstract class AmiCommand
{
    protected string $action;
    protected array $parameters = [];
    protected ?string $actionId = null;
    protected int $timeout = 15000;
    protected bool $expectsMultipleEvents = false;
    protected ?string $completionEventName = null;

    public function __construct(array $parameters = [])
    {
        $this->parameters = $parameters;
        $this->actionId = $this->generateActionId();
    }

    abstract public function getAction(): string;

    public function getParameters(): array
    {
        return array_merge($this->parameters, [
            'ActionID' => $this->actionId
        ]);
    }

    public function getActionId(): string
    {
        return $this->actionId;
    }

    public function getTimeout(): int
    {
        return $this->timeout;
    }

    public function expectsMultipleEvents(): bool
    {
        return $this->expectsMultipleEvents;
    }

    public function getCompletionEventName(): ?string
    {
        return $this->completionEventName;
    }

    public function toString(): string
    {
        $command = "Action: {$this->getAction()}\r\n";
        
        foreach ($this->getParameters() as $key => $value) {
            if ($value !== null && $value !== '') {
                $command .= "{$key}: {$value}\r\n";
            }
        }
        
        $command .= "\r\n"; // Empty line to end the command
        
        return $command;
    }

    protected function generateActionId(): string
    {
        return static::class . '-' . time() . '-' . substr(md5(uniqid()), 0, 8);
    }

    protected function setTimeout(int $timeout): static
    {
        $this->timeout = $timeout;
        return $this;
    }

    protected function setExpectsMultipleEvents(bool $expects, ?string $completionEvent = null): static
    {
        $this->expectsMultipleEvents = $expects;
        $this->completionEventName = $completionEvent;
        return $this;
    }
}