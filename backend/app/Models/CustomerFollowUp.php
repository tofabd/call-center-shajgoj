<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Carbon\Carbon;

class CustomerFollowUp extends Model
{
    use HasFactory;

    protected $fillable = [
        'title',
        'description',
        'type',
        'priority',
        'status',
        'customer_phone',
        'customer_email',
        'customer_name',
        'woocommerce_customer_id',
        'woocommerce_order_id',
        'scheduled_date',
        'completed_date',
        'reminder_date',
        'is_recurring',
        'recurring_pattern',
        'recurring_interval',
        'assigned_to',
        'created_by',
        'tags',
        'metadata',
        'outcome',
        'last_reminder_sent',
        'reminder_count'
    ];

    protected $casts = [
        'scheduled_date' => 'datetime',
        'completed_date' => 'datetime',
        'reminder_date' => 'datetime',
        'last_reminder_sent' => 'datetime',
        'is_recurring' => 'boolean',
        'tags' => 'array',
        'metadata' => 'array',
        'reminder_count' => 'integer'
    ];

    // Relationships
    public function assignedUser()
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function notes()
    {
        return $this->hasMany(FollowUpNote::class, 'follow_up_id');
    }

    // Scopes
    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    public function scopeOverdue($query)
    {
        return $query->where('status', 'pending')
                    ->where('scheduled_date', '<', now());
    }

    public function scopeDueToday($query)
    {
        return $query->where('status', 'pending')
                    ->whereDate('scheduled_date', today());
    }

    public function scopeForUser($query, $userId)
    {
        return $query->where('assigned_to', $userId);
    }

    public function scopeByPriority($query, $priority)
    {
        return $query->where('priority', $priority);
    }

    public function scopeByType($query, $type)
    {
        return $query->where('type', $type);
    }

    public function scopeByStatus($query, $status)
    {
        return $query->where('status', $status);
    }

    // Accessors
    public function getIsOverdueAttribute()
    {
        return $this->status === 'pending' && $this->scheduled_date < now();
    }

    public function getFormattedScheduledDateAttribute()
    {
        return $this->scheduled_date->format('Y-m-d H:i:s');
    }

    public function getPriorityColorAttribute()
    {
        $colors = [
            'low' => '#10B981',      // green
            'medium' => '#F59E0B',   // yellow
            'high' => '#F97316',     // orange
            'urgent' => '#EF4444'    // red
        ];

        return $colors[$this->priority] ?? $colors['medium'];
    }

    // Methods
    public function markAsCompleted($outcome = null)
    {
        return $this->update([
            'status' => 'completed',
            'completed_date' => now(),
            'outcome' => $outcome
        ]);
    }

    public function reschedule(Carbon $newDate)
    {
        return $this->update([
            'scheduled_date' => $newDate,
            'status' => 'pending'
        ]);
    }

    public function addNote($note, $userId, $type = 'note')
    {
        return $this->notes()->create([
            'note' => $note,
            'user_id' => $userId,
            'type' => $type
        ]);
    }

    public function markAsInProgress()
    {
        return $this->update(['status' => 'in_progress']);
    }

    public function cancel($reason = null)
    {
        return $this->update([
            'status' => 'cancelled',
            'outcome' => $reason
        ]);
    }

    public function incrementReminderCount()
    {
        return $this->update([
            'reminder_count' => $this->reminder_count + 1,
            'last_reminder_sent' => now()
        ]);
    }
}
