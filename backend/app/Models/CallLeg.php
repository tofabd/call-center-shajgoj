<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CallLeg extends Model
{
	protected $fillable = [
		'uniqueid',
		'linkedid',
		'channel',
		'exten',
		'context',
		'channel_state',
		'channel_state_desc',
		'state',
		'callerid_num',
		'callerid_name',
		'connected_line_num',
		'connected_line_name',
		'start_time',
		'answer_at',
		'hangup_at',
		'hangup_cause',
		'agent_exten_if_leg',
		'other_party_if_leg',
	];

	protected $casts = [
		'start_time' => 'datetime',
		'answer_at' => 'datetime',
		'hangup_at' => 'datetime',
	];

	public function call()
	{
		return $this->belongsTo(Call::class, 'linkedid', 'linkedid');
	}
}


