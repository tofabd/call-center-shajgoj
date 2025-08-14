<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable, HasApiTokens;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'extension',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    // Follow-up relationships
    public function assignedFollowUps()
    {
        return $this->hasMany(CustomerFollowUp::class, 'assigned_to');
    }

    public function createdFollowUps()
    {
        return $this->hasMany(CustomerFollowUp::class, 'created_by');
    }

    public function followUpNotes()
    {
        return $this->hasMany(FollowUpNote::class);
    }

    public function followUpTemplates()
    {
        return $this->hasMany(FollowUpTemplate::class, 'created_by');
    }
}
