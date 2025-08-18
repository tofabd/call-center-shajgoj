<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Call extends Model
{
	protected $fillable = [
		'linkedid',
		'direction',
		'other_party',
		'agent_exten',
		'started_at',
		'answered_at',
		'ended_at',
		'ring_seconds',
		'talk_seconds',
		'dial_status',
		'disposition',
		'hangup_cause',
		'recording_file',
	];

	protected $casts = [
		'started_at' => 'datetime',
		'answered_at' => 'datetime',
		'ended_at' => 'datetime',
	];

	public function legs()
	{
		return $this->hasMany(CallLeg::class, 'linkedid', 'linkedid');
	}

	public function bridgeSegments()
	{
		return $this->hasMany(BridgeSegment::class, 'linkedid', 'linkedid');
	}
}


