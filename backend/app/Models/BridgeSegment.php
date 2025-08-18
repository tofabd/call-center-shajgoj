<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BridgeSegment extends Model
{
	protected $fillable = [
		'linkedid',
		'agent_exten',
		'party_channel',
		'entered_at',
		'left_at',
	];

	protected $casts = [
		'entered_at' => 'datetime',
		'left_at' => 'datetime',
	];

	public function call()
	{
		return $this->belongsTo(Call::class, 'linkedid', 'linkedid');
	}
}


