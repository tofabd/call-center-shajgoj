<?php

namespace App\Http\Controllers;

use App\Services\WooComTestService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Http;

class WooComTestController extends Controller
{
    protected $wooComTestService;

    public function __construct(WooComTestService $wooComTestService)
    {
        $this->wooComTestService = $wooComTestService;
    }

    public function testConnection()
    {
        try {
            $result = $this->wooComTestService->testConnection();
            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Connection test failed: ' . $e->getMessage()
            ], 500);
        }
    }



    public function searchProducts(Request $request)
    {
        try {
            $query = $request->input('q', '');
            $page = $request->input('page', 1);
            $perPage = $request->input('per_page', 10);

            if (empty($query)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Search query is required'
                ], 400);
            }

            $response = $this->wooComTestService->searchProducts($query, $page, $perPage);

            if (isset($response['error'])) {
                return response()->json(['message' => $response['error']], 500);
            }

            return response()->json($response);
        } catch (\Exception $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    public function getCustomersByPhoneNumber($phoneNumber)
    {
        try {


            if (empty($phoneNumber)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Phone number is required'
                ], 400);
            }

            // Use the service method that handles phone formatting and API call
            $response = $this->wooComTestService->getCustomersByPhoneNumber($phoneNumber);

            // Handle error response from service
            if (isset($response['error'])) {
                return response()->json(['error' => $response['error']], 500);
            }

            // Check if no customers found and return appropriate message
            if (empty($response)) {
                return response()->json([
                    'data' => [],
                    'message' => 'No customer found for this phone number',
                    'success' => true
                ]);
            }

            // Return the customer data with success message
            return response()->json([
                'data' => $response,
                'message' => 'Customer found successfully',
                'success' => true
            ]);
        } catch (\Exception $e) {
            Log::error('Error searching users by phone: ' . $e->getMessage());
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

      /**
     * Check if a phone number exists in WooCommerce
     *
     * @param string $phoneNumber The phone number to check
     * @return \Illuminate\Http\JsonResponse
     */
    public function checkPhoneExists($phoneNumber)
    {
        try {
            // Use the direct customer lookup method
            $customerData = $this->wooComTestService->getCustomersByPhoneNumber($phoneNumber);

            if (isset($customerData['error'])) {
                // Customer not found, phone is available
                return response()->json([
                    'exists' => false,
                    'message' => 'Phone number is available',
                    'count' => 0
                ]);
            }

            // If multiple customers have this phone number, get all of them
            if (isset($customerData['count']) && $customerData['count'] > 1) {


                // Return all customers along with the count
                return response()->json([
                    'exists' => true,
                    'message' => $customerData['count'] . ' customers with this phone number found',
                    'count' => $customerData['count'],
                    'customers' => $customerData
                ]);
            }

            // Single customer found, show information about existing customer
            return response()->json([
                'exists' => true,
                'message' => 'A customer with this phone number already exists',
                'count' => isset($customerData['count']) ? $customerData['count'] : 1,
                'customer' => [
                    'id' => $customerData['id'] ?? 0,
                    'first_name' => $customerData['first_name'] ?? '',
                    'last_name' => $customerData['last_name'] ?? '',
                    'email' => $customerData['email'] ?? '',
                    'phone' => $customerData['billing']['phone'] ?? ''
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Error checking phone number: ' . $e->getMessage());
            return response()->json([
                'error' => 'Failed to check phone number',
                'message' => $e->getMessage()
            ], 500);
        }
    }




    /**
     * Get orders by phone number
     *
     * @param string $phoneNumber The phone number to search for
     * @return \Illuminate\Http\JsonResponse
     */
    public function getOrdersByPhoneNumber($phoneNumber)
    {
        try {
            Log::info('Getting orders for phone number: ' . $phoneNumber);

            // Get orders from WooCommerce service using the search parameter
            // Let the service handle all phone number formatting
            $rawOrders = $this->wooComTestService->getOrdersByPhone($phoneNumber);

            if (isset($rawOrders['error'])) {
                Log::error('WooCommerce API Error: ' . json_encode($rawOrders));
                return response()->json(['error' => $rawOrders['error']], 500);
            }

            Log::info('Found ' . count($rawOrders) . ' orders from WooCommerce API for phone: ' . $phoneNumber);

            // Check if no orders found and return appropriate message
            if (empty($rawOrders)) {
                return response()->json([
                    'data' => [],
                    'message' => 'No orders found for this phone number',
                    'success' => true
                ]);
            }

            // Return the orders data with success message
            return response()->json([
                'data' => $rawOrders,
                'message' => 'Orders found successfully',
                'success' => true
            ]);

        } catch (\Exception $e) {
            Log::error('Error fetching WooCommerce orders: ' . $e->getMessage());
            return response()->json([], 500);
        }
    }
}
