<?php

namespace App\Services;

use App\Models\CustomerFollowUp;
use App\Models\FollowUpTemplate;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;

class FollowUpService
{
    /**
     * Create a follow-up from template
     */
    public function createFromTemplate($templateId, $customerData, $scheduledDate = null, $assignedTo = null)
    {
        $template = FollowUpTemplate::findOrFail($templateId);

        $scheduledDate = $scheduledDate ?: now()->addDays($template->default_days_offset);

        return CustomerFollowUp::create([
            'title' => $this->processTemplate($template->title_template, $customerData),
            'description' => $this->processTemplate($template->description_template, $customerData),
            'type' => $template->type,
            'priority' => $template->priority,
            'customer_phone' => $customerData['phone'] ?? null,
            'customer_email' => $customerData['email'] ?? null,
            'customer_name' => $customerData['name'] ?? null,
            'woocommerce_customer_id' => $customerData['woocommerce_customer_id'] ?? null,
            'woocommerce_order_id' => $customerData['woocommerce_order_id'] ?? null,
            'scheduled_date' => $scheduledDate,
            'assigned_to' => $assignedTo,
            'created_by' => auth()->id() ?? 1,
            'tags' => $template->default_tags,
            'metadata' => $customerData
        ]);
    }

    /**
     * Auto-create follow-ups based on triggers
     */
    public function createAutoFollowUp($trigger, $customerData, $orderData = null)
    {
        $templates = FollowUpTemplate::active()
            ->where('type', $this->getTriggerType($trigger))
            ->get();

        $followUps = [];
        foreach ($templates as $template) {
            $followUps[] = $this->createFromTemplate(
                $template->id,
                array_merge($customerData, $orderData ?? [])
            );
        }

        return $followUps;
    }

    /**
     * Get overdue follow-ups
     */
    public function getOverdueFollowUps($userId = null)
    {
        $query = CustomerFollowUp::overdue()
            ->with(['assignedUser', 'creator', 'notes']);

        if ($userId) {
            $query->forUser($userId);
        }

        return $query->orderBy('scheduled_date', 'asc')->get();
    }

    /**
     * Get dashboard statistics
     */
    public function getDashboardStats($userId = null)
    {
        $baseQuery = CustomerFollowUp::query();

        if ($userId) {
            $baseQuery->forUser($userId);
        }

        return [
            'total_pending' => (clone $baseQuery)->pending()->count(),
            'overdue' => (clone $baseQuery)->overdue()->count(),
            'due_today' => (clone $baseQuery)->dueToday()->count(),
            'completed_today' => (clone $baseQuery)->where('status', 'completed')
                ->whereDate('completed_date', today())->count(),
            'by_priority' => [
                'urgent' => (clone $baseQuery)->pending()->byPriority('urgent')->count(),
                'high' => (clone $baseQuery)->pending()->byPriority('high')->count(),
                'medium' => (clone $baseQuery)->pending()->byPriority('medium')->count(),
                'low' => (clone $baseQuery)->pending()->byPriority('low')->count(),
            ],
            'by_type' => CustomerFollowUp::pending()
                ->selectRaw('type, count(*) as count')
                ->groupBy('type')
                ->pluck('count', 'type')
                ->toArray()
        ];
    }

    /**
     * Process template placeholders
     */
    private function processTemplate($template, $data)
    {
        $placeholders = [
            '{customer_name}' => $data['name'] ?? 'Customer',
            '{customer_email}' => $data['email'] ?? '',
            '{customer_phone}' => $data['phone'] ?? '',
            '{order_id}' => $data['woocommerce_order_id'] ?? '',
            '{order_total}' => $data['order_total'] ?? '',
            '{today}' => now()->format('Y-m-d'),
        ];

        return str_replace(array_keys($placeholders), array_values($placeholders), $template);
    }

    /**
     * Map triggers to follow-up types
     */
    private function getTriggerType($trigger)
    {
        $mapping = [
            'order_created' => 'order_followup',
            'payment_failed' => 'payment_reminder',
            'order_delivered' => 'feedback_request',
            'call_completed' => 'general_check_in',
        ];

        return $mapping[$trigger] ?? 'general_check_in';
    }

    /**
     * Bulk update follow-ups
     */
    public function bulkUpdate(array $followUpIds, array $updates)
    {
        return CustomerFollowUp::whereIn('id', $followUpIds)->update($updates);
    }

    /**
     * Search follow-ups
     */
    public function search($params)
    {
        $query = CustomerFollowUp::with(['assignedUser', 'creator'])
            ->orderBy('scheduled_date', 'desc');

        // Apply filters
        if (!empty($params['status'])) {
            $query->where('status', $params['status']);
        }

        if (!empty($params['type'])) {
            $query->where('type', $params['type']);
        }

        if (!empty($params['priority'])) {
            $query->where('priority', $params['priority']);
        }

        if (!empty($params['assigned_to'])) {
            $query->where('assigned_to', $params['assigned_to']);
        }

        if (!empty($params['search'])) {
            $search = $params['search'];
            $query->where(function($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%")
                  ->orWhere('customer_name', 'like', "%{$search}%")
                  ->orWhere('customer_phone', 'like', "%{$search}%")
                  ->orWhere('customer_email', 'like', "%{$search}%");
            });
        }

        if (!empty($params['date_from'])) {
            $query->where('scheduled_date', '>=', $params['date_from']);
        }

        if (!empty($params['date_to'])) {
            $query->where('scheduled_date', '<=', $params['date_to']);
        }

        return $query->paginate($params['per_page'] ?? 50);
    }

    /**
     * Get follow-ups for calendar view
     */
    public function getCalendarData($startDate, $endDate, $userId = null)
    {
        $query = CustomerFollowUp::with(['assignedUser'])
            ->whereBetween('scheduled_date', [$startDate, $endDate]);

        if ($userId) {
            $query->where('assigned_to', $userId);
        }

        return $query->get()->map(function ($followUp) {
            return [
                'id' => $followUp->id,
                'title' => $followUp->title,
                'start' => $followUp->scheduled_date->toISOString(),
                'end' => $followUp->scheduled_date->addHour()->toISOString(),
                'backgroundColor' => $followUp->priority_color,
                'borderColor' => $followUp->priority_color,
                'extendedProps' => [
                    'type' => $followUp->type,
                    'priority' => $followUp->priority,
                    'status' => $followUp->status,
                    'customer_name' => $followUp->customer_name,
                    'assigned_user' => $followUp->assignedUser?->name
                ]
            ];
        });
    }

    /**
     * Create follow-up manually
     */
    public function createFollowUp($data)
    {
        $data['created_by'] = auth()->id() ?? 1;

        if (!isset($data['scheduled_date'])) {
            $data['scheduled_date'] = now()->addDay();
        }

        return CustomerFollowUp::create($data);
    }

    /**
     * Update follow-up
     */
    public function updateFollowUp($id, $data)
    {
        $followUp = CustomerFollowUp::findOrFail($id);

        // If marking as completed, set completed_date
        if (isset($data['status']) && $data['status'] === 'completed' && $followUp->status !== 'completed') {
            $data['completed_date'] = now();
        }

        $followUp->update($data);

        return $followUp->fresh(['assignedUser', 'creator']);
    }

    /**
     * Delete follow-up
     */
    public function deleteFollowUp($id)
    {
        $followUp = CustomerFollowUp::findOrFail($id);
        return $followUp->delete();
    }

    /**
     * Get customer follow-ups
     */
    public function getCustomerFollowUps($customerData)
    {
        $query = CustomerFollowUp::with(['assignedUser', 'creator']);

        if (!empty($customerData['customer_phone'])) {
            $query->where('customer_phone', $customerData['customer_phone']);
        }

        if (!empty($customerData['customer_email'])) {
            $query->where('customer_email', $customerData['customer_email']);
        }

        if (!empty($customerData['woocommerce_customer_id'])) {
            $query->where('woocommerce_customer_id', $customerData['woocommerce_customer_id']);
        }

        return $query->orderBy('scheduled_date', 'desc')->get();
    }

    /**
     * Mark overdue follow-ups
     */
    public function markOverdueFollowUps()
    {
        return CustomerFollowUp::where('status', 'pending')
            ->where('scheduled_date', '<', now()->subDay())
            ->update(['status' => 'overdue']);
    }
}
