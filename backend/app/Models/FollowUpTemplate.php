<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FollowUpTemplate extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'description',
        'title_template',
        'description_template',
        'type',
        'priority',
        'default_days_offset',
        'is_active',
        'created_by',
        'default_tags'
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'default_tags' => 'array',
        'default_days_offset' => 'integer'
    ];

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeByType($query, $type)
    {
        return $query->where('type', $type);
    }

    public function scopeByPriority($query, $priority)
    {
        return $query->where('priority', $priority);
    }
}
