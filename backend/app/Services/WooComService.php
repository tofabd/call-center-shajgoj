<?php

namespace App\Services;

use Automattic\WooCommerce\Client;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WooComService
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
     * Get orders by phone number using the custom endpoint
     *
     * @param string $phoneNumber The phone number to search for
     * @return array The orders data or error message
     */
    public function getOrdersByPhoneNumber(string $phoneNumber): array
    {
        try {
            // Format the phone number using our helper function
            $formattedPhone = format_phone($phoneNumber);

            // Log the original and formatted phone numbers for debugging
            Log::info("Searching orders by phone: $phoneNumber, Formatted phone: $formattedPhone");

            // First, call the custom API endpoint to get order IDs only
            $response = Http::withBasicAuth($this->consumerKey, $this->consumerSecret)
                ->withoutVerifying()
                ->timeout($this->timeout)
                ->get($this->baseUrl . '/wp-json/wc-api/v1/orders', [
                    'phone' => $formattedPhone
                ]);

            if ($response->successful()) {
                $orderIds = $response->json();

                Log::info("Found " . count($orderIds) . " order IDs with phone: $formattedPhone");

                // If no orders found, return empty array
                if (empty($orderIds)) {
                    return [];
                }

                // Extract order IDs from the response
                $ids = array_map(function($item) {
                    return $item['id'];
                }, $orderIds);

                Log::info("Order IDs to fetch: " . implode(', ', $ids));

                // Fetch all orders in a single call using 'include' and set per_page high
                $ordersResponse = Http::withBasicAuth($this->consumerKey, $this->consumerSecret)
                    ->withoutVerifying()
                    ->timeout($this->timeout)
                    ->get($this->baseUrl . '/wp-json/wc/v3/orders', [
                        'include' => implode(',', $ids),
                        'per_page' => 100 // Set high to avoid pagination
                    ]);

                if ($ordersResponse->successful()) {
                    $fullOrders = $ordersResponse->json();
                    Log::info("Successfully fetched " . count($fullOrders) . " full orders in one call");
                    if (!empty($fullOrders)) {
                        $sampleOrder = $fullOrders[0];
                        Log::info("Sample order: ID {$sampleOrder['id']}, Status: {$sampleOrder['status']}, Total: {$sampleOrder['total']}");
                    }
                    return $fullOrders;
                } else {
                    Log::error('WooCommerce API Error (Bulk Order Fetch): ' . $ordersResponse->body());
                    return ['error' => 'Failed to fetch orders by IDs from WooCommerce', 'status' => $ordersResponse->status()];
                }
            }

            Log::error('WooCommerce API Error (Phone Search): ' . $response->body());
            return ['error' => 'Failed to search orders by phone from WooCommerce', 'status' => $response->status()];

        } catch (\Exception $e) {
            Log::error('WooCommerce Service Exception (Phone Search): ' . $e->getMessage());
            return ['error' => $e->getMessage()];
        }
    }

    public function updateOrder($orderId, $status, $total, array $lineItems = [], $shipping = null, $billing = null)
    {
        try {
            $data = [
                'status' => $status,
            ];

            // Add total if provided
            if ($total !== null) {
                $data['total'] = (string)$total;
            }

            // Add shipping info if provided
            if ($shipping) {
                // Format shipping data to ensure all fields are strings
                $formattedShipping = [
                    'first_name' => (string)($shipping['first_name'] ?? ''),
                    'last_name' => (string)($shipping['last_name'] ?? ''),
                    'address_1' => (string)($shipping['address_1'] ?? ''),
                    'address_2' => (string)($shipping['address_2'] ?? ''),
                    'city' => (string)($shipping['city'] ?? ''),
                    'state' => (string)($shipping['state'] ?? ''),
                    'postcode' => (string)($shipping['postcode'] ?? ''),
                    'country' => (string)($shipping['country'] ?? '')
                ];
                $data['shipping'] = $formattedShipping;
            }

            // Add billing info if provided
            if ($billing) {
                // Format billing data to ensure all fields are strings
                $formattedBilling = [
                    'first_name' => (string)($billing['first_name'] ?? ''),
                    'last_name' => (string)($billing['last_name'] ?? ''),
                    'email' => (string)($billing['email'] ?? ''),
                    'phone' => (string)($billing['phone'] ?? ''),
                    'address_1' => (string)($billing['address_1'] ?? ''),
                    'address_2' => (string)($billing['address_2'] ?? ''),
                    'city' => (string)($billing['city'] ?? ''),
                    'state' => (string)($billing['state'] ?? ''),
                    'postcode' => (string)($billing['postcode'] ?? ''),
                    'country' => (string)($billing['country'] ?? '')
                ];
                $data['billing'] = $formattedBilling;
            }

            if (!empty($lineItems)) {
                $formattedLineItems = [];
                foreach ($lineItems as $item) {
                    // Handle existing line items (with id)
                    if (isset($item['id']) && $item['id']) {
                        $formattedLineItems[] = [
                            'id' => (int)$item['id'],
                            'quantity' => (int)$item['quantity'],
                            'total' => (string)$item['total'],
                        ];
                    }
                    // Handle newly added products (without id but with product_id)
                    else if (isset($item['product_id']) && $item['product_id']) {
                        $formattedLineItems[] = [
                            'product_id' => (int)$item['product_id'],
                            'quantity' => (int)$item['quantity'],
                        ];
                    }
                }

                // Get all existing line items from WooCommerce
                $response = Http::withBasicAuth($this->consumerKey, $this->consumerSecret)
                    ->withoutVerifying()
                    ->timeout($this->timeout)
                    ->get($this->baseUrl . '/wp-json/wc/v3/orders/' . $orderId);

                if ($response->successful()) {
                    $existingOrder = $response->json();
                    $existingLineItems = $existingOrder['line_items'] ?? [];

                    // Find line items that were deleted (exist in WooCommerce but not in our update)
                    foreach ($existingLineItems as $existingItem) {
                        $existsInUpdate = false;
                        foreach ($formattedLineItems as $updateItem) {
                            if (isset($updateItem['id']) && $updateItem['id'] === $existingItem['id']) {
                                $existsInUpdate = true;
                                break;
                            }
                        }
                        if (!$existsInUpdate) {
                            // Add deleted item with quantity 0 to remove it
                            $formattedLineItems[] = [
                                'id' => (int)$existingItem['id'],
                                'quantity' => 0,
                                'total' => '0.00'
                            ];
                        }
                    }
                }

                $data['line_items'] = $formattedLineItems;
            }

            Log::info('Updating WooCommerce order:', [
                'orderId' => $orderId,
                'data' => $data
            ]);

            // Update order
            $response = Http::withBasicAuth($this->consumerKey, $this->consumerSecret)
                ->withoutVerifying()
                ->timeout($this->timeout)
                ->put($this->baseUrl . '/wp-json/wc/v3/orders/' . $orderId, $data);

            if ($response->successful()) {
                Log::info('WooCommerce order updated successfully', [
                    'response' => $response->json()
                ]);
                return $response->json();
            }

            Log::error('WooCommerce API Error:', [
                'status' => $response->status(),
                'body' => $response->body()
            ]);

            return [
                'error' => 'Failed to update order in WooCommerce',
                'status' => $response->status()
            ];
        } catch (\Exception $e) {
            Log::error('WooCommerce order update failed', [
                'error' => $e->getMessage(),
                'orderId' => $orderId
            ]);
            return ['error' => $e->getMessage()];
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

    /**
     * Get paginated orders with optional filtering
     *
     * @param int $page The page number to fetch
     * @param int $perPage Number of orders per page
     * @return array The orders data with pagination info or error message
     */
    public function getPaginatedOrders($page = 1, $perPage = 50)
    {
        try {
            Log::info("Fetching paginated orders: page {$page}, perPage {$perPage}");

            $response = Http::withBasicAuth($this->consumerKey, $this->consumerSecret)
                ->withoutVerifying()  // For local development
                ->timeout($this->timeout)
                ->get($this->baseUrl . '/wp-json/wc/v3/orders', [
                    'page' => $page,
                    'per_page' => $perPage
                ]);

            if ($response->successful()) {
                $orders = $response->json();

                // Get total from headers
                $totalOrders = $response->header('X-WP-Total') ? (int)$response->header('X-WP-Total') : count($orders);
                $totalPages = $response->header('X-WP-TotalPages') ? (int)$response->header('X-WP-TotalPages') : 1;

                // Calculate statistics for these orders
                $totalRevenue = array_reduce($orders, function($carry, $order) {
                    return $carry + floatval($order['total']);
                }, 0);

                $completedOrders = array_filter($orders, function($order) {
                    return $order['status'] === 'completed';
                });

                $processingOrders = array_filter($orders, function($order) {
                    return $order['status'] === 'processing';
                });

                $onHoldOrders = array_filter($orders, function($order) {
                    return $order['status'] === 'on-hold';
                });

                $cancelledOrders = array_filter($orders, function($order) {
                    return $order['status'] === 'cancelled';
                });

                Log::info("Fetched {$totalOrders} orders across {$totalPages} pages");

                return [
                    'orders' => $orders,
                    'pagination' => [
                        'total' => $totalOrders,
                        'total_pages' => $totalPages,
                        'current_page' => $page,
                        'per_page' => $perPage
                    ],
                    'stats' => [
                        'total_count' => $totalOrders,
                        'total_revenue' => $totalRevenue,
                        'completed_count' => count($completedOrders),
                        'processing_count' => count($processingOrders),
                        'on_hold_count' => count($onHoldOrders),
                        'cancelled_count' => count($cancelledOrders)
                    ]
                ];
            }

            Log::error('WooCommerce API Error (Paginated Orders): ' . $response->body());
            return ['error' => 'Failed to fetch orders from WooCommerce', 'status' => $response->status()];
        } catch (\Exception $e) {
            Log::error('WooCommerce Service Exception (Paginated Orders): ' . $e->getMessage());
            return ['error' => $e->getMessage()];
        }
    }



    /**
     * Get customers by phone number using the custom endpoint
     *
     * @param string $phoneNumber The phone number to search for
     * @return array The customers data or error message
     */
    public function getCustomersByPhoneNumber(string $phoneNumber): array
    {
        try {
            // Format the phone number using our helper function
            $formattedPhone = format_phone($phoneNumber);

            // Log the original and formatted phone numbers for debugging
            Log::info("Searching customers by phone: $phoneNumber, Formatted phone: $formattedPhone");

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

                // Fetch all customers in a single call using 'include' and set per_page high
                $customersResponse = Http::withBasicAuth($this->consumerKey, $this->consumerSecret)
                    ->withoutVerifying()
                    ->timeout($this->timeout)
                    ->get($this->baseUrl . '/wp-json/wc/v3/customers', [
                        'include' => implode(',', $ids),
                        'per_page' => 100 // Set high to avoid pagination
                    ]);

                if ($customersResponse->successful()) {
                    $fullCustomers = $customersResponse->json();
                    Log::info("Successfully fetched " . count($fullCustomers) . " full customers in one call");
                    if (!empty($fullCustomers)) {
                        $sampleCustomer = $fullCustomers[0];
                        Log::info("Sample customer: ID {$sampleCustomer['id']}, Name: {$sampleCustomer['first_name']} {$sampleCustomer['last_name']}, Email: {$sampleCustomer['email']}");
                    }
                    return $fullCustomers;
                } else {
                    Log::error('WooCommerce API Error (Bulk Customer Fetch): ' . $customersResponse->body());
                    return ['error' => 'Failed to fetch customers by IDs from WooCommerce', 'status' => $customersResponse->status()];
                }
            }

            Log::error('WooCommerce API Error (Phone Search): ' . $response->body());
            return ['error' => 'Failed to search customers by phone from WooCommerce', 'status' => $response->status()];

        } catch (\Exception $e) {
            Log::error('WooCommerce Service Exception (Phone Search): ' . $e->getMessage());
            return ['error' => $e->getMessage()];
        }
    }

    /**
     * Creates a new customer in WooCommerce
     *
     * @param string $username The customer's username
     * @param string $firstName The customer's first name
     * @param string $lastName The customer's last name
     * @param string $email The customer's email address
     * @param string $phone The customer's phone number
     * @param array $address The customer's address information
     * @return array The created customer or error details
     */
    public function createCustomer($username, $firstName, $lastName, $email, $phone, array $billingAddress = [], array $shippingAddress = [], bool $sameAsBilling = true)
    {
        try {
            // Format the phone number using our helper function
            $formattedPhone = format_phone($phone);

            // Ensure all billing address fields are strings
            $formattedBillingAddress = [
                'first_name' => (string)($billingAddress['first_name'] ?? $firstName),
                'last_name' => (string)($billingAddress['last_name'] ?? $lastName),
                'address_1' => (string)($billingAddress['address_1'] ?? ''),
                'address_2' => (string)($billingAddress['address_2'] ?? ''),
                'city' => (string)($billingAddress['city'] ?? ''),
                'state' => (string)($billingAddress['state'] ?? ''),
                'postcode' => (string)($billingAddress['postcode'] ?? ''),
                'country' => (string)($billingAddress['country'] ?? 'BD')
            ];

            // Format shipping address (use billing as fallback if same_as_billing is true)
            $formattedShippingAddress = $sameAsBilling ? $formattedBillingAddress : [
                'first_name' => (string)($shippingAddress['first_name'] ?? $firstName),
                'last_name' => (string)($shippingAddress['last_name'] ?? $lastName),
                'address_1' => (string)($shippingAddress['address_1'] ?? ''),
                'address_2' => (string)($shippingAddress['address_2'] ?? ''),
                'city' => (string)($shippingAddress['city'] ?? ''),
                'state' => (string)($shippingAddress['state'] ?? ''),
                'postcode' => (string)($shippingAddress['postcode'] ?? ''),
                'country' => (string)($shippingAddress['country'] ?? 'BD')
            ];

            $data = [
                'username' => $username,
                'email' => $email,
                'first_name' => $firstName,
                'last_name' => $lastName,
                'billing' => [
                    'first_name' => $formattedBillingAddress['first_name'],
                    'last_name' => $formattedBillingAddress['last_name'],
                    'email' => $email,
                    'phone' => $formattedPhone,
                    'address_1' => $formattedBillingAddress['address_1'],
                    'address_2' => $formattedBillingAddress['address_2'],
                    'city' => $formattedBillingAddress['city'],
                    'state' => $formattedBillingAddress['state'],
                    'postcode' => $formattedBillingAddress['postcode'],
                    'country' => $formattedBillingAddress['country']
                ],
                'shipping' => [
                    'first_name' => $formattedShippingAddress['first_name'],
                    'last_name' => $formattedShippingAddress['last_name'],
                    'address_1' => $formattedShippingAddress['address_1'],
                    'address_2' => $formattedShippingAddress['address_2'],
                    'city' => $formattedShippingAddress['city'],
                    'state' => $formattedShippingAddress['state'],
                    'postcode' => $formattedShippingAddress['postcode'],
                    'country' => $formattedShippingAddress['country']
                ]
            ];

            Log::info('Creating new WooCommerce customer:', [
                'same_as_billing' => $sameAsBilling,
                'billing_address' => $formattedBillingAddress,
                'shipping_address' => $formattedShippingAddress,
                'data' => array_merge($data, ['email' => '****@****.com', 'phone' => '****']) // Log with masked sensitive data
            ]);

            // Create customer via WooCommerce API
            $response = Http::withBasicAuth($this->consumerKey, $this->consumerSecret)
                ->withoutVerifying()
                ->timeout($this->timeout)
                ->post($this->baseUrl . '/wp-json/wc/v3/customers', $data);

            if ($response->successful()) {
                Log::info('WooCommerce customer created successfully');

                $customer = $response->json();

                // Format the response to match our expected structure for frontend
                $formattedCustomer = [
                    'id' => (int) $customer['id'],
                    'username' => $customer['username'] ?? $username,
                    'first_name' => $customer['first_name'],
                    'last_name' => $customer['last_name'],
                    'email' => $customer['email'],
                    'phone' => $customer['billing']['phone'] ?? $formattedPhone,
                    'total_orders' => 0,
                    'total_spent' => '0.00',
                    'last_order_date' => null
                ];

                return $formattedCustomer;
            }

            Log::error('WooCommerce API Error (Create Customer):', [
                'status' => $response->status(),
                'body' => $response->body()
            ]);

            $errorData = $response->json();
            $errorMessage = 'Failed to create customer in WooCommerce';
            $errorDetails = [];

            if (isset($errorData['message'])) {
                $errorMessage = $errorData['message'];
            }

            // Handle specific WooCommerce error codes
            if (isset($errorData['code'])) {
                switch ($errorData['code']) {
                    case 'registration-error-username-exists':
                        $errorDetails['username'] = 'This username is already taken. Please choose another.';
                        break;
                    case 'registration-error-email-exists':
                        $errorDetails['email'] = 'This email is already registered. Please use a different email.';
                        break;
                    case 'registration-error-invalid-email':
                        $errorDetails['email'] = 'Please enter a valid email address.';
                        break;
                    case 'registration-error-invalid-username':
                        $errorDetails['username'] = 'Please enter a valid username.';
                        break;
                    case 'registration-error-invalid-phone':
                        $errorDetails['phone'] = 'Please enter a valid phone number.';
                        break;
                    default:
                        $errorDetails['general'] = $errorMessage;
                }
            }

            return [
                'error' => $errorMessage,
                'status' => $response->status(),
                'details' => $errorDetails,
                'raw_error' => $errorData
            ];
        } catch (\Exception $e) {
            Log::error('WooCommerce customer creation failed', [
                'error' => $e->getMessage()
            ]);
            return [
                'error' => 'Failed to create customer: ' . $e->getMessage(),
                'details' => [
                    'general' => 'An unexpected error occurred while creating the customer'
                ]
            ];
        }
    }

    /**
     * Updates an existing customer in WooCommerce
     *
     * @param int $customerId The customer ID to update
     * @param string $firstName The customer's first name
     * @param string $lastName The customer's last name
     * @param string $email The customer's email address
     * @param string $phone The customer's phone number
     * @param array $billingAddress The customer's billing address information
     * @param array $shippingAddress The customer's shipping address information
     * @return array The updated customer or error details
     */
    public function updateCustomer($customerId, $firstName, $lastName, $email, $phone, array $billingAddress = [], array $shippingAddress = [])
    {
        try {
            // Format the phone number using our helper function
            $formattedPhone = format_phone($phone);

            // Ensure all billing address fields are strings
            $formattedBillingAddress = [
                'first_name' => (string)($billingAddress['first_name'] ?? ''),
                'last_name' => (string)($billingAddress['last_name'] ?? ''),
                'email' => (string)($billingAddress['email'] ?? $email),
                'address_1' => (string)($billingAddress['address_1'] ?? ''),
                'address_2' => (string)($billingAddress['address_2'] ?? ''),
                'city' => (string)($billingAddress['city'] ?? ''),
                'state' => (string)($billingAddress['state'] ?? ''),
                'postcode' => (string)($billingAddress['postcode'] ?? ''),
                'country' => (string)($billingAddress['country'] ?? 'BD')
            ];

            // Ensure all shipping address fields are strings - no fallback to billing
            $formattedShippingAddress = [
                'first_name' => (string)($shippingAddress['first_name'] ?? ''),
                'last_name' => (string)($shippingAddress['last_name'] ?? ''),
                'address_1' => (string)($shippingAddress['address_1'] ?? ''),
                'address_2' => (string)($shippingAddress['address_2'] ?? ''),
                'city' => (string)($shippingAddress['city'] ?? ''),
                'state' => (string)($shippingAddress['state'] ?? ''),
                'postcode' => (string)($shippingAddress['postcode'] ?? ''),
                'country' => (string)($shippingAddress['country'] ?? 'BD')
            ];

            $data = [
                'first_name' => $firstName,
                'last_name' => $lastName,
                'email' => $email,
                'billing' => [
                    'first_name' => $formattedBillingAddress['first_name'],
                    'last_name' => $formattedBillingAddress['last_name'],
                    'email' => $formattedBillingAddress['email'],
                    'phone' => $formattedPhone,
                    'address_1' => $formattedBillingAddress['address_1'],
                    'address_2' => $formattedBillingAddress['address_2'],
                    'city' => $formattedBillingAddress['city'],
                    'state' => $formattedBillingAddress['state'],
                    'postcode' => $formattedBillingAddress['postcode'],
                    'country' => $formattedBillingAddress['country']
                ],
                'shipping' => [
                    'first_name' => $formattedShippingAddress['first_name'],
                    'last_name' => $formattedShippingAddress['last_name'],
                    'address_1' => $formattedShippingAddress['address_1'],
                    'address_2' => $formattedShippingAddress['address_2'],
                    'city' => $formattedShippingAddress['city'],
                    'state' => $formattedShippingAddress['state'],
                    'postcode' => $formattedShippingAddress['postcode'],
                    'country' => $formattedShippingAddress['country']
                ]
            ];

            Log::info('Updating WooCommerce customer:', [
                'customer_id' => $customerId,
                'data' => array_merge($data, ['email' => '****@****.com', 'phone' => '****']) // Log with masked sensitive data
            ]);

            // Update customer via WooCommerce API
            $response = Http::withBasicAuth($this->consumerKey, $this->consumerSecret)
                ->withoutVerifying()
                ->timeout($this->timeout)
                ->put($this->baseUrl . '/wp-json/wc/v3/customers/' . $customerId, $data);

            if ($response->successful()) {
                Log::info('WooCommerce customer updated successfully', [
                    'customer_id' => $customerId
                ]);

                $customer = $response->json();

                // Format the response to match our expected structure for frontend
                $formattedCustomer = [
                    'id' => (int) $customer['id'],
                    'username' => $customer['username'] ?? '',
                    'first_name' => $customer['first_name'],
                    'last_name' => $customer['last_name'],
                    'email' => $customer['email'],
                    'phone' => $customer['billing']['phone'] ?? $formattedPhone,
                    'total_orders' => $customer['orders_count'] ?? 0,
                    'total_spent' => $customer['total_spent'] ?? '0.00',
                    'last_order_date' => null,
                    'billing' => $customer['billing'] ?? null,
                    'shipping' => $customer['shipping'] ?? null
                ];

                return $formattedCustomer;
            }

            Log::error('WooCommerce API Error (Update Customer):', [
                'status' => $response->status(),
                'body' => $response->body()
            ]);

            $errorData = $response->json();
            $errorMessage = isset($errorData['message']) ? 'WooCommerce API error: ' . $errorData['message'] : 'Failed to update customer in WooCommerce';

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

    /**
     * Create a new order in WooCommerce
     *
     * @param array $orderData The order data
     * @return array The created order data or error message
     */
    public function createOrder(array $orderData): array
    {
        try {
            Log::info('Creating WooCommerce order', ['order_data' => $orderData]);

            $response = Http::withBasicAuth($this->consumerKey, $this->consumerSecret)
                ->withoutVerifying()
                ->timeout($this->timeout)
                ->post($this->baseUrl . '/wp-json/wc/v3/orders', $orderData);

            if ($response->successful()) {
                $order = $response->json();
                Log::info('WooCommerce order created successfully', ['order_id' => $order['id'] ?? 'unknown']);
                return $order;
            } else {
                $errorData = $response->json();
                $errorMessage = $errorData['message'] ?? 'Unknown error occurred';
                Log::error('WooCommerce order creation failed', [
                    'status' => $response->status(),
                    'error' => $errorMessage,
                    'response' => $errorData
                ]);
                return ['error' => $errorMessage];
            }
        } catch (\Exception $e) {
            Log::error('WooCommerce order creation failed', [
                'error' => $e->getMessage(),
                'order_data' => $orderData
            ]);
            return ['error' => $e->getMessage()];
        }
    }

    /**
     * Get order notes for a specific order from WooCommerce
     *
     * @param int $orderId
     * @return array
     */
    public function getOrderNotes($orderId)
    {
        try {
            $response = Http::withBasicAuth($this->consumerKey, $this->consumerSecret)
                ->withoutVerifying()
                ->timeout($this->timeout)
                ->get($this->baseUrl . "/wp-json/wc/v3/orders/{$orderId}/notes");

            if ($response->successful()) {
                return $response->json();
            }

            Log::error('WooCommerce API Error (Order Notes): ' . $response->body());
            return ['error' => 'Failed to fetch order notes from WooCommerce', 'status' => $response->status()];
        } catch (\Exception $e) {
            Log::error('WooCommerce Service Exception (Order Notes): ' . $e->getMessage());
            return ['error' => $e->getMessage()];
        }
    }

    /**
     * Add a note to a WooCommerce order
     *
     * @param int $orderId
     * @param string $note
     * @param bool $customerNote
     * @param string|null $addedByUser
     * @return array
     */
    public function addOrderNote($orderId, $note, $customerNote = false, $addedByUser = null)
    {
        try {
            $payload = [
                'note' => $note,
                'customer_note' => (bool)$customerNote,
            ];
            if ($addedByUser) {
                $payload['added_by_user'] = $addedByUser;
            }
            $response = Http::withBasicAuth($this->consumerKey, $this->consumerSecret)
                ->withoutVerifying()
                ->timeout($this->timeout)
                ->post($this->baseUrl . "/wp-json/wc/v3/orders/{$orderId}/notes", $payload);
            if ($response->successful()) {
                return $response->json();
            }
            Log::error('WooCommerce API Error (Add Order Note): ' . $response->body());
            return ['error' => 'Failed to add order note in WooCommerce', 'status' => $response->status()];
        } catch (\Exception $e) {
            Log::error('WooCommerce Service Exception (Add Order Note): ' . $e->getMessage());
            return ['error' => $e->getMessage()];
        }
    }

    /**
     * Get available payment methods from WooCommerce
     *
     * @return array
     */
    public function getPaymentMethods(): array
    {
        try {
            $response = Http::withBasicAuth($this->consumerKey, $this->consumerSecret)
                ->withoutVerifying()
                ->timeout($this->timeout)
                ->get($this->baseUrl . '/wp-json/wc/v3/payment_gateways');

            if ($response->successful()) {
                return [
                    'success' => true,
                    'data' => $response->json()
                ];
            }

            Log::error('WooCommerce API Error (Payment Methods): ' . $response->body());
            return [
                'success' => false,
                'message' => 'Failed to fetch payment methods from WooCommerce',
                'status' => $response->status()
            ];
        } catch (\Exception $e) {
            Log::error('WooCommerce Service Exception (Payment Methods): ' . $e->getMessage());
            return [
                'success' => false,
                'message' => $e->getMessage()
            ];
        }
    }

    /**
     * Get available shipping methods from WooCommerce
     *
     * @return array
     */
    public function getShippingMethods(): array
    {
        try {
            $response = Http::withBasicAuth($this->consumerKey, $this->consumerSecret)
                ->withoutVerifying()
                ->timeout($this->timeout)
                ->get($this->baseUrl . '/wp-json/wc/v3/shipping_methods');

            if ($response->successful()) {
                return [
                    'success' => true,
                    'data' => $response->json()
                ];
            }

            Log::error('WooCommerce API Error (Shipping Methods): ' . $response->body());
            return [
                'success' => false,
                'message' => 'Failed to fetch shipping methods from WooCommerce',
                'status' => $response->status()
            ];
        } catch (\Exception $e) {
            Log::error('WooCommerce Service Exception (Shipping Methods): ' . $e->getMessage());
            return [
                'success' => false,
                'message' => $e->getMessage()
            ];
        }
    }

    /**
     * Get all enabled shipping methods with costs for all zones
     *
     * @return array
     */
    public function getShippingZonesWithMethods(): array
    {
        try {
            // 1. Get all shipping zones
            $zonesResponse = Http::withBasicAuth($this->consumerKey, $this->consumerSecret)
                ->withoutVerifying()
                ->timeout($this->timeout)
                ->get($this->baseUrl . '/wp-json/wc/v3/shipping/zones');

            if (!$zonesResponse->successful()) {
                Log::error('WooCommerce API Error (Shipping Zones): ' . $zonesResponse->body());
                return [
                    'success' => false,
                    'message' => 'Failed to fetch shipping zones from WooCommerce',
                    'status' => $zonesResponse->status()
                ];
            }

            $zones = $zonesResponse->json();
            $allMethods = [];

            // 2. For each zone, get its enabled shipping methods
            foreach ($zones as $zone) {
                $zoneId = $zone['id'];
                $zoneName = $zone['name'];
                $methodsResponse = Http::withBasicAuth($this->consumerKey, $this->consumerSecret)
                    ->withoutVerifying()
                    ->timeout($this->timeout)
                    ->get($this->baseUrl . "/wp-json/wc/v3/shipping/zones/{$zoneId}/methods");

                if (!$methodsResponse->successful()) {
                    Log::error("WooCommerce API Error (Shipping Methods for Zone {$zoneId}): " . $methodsResponse->body());
                    continue;
                }

                $methods = $methodsResponse->json();
                foreach ($methods as $method) {
                    if (!empty($method['enabled'])) {
                        $allMethods[] = [
                            'id' => $method['id'],
                            'instance_id' => $method['instance_id'],
                            'title' => $method['title'],
                            'zone_id' => $zoneId,
                            'zone_name' => $zoneName,
                            'cost' => isset($method['settings']['cost']['value']) ? $method['settings']['cost']['value'] : ($method['cost'] ?? '0'),
                            'method_type' => $method['method_id'] ?? $method['id'],
                        ];
                    }
                }
            }

            return [
                'success' => true,
                'data' => $allMethods
            ];
        } catch (\Exception $e) {
            Log::error('WooCommerce Service Exception (Shipping Zones/Methods): ' . $e->getMessage());
            return [
                'success' => false,
                'message' => $e->getMessage()
            ];
        }
    }


}
