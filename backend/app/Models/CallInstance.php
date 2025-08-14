<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CallInstance extends Model
{
    protected $fillable = ['unique_id'];

    public function callLogs()
    {
        return $this->hasMany(CallLog::class);
    }
}
