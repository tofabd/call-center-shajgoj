<?php

namespace App\Helpers;

use App\Models\Call;

class CallStatusHelper
{
    public static function deriveStatus(Call $call): string
    {
        $disposition = strtolower((string)($call->disposition ?? ''));
        $dialStatus = strtolower((string)($call->dial_status ?? ''));
        $hangupCause = strtolower((string)($call->hangup_cause ?? ''));

        // FIRST: Check for ongoing calls (answered but not ended)
        if ($call->answered_at && !$call->ended_at) {
            // Call is currently active and answered - treat as "in_progress"
            return 'in_progress';
        }

        // SECOND: Check for ended calls
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
            if ($disposition === 'congestion') {
                return 'congestion';
            }
            if ($disposition === 'rejected') {
                return 'rejected';
            }

            // Check hangup cause for more specific status
            if (!empty($hangupCause)) {
                if (str_contains($hangupCause, 'busy')) {
                    return 'busy';
                }
                if (str_contains($hangupCause, 'congestion')) {
                    return 'congestion';
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

        // THIRD: Check for calls that started but haven't been answered yet
        if ($call->started_at && !$call->answered_at) {
            // Call started but not yet answered - it's ringing
            return 'ringing';
        }

        // FOURTH: For calls without clear status
        if (!empty($disposition)) {
            return $disposition;
        }

        return 'unknown';
    }
}