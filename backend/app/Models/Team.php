<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Team extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'slug',
        'description',
        'color',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    /**
     * Boot method to auto-generate slug
     */
    protected static function boot()
    {
        parent::boot();

        static::creating(function ($team) {
            if (empty($team->slug)) {
                $team->slug = Str::slug($team->name);
            }
        });

        static::updating(function ($team) {
            if ($team->isDirty('name') && empty($team->slug)) {
                $team->slug = Str::slug($team->name);
            }
        });
    }

    /**
     * Get extensions belonging to this team
     */
    public function extensions(): HasMany
    {
        return $this->hasMany(Extension::class);
    }

    /**
     * Get active extensions for this team
     */
    public function activeExtensions(): HasMany
    {
        return $this->extensions()->where('is_active', true);
    }

    /**
     * Get online extensions count for this team
     */
    public function getOnlineExtensionsCount(): int
    {
        return $this->extensions()
                    ->where('availability_status', 'online')
                    ->where('is_active', true)
                    ->count();
    }

    /**
     * Get total extensions count for this team
     */
    public function getTotalExtensionsCount(): int
    {
        return $this->extensions()
                    ->where('is_active', true)
                    ->count();
    }

    /**
     * Scope for active teams
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
