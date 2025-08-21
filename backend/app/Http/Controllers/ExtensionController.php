<?php

namespace App\Http\Controllers;

use App\Models\Extension;
use App\Services\ExtensionService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;

class ExtensionController extends Controller
{
    protected $extensionService;

    public function __construct(ExtensionService $extensionService)
    {
        $this->extensionService = $extensionService;
    }

    /**
     * Get all extensions with their current status
     */
    public function index(): JsonResponse
    {
        try {
            $extensions = Extension::orderBy('extension')->get();

            return response()->json([
                'success' => true,
                'data' => $extensions
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch extensions: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get extension statistics for dashboard
     */
    public function stats(): JsonResponse
    {
        try {
            $stats = $this->extensionService->getExtensionStats();
            $topAgents = $this->extensionService->getTopPerformingAgents(3);

            return response()->json([
                'success' => true,
                'data' => [
                    'stats' => $stats,
                    'top_agents' => $topAgents
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch statistics: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Create a new extension
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'extension' => 'required|string|max:10|unique:extensions,extension',
            'agent_name' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $extension = Extension::create([
                'extension' => $request->extension,
                'agent_name' => $request->agent_name,
                'status' => 'unknown',
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Extension created successfully',
                'data' => $extension
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to create extension: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update an extension
     */
    public function update(Request $request, Extension $extension): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'agent_name' => 'nullable|string|max:255',
            'status' => 'nullable|in:online,offline,unknown',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $extension->update($request->only(['agent_name', 'status']));

            return response()->json([
                'success' => true,
                'message' => 'Extension updated successfully',
                'data' => $extension
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to update extension: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Delete an extension
     */
    public function destroy(Extension $extension): JsonResponse
    {
        try {
            $extension->delete();

            return response()->json([
                'success' => true,
                'message' => 'Extension deleted successfully'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete extension: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Sync extensions from Asterisk AMI
     */
    public function sync(): JsonResponse
    {
        try {
            $synced = $this->extensionService->syncExtensions();

            return response()->json([
                'success' => true,
                'message' => 'Extensions synced successfully',
                'data' => [
                    'synced_count' => count($synced),
                    'extensions' => $synced
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to sync extensions: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update extension status
     */
    public function updateStatus(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'extension' => 'required|string',
            'status' => 'required|in:online,offline,unknown',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $success = $this->extensionService->updateExtensionStatus(
                $request->extension,
                $request->status
            );

            if ($success) {
                return response()->json([
                    'success' => true,
                    'message' => 'Extension status updated successfully'
                ]);
            } else {
                return response()->json([
                    'success' => false,
                    'message' => 'Extension not found'
                ], 404);
            }
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to update extension status: ' . $e->getMessage()
            ], 500);
        }
    }
}
