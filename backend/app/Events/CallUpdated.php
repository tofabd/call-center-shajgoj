<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use App\Models\Call;

class CallUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public Call $call;

    public function __construct(Call $call)
    {
        $this->call = $call;
    }

    public function broadcastOn(): array
    {
        return [
            new Channel('call-console'),
        ];
    }

    public function broadcastWith(): array
    {
        return [
            'id' => $this->call->id,
            'callerNumber' => $this->call->other_party ?? 'Unknown',
            'callerName' => null,
            'startTime' => $this->call->started_at,
            'endTime' => $this->call->ended_at,
            'status' => $this->deriveStatus($this->call),
            'duration' => ($this->call->started_at && $this->call->ended_at)
                ? max(0, $this->call->started_at->diffInSeconds($this->call->ended_at, true))
                : null,
            'direction' => $this->call->direction,
            'agentExten' => $this->call->agent_exten,
            'otherParty' => $this->call->other_party,
            'timestamp' => now()->toISOString(),
        ];
    }

    public function broadcastAs(): string
    {
        return 'call-updated';
    }

    private function deriveStatus(Call $call): string
    {
        $disposition = strtolower((string)($call->disposition ?? ''));
        if (!empty($disposition)) {
            return $disposition;
        }
        if ($call->ended_at) {
            return 'completed';
        }
        if ($call->answered_at) {
            return 'answered';
        }
        if ($call->started_at) {
            return 'ringing';
        }
        return 'unknown';
    }
}


