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
		$dialStatus = strtolower((string)($call->dial_status ?? ''));
		$hangupCause = strtolower((string)($call->hangup_cause ?? ''));

		// If call has ended, determine final status
		if ($call->ended_at) {
			// If call was answered and ended, it's completed
			if ($call->answered_at) {
				return 'completed';
			}

			// Handle specific dispositions for ended calls
			if ($disposition === 'busy') {
				return 'busy';
			}
			if ($disposition === 'no_answer' || $disposition === 'no answer') {
				return 'no_answer';
			}
			if ($disposition === 'canceled' || $disposition === 'cancelled') {
				return 'canceled';
			}
			if ($disposition === 'failed') {
				return 'failed';
			}
			if ($disposition === 'rejected') {
				return 'rejected';
			}

			// Check hangup cause for more specific status
			if (!empty($hangupCause)) {
				if (str_contains($hangupCause, 'busy')) {
					return 'busy';
				}
				if (str_contains($hangupCause, 'no answer') || str_contains($hangupCause, 'noanswer')) {
					return 'no_answer';
				}
				if (str_contains($hangupCause, 'cancel') || str_contains($hangupCause, 'cancelled')) {
					return 'canceled';
				}
				if (str_contains($hangupCause, 'failed') || str_contains($hangupCause, 'failure')) {
					return 'failed';
				}
				if (str_contains($hangupCause, 'rejected') || str_contains($hangupCause, 'reject')) {
					return 'rejected';
				}
			}

			// If no specific disposition but call ended, check if it was answered
			if ($disposition === 'answered') {
				return 'completed';
			}

			// Default for ended calls without clear status
			return 'unknown';
		}

		// For ongoing calls, determine current status
		if ($call->answered_at) {
			// Call is currently active and answered - this is "in progress"
			return 'in_progress';
		}

		if ($call->started_at && !$call->answered_at) {
			// Call started but not yet answered - it's ringing
			return 'ringing';
		}

		// For calls without clear status
		if (!empty($disposition)) {
			return $disposition;
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

	/**
	 * Debug method to understand call status derivation
	 */
	public function debugCallStatus(int $callId)
	{
		$call = Call::find($callId);
		if (!$call) {
			return response()->json(['error' => 'Call not found'], 404);
		}

		$status = $this->deriveStatusFromCall($call);

		return response()->json([
			'call_id' => $call->id,
			'linkedid' => $call->linkedid,
			'direction' => $call->direction,
			'disposition' => $call->disposition,
			'dial_status' => $call->dial_status,
			'hangup_cause' => $call->hangup_cause,
			'started_at' => $call->started_at,
			'answered_at' => $call->answered_at,
			'ended_at' => $call->ended_at,
			'derived_status' => $status,
			'has_answered_timestamp' => !is_null($call->answered_at),
			'has_ended_timestamp' => !is_null($call->ended_at),
			'is_currently_active' => is_null($call->ended_at) && !is_null($call->started_at),
		]);
	}

	public function getTodayStats()
	{
		$today = Carbon::today();

		// Get total calls for today
		$totalCalls = Call::whereDate('started_at', $today)->count();

		// Get calls by direction
		$incomingCalls = Call::whereDate('started_at', $today)
			->where('direction', 'inbound')
			->count();

		$outgoingCalls = Call::whereDate('started_at', $today)
			->where('direction', 'outbound')
			->count();

		// Get currently active calls (ongoing calls)
		$activeCalls = Call::whereDate('started_at', $today)
			->whereNull('ended_at')
			->count();

		// Get completed calls (answered calls that have ended)
		$completedCalls = Call::whereDate('started_at', $today)
			->whereNotNull('answered_at')
			->whereNotNull('ended_at')
			->count();

		// Get calls by status for all calls
		$callsByStatus = Call::whereDate('started_at', $today)
			->get()
			->groupBy(function (Call $c) {
				return $this->deriveStatusFromCall($c);
			})
			->map->count()
			->toArray();

		// Get calls by status for incoming calls only
		$incomingByStatus = Call::whereDate('started_at', $today)
			->where('direction', 'inbound')
			->get()
			->groupBy(function (Call $c) {
				return $this->deriveStatusFromCall($c);
			})
			->map->count()
			->toArray();

		// Get calls by status for outgoing calls only
		$outgoingByStatus = Call::whereDate('started_at', $today)
			->where('direction', 'outbound')
			->get()
			->groupBy(function (Call $c) {
				return $this->deriveStatusFromCall($c);
			})
			->map->count()
			->toArray();

		// Ensure we have proper counts for key statuses
		$callsByStatus = array_merge([
			'completed' => 0,
			'in_progress' => 0,
			'ringing' => 0,
			'no_answer' => 0,
			'busy' => 0,
			'failed' => 0,
			'canceled' => 0,
			'rejected' => 0,
			'unknown' => 0
		], $callsByStatus);

		$incomingByStatus = array_merge([
			'completed' => 0,
			'in_progress' => 0,
			'ringing' => 0,
			'no_answer' => 0,
			'busy' => 0,
			'failed' => 0,
			'canceled' => 0,
			'rejected' => 0,
			'unknown' => 0
		], $incomingByStatus);

		$outgoingByStatus = array_merge([
			'completed' => 0,
			'in_progress' => 0,
			'ringing' => 0,
			'no_answer' => 0,
			'busy' => 0,
			'failed' => 0,
			'canceled' => 0,
			'rejected' => 0,
			'unknown' => 0
		], $outgoingByStatus);

		return response()->json([
			'total_calls' => $totalCalls,
			'incoming_calls' => $incomingCalls,
			'outgoing_calls' => $outgoingCalls,
			'calls_by_status' => $callsByStatus,
			'incoming_by_status' => $incomingByStatus,
			'outgoing_by_status' => $outgoingByStatus,
			'date' => $today->toDateString(),
			'summary' => [
				'active_calls' => $activeCalls,
				'completed_calls' => $completedCalls,
				'total_handled_calls' => $completedCalls + $callsByStatus['in_progress']
			]
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


