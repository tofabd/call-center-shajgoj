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
        'team',
        'status',
        'status_code',
        'device_state',
        'status_text',
        'last_status_change',
        'last_seen',
        'is_active',
    ];

    protected $casts = [
        'last_seen' => 'datetime',
        'last_status_change' => 'datetime',
        'is_active' => 'boolean',
        'status_code' => 'integer',
    ];

    protected $appends = [
        'department' // Add department as virtual attribute for frontend compatibility
    ];

    /**
     * Get department attribute (alias for team)
     */
    public function getDepartmentAttribute(): ?string
    {
        return $this->team;
    }

    /**
     * Set department attribute (maps to team)
     */
    public function setDepartmentAttribute(?string $value): void
    {
        $this->attributes['team'] = $value;
    }

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
     * Update the extension status with detailed state information
     */
    public function updateStatus(string $status, ?string $lastSeen = null, ?int $statusCode = null, ?string $deviceState = null): bool
    {
        $this->status = $status;
        
        if ($lastSeen) {
            $this->last_seen = $lastSeen;
        } else {
            $this->last_seen = now();
        }
        
        // Update status code if provided
        if ($statusCode !== null) {
            $this->status_code = $statusCode;
        }
        
        // Update device state if provided
        if ($deviceState !== null) {
            $this->device_state = $deviceState;
        }
        
        // Update last status change timestamp
        $this->last_status_change = now();

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
