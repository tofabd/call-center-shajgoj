<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\CallLog;
use Carbon\Carbon;

class CallLogController extends Controller
{
    public function index()
    {
        $calls = CallLog::whereColumn('uniqueid', 'linkedid')
            ->orderBy('created_at', 'desc')
            ->take(200)
            ->get()
            ->map(function ($call) {
                return [
                    'id' => $call->id,
                    'callerNumber' => $call->callerid_num,
                    'callerName' => $call->callerid_name,
                    'startTime' => $call->start_time,
                    'status' => $call->status ?? 'Unknown',
                    'duration' => $call->duration,
                    'direction' => $call->direction,
                    'agentExten' => $call->agent_exten,
                    'otherParty' => $call->other_party,
                ];
            })->toArray();

        return $calls;
    }

    /**
     * Get call statistics for today
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function getTodayStats()
    {
        $today = Carbon::today();

        // Get all unique calls for today (where uniqueid equals linkedid)
        $totalCalls = CallLog::whereColumn('uniqueid', 'linkedid')
            ->whereDate('created_at', $today)
            ->count();

        // Get calls by status
        $callsByStatus = CallLog::whereColumn('uniqueid', 'linkedid')
            ->whereDate('created_at', $today)
            ->selectRaw('status, count(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status')
            ->toArray();

        return response()->json([
            'total_calls' => $totalCalls,
            'calls_by_status' => $callsByStatus,
            'date' => $today->toDateString()
        ]);
    }

    /**
     * Get detailed call information by ID
     *
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function getCallDetails($id)
    {
        $callLog = CallLog::find($id);

        if (!$callLog) {
            return response()->json(['error' => 'Call not found'], 404);
        }

        return response()->json([
            'id' => $callLog->id,
            'uniqueid' => $callLog->uniqueid,
            'linkedid' => $callLog->linkedid,
            'channel' => $callLog->channel,
            'callerNumber' => $callLog->callerid_num,
            'callerName' => $callLog->callerid_name,
            'extension' => $callLog->exten,
            'context' => $callLog->context,
            'channelState' => $callLog->channel_state,
            'channelStateDesc' => $callLog->channel_state_desc,
            'connectedLineNum' => $callLog->connected_line_num,
            'connectedLineName' => $callLog->connected_line_name,
            'state' => $callLog->state,
            'startTime' => $callLog->start_time,
            'endTime' => $callLog->end_time,
            'status' => $callLog->status,
            'duration' => $callLog->duration,
            'callInstanceId' => $callLog->call_instance_id,
            'direction' => $callLog->direction,
            'agentExten' => $callLog->agent_exten,
            'otherParty' => $callLog->other_party,
            'createdAt' => $callLog->created_at,
            'updatedAt' => $callLog->updated_at
        ]);
    }
}
