<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\WooComService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class WooComController extends Controller
{
    protected $wooComService;

    public function __construct(WooComService $wooComService)
    {
        $this->wooComService = $wooComService;
    }

    public function updateOrder(Request $request)
    {
        $request->validate([
            'order_id' => 'required|numeric',
            'status' => 'required|string',
            'total' => 'nullable|string',
            'line_items' => 'nullable|array',
            'shipping' => 'nullable|array',
            'shipping.first_name' => 'nullable|string',
            'shipping.last_name' => 'nullable|string',
            'shipping.address_1' => 'nullable|string',
            'shipping.address_2' => 'nullable|string',
            'shipping.city' => 'nullable|string',
            'shipping.state' => 'nullable|string',
            'shipping.postcode' => 'nullable|string',
            'shipping.country' => 'nullable|string',
            'billing' => 'nullable|array',
            'billing.first_name' => 'nullable|string',
            'billing.last_name' => 'nullable|string',
            'billing.email' => 'nullable|string',
            'billing.phone' => 'nullable|string',
            'billing.address_1' => 'nullable|string',
            'billing.address_2' => 'nullable|string',
            'billing.city' => 'nullable|string',
            'billing.state' => 'nullable|string',
            'billing.postcode' => 'nullable|string',
            'billing.country' => 'nullable|string'
        ]);

        try {
            // Log the shipping data that we're receiving
            if ($request->has('shipping')) {
                Log::info('Received shipping data for order update:', [
                    'order_id' => $request->order_id,
                    'shipping' => $request->shipping
                ]);
            }

            // Log the billing data that we're receiving
            if ($request->has('billing')) {
                Log::info('Received billing data for order update:', [
                    'order_id' => $request->order_id,
                    'billing' => $request->billing
                ]);
            }

            $response = $this->wooComService->updateOrder(
                $request->order_id,
                $request->status,
                $request->total ?? null,
                $request->line_items ?? [],
                $request->shipping ?? null,
                $request->billing ?? null
            );

            if (isset($response['error'])) {
                return response()->json(['message' => $response['error']], 422);
            }

            return response()->json($response);
        } catch (\Exception $e) {
            Log::error('Order update failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to update orders'], 500);
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

            // Get orders from WooCommerce service (already filtered by phone)
            // Let the service handle all phone number formatting
            $orders = $this->wooComService->getOrdersByPhoneNumber($phoneNumber);

            if (isset($orders['error'])) {
                Log::error('WooCommerce API Error: ' . json_encode($orders));
                return response()->json(['error' => $orders['error']], 500);
            }

            Log::info('Found ' . count($orders) . ' orders for phone: ' . $phoneNumber);

            // Check if no orders found and return appropriate message
            if (empty($orders)) {
                return response()->json([
                    'data' => [],
                    'message' => 'No orders found for this phone number',
                    'success' => true
                ]);
            }

            // Return the orders data with success message
            return response()->json([
                'data' => $orders,
                'message' => 'Orders found successfully',
                'success' => true
            ]);

        } catch (\Exception $e) {
            Log::error('Error fetching WooCommerce orders: ' . $e->getMessage());
            return response()->json([], 500);
        }
    }



    /**
     * Get paginated orders with statistics
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function getPaginatedOrders(Request $request)
    {
        try {
            $page = $request->input('page', 1);
            $perPage = $request->input('per_page', 50);


            Log::info('Fetching paginated orders', [
                'page' => $page,
                'per_page' => $perPage
            ]);

            $result = $this->wooComService->getPaginatedOrders($page, $perPage);

            if (isset($result['error'])) {
                Log::error('WooCommerce API Error (paginated orders): ' . json_encode($result));
                return response()->json(['error' => $result['error']], 500);
            }

            return response()->json([
                'stats' => $result['stats'],
                'pagination' => $result['pagination'],
                'orders' => array_map(function($order) {
                    return [
                        'id' => (int) $order['id'],
                        'status' => $order['status'],
                        'total' => (string) $order['total'],
                        'date_created' => $order['date_created'],
                        'customer_name' => $order['billing']['first_name'] . ' ' . $order['billing']['last_name'],
                        'items_count' => count($order['line_items'] ?? []),
                        'billing' => $order['billing'] ?? null,
                        'shipping' => $order['shipping'] ?? null,
                        'line_items' => $order['line_items'] ?? []
                    ];
                }, $result['orders'])
            ]);
        } catch (\Exception $e) {
            Log::error('Error fetching paginated WooCommerce orders: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to retrieve order data: ' . $e->getMessage()], 500);
        }
    }





    /**
     * Create a new customer in WooCommerce
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function createCustomer(Request $request)
    {
        Log::info('Create customer request received:', $request->all());

        $request->validate([
            'username' => 'required|string',
            'first_name' => 'required|string',
            'last_name' => 'required|string',
            'email' => 'required|email',
            'phone' => 'required|string',
            'same_as_billing' => 'boolean',
            // Billing address validation
            'billing_first_name' => 'nullable|string',
            'billing_last_name' => 'nullable|string',
            'billing_address_1' => 'nullable|string',
            'billing_address_2' => 'nullable|string',
            'billing_city' => 'nullable|string',
            'billing_state' => 'nullable|string',
            'billing_postcode' => 'nullable|string',
            'billing_country' => 'nullable|string',
            // Shipping address validation
            'shipping_first_name' => 'nullable|string',
            'shipping_last_name' => 'nullable|string',
            'shipping_address_1' => 'nullable|string',
            'shipping_address_2' => 'nullable|string',
            'shipping_city' => 'nullable|string',
            'shipping_state' => 'nullable|string',
            'shipping_postcode' => 'nullable|string',
            'shipping_country' => 'nullable|string',
        ]);

        try {
            Log::info('Validated create customer request, calling WooCommerceService');

            // Create billing address array
            $billingAddress = [
                'first_name' => $request->billing_first_name ?? $request->first_name,
                'last_name' => $request->billing_last_name ?? $request->last_name,
                'address_1' => $request->billing_address_1 ?? '',
                'address_2' => $request->billing_address_2 ?? '',
                'city' => $request->billing_city ?? '',
                'state' => $request->billing_state ?? '',
                'postcode' => $request->billing_postcode ?? '',
                'country' => $request->billing_country ?? 'BD'
            ];

            // Create shipping address array
            $shippingAddress = [
                'first_name' => $request->shipping_first_name ?? $request->first_name,
                'last_name' => $request->shipping_last_name ?? $request->last_name,
                'address_1' => $request->shipping_address_1 ?? '',
                'address_2' => $request->shipping_address_2 ?? '',
                'city' => $request->shipping_city ?? '',
                'state' => $request->shipping_state ?? '',
                'postcode' => $request->shipping_postcode ?? '',
                'country' => $request->shipping_country ?? 'BD'
            ];

            Log::info('Address data prepared:', [
                'same_as_billing' => $request->same_as_billing ?? true,
                'billing_address' => $billingAddress,
                'shipping_address' => $shippingAddress
            ]);

            $response = $this->wooComService->createCustomer(
                $request->username,
                $request->first_name,
                $request->last_name,
                $request->email,
                $request->phone,
                $billingAddress,
                $shippingAddress,
                $request->same_as_billing ?? true
            );

            if (isset($response['error'])) {
                Log::error('WooCommerce API Error during customer creation: ' . json_encode($response));
                return response()->json([
                    'error' => $response['error'],
                    'details' => $response['details'] ?? [],
                    'status' => $response['status'] ?? 422
                ], $response['status'] ?? 422);
            }

            Log::info('WooCommerce customer created successfully:', ['customer_id' => $response['id'] ?? 'unknown']);
            return response()->json($response);
        } catch (\Exception $e) {
            Log::error('Customer creation failed with exception: ' . $e->getMessage(), [
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'error' => 'Failed to create customer: ' . $e->getMessage(),
                'details' => [
                    'general' => 'An unexpected error occurred while creating the customer'
                ]
            ], 500);
        }
    }

    /**
     * Update an existing customer in WooCommerce
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function updateCustomer(Request $request)
    {
        Log::info('Update customer request received:', $request->all());

        $request->validate([
            'id' => 'required|numeric',
            'first_name' => 'required|string',
            'last_name' => 'required|string',
            'email' => 'required|email',
            'phone' => 'required|string',
            'billing_first_name' => 'nullable|string',
            'billing_last_name' => 'nullable|string',
            'billing_email' => 'nullable|email',
            'address_1' => 'nullable|string',
            'address_2' => 'nullable|string',
            'city' => 'nullable|string',
            'state' => 'nullable|string',
            'postcode' => 'nullable|string',
            'country' => 'nullable|string',
            'shipping_first_name' => 'nullable|string',
            'shipping_last_name' => 'nullable|string',
            'shipping_address_1' => 'nullable|string',
            'shipping_address_2' => 'nullable|string',
            'shipping_city' => 'nullable|string',
            'shipping_state' => 'nullable|string',
            'shipping_postcode' => 'nullable|string',
            'shipping_country' => 'nullable|string',
        ]);

        try {
            Log::info('Validated update customer request, calling WooCommerceService');

            // Create billing address array
            $billingAddress = [
                'first_name' => $request->billing_first_name ?? '',
                'last_name' => $request->billing_last_name ?? '',
                'email' => $request->billing_email ?? $request->email,
                'address_1' => $request->address_1 ?? '',
                'address_2' => $request->address_2 ?? '',
                'city' => $request->city ?? '',
                'state' => $request->state ?? '',
                'postcode' => $request->postcode ?? '',
                'country' => $request->country ?? 'BD'
            ];

            // Create shipping address array - only use shipping-specific values, no fallback to billing
            $shippingAddress = [
                'first_name' => $request->shipping_first_name ?? '',
                'last_name' => $request->shipping_last_name ?? '',
                'address_1' => $request->shipping_address_1 ?? '',
                'address_2' => $request->shipping_address_2 ?? '',
                'city' => $request->shipping_city ?? '',
                'state' => $request->shipping_state ?? '',
                'postcode' => $request->shipping_postcode ?? '',
                'country' => $request->shipping_country ?? 'BD'
            ];

            $response = $this->wooComService->updateCustomer(
                $request->id,
                $request->first_name,
                $request->last_name,
                $request->email,
                $request->phone,
                $billingAddress,
                $shippingAddress
            );

            if (isset($response['error'])) {
                Log::error('WooCommerce API Error during customer update: ' . json_encode($response));
                return response()->json(['message' => $response['error']], 422);
            }

            Log::info('WooCommerce customer updated successfully:', ['customer_id' => $response['id'] ?? 'unknown']);
            return response()->json($response);
        } catch (\Exception $e) {
            Log::error('Customer update failed with exception: ' . $e->getMessage(), [
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json(['message' => 'Failed to update customer: ' . $e->getMessage()], 500);
        }
    }

    public function createOrder(Request $request)
    {
        $request->validate([
            'payment_method' => 'nullable|string',
            'payment_method_title' => 'nullable|string',
            'set_paid' => 'nullable|boolean',
            'billing' => 'required|array',
            'billing.first_name' => 'required|string',
            'billing.last_name' => 'required|string',
            'billing.address_1' => 'required|string',
            'billing.address_2' => 'nullable|string',
            'billing.city' => 'required|string',
            'billing.state' => 'required|string',
            'billing.postcode' => 'required|string',
            'billing.country' => 'required|string',
            'billing.email' => 'required|email',
            'billing.phone' => 'required|string',
            'shipping' => 'nullable|array',
            'shipping.first_name' => 'nullable|string',
            'shipping.last_name' => 'nullable|string',
            'shipping.address_1' => 'nullable|string',
            'shipping.address_2' => 'nullable|string',
            'shipping.city' => 'nullable|string',
            'shipping.state' => 'nullable|string',
            'shipping.postcode' => 'nullable|string',
            'shipping.country' => 'nullable|string',
            'line_items' => 'required|array',
            'line_items.*.product_id' => 'required|integer',
            'line_items.*.quantity' => 'required|integer|min:1',
            'line_items.*.variation_id' => 'nullable|integer',
            'shipping_lines' => 'nullable|array',
            'shipping_lines.*.method_id' => 'nullable|string',
            'shipping_lines.*.method_title' => 'nullable|string',
            'shipping_lines.*.total' => 'nullable|string'
        ]);

        try {
            $orderData = [
                'payment_method' => $request->payment_method ?? 'bacs',
                'payment_method_title' => $request->payment_method_title ?? 'Direct Bank Transfer',
                'set_paid' => $request->set_paid ?? true,
                'billing' => $request->billing,
                'shipping' => $request->shipping ?? $request->billing,
                'line_items' => $request->line_items,
                'shipping_lines' => $request->shipping_lines ?? []
            ];

            $response = $this->wooComService->createOrder($orderData);

            if (isset($response['error'])) {
                Log::error('WooCommerce API Error during order creation: ' . json_encode($response));
                return response()->json(['message' => $response['error']], 422);
            }

            Log::info('WooCommerce order created successfully:', ['order_id' => $response['id'] ?? 'unknown']);
            return response()->json($response);
        } catch (\Exception $e) {
            Log::error('Order creation failed with exception: ' . $e->getMessage(), [
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json(['message' => 'Failed to create order: ' . $e->getMessage()], 500);
        }
    }



    /**
     * Get customers by phone number
     *
     * @param string $phoneNumber The phone number to search for
     * @return \Illuminate\Http\JsonResponse
     */
    public function getCustomersByPhone($phoneNumber)
    {
        try {
            Log::info('Getting customers for phone number: ' . $phoneNumber);

            // Get customers from WooCommerce service (already filtered by phone)
            // Let the service handle all phone number formatting
            $customers = $this->wooComService->getCustomersByPhoneNumber($phoneNumber);

            if (isset($customers['error'])) {
                Log::error('WooCommerce API Error: ' . json_encode($customers));
                return response()->json(['error' => $customers['error']], 500);
            }

            Log::info('Found ' . count($customers) . ' customers for phone: ' . $phoneNumber);

            // Check if no customers found and return appropriate message
            if (empty($customers)) {
                return response()->json([
                    'data' => [],
                    'message' => 'No customers found for this phone number',
                    'success' => true
                ]);
            }

            // Return the customers data with success message
            return response()->json([
                'data' => $customers,
                'message' => 'Customers found successfully',
                'success' => true
            ]);

        } catch (\Exception $e) {
            Log::error('Error fetching WooCommerce customers: ' . $e->getMessage());
            return response()->json([], 500);
        }
    }

    /**
     * Get order notes for a specific order
     *
     * @param int $orderId
     * @return \Illuminate\Http\JsonResponse
     */
    public function getOrderNotes($orderId)
    {
        try {
            $notes = $this->wooComService->getOrderNotes($orderId);
            if (isset($notes['error'])) {
                return response()->json(['error' => $notes['error']], 500);
            }
            return response()->json(['data' => $notes, 'success' => true]);
        } catch (\Exception $e) {
            \Log::error('Error fetching WooCommerce order notes: ' . $e->getMessage());
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Add a note to a WooCommerce order
     *
     * @param int $orderId
     * @param \Illuminate\Http\Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function addOrderNote($orderId, Request $request)
    {
        $request->validate([
            'note' => 'required|string',
            'customer_note' => 'boolean',
            'added_by_user' => 'nullable|string',
        ]);
        try {
            $result = $this->wooComService->addOrderNote($orderId, $request->note, $request->customer_note ?? false, $request->added_by_user ?? null);
            if (isset($result['error'])) {
                return response()->json(['error' => $result['error']], 500);
            }
            return response()->json(['data' => $result, 'success' => true]);
        } catch (\Exception $e) {
            \Log::error('Error adding WooCommerce order note: ' . $e->getMessage());
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Get available payment methods from WooCommerce
     * @return \Illuminate\Http\JsonResponse
     */
    public function getPaymentMethods()
    {
        try {
            $result = $this->wooComService->getPaymentMethods();
            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get available shipping methods from WooCommerce
     * @return \Illuminate\Http\JsonResponse
     */
    public function getShippingMethods()
    {
        try {
            $result = $this->wooComService->getShippingMethods();
            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get all enabled shipping methods with costs for all zones
     * @return \Illuminate\Http\JsonResponse
     */
    public function getShippingZonesWithMethods()
    {
        try {
            $result = $this->wooComService->getShippingZonesWithMethods();
            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 500);
        }
    }


}
