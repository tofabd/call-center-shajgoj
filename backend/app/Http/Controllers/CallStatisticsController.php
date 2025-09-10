<?php

namespace App\Http\Controllers;

use App\Models\Call;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CallStatisticsController extends Controller
{
    private function deriveStatusFromCall(Call $call): string
    {
        $disposition = strtolower((string)($call->disposition ?? ''));
        $dialStatus = strtolower((string)($call->dial_status ?? ''));
        $hangupCause = strtolower((string)($call->hangup_cause ?? ''));

        if ($call->answered_at && !$call->ended_at) {
            $secondsSinceAnswer = $call->answered_at->diffInSeconds(now());
            if ($secondsSinceAnswer < 10) {
                return 'answered';
            }
            return 'in_progress';
        }

        if ($call->ended_at) {
            if ($call->answered_at) {
                return 'completed';
            }

            if ($disposition === 'busy') return 'busy';
            if ($disposition === 'no_answer' || $disposition === 'no answer') return 'no_answer';
            if ($disposition === 'canceled' || $disposition === 'cancelled') return 'canceled';
            if ($disposition === 'failed') return 'failed';
            if ($disposition === 'rejected') return 'rejected';

            if (!empty($hangupCause)) {
                if (str_contains($hangupCause, 'busy')) return 'busy';
                if (str_contains($hangupCause, 'no answer') || str_contains($hangupCause, 'noanswer')) return 'no_answer';
                if (str_contains($hangupCause, 'cancel') || str_contains($hangupCause, 'cancelled')) return 'canceled';
                if (str_contains($hangupCause, 'failed') || str_contains($hangupCause, 'failure')) return 'failed';
                if (str_contains($hangupCause, 'rejected') || str_contains($hangupCause, 'reject')) return 'rejected';
            }

            if ($disposition === 'answered') return 'completed';
            return 'unknown';
        }

        if ($call->started_at && !$call->answered_at) {
            return 'ringing';
        }

        if (!empty($disposition)) {
            return $disposition;
        }

        return 'unknown';
    }

    private function calculateCallStatistics($calls, $period = null)
    {
        $totalCalls = $calls->count();
        $incomingCalls = $calls->where('direction', 'incoming')->count();
        $outgoingCalls = $calls->where('direction', 'outgoing')->count();

        $callsByStatus = $calls->groupBy(function (Call $call) {
            return $this->deriveStatusFromCall($call);
        })->map->count()->toArray();

        $incomingByStatus = $calls->where('direction', 'incoming')
            ->groupBy(function (Call $call) {
                return $this->deriveStatusFromCall($call);
            })->map->count()->toArray();

        $outgoingByStatus = $calls->where('direction', 'outgoing')
            ->groupBy(function (Call $call) {
                return $this->deriveStatusFromCall($call);
            })->map->count()->toArray();

        $defaultStatuses = [
            'completed' => 0,
            'in_progress' => 0,
            'ringing' => 0,
            'no_answer' => 0,
            'busy' => 0,
            'failed' => 0,
            'canceled' => 0,
            'rejected' => 0,
            'unknown' => 0
        ];

        $callsByStatus = array_merge($defaultStatuses, $callsByStatus);
        $incomingByStatus = array_merge($defaultStatuses, $incomingByStatus);
        $outgoingByStatus = array_merge($defaultStatuses, $outgoingByStatus);

        // Calculate additional metrics
        $answeredCalls = $calls->whereNotNull('answered_at')->count();
        $completedCalls = $calls->whereNotNull('answered_at')->whereNotNull('ended_at')->count();
        $activeCalls = $calls->whereNull('ended_at')->count();

        // Calculate answer rate
        $answerRate = $totalCalls > 0 ? round(($answeredCalls / $totalCalls) * 100, 2) : 0;

        // Calculate average handle time (for completed calls)
        $avgHandleTime = 0;
        if ($completedCalls > 0) {
            $completedCallsData = $calls->whereNotNull('answered_at')->whereNotNull('ended_at');
            $totalDuration = $completedCallsData->sum(function ($call) {
                return $call->answered_at && $call->ended_at 
                    ? $call->answered_at->diffInSeconds($call->ended_at) 
                    : 0;
            });
            $avgHandleTime = round($totalDuration / $completedCalls, 2);
        }

        return [
            'period' => $period,
            'total_calls' => $totalCalls,
            'incoming_calls' => $incomingCalls,
            'outgoing_calls' => $outgoingCalls,
            'calls_by_status' => $callsByStatus,
            'incoming_by_status' => $incomingByStatus,
            'outgoing_by_status' => $outgoingByStatus,
            'metrics' => [
                'active_calls' => $activeCalls,
                'completed_calls' => $completedCalls,
                'answered_calls' => $answeredCalls,
                'answer_rate' => $answerRate,
                'average_handle_time' => $avgHandleTime
            ]
        ];
    }

    public function getTodayStats()
    {
        $today = Carbon::today();
        $calls = Call::whereDate('started_at', $today)->get();
        
        $stats = $this->calculateCallStatistics($calls, [
            'type' => 'today',
            'date' => $today->toDateString(),
            'label' => 'Today - ' . $today->format('M d, Y')
        ]);

        return response()->json($stats);
    }

    public function getWeekStats()
    {
        $startOfWeek = Carbon::now()->startOfWeek();
        $endOfWeek = Carbon::now()->endOfWeek();
        
        $calls = Call::whereBetween('started_at', [$startOfWeek, $endOfWeek])->get();
        
        $stats = $this->calculateCallStatistics($calls, [
            'type' => 'week',
            'start_date' => $startOfWeek->toDateString(),
            'end_date' => $endOfWeek->toDateString(),
            'label' => 'This Week - ' . $startOfWeek->format('M d') . ' to ' . $endOfWeek->format('M d, Y')
        ]);

        return response()->json($stats);
    }

    public function getLastWeekStats()
    {
        $startOfLastWeek = Carbon::now()->subWeek()->startOfWeek();
        $endOfLastWeek = Carbon::now()->subWeek()->endOfWeek();
        
        $calls = Call::whereBetween('started_at', [$startOfLastWeek, $endOfLastWeek])->get();
        
        $stats = $this->calculateCallStatistics($calls, [
            'type' => 'last_week',
            'start_date' => $startOfLastWeek->toDateString(),
            'end_date' => $endOfLastWeek->toDateString(),
            'label' => 'Last Week - ' . $startOfLastWeek->format('M d') . ' to ' . $endOfLastWeek->format('M d, Y')
        ]);

        return response()->json($stats);
    }

    public function getMonthStats()
    {
        $startOfMonth = Carbon::now()->startOfMonth();
        $endOfMonth = Carbon::now()->endOfMonth();
        
        $calls = Call::whereBetween('started_at', [$startOfMonth, $endOfMonth])->get();
        
        $stats = $this->calculateCallStatistics($calls, [
            'type' => 'month',
            'start_date' => $startOfMonth->toDateString(),
            'end_date' => $endOfMonth->toDateString(),
            'label' => 'This Month - ' . $startOfMonth->format('M Y')
        ]);

        return response()->json($stats);
    }

    public function getDateRangeStats(Request $request)
    {
        $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
        ]);

        $startDate = Carbon::parse($request->start_date)->startOfDay();
        $endDate = Carbon::parse($request->end_date)->endOfDay();
        
        $calls = Call::whereBetween('started_at', [$startDate, $endDate])->get();
        
        $stats = $this->calculateCallStatistics($calls, [
            'type' => 'date_range',
            'start_date' => $startDate->toDateString(),
            'end_date' => $endDate->toDateString(),
            'label' => $startDate->format('M d, Y') . ' to ' . $endDate->format('M d, Y')
        ]);

        return response()->json($stats);
    }

    public function getHourlyTrends(Request $request)
    {
        $date = $request->has('date') ? Carbon::parse($request->date) : Carbon::today();
        
        $hourlyData = [];
        for ($hour = 0; $hour < 24; $hour++) {
            $startHour = $date->copy()->hour($hour)->minute(0)->second(0);
            $endHour = $date->copy()->hour($hour)->minute(59)->second(59);
            
            $calls = Call::whereBetween('started_at', [$startHour, $endHour])->get();
            
            $hourlyData[] = [
                'hour' => $hour,
                'hour_label' => $startHour->format('H:i'),
                'total_calls' => $calls->count(),
                'incoming_calls' => $calls->where('direction', 'incoming')->count(),
                'outgoing_calls' => $calls->where('direction', 'outgoing')->count(),
                'completed_calls' => $calls->whereNotNull('answered_at')->whereNotNull('ended_at')->count(),
            ];
        }

        return response()->json([
            'date' => $date->toDateString(),
            'date_label' => $date->format('M d, Y'),
            'hourly_data' => $hourlyData
        ]);
    }

    public function getAgentStats(Request $request)
    {
        $period = $request->get('period', 'today');
        
        switch ($period) {
            case 'week':
                $startDate = Carbon::now()->startOfWeek();
                $endDate = Carbon::now()->endOfWeek();
                break;
            case 'month':
                $startDate = Carbon::now()->startOfMonth();
                $endDate = Carbon::now()->endOfMonth();
                break;
            case 'today':
            default:
                $startDate = Carbon::today();
                $endDate = Carbon::today()->endOfDay();
                break;
        }

        $agentStats = Call::whereBetween('started_at', [$startDate, $endDate])
            ->whereNotNull('agent_exten')
            ->get()
            ->groupBy('agent_exten')
            ->map(function ($calls, $agent) {
                $totalCalls = $calls->count();
                $answeredCalls = $calls->whereNotNull('answered_at')->count();
                $completedCalls = $calls->whereNotNull('answered_at')->whereNotNull('ended_at')->count();
                
                $avgHandleTime = 0;
                if ($completedCalls > 0) {
                    $totalDuration = $calls->whereNotNull('answered_at')->whereNotNull('ended_at')->sum(function ($call) {
                        return $call->answered_at && $call->ended_at 
                            ? $call->answered_at->diffInSeconds($call->ended_at) 
                            : 0;
                    });
                    $avgHandleTime = round($totalDuration / $completedCalls, 2);
                }

                return [
                    'agent_extension' => $agent,
                    'total_calls' => $totalCalls,
                    'answered_calls' => $answeredCalls,
                    'completed_calls' => $completedCalls,
                    'answer_rate' => $totalCalls > 0 ? round(($answeredCalls / $totalCalls) * 100, 2) : 0,
                    'average_handle_time' => $avgHandleTime,
                    'incoming_calls' => $calls->where('direction', 'incoming')->count(),
                    'outgoing_calls' => $calls->where('direction', 'outgoing')->count(),
                ];
            })
            ->values()
            ->sortByDesc('total_calls');

        return response()->json([
            'period' => $period,
            'period_label' => ucfirst($period),
            'start_date' => $startDate->toDateString(),
            'end_date' => $endDate->toDateString(),
            'agents' => $agentStats
        ]);
    }

    public function getComparisonStats(Request $request)
    {
        $period = $request->get('period', 'week'); // week, month
        
        if ($period === 'week') {
            // Current week vs last week
            $currentStart = Carbon::now()->startOfWeek();
            $currentEnd = Carbon::now()->endOfWeek();
            $previousStart = Carbon::now()->subWeek()->startOfWeek();
            $previousEnd = Carbon::now()->subWeek()->endOfWeek();
        } else {
            // Current month vs last month
            $currentStart = Carbon::now()->startOfMonth();
            $currentEnd = Carbon::now()->endOfMonth();
            $previousStart = Carbon::now()->subMonth()->startOfMonth();
            $previousEnd = Carbon::now()->subMonth()->endOfMonth();
        }

        $currentCalls = Call::whereBetween('started_at', [$currentStart, $currentEnd])->get();
        $previousCalls = Call::whereBetween('started_at', [$previousStart, $previousEnd])->get();

        $currentStats = $this->calculateCallStatistics($currentCalls, [
            'type' => "current_$period",
            'start_date' => $currentStart->toDateString(),
            'end_date' => $currentEnd->toDateString(),
        ]);

        $previousStats = $this->calculateCallStatistics($previousCalls, [
            'type' => "previous_$period",
            'start_date' => $previousStart->toDateString(),
            'end_date' => $previousEnd->toDateString(),
        ]);

        // Calculate percentage changes
        $changes = [
            'total_calls' => $this->calculatePercentageChange($previousStats['total_calls'], $currentStats['total_calls']),
            'incoming_calls' => $this->calculatePercentageChange($previousStats['incoming_calls'], $currentStats['incoming_calls']),
            'outgoing_calls' => $this->calculatePercentageChange($previousStats['outgoing_calls'], $currentStats['outgoing_calls']),
            'answer_rate' => $this->calculatePercentageChange($previousStats['metrics']['answer_rate'], $currentStats['metrics']['answer_rate']),
            'completed_calls' => $this->calculatePercentageChange($previousStats['metrics']['completed_calls'], $currentStats['metrics']['completed_calls']),
        ];

        return response()->json([
            'period' => $period,
            'current' => $currentStats,
            'previous' => $previousStats,
            'changes' => $changes
        ]);
    }

    public function getExtensionStats(Request $request, string $extension)
    {
        // Get date parameter, default to today
        $date = $request->get('date', 'today');
        
        // Set date range based on parameter
        switch ($date) {
            case 'week':
                $startDate = Carbon::now()->startOfWeek();
                $endDate = Carbon::now()->endOfWeek();
                $label = 'This Week';
                break;
            case 'month':
                $startDate = Carbon::now()->startOfMonth();
                $endDate = Carbon::now()->endOfMonth();
                $label = 'This Month';
                break;
            case 'today':
            default:
                $startDate = Carbon::today();
                $endDate = Carbon::today()->endOfDay();
                $label = 'Today';
                break;
        }

        // Get all calls for this extension in the date range
        $calls = Call::where('agent_exten', $extension)
            ->whereBetween('started_at', [$startDate, $endDate])
            ->orderBy('started_at', 'desc')
            ->get();

        // Calculate statistics
        $totalCalls = $calls->count();
        $incomingCalls = $calls->where('direction', 'incoming')->count();
        $outgoingCalls = $calls->where('direction', 'outgoing')->count();

        // Status breakdown
        $statusBreakdown = [];
        $incomingByStatus = [];
        $outgoingByStatus = [];
        
        $totalRingTime = 0;
        $totalTalkTime = 0;
        $ringTimeCount = 0;
        $talkTimeCount = 0;
        $answeredCalls = 0;
        $missedCalls = 0;

        foreach ($calls as $call) {
            $status = $this->deriveStatusFromCall($call);
            
            // Overall status breakdown
            $statusBreakdown[$status] = ($statusBreakdown[$status] ?? 0) + 1;
            
            // Direction-specific status breakdown
            if ($call->direction === 'incoming') {
                $incomingByStatus[$status] = ($incomingByStatus[$status] ?? 0) + 1;
            } else {
                $outgoingByStatus[$status] = ($outgoingByStatus[$status] ?? 0) + 1;
            }

            // Calculate ring time (time from start to answer)
            if ($call->started_at && $call->answered_at) {
                $ringTime = $call->started_at->diffInSeconds($call->answered_at);
                $totalRingTime += $ringTime;
                $ringTimeCount++;
                $answeredCalls++;
            }

            // Calculate talk time (duration of answered calls)
            if ($call->answered_at && $call->ended_at) {
                $talkTime = $call->answered_at->diffInSeconds($call->ended_at);
                $totalTalkTime += $talkTime;
                $talkTimeCount++;
            }

            // Count missed calls (no answer status)
            if (in_array($status, ['no_answer', 'busy', 'rejected', 'canceled'])) {
                $missedCalls++;
            }
        }

        // Calculate averages
        $avgRingTime = $ringTimeCount > 0 ? round($totalRingTime / $ringTimeCount, 2) : 0;
        $avgTalkTime = $talkTimeCount > 0 ? round($totalTalkTime / $talkTimeCount, 2) : 0;
        $answerRate = $totalCalls > 0 ? round(($answeredCalls / $totalCalls) * 100, 2) : 0;

        // Get recent calls for display (limit to 10)
        $recentCalls = $calls->take(10)->map(function ($call) {
            return [
                'id' => $call->id,
                'direction' => $call->direction,
                'other_party' => $call->other_party ?? $call->caller_number ?? 'Unknown',
                'started_at' => $call->started_at,
                'answered_at' => $call->answered_at,
                'ended_at' => $call->ended_at,
                'duration' => $call->duration ?? 0,
                'status' => $this->deriveStatusFromCall($call)
            ];
        });

        return response()->json([
            'extension' => $extension,
            'period' => [
                'type' => $date,
                'date' => $date === 'today' ? $startDate->toDateString() : null,
                'start_date' => $startDate->toDateString(),
                'end_date' => $endDate->toDateString(),
                'label' => $label
            ],
            'summary' => [
                'total_calls' => $totalCalls,
                'answered_calls' => $answeredCalls,
                'missed_calls' => $missedCalls,
                'answer_rate' => $answerRate
            ],
            'direction_breakdown' => [
                'incoming' => $incomingCalls,
                'outgoing' => $outgoingCalls
            ],
            'status_breakdown' => $statusBreakdown,
            'incoming_by_status' => $incomingByStatus,
            'outgoing_by_status' => $outgoingByStatus,
            'performance' => [
                'average_ring_time' => $avgRingTime,
                'average_talk_time' => $avgTalkTime,
                'total_talk_time' => $totalTalkTime
            ],
            'recent_calls' => $recentCalls
        ]);
    }

    private function calculatePercentageChange($oldValue, $newValue)
    {
        if ($oldValue == 0) {
            return $newValue > 0 ? 100 : 0;
        }
        return round((($newValue - $oldValue) / $oldValue) * 100, 2);
    }
}