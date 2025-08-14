<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FollowUpNote extends Model
{
    use HasFactory;

    protected $fillable = [
        'follow_up_id',
        'user_id',
        'note',
        'type',
        'attachments'
    ];

    protected $casts = [
        'attachments' => 'array'
    ];

    public function followUp()
    {
        return $this->belongsTo(CustomerFollowUp::class, 'follow_up_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
