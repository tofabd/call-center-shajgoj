<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use App\Models\Call;
use App\Helpers\CallStatusHelper;

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
        $channels = [];

        // Always broadcast to the original channel for backward compatibility
        $channels[] = new Channel('call-console');

        // Always broadcast to live calls channel so frontend can handle call removal
        $channels[] = new Channel('live-calls');

        // Broadcast to specific channels based on call state
        if ($this->call->ended_at) {
            // Completed call - also broadcast to call history channel
            $channels[] = new Channel('call-history');
        }

        return $channels;
    }

    public function broadcastWith(): array
    {
        return [
            'id' => $this->call->id,
            'callerNumber' => $this->call->other_party ?? 'Unknown',
            'callerName' => null,
            'startTime' => $this->call->started_at,
            'endTime' => $this->call->ended_at,
            'answeredAt' => $this->call->answered_at,
            'status' => $this->deriveStatus($this->call),
            'duration' => ($this->call->started_at && $this->call->ended_at)
                ? max(0, $this->call->started_at->diffInSeconds($this->call->ended_at, true))
                : null,
            'ringSeconds' => $this->call->ring_seconds,
            'talkSeconds' => $this->call->talk_seconds,
            'direction' => $this->call->direction,
            'agentExten' => $this->call->agent_exten,
            'dialStatus' => $this->call->dial_status,
            'hangupCause' => $this->call->hangup_cause,
            'disposition' => $this->call->disposition,
            'timestamp' => now()->toISOString(),
        ];
    }

    public function broadcastAs(): string
    {
        return 'call-updated';
    }

    private function deriveStatus(Call $call): string
    {
        return CallStatusHelper::deriveStatus($call);
    }
}


