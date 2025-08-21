<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Extension extends Model
{
    use HasFactory;

    protected $fillable = [
        'extension',
        'agent_name',
        'status',
        'last_seen',
    ];

    protected $casts = [
        'last_seen' => 'datetime',
    ];

    /**
     * Get the calls associated with this extension
     */
    public function calls(): HasMany
    {
        return $this->hasMany(Call::class, 'agent_exten', 'extension');
    }

    /**
     * Get the bridge segments associated with this extension
     */
    public function bridgeSegments(): HasMany
    {
        return $this->hasMany(BridgeSegment::class, 'agent_exten', 'extension');
    }

    /**
     * Update the extension status
     */
    public function updateStatus(string $status, ?string $lastSeen = null): bool
    {
        $this->status = $status;
        if ($lastSeen) {
            $this->last_seen = $lastSeen;
        } else {
            $this->last_seen = now();
        }

        return $this->save();
    }

    /**
     * Get online extensions count
     */
    public static function getOnlineCount(): int
    {
        return static::where('status', 'online')->count();
    }

    /**
     * Get total extensions count
     */
    public static function getTotalCount(): int
    {
        return static::count();
    }
}
