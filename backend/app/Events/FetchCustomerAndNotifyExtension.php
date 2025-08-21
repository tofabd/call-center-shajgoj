<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use App\Models\User;
 // use App\Services\WooComService; // WooCommerce service removed
use Illuminate\Support\Facades\Log;

class FetchCustomerAndNotifyExtension implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $callData;

    public $orders;

    public function __construct(public User $user, public string $callerId)
    {
        // Comment out WooCommerce integration and use demo data instead
        // $this->orders = $this->fetchWooCommerceOrders($callerId);
        $this->callData = $this->generateDemoCallData($callerId);
    }

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('call-received-' . $this->user->id),
        ];
    }

    public function broadcastWith(): array
    {
        return [
            'user_id' => $this->user->id,
            'caller_id' => $this->callerId,
            'call_data' => $this->callData,
            'timestamp' => now()->toISOString(),
        ];
    }

    private function generateDemoCallData(string $phoneNumber): array
    {
        // Generate demo call data
        $demoCustomers = [
            [
                'name' => 'John Doe',
                'email' => 'john.doe@example.com',
                'phone' => $phoneNumber,
                'company' => 'Acme Corp',
                'address' => '123 Main St, New York, NY 10001',
                'last_order_date' => now()->subDays(rand(1, 30))->toDateString(),
                'total_orders' => rand(1, 15),
                'total_spent' => number_format(rand(100, 5000), 2),
            ],
            [
                'name' => 'Jane Smith',
                'email' => 'jane.smith@example.com',
                'phone' => $phoneNumber,
                'company' => 'Tech Solutions Inc',
                'address' => '456 Oak Ave, Los Angeles, CA 90210',
                'last_order_date' => now()->subDays(rand(1, 60))->toDateString(),
                'total_orders' => rand(1, 25),
                'total_spent' => number_format(rand(200, 8000), 2),
            ],
            [
                'name' => 'Mike Johnson',
                'email' => 'mike.johnson@example.com',
                'phone' => $phoneNumber,
                'company' => 'Global Industries',
                'address' => '789 Pine Rd, Chicago, IL 60601',
                'last_order_date' => now()->subDays(rand(1, 90))->toDateString(),
                'total_orders' => rand(1, 10),
                'total_spent' => number_format(rand(150, 3000), 2),
            ]
        ];

        // Select a random customer or create a new one
        $customer = $demoCustomers[array_rand($demoCustomers)];
        $customer['phone'] = $phoneNumber; // Ensure phone matches

        return [
            'customer' => $customer,
            'recent_orders' => $this->generateDemoOrders(),
            'call_notes' => [
                'Previous call: Customer inquired about delivery status',
                'Preferred contact time: 9 AM - 5 PM EST',
                'VIP Customer - Priority handling required'
            ]
        ];
    }

    private function generateDemoOrders(): array
    {
        $orders = [];
        $orderCount = rand(1, 5);

        for ($i = 0; $i < $orderCount; $i++) {
            $orders[] = [
                'id' => 'ORD-' . rand(100000, 999999),
                'date' => now()->subDays(rand(1, 180))->toDateString(),
                'status' => ['pending', 'processing', 'shipped', 'delivered', 'cancelled'][rand(0, 4)],
                'total' => number_format(rand(50, 500), 2),
                'items' => [
                    [
                        'name' => ['Wireless Headphones', 'Smartphone Case', 'USB Cable', 'Power Bank', 'Bluetooth Speaker'][rand(0, 4)],
                        'quantity' => rand(1, 3),
                        'price' => number_format(rand(20, 150), 2)
                    ]
                ]
            ];
        }

        return $orders;
    }


    // WooCommerce integration removed - using demo data instead
    /*
    private function fetchWooCommerceOrders(string $phoneNumber): array
    {
        try {
            $woocommerce = new WooComService();

            // Use the search parameter to filter orders by phone number
            $rawOrders = $woocommerce->getOrdersByPhoneNumber($phoneNumber);

            if (isset($rawOrders['error'])) {
                Log::error('WooCommerce API Error: ' . json_encode($rawOrders));
                return [];
            }

            //Log::info('Raw Orders'. json_encode($rawOrders));

            // Format WooCommerce orders to match frontend interface
            return array_map(function($order) {
                return [
                    'id' => (int) $order['id'],
                    'status' => $order['status'],
                    'total' => (string) $order['total'],
                    'subtotal' => (string) ($order['subtotal'] ?? '0.00'),
                    'shipping_total' => (string) ($order['shipping_total'] ?? '0.00'),
                    'discount_total' => (string) ($order['discount_total'] ?? '0.00'),
                    'date_created' => $order['date_created'],
                    'billing' => [
                        'first_name' => $order['billing']['first_name'] ?? '',
                        'last_name' => $order['billing']['last_name'] ?? '',
                        'email' => $order['billing']['email'] ?? '',
                        'phone' => $order['billing']['phone'] ?? '',
                    ],
                    'line_items' => array_map(function($item) {
                        return [
                            'id' => (int) $item['id'],
                            'product_id' => (int) $item['product_id'],
                            'name' => $item['name'],
                            'quantity' => (int) $item['quantity'],
                            'price' => (string) $item['price'],
                            'total' => (string) $item['total']
                        ];
                    }, $order['line_items'] ?? [])
                ];
            }, $rawOrders);

        } catch (\Exception $e) {
            Log::error('Error fetching WooCommerce orders: ' . $e->getMessage());
            return [];
        }
    }
    */

}
