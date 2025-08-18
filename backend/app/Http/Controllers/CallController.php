<?php

namespace App\Http\Controllers;

use App\Models\Call;
use App\Models\CallLeg;
use Carbon\Carbon;

class CallController extends Controller
{
	private function deriveStatusFromCall(Call $call): string
	{
		$disposition = strtolower((string)($call->disposition ?? ''));
		if (!empty($disposition)) {
			return $disposition;
		}
		if ($call->ended_at) {
			return 'completed';
		}
		if ($call->answered_at) {
			return 'answered';
		}
		if ($call->started_at) {
			return 'ringing';
		}
		return 'unknown';
	}

	public function index()
	{
		$calls = Call::orderByDesc('started_at')
			->take(200)
			->get()
			->map(function (Call $call) {
				return [
					'id' => $call->id,
					'callerNumber' => $call->other_party,
					'callerName' => null,
					'startTime' => $call->started_at,
					'endTime' => $call->ended_at,
					'status' => $this->deriveStatusFromCall($call),
					'duration' => ($call->started_at && $call->ended_at) ? max(0, $call->started_at->diffInSeconds($call->ended_at, true)) : null,
					'direction' => $call->direction,
					'agentExten' => $call->agent_exten,
					'otherParty' => $call->other_party,
				];
			})->toArray();

		return $calls;
	}

	public function getTodayStats()
	{
		$today = Carbon::today();
		$totalCalls = Call::whereDate('started_at', $today)->count();
		$callsByStatus = Call::whereDate('started_at', $today)
			->get()
			->groupBy(function (Call $c) {
				return $this->deriveStatusFromCall($c);
			})
			->map->count()
			->toArray();

		return response()->json([
			'total_calls' => $totalCalls,
			'calls_by_status' => $callsByStatus,
			'date' => $today->toDateString(),
		]);
	}

	public function getCallDetails(int $id)
	{
		$call = Call::find($id);
		if (!$call) {
			return response()->json(['error' => 'Call not found'], 404);
		}
		// Try to find master leg for identifiers/channel context
		$masterLeg = CallLeg::where('linkedid', $call->linkedid)
			->where('uniqueid', $call->linkedid)
			->first();
		if (!$masterLeg) {
			$masterLeg = CallLeg::where('linkedid', $call->linkedid)
				->orderBy('start_time', 'asc')
				->first();
		}

		return response()->json([
			'id' => $call->id,
			'uniqueid' => $masterLeg->uniqueid ?? null,
			'linkedid' => $call->linkedid,
			'channel' => $masterLeg->channel ?? null,
			'callerNumber' => $call->other_party,
			'callerName' => null,
			'extension' => $masterLeg->exten ?? null,
			'context' => $masterLeg->context ?? null,
			'channelState' => $masterLeg->channel_state ?? null,
			'channelStateDesc' => $masterLeg->channel_state_desc ?? null,
			'connectedLineNum' => $masterLeg->connected_line_num ?? null,
			'connectedLineName' => $masterLeg->connected_line_name ?? null,
			'state' => $masterLeg->state ?? null,
			'startTime' => $call->started_at,
			'endTime' => $call->ended_at,
			'status' => $this->deriveStatusFromCall($call),
			'duration' => ($call->started_at && $call->ended_at) ? max(0, $call->started_at->diffInSeconds($call->ended_at, true)) : null,
			'callInstanceId' => null,
			'direction' => $call->direction,
			'agentExten' => $call->agent_exten,
			'otherParty' => $call->other_party,
			'createdAt' => $call->created_at,
			'updatedAt' => $call->updated_at,
		]);
	}
}


