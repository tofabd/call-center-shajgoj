<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WooComUserService
{
    protected $baseUrl;
    protected $consumerKey;
    protected $consumerSecret;
    protected $timeout = 15; // Default timeout in seconds

    public function __construct()
    {
        $this->baseUrl = config('services.woocommerce.base_url');
        $this->consumerKey = config('services.woocommerce.consumer_key');
        $this->consumerSecret = config('services.woocommerce.consumer_secret');
    }



    /**
     * Get paginated customers with search functionality
     *
     * @param int $page Page number
     * @param int $perPage Items per page
     * @param string|null $search Search term
     * @return array Paginated customers or error details
     */
    public function getPaginatedUsers($page = 1, $perPage = 50, $search = null)
    {
        try {
            Log::info('Fetching paginated customers', [
                'page' => $page,
                'per_page' => $perPage,
                'search' => $search
            ]);

            $params = [
                'page' => $page,
                'per_page' => $perPage,
                'orderby' => 'registered_date',
                'order' => 'desc'
            ];

            // Add search parameter if provided
            if ($search) {
                $params['search'] = $search;
            }

            $response = Http::withBasicAuth($this->consumerKey, $this->consumerSecret)
                ->withoutVerifying()
                ->timeout($this->timeout)
                ->get($this->baseUrl . '/wp-json/wc/v3/customers', $params);

            if ($response->successful()) {
                // Get total customers from headers
                $totalCustomers = $response->header('X-WP-Total') ? (int)$response->header('X-WP-Total') : 0;
                $totalPages = $response->header('X-WP-TotalPages') ? (int)$response->header('X-WP-TotalPages') : 0;

                // Calculate pagination metadata
                $from = ($page - 1) * $perPage + 1;
                $to = min($from + $perPage - 1, $totalCustomers);

                // Format response with pagination metadata
                return [
                    'customers' => $response->json(),
                    'pagination' => [
                        'total' => $totalCustomers,
                        'total_pages' => $totalPages,
                        'current_page' => (int)$page,
                        'per_page' => (int)$perPage
                    ]
                ];
            }

            Log::error('WooCommerce API Error (Paginated Users): ' . $response->body());
            return ['error' => 'Failed to fetch users from WooCommerce', 'status' => $response->status()];
        } catch (\Exception $e) {
            Log::error('WooCommerce Service Exception (Paginated Users): ' . $e->getMessage());
            return ['error' => $e->getMessage()];
        }
    }

    public function updateUser($customerId, $firstName, $lastName, $email, $phone, array $billingAddress = [], array $shippingAddress = [])
    {
        try {
            // Format the phone number using our helper function
            $formattedPhone = format_phone($phone);

            // Build the billing data - use separate billing names if provided
            $billing = [
                'first_name' => $billingAddress['first_name'] ?? $firstName,
                'last_name' => $billingAddress['last_name'] ?? $lastName,
                'email' => $billingAddress['email'] ?? $email,
                'phone' => $formattedPhone
            ];

            // Add address fields if provided
            if (!empty($billingAddress)) {
                $billing['address_1'] = $billingAddress['address_1'] ?? '';
                $billing['address_2'] = $billingAddress['address_2'] ?? '';
                $billing['city'] = $billingAddress['city'] ?? '';
                $billing['state'] = $billingAddress['state'] ?? '';
                $billing['postcode'] = $billingAddress['postcode'] ?? '';
                $billing['country'] = $billingAddress['country'] ?? 'BD';
            }

            // Build shipping data - use separate shipping names if provided
            $useShippingAddress = !empty($shippingAddress);
            $shipping = [
                'first_name' => $shippingAddress['first_name'] ?? $firstName,
                'last_name' => $shippingAddress['last_name'] ?? $lastName
            ];

            if ($useShippingAddress) {
                $shipping['address_1'] = $shippingAddress['address_1'] ?? '';
                $shipping['address_2'] = $shippingAddress['address_2'] ?? '';
                $shipping['city'] = $shippingAddress['city'] ?? '';
                $shipping['state'] = $shippingAddress['state'] ?? '';
                $shipping['postcode'] = $shippingAddress['postcode'] ?? '';
                $shipping['country'] = $shippingAddress['country'] ?? 'BD';
            } else if (!empty($billingAddress)) {
                $shipping['address_1'] = $billingAddress['address_1'] ?? '';
                $shipping['address_2'] = $billingAddress['address_2'] ?? '';
                $shipping['city'] = $billingAddress['city'] ?? '';
                $shipping['state'] = $billingAddress['state'] ?? '';
                $shipping['postcode'] = $billingAddress['postcode'] ?? '';
                $shipping['country'] = $billingAddress['country'] ?? 'BD';
            }

            // Prepare data for WooCommerce API
            $data = [
                'first_name' => $firstName,
                'last_name' => $lastName,
                'email' => $email,
                'billing' => $billing,
                'shipping' => $shipping
            ];

            Log::info('Updating WooCommerce customer:', [
                'customer_id' => $customerId,
                'data' => array_merge($data, ['email' => '****@****.com', 'phone' => '****']) // Mask sensitive data in logs
            ]);

            // Make PUT request to WooCommerce API
            $response = Http::withBasicAuth($this->consumerKey, $this->consumerSecret)
                ->withoutVerifying()
                ->timeout($this->timeout)
                ->put($this->baseUrl . '/wp-json/wc/v3/customers/' . $customerId, $data);

            if ($response->successful()) {
                Log::info('WooCommerce customer updated successfully', [
                    'customer_id' => $customerId
                ]);

                $customer = $response->json();

                // Format the response for frontend
                $formattedCustomer = [
                    'id' => (int) $customer['id'],
                    'username' => $customer['username'] ?? '',
                    'first_name' => $customer['first_name'],
                    'last_name' => $customer['last_name'],
                    'email' => $customer['email'],
                    'phone' => $customer['billing']['phone'] ?? $formattedPhone,
                    'role' => $customer['role'] ?? 'customer',
                    'billing' => $customer['billing'] ?? null,
                    'shipping' => $customer['shipping'] ?? null
                ];

                return $formattedCustomer;
            }

            // Handle error response
            Log::error('WooCommerce API Error (Update User):', [
                'status' => $response->status(),
                'body' => $response->body()
            ]);

            $errorData = $response->json();
            $errorMessage = isset($errorData['message'])
                ? 'WooCommerce API error: ' . $errorData['message']
                : 'Failed to update customer in WooCommerce';

            return [
                'error' => $errorMessage,
                'status' => $response->status(),
                'details' => $errorData
            ];
        } catch (\Exception $e) {
            Log::error('WooCommerce customer update failed', [
                'error' => $e->getMessage(),
                'customer_id' => $customerId
            ]);
            return ['error' => $e->getMessage()];
        }
    }
    public function deleteUser($id)
    {
        try {
            $response = Http::withBasicAuth($this->consumerKey, $this->consumerSecret)
                ->withoutVerifying()
                ->timeout($this->timeout)
                ->delete($this->baseUrl . '/wp-json/wc/v3/customers/' . $id, [
                    'force' => true // Permanently delete the customer
                ]);

            if ($response->successful()) {
                Log::info("User with ID {$id} has been deleted successfully");
                return $response->json();
            }

            Log::error('WooCommerce API Error (Delete User): ' . $response->body());
            return ['error' => 'Failed to delete user from WooCommerce', 'status' => $response->status()];
        } catch (\Exception $e) {
            Log::error('WooCommerce Service Exception (Delete User): ' . $e->getMessage());
            return ['error' => $e->getMessage()];
        }
    }



}
