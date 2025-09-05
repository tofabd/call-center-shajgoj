<?php

namespace App\Http\Controllers;

use App\Models\Team;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\Rule;

class TeamController extends Controller
{
    /**
     * Display a listing of teams
     */
    public function index(): JsonResponse
    {
        try {
            $teams = Team::with('extensions')
                ->orderBy('name')
                ->get()
                ->map(function ($team) {
                    return [
                        'id' => $team->id,
                        'name' => $team->name,
                        'slug' => $team->slug,
                        'description' => $team->description,
                        'color' => $team->color,
                        'is_active' => $team->is_active,
                        'created_at' => $team->created_at,
                        'updated_at' => $team->updated_at,
                        'extensions_count' => $team->getTotalExtensionsCount(),
                        'online_extensions_count' => $team->getOnlineExtensionsCount(),
                        'extensions' => $team->extensions->map(function ($extension) {
                            return [
                                'id' => $extension->id,
                                'extension' => $extension->extension,
                                'agent_name' => $extension->agent_name,
                                'availability_status' => $extension->availability_status,
                                'is_active' => $extension->is_active,
                            ];
                        })
                    ];
                });

            return response()->json([
                'success' => true,
                'data' => $teams,
                'message' => 'Teams retrieved successfully'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to retrieve teams',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Store a newly created team
     */
    public function store(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'name' => 'required|string|max:100|unique:teams,name',
                'slug' => 'nullable|string|max:100|unique:teams,slug|regex:/^[a-z0-9-]+$/',
                'description' => 'nullable|string',
                'color' => 'nullable|string|regex:/^#[0-9A-Fa-f]{6}$/',
                'is_active' => 'boolean'
            ]);

            // Set defaults
            $validated['color'] = $validated['color'] ?? '#3B82F6';
            $validated['is_active'] = $validated['is_active'] ?? true;

            $team = Team::create($validated);

            // Load relationships for response
            $team->load('extensions');

            $responseData = [
                'id' => $team->id,
                'name' => $team->name,
                'slug' => $team->slug,
                'description' => $team->description,
                'color' => $team->color,
                'is_active' => $team->is_active,
                'created_at' => $team->created_at,
                'updated_at' => $team->updated_at,
                'extensions_count' => $team->getTotalExtensionsCount(),
                'online_extensions_count' => $team->getOnlineExtensionsCount(),
                'extensions' => []
            ];

            return response()->json([
                'success' => true,
                'data' => $responseData,
                'message' => 'Team created successfully'
            ], 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to create team',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Display the specified team
     */
    public function show($id): JsonResponse
    {
        try {
            $team = Team::with('extensions')->findOrFail($id);

            $responseData = [
                'id' => $team->id,
                'name' => $team->name,
                'slug' => $team->slug,
                'description' => $team->description,
                'color' => $team->color,
                'is_active' => $team->is_active,
                'created_at' => $team->created_at,
                'updated_at' => $team->updated_at,
                'extensions_count' => $team->getTotalExtensionsCount(),
                'online_extensions_count' => $team->getOnlineExtensionsCount(),
                'extensions' => $team->extensions->map(function ($extension) {
                    return [
                        'id' => $extension->id,
                        'extension' => $extension->extension,
                        'agent_name' => $extension->agent_name,
                        'availability_status' => $extension->availability_status,
                        'is_active' => $extension->is_active,
                    ];
                })
            ];

            return response()->json([
                'success' => true,
                'data' => $responseData,
                'message' => 'Team retrieved successfully'
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Team not found'
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to retrieve team',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update the specified team
     */
    public function update(Request $request, $id): JsonResponse
    {
        try {
            $team = Team::findOrFail($id);

            $validated = $request->validate([
                'name' => [
                    'sometimes',
                    'required',
                    'string',
                    'max:100',
                    Rule::unique('teams', 'name')->ignore($team->id)
                ],
                'slug' => [
                    'nullable',
                    'string',
                    'max:100',
                    'regex:/^[a-z0-9-]+$/',
                    Rule::unique('teams', 'slug')->ignore($team->id)
                ],
                'description' => 'nullable|string',
                'color' => 'nullable|string|regex:/^#[0-9A-Fa-f]{6}$/',
                'is_active' => 'boolean'
            ]);

            $team->update($validated);

            // Load relationships for response
            $team->load('extensions');

            $responseData = [
                'id' => $team->id,
                'name' => $team->name,
                'slug' => $team->slug,
                'description' => $team->description,
                'color' => $team->color,
                'is_active' => $team->is_active,
                'created_at' => $team->created_at,
                'updated_at' => $team->updated_at,
                'extensions_count' => $team->getTotalExtensionsCount(),
                'online_extensions_count' => $team->getOnlineExtensionsCount(),
                'extensions' => $team->extensions->map(function ($extension) {
                    return [
                        'id' => $extension->id,
                        'extension' => $extension->extension,
                        'agent_name' => $extension->agent_name,
                        'availability_status' => $extension->availability_status,
                        'is_active' => $extension->is_active,
                    ];
                })
            ];

            return response()->json([
                'success' => true,
                'data' => $responseData,
                'message' => 'Team updated successfully'
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Team not found'
            ], 404);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to update team',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Remove the specified team
     */
    public function destroy($id): JsonResponse
    {
        try {
            $team = Team::findOrFail($id);

            // Check if team has extensions
            $extensionsCount = $team->extensions()->count();
            if ($extensionsCount > 0) {
                return response()->json([
                    'success' => false,
                    'message' => "Cannot delete team '{$team->name}' because it has {$extensionsCount} extension(s). Please reassign or remove the extensions first."
                ], 422);
            }

            $teamName = $team->name;
            $team->delete();

            return response()->json([
                'success' => true,
                'message' => "Team '{$teamName}' deleted successfully"
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Team not found'
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete team',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Toggle team active status
     */
    public function toggleActive($id): JsonResponse
    {
        try {
            $team = Team::findOrFail($id);
            $team->is_active = !$team->is_active;
            $team->save();

            return response()->json([
                'success' => true,
                'data' => [
                    'id' => $team->id,
                    'is_active' => $team->is_active
                ],
                'message' => "Team '{$team->name}' " . ($team->is_active ? 'activated' : 'deactivated') . ' successfully'
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Team not found'
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to toggle team status',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get team statistics
     */
    public function statistics(): JsonResponse
    {
        try {
            $stats = [
                'total_teams' => Team::count(),
                'active_teams' => Team::where('is_active', true)->count(),
                'inactive_teams' => Team::where('is_active', false)->count(),
                'teams_with_extensions' => Team::has('extensions')->count(),
                'teams_without_extensions' => Team::doesntHave('extensions')->count(),
            ];

            // Get teams with most extensions
            $topTeams = Team::withCount('extensions')
                ->orderBy('extensions_count', 'desc')
                ->limit(5)
                ->get()
                ->map(function ($team) {
                    return [
                        'name' => $team->name,
                        'extensions_count' => $team->extensions_count,
                        'color' => $team->color
                    ];
                });

            return response()->json([
                'success' => true,
                'data' => [
                    'stats' => $stats,
                    'top_teams' => $topTeams
                ],
                'message' => 'Team statistics retrieved successfully'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to retrieve team statistics',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}