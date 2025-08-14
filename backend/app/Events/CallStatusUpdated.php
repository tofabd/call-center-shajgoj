<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use App\Models\CallLog;

class CallStatusUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $callLog;

    public function __construct(CallLog $callLog)
    {
        $this->callLog = $callLog;
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
            'id' => $this->callLog->id,
            'callerNumber' => $this->callLog->callerid_num ?? 'Unknown',
            'callerName' => $this->callLog->callerid_name,
            'startTime' => $this->callLog->start_time,
            'endTime' => $this->callLog->end_time,
            'status' => $this->callLog->status,
            'duration' => $this->callLog->duration,
            'exten' => $this->callLog->exten,
            'timestamp' => now()->toISOString(),
        ];
    }

    public function broadcastAs(): string
    {
        return 'call-status-updated';
    }
}
