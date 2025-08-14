<?php

namespace App\Http\Controllers;

use App\Services\WooComService;
use App\Services\WooComUserService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class WooComUserController extends Controller
{

    protected $wooComUserService;
    protected $wooComService;

    public function __construct(WooComUserService $wooComUserService, WooComService $wooComService)
    {
        $this->wooComUserService = $wooComUserService;
        $this->wooComService = $wooComService;
    }


    /**
     * Get paginated customers with search functionality
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function getPaginatedUsers(Request $request)
    {
        try {
            // Get pagination parameters from request
            $page = $request->input('page', 1);
            $perPage = $request->input('per_page', 50);
            $search = $request->input('search');

            // Call service with pagination parameters
            $response = $this->wooComUserService->getPaginatedUsers($page, $perPage, $search);

            if (isset($response['error'])) {
                return response()->json(['message' => $response['error']], 500);
            }

            return response()->json($response);
        } catch (\Exception $e) {
            Log::error('Error getting paginated users: ' . $e->getMessage());
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }


    public function updateUser(Request $request, $id)
    {
        try {
            Log::info('Update user request received:', $request->all());

            $result = $this->wooComUserService->updateUser(
                $id,
                $request->input('first_name'),
                $request->input('last_name'),
                $request->input('email'),
                $request->input('phone'),
                $request->input('billing', []),
                $request->input('shipping', [])
            );

            if (isset($result['error'])) {
                Log::error('Error updating user: ' . json_encode($result));
                return response()->json(['success' => false, 'message' => $result['error']], 500);
            }

            return response()->json($result);
        } catch (\Exception $e) {
            Log::error('Error updating user: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }
    public function deleteUser($id)
    {
        try {
            $result = $this->wooComUserService->deleteUser($id);

            if (isset($result['error'])) {
                return response()->json(['success' => false, 'message' => $result['error']], 500);
            }

            return response()->json(['success' => true, 'message' => 'User deleted successfully']);
        } catch (\Exception $e) {
            Log::error('Error deleting user: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

}
