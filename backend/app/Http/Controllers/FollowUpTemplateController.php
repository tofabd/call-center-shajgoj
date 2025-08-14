<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\FollowUpTemplate;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class FollowUpTemplateController extends Controller
{
    /**
     * Get paginated templates with filters
     */
    public function index(Request $request)
    {
        try {
            $query = FollowUpTemplate::with(['creator'])
                ->orderBy('created_at', 'desc');

            // Apply filters
            if ($request->has('type') && $request->type) {
                $query->where('type', $request->type);
            }

            if ($request->has('is_active')) {
                $query->where('is_active', $request->boolean('is_active'));
            }

            if ($request->has('search') && $request->search) {
                $search = $request->search;
                $query->where(function($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                      ->orWhere('description', 'like', "%{$search}%");
                });
            }

            $templates = $query->paginate($request->input('per_page', 50));

            return response()->json([
                'data' => $templates->items(),
                'pagination' => [
                    'current_page' => $templates->currentPage(),
                    'last_page' => $templates->lastPage(),
                    'per_page' => $templates->perPage(),
                    'total' => $templates->total(),
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Error fetching templates: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to fetch templates'], 500);
        }
    }

    /**
     * Create new template
     */
    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'title_template' => 'required|string',
            'description_template' => 'required|string',
            'type' => ['required', Rule::in([
                'sales_call', 'order_followup', 'payment_reminder',
                'delivery_check', 'feedback_request', 'upsell_opportunity',
                'complaint_resolution', 'general_check_in'
            ])],
            'priority' => ['required', Rule::in(['low', 'medium', 'high', 'urgent'])],
            'default_days_offset' => 'required|integer|min:0|max:365',
            'is_active' => 'boolean',
            'default_tags' => 'nullable|array'
        ]);

        try {
            $data = $request->all();
            $data['created_by'] = auth() ? auth()->id() : 1;

            $template = FollowUpTemplate::create($data);

            return response()->json($template->load(['creator']), 201);
        } catch (\Exception $e) {
            Log::error('Error creating template: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to create template'], 500);
        }
    }

    /**
     * Get specific template
     */
    public function show($id)
    {
        try {
            $template = FollowUpTemplate::with(['creator'])
                ->findOrFail($id);

            return response()->json($template);
        } catch (\Exception $e) {
            Log::error('Error fetching template: ' . $e->getMessage());
            return response()->json(['error' => 'Template not found'], 404);
        }
    }

    /**
     * Update template
     */
    public function update(Request $request, $id)
    {
        $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'title_template' => 'sometimes|required|string',
            'description_template' => 'sometimes|required|string',
            'type' => ['sometimes', Rule::in([
                'sales_call', 'order_followup', 'payment_reminder',
                'delivery_check', 'feedback_request', 'upsell_opportunity',
                'complaint_resolution', 'general_check_in'
            ])],
            'priority' => ['sometimes', Rule::in(['low', 'medium', 'high', 'urgent'])],
            'default_days_offset' => 'sometimes|integer|min:0|max:365',
            'is_active' => 'boolean',
            'default_tags' => 'nullable|array'
        ]);

        try {
            $template = FollowUpTemplate::findOrFail($id);
            $template->update($request->all());

            return response()->json($template->fresh(['creator']));
        } catch (\Exception $e) {
            Log::error('Error updating template: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to update template'], 500);
        }
    }

    /**
     * Delete template
     */
    public function destroy($id)
    {
        try {
            $template = FollowUpTemplate::findOrFail($id);
            $template->delete();

            return response()->json(['message' => 'Template deleted successfully']);
        } catch (\Exception $e) {
            Log::error('Error deleting template: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to delete template'], 500);
        }
    }

    /**
     * Get active templates by type
     */
    public function getByType($type)
    {
        try {
            $templates = FollowUpTemplate::active()
                ->byType($type)
                ->orderBy('name')
                ->get();

            return response()->json($templates);
        } catch (\Exception $e) {
            Log::error('Error fetching templates by type: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to fetch templates'], 500);
        }
    }

    /**
     * Get all active templates
     */
    public function getActive()
    {
        try {
            $templates = FollowUpTemplate::active()
                ->orderBy('type')
                ->orderBy('name')
                ->get()
                ->groupBy('type');

            return response()->json($templates);
        } catch (\Exception $e) {
            Log::error('Error fetching active templates: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to fetch active templates'], 500);
        }
    }

    /**
     * Toggle template active status
     */
    public function toggleActive($id)
    {
        try {
            $template = FollowUpTemplate::findOrFail($id);
            $template->update(['is_active' => !$template->is_active]);

            return response()->json([
                'message' => 'Template status updated successfully',
                'template' => $template->fresh(['creator'])
            ]);
        } catch (\Exception $e) {
            Log::error('Error toggling template status: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to update template status'], 500);
        }
    }

    /**
     * Duplicate template
     */
    public function duplicate($id)
    {
        try {
            $originalTemplate = FollowUpTemplate::findOrFail($id);

            $duplicateData = $originalTemplate->toArray();
            unset($duplicateData['id'], $duplicateData['created_at'], $duplicateData['updated_at']);

            $duplicateData['name'] = $duplicateData['name'] . ' (Copy)';
            $duplicateData['created_by'] = auth() ? auth()->id() : 1;

            $newTemplate = FollowUpTemplate::create($duplicateData);

            return response()->json($newTemplate->load(['creator']), 201);
        } catch (\Exception $e) {
            Log::error('Error duplicating template: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to duplicate template'], 500);
        }
    }
}
