<?php

namespace App\Events;

use App\Models\Extension;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ExtensionStatusUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $extension;

    /**
     * Create a new event instance.
     */
    public function __construct(Extension $extension)
    {
        $this->extension = $extension;
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new Channel('extensions'),
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'extension.status.updated';
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        return [
            'id' => $this->extension->id,
            'extension' => $this->extension->extension,
            'agent_name' => $this->extension->agent_name,
            'availability_status' => $this->extension->availability_status,
            'status_code' => $this->extension->status_code,
            'status_text' => $this->extension->status_text,
            'status_changed_at' => $this->extension->status_changed_at,
            'updated_at' => $this->extension->updated_at,
        ];
    }
}
