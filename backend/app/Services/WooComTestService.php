<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WooComTestService
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

    public function testConnection()
    {
        try {
            $response = Http::withBasicAuth($this->consumerKey, $this->consumerSecret)
                ->withoutVerifying()
                ->timeout(10) // Very short timeout for testing
                ->get($this->baseUrl . '/wp-json/wc/v3/system_status');

            if ($response->successful()) {
                return [
                    'success' => true,
                    'message' => 'Successfully connected to WordPress API'
                ];
            }

            return [
                'success' => false,
                'message' => 'Failed to connect to WordPress API',
                'status' => $response->status(),
                'body' => $response->body()
            ];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'message' => 'Connection error: ' . $e->getMessage()
            ];
        }
    }



    public function searchProducts($query, $page = 1, $perPage = 10)
    {
        try {
            $response = Http::withBasicAuth($this->consumerKey, $this->consumerSecret)
                ->withoutVerifying()
                ->timeout($this->timeout)
                ->get($this->baseUrl . '/wp-json/wc/v3/products', [
                    'search' => $query,
                    'page' => $page,
                    'per_page' => $perPage
                ]);

            if ($response->successful()) {
                return $response->json();
            }

            Log::error('WooCommerce API Error (Product Search): ' . $response->body());
            return ['error' => 'Failed to search products from WooCommerce', 'status' => $response->status()];
        } catch (\Exception $e) {
            Log::error('WooCommerce Service Exception (Product Search): ' . $e->getMessage());
            return ['error' => $e->getMessage()];
        }
    }



    public function getOrdersByPhone(string $phoneNumber): array
    {
        try {
            // Format the phone number using our helper function
            $formattedPhone = format_phone($phoneNumber);

            // Log the original and formatted phone numbers for debugging
            Log::info("Original phone: $phoneNumber, Formatted phone: $formattedPhone");

            // First, call the custom API endpoint to get order IDs only
            $response = Http::withBasicAuth($this->consumerKey, $this->consumerSecret)
                ->withoutVerifying()  // For local development
                ->timeout($this->timeout)  // Set a shorter timeout
                ->get($this->baseUrl . '/wp-json/wc-api/v1/orders', [
                    'phone' => $formattedPhone
                ]);

            if ($response->successful()) {
                $orderIds = $response->json();

                Log::info("Found " . count($orderIds) . " order IDs from WooCommerce API for search term: " . $formattedPhone);

                // If no orders found, return empty array
                if (empty($orderIds)) {
                    return [];
                }

                // Extract order IDs from the response
                $ids = array_map(function($item) {
                    return $item['id'];
                }, $orderIds);

                Log::info("Order IDs to fetch: " . implode(', ', $ids));

                // Now fetch full order data using standard WooCommerce REST API
                $fullOrders = [];
                foreach ($ids as $orderId) {
                    $orderResponse = Http::withBasicAuth($this->consumerKey, $this->consumerSecret)
                        ->withoutVerifying()
                        ->timeout($this->timeout)
                        ->get($this->baseUrl . '/wp-json/wc/v3/orders/' . $orderId);

                    if ($orderResponse->successful()) {
                        $fullOrders[] = $orderResponse->json();
                    } else {
                        Log::warning("Failed to fetch order {$orderId}: " . $orderResponse->body());
                    }
                }

                Log::info("Successfully fetched " . count($fullOrders) . " full orders");

                return $fullOrders;
            }

            Log::error('WooCommerce API Error (Orders by Phone): ' . $response->body());
            return ['error' => 'Failed to fetch orders from WooCommerce', 'status' => $response->status()];
        } catch (\Exception $e) {
            Log::error('WooCommerce Service Exception (Orders by Phone): ' . $e->getMessage());

            // More user-friendly error message
            $errorMessage = $e->getMessage();
            if (strpos($errorMessage, 'Operation timed out') !== false) {
                return [
                    'error' => 'Connection to WooCommerce timed out. Please check if your WordPress server is running and accessible.',
                    'details' => $errorMessage
                ];
            }

            return ['error' => $errorMessage];
        }
    }

    public function getCustomersByPhoneNumber($phoneNumber)
    {
        try {
            // Format the phone number using our helper function
            $formattedPhone = format_phone($phoneNumber);

            // Log the original and formatted phone numbers for debugging
            Log::info("Searching customer by phone: $phoneNumber, Formatted phone: $formattedPhone");

            // First, call the custom API endpoint to get customer IDs only
            $response = Http::withBasicAuth($this->consumerKey, $this->consumerSecret)
                ->withoutVerifying()
                ->timeout($this->timeout)
                ->get($this->baseUrl . '/wp-json/wc-api/v1/customers', [
                    'phone' => $formattedPhone
                ]);

            if ($response->successful()) {
                $customerIds = $response->json();

                Log::info("Found " . count($customerIds) . " customer IDs with phone: $formattedPhone");

                // If no customers found, return empty array
                if (empty($customerIds)) {
                    return [];
                }

                // Extract customer IDs from the response
                $ids = array_map(function($item) {
                    return $item['id'];
                }, $customerIds);

                Log::info("Customer IDs to fetch: " . implode(', ', $ids));

                // Now fetch full customer data using standard WooCommerce REST API
                $fullCustomers = [];
                foreach ($ids as $customerId) {
                    $customerResponse = Http::withBasicAuth($this->consumerKey, $this->consumerSecret)
                        ->withoutVerifying()
                        ->timeout($this->timeout)
                        ->get($this->baseUrl . '/wp-json/wc/v3/customers/' . $customerId);

                    if ($customerResponse->successful()) {
                        $fullCustomers[] = $customerResponse->json();
                    } else {
                        Log::warning("Failed to fetch customer {$customerId}: " . $customerResponse->body());
                    }
                }

                Log::info("Successfully fetched " . count($fullCustomers) . " full customers");

                if (!empty($fullCustomers)) {
                    // Log the raw customer data
                    Log::info("Customer(s) found by phone number: {$formattedPhone}", $fullCustomers);
                }

                return $fullCustomers;
            }

            Log::error('WooCommerce API Error (Phone Search): ' . $response->body());
            return ['error' => 'Failed to search customers by phone from WooCommerce', 'status' => $response->status()];
        } catch (\Exception $e) {
            Log::error('WooCommerce Service Exception (Phone Search): ' . $e->getMessage());
            return ['error' => $e->getMessage()];
        }
    }


}
