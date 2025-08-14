<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CallLog extends Model
{
    protected $fillable = [
        'uniqueid',
        'linkedid',
        'channel',
        'callerid_num',
        'callerid_name',
        'exten',
        'context',
        'channel_state',
        'channel_state_desc',
        'connected_line_num',
        'connected_line_name',
        'state',
        'start_time',
        'status',
        'end_time',
        'duration',
        'call_instance_id'
    ];

    protected $casts = [
        'start_time' => 'datetime',
        'end_time' => 'datetime',
    ];

    public function callInstance()
    {
        return $this->belongsTo(CallInstance::class);
    }
}
