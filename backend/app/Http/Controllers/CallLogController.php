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
            ->get();

        // Group calls by caller number and get the latest call for each
        $groupedCalls = $calls->groupBy('callerid_num')->map(function ($calls) {
            $latestCall = $calls->first(); // Most recent call
            return [
                'id' => $latestCall->id,
                'callerNumber' => $latestCall->callerid_num,
                'callerName' => $latestCall->callerid_name,
                'startTime' => $latestCall->start_time,
                'status' => $latestCall->status ?? 'Unknown',
                'duration' => $latestCall->duration,
                'frequency' => $calls->count(),
                'allCalls' => $calls->map(function ($call) {
                    return [
                        'id' => $call->id,
                        'callerNumber' => $call->callerid_num,
                        'callerName' => $call->callerid_name,
                        'startTime' => $call->start_time,
                        'endTime' => $call->end_time,
                        'status' => $call->status ?? 'Unknown',
                        'duration' => $call->duration,
                        'created_at' => $call->created_at,
                    ];
                })->values()->toArray()
            ];
        });
        
        $uniqueCalls = $groupedCalls->values()->toArray();
        
        // Sort by latest call time
        usort($uniqueCalls, function($a, $b) {
            return strtotime($b['startTime']) - strtotime($a['startTime']);
        });
        
        return array_slice($uniqueCalls, 0, 50);
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
            'createdAt' => $callLog->created_at,
            'updatedAt' => $callLog->updated_at
        ]);
    }
}
