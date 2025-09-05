<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Extension extends Model
{
    use HasFactory;

    protected $fillable = [
        'extension',
        'agent_name',
        'team_id',
        'status_code',
        'status_text',
        'availability_status',
        'status_changed_at',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'status_code' => 'integer',
        'status_changed_at' => 'datetime',
    ];

    protected $appends = [
        'department', // Add department as virtual attribute for frontend compatibility
        'team_name', // Add team name for easy access
        'device_state' // Computed from status_code
    ];

    /**
     * Get the team that owns this extension
     */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    /**
     * Get team name attribute
     */
    public function getTeamNameAttribute(): ?string
    {
        return $this->team?->name;
    }

    /**
     * Get department attribute (alias for team for backward compatibility)
     */
    public function getDepartmentAttribute(): ?string
    {
        return $this->team?->name;
    }

    /**
     * Set department attribute (maps to team_id by finding team by name)
     */
    public function setDepartmentAttribute(?string $value): void
    {
        if ($value) {
            $team = Team::where('name', $value)->first();
            $this->team_id = $team?->id;
        } else {
            $this->team_id = null;
        }
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
     * Update the extension status from Asterisk AMI event
     */
    public function updateFromAsteriskEvent(int $statusCode, ?string $statusText = null): bool
    {
        $oldAvailabilityStatus = $this->availability_status;
        $newAvailabilityStatus = $this->mapToAvailabilityStatus($statusCode);
        
        $this->status_code = $statusCode;
        
        // Update availability status and timestamp if status changed
        if ($oldAvailabilityStatus !== $newAvailabilityStatus) {
            $this->availability_status = $newAvailabilityStatus;
            $this->status_changed_at = now();
        }
        
        if ($statusText !== null) {
            $this->status_text = $statusText;
        }
        
        return $this->save();
    }

    /**
     * Map Asterisk status code to availability status
     */
    public function mapToAvailabilityStatus(int $statusCode): string
    {
        return match($statusCode) {
            0, 1, 2, 8, 16 => 'online',    // All online states
            4 => 'offline',                 // UNAVAILABLE
            32 => 'invalid',                // Invalid state
            -1 => 'unknown',                // Unknown state
            default => 'unknown'            // Others
        };
    }

    /**
     * Get device state from status code (computed property)
     */
    public function getDeviceStateAttribute(): string
    {
        return match($this->status_code) {
            -1 => 'UNKNOWN',
            0 => 'NOT_INUSE',
            1 => 'INUSE',
            2 => 'BUSY',
            4 => 'UNAVAILABLE',
            8 => 'RINGING',
            16 => 'RINGINUSE',
            32 => 'INVALID',
            default => 'UNKNOWN'
        };
    }

    /**
     * Get status text from status code (computed property)
     */
    public function getStatusTextAttribute(): string
    {
        return match($this->status_code) {
            -1 => 'Unknown',
            0 => 'Not In Use',
            1 => 'In Use',
            2 => 'Busy',
            4 => 'Unavailable',
            8 => 'Ringing',
            16 => 'Ringing In Use',
            32 => 'Invalid',
            default => 'Unknown'
        };
    }

    /**
     * Check if extension is online
     */
    public function isOnline(): bool
    {
        return $this->availability_status === 'online';
    }

    /**
     * Check if extension can receive calls
     */
    public function canReceiveCalls(): bool
    {
        return $this->status_code === 0; // Only NOT_INUSE state
    }

    /**
     * Get online extensions count
     */
    public static function getOnlineCount(): int
    {
        return static::where('availability_status', 'online')->count();
    }

    /**
     * Get total extensions count
     */
    public static function getTotalCount(): int
    {
        return static::count();
    }

    /**
     * Get how long extension has been in current availability status (in minutes)
     */
    public function getStatusDurationMinutes(): ?int
    {
        if (!$this->status_changed_at) {
            return null;
        }
        
        return now()->diffInMinutes($this->status_changed_at);
    }

    /**
     * Get how long extension has been in current availability status (human readable)
     */
    public function getStatusDurationHuman(): ?string
    {
        if (!$this->status_changed_at) {
            return null;
        }
        
        return $this->status_changed_at->diffForHumans(now());
    }

    /**
     * Check if extension has been offline for longer than specified minutes
     */
    public function hasBeenOfflineFor(int $minutes): bool
    {
        return $this->availability_status === 'offline' && 
               $this->status_changed_at && 
               $this->status_changed_at->diffInMinutes(now()) >= $minutes;
    }

    /**
     * Check if extension has been online for longer than specified minutes
     */
    public function hasBeenOnlineFor(int $minutes): bool
    {
        return $this->availability_status === 'online' && 
               $this->status_changed_at && 
               $this->status_changed_at->diffInMinutes(now()) >= $minutes;
    }
}
