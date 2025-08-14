<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\CustomerFollowUp;
use App\Services\FollowUpService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class FollowUpController extends Controller
{
    protected $followUpService;

    public function __construct(FollowUpService $followUpService)
    {
        $this->followUpService = $followUpService;
    }

    /**
     * Get paginated follow-ups with filters
     */
    public function index(Request $request)
    {
        try {
            $followUps = $this->followUpService->search($request->all());

            return response()->json([
                'data' => $followUps->items(),
                'pagination' => [
                    'current_page' => $followUps->currentPage(),
                    'last_page' => $followUps->lastPage(),
                    'per_page' => $followUps->perPage(),
                    'total' => $followUps->total(),
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Error fetching follow-ups: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to fetch follow-ups'], 500);
        }
    }

    /**
     * Create new follow-up
     */
    public function store(Request $request)
    {
        $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'type' => ['required', Rule::in([
                'sales_call', 'order_followup', 'payment_reminder',
                'delivery_check', 'feedback_request', 'upsell_opportunity',
                'complaint_resolution', 'general_check_in'
            ])],
            'priority' => ['required', Rule::in(['low', 'medium', 'high', 'urgent'])],
            'customer_phone' => 'nullable|string',
            'customer_email' => 'nullable|email',
            'customer_name' => 'nullable|string',
            'woocommerce_customer_id' => 'nullable|integer',
            'woocommerce_order_id' => 'nullable|integer',
            'scheduled_date' => 'required|date|after:now',
            'assigned_to' => 'nullable|exists:users,id',
            'tags' => 'nullable|array',
            'metadata' => 'nullable|array'
        ]);

        try {
            $followUp = $this->followUpService->createFollowUp($request->all());

            return response()->json($followUp->load(['assignedUser', 'creator']), 201);
        } catch (\Exception $e) {
            Log::error('Error creating follow-up: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to create follow-up'], 500);
        }
    }

    /**
     * Get specific follow-up
     */
    public function show($id)
    {
        try {
            $followUp = CustomerFollowUp::with(['assignedUser', 'creator', 'notes.user'])
                ->findOrFail($id);

            return response()->json($followUp);
        } catch (\Exception $e) {
            Log::error('Error fetching follow-up: ' . $e->getMessage());
            return response()->json(['error' => 'Follow-up not found'], 404);
        }
    }

    /**
     * Update follow-up
     */
    public function update(Request $request, $id)
    {
        $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'type' => ['sometimes', Rule::in([
                'sales_call', 'order_followup', 'payment_reminder',
                'delivery_check', 'feedback_request', 'upsell_opportunity',
                'complaint_resolution', 'general_check_in'
            ])],
            'priority' => ['sometimes', Rule::in(['low', 'medium', 'high', 'urgent'])],
            'status' => ['sometimes', Rule::in(['pending', 'in_progress', 'completed', 'cancelled'])],
            'scheduled_date' => 'sometimes|date',
            'assigned_to' => 'nullable|exists:users,id',
            'outcome' => 'nullable|string'
        ]);

        try {
            $followUp = $this->followUpService->updateFollowUp($id, $request->all());

            return response()->json($followUp);
        } catch (\Exception $e) {
            Log::error('Error updating follow-up: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to update follow-up'], 500);
        }
    }

    /**
     * Delete follow-up
     */
    public function destroy($id)
    {
        try {
            $this->followUpService->deleteFollowUp($id);

            return response()->json(['message' => 'Follow-up deleted successfully']);
        } catch (\Exception $e) {
            Log::error('Error deleting follow-up: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to delete follow-up'], 500);
        }
    }

    /**
     * Get dashboard statistics
     */
    public function getDashboardStats(Request $request)
    {
        try {
            $userId = $request->input('user_id'); // null for all users
            $stats = $this->followUpService->getDashboardStats($userId);

            return response()->json($stats);
        } catch (\Exception $e) {
            Log::error('Error fetching dashboard stats: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to fetch statistics'], 500);
        }
    }

    /**
     * Get calendar data
     */
    public function getCalendarData(Request $request)
    {
        $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date|after:start_date',
            'user_id' => 'nullable|exists:users,id'
        ]);

        try {
            $followUps = $this->followUpService->getCalendarData(
                $request->start_date,
                $request->end_date,
                $request->user_id
            );

            return response()->json($followUps);
        } catch (\Exception $e) {
            Log::error('Error fetching calendar data: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to fetch calendar data'], 500);
        }
    }

    /**
     * Bulk operations
     */
    public function bulkUpdate(Request $request)
    {
        $request->validate([
            'follow_up_ids' => 'required|array',
            'follow_up_ids.*' => 'exists:customer_follow_ups,id',
            'updates' => 'required|array',
            'updates.status' => ['sometimes', Rule::in(['pending', 'in_progress', 'completed', 'cancelled'])],
            'updates.assigned_to' => 'sometimes|nullable|exists:users,id',
            'updates.priority' => ['sometimes', Rule::in(['low', 'medium', 'high', 'urgent'])]
        ]);

        try {
            $updates = $request->updates;
            if (isset($updates['status']) && $updates['status'] === 'completed') {
                $updates['completed_date'] = now();
            }

            $affected = $this->followUpService->bulkUpdate($request->follow_up_ids, $updates);

            return response()->json([
                'message' => "Successfully updated {$affected} follow-ups",
                'affected_count' => $affected
            ]);
        } catch (\Exception $e) {
            Log::error('Error bulk updating follow-ups: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to update follow-ups'], 500);
        }
    }

    /**
     * Add note to follow-up
     */
    public function addNote(Request $request, $id)
    {
        $request->validate([
            'note' => 'required|string',
            'type' => ['sometimes', Rule::in(['note', 'status_change', 'system'])]
        ]);

        try {
            $followUp = CustomerFollowUp::findOrFail($id);
            $note = $followUp->addNote(
                $request->note,
                auth() ? auth()->id() : 1,
                $request->type ?? 'note'
            );

            return response()->json($note->load('user'), 201);
        } catch (\Exception $e) {
            Log::error('Error adding note: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to add note'], 500);
        }
    }

    /**
     * Get customer follow-ups
     */
    public function getCustomerFollowUps(Request $request)
    {
        $request->validate([
            'customer_phone' => 'sometimes|string',
            'customer_email' => 'sometimes|email',
            'woocommerce_customer_id' => 'sometimes|integer'
        ]);

        try {
            $followUps = $this->followUpService->getCustomerFollowUps($request->all());

            return response()->json($followUps);
        } catch (\Exception $e) {
            Log::error('Error fetching customer follow-ups: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to fetch customer follow-ups'], 500);
        }
    }

    /**
     * Mark follow-up as completed
     */
    public function markCompleted(Request $request, $id)
    {
        $request->validate([
            'outcome' => 'nullable|string'
        ]);

        try {
            $followUp = CustomerFollowUp::findOrFail($id);
            $followUp->markAsCompleted($request->outcome);

            return response()->json([
                'message' => 'Follow-up marked as completed',
                'follow_up' => $followUp->fresh(['assignedUser', 'creator'])
            ]);
        } catch (\Exception $e) {
            Log::error('Error marking follow-up as completed: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to mark follow-up as completed'], 500);
        }
    }

    /**
     * Reschedule follow-up
     */
    public function reschedule(Request $request, $id)
    {
        $request->validate([
            'scheduled_date' => 'required|date|after:now'
        ]);

        try {
            $followUp = CustomerFollowUp::findOrFail($id);
            $followUp->reschedule(\Carbon\Carbon::parse($request->scheduled_date));

            return response()->json([
                'message' => 'Follow-up rescheduled successfully',
                'follow_up' => $followUp->fresh(['assignedUser', 'creator'])
            ]);
        } catch (\Exception $e) {
            Log::error('Error rescheduling follow-up: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to reschedule follow-up'], 500);
        }
    }

    /**
     * Get overdue follow-ups
     */
    public function getOverdue(Request $request)
    {
        try {
            $userId = $request->input('user_id');
            $overdueFollowUps = $this->followUpService->getOverdueFollowUps($userId);

            return response()->json($overdueFollowUps);
        } catch (\Exception $e) {
            Log::error('Error fetching overdue follow-ups: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to fetch overdue follow-ups'], 500);
        }
    }
}
