<?php

namespace Database\Seeders;

use App\Models\CustomerFollowUp;
use App\Models\FollowUpNote;
use Illuminate\Database\Seeder;
use Carbon\Carbon;

class SampleFollowUpSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $sampleFollowUps = [
            [
                'title' => 'Follow up with John Smith - Order #12345',
                'description' => 'Check on customer satisfaction for recent laptop purchase',
                'type' => 'order_followup',
                'priority' => 'medium',
                'status' => 'pending',
                'customer_phone' => '+8801712345678',
                'customer_email' => 'john.smith@email.com',
                'customer_name' => 'John Smith',
                'woocommerce_order_id' => 12345,
                'scheduled_date' => now()->addDays(1),
                'assigned_to' => 1,
                'created_by' => 1,
                'tags' => ['post-purchase', 'laptop', 'electronics']
            ],
            [
                'title' => 'Payment reminder for Sarah Johnson - Order #12346',
                'description' => 'Contact customer regarding pending payment for smartphone order',
                'type' => 'payment_reminder',
                'priority' => 'high',
                'status' => 'pending',
                'customer_phone' => '+8801812345679',
                'customer_email' => 'sarah.johnson@email.com',
                'customer_name' => 'Sarah Johnson',
                'woocommerce_order_id' => 12346,
                'scheduled_date' => now()->addHours(4),
                'assigned_to' => 1,
                'created_by' => 1,
                'tags' => ['payment', 'urgent', 'smartphone']
            ],
            [
                'title' => 'Delivery confirmation - Mike Wilson',
                'description' => 'Confirm delivery of order #12347 and check customer satisfaction',
                'type' => 'delivery_check',
                'priority' => 'medium',
                'status' => 'completed',
                'customer_phone' => '+8801912345680',
                'customer_email' => 'mike.wilson@email.com',
                'customer_name' => 'Mike Wilson',
                'woocommerce_order_id' => 12347,
                'scheduled_date' => now()->subDays(1),
                'completed_date' => now()->subHours(2),
                'assigned_to' => 1,
                'created_by' => 1,
                'outcome' => 'Customer confirmed delivery and is satisfied with the product',
                'tags' => ['delivery', 'tablet', 'satisfied']
            ],
            [
                'title' => 'Request feedback from Emma Davis',
                'description' => 'Ask for product review for wireless headphones purchase',
                'type' => 'feedback_request',
                'priority' => 'low',
                'status' => 'pending',
                'customer_phone' => '+8801612345681',
                'customer_email' => 'emma.davis@email.com',
                'customer_name' => 'Emma Davis',
                'woocommerce_order_id' => 12348,
                'scheduled_date' => now()->addDays(3),
                'assigned_to' => 1,
                'created_by' => 1,
                'tags' => ['feedback', 'headphones', 'review']
            ],
            [
                'title' => 'Sales follow-up with David Brown',
                'description' => 'Follow up on gaming setup discussion from last call',
                'type' => 'sales_call',
                'priority' => 'high',
                'status' => 'in_progress',
                'customer_phone' => '+8801512345682',
                'customer_email' => 'david.brown@email.com',
                'customer_name' => 'David Brown',
                'scheduled_date' => now()->addHours(2),
                'assigned_to' => 1,
                'created_by' => 1,
                'tags' => ['sales', 'gaming', 'opportunity']
            ],
            [
                'title' => 'Complaint resolution follow-up - Lisa Taylor',
                'description' => 'Follow up on keyboard replacement issue resolution',
                'type' => 'complaint_resolution',
                'priority' => 'urgent',
                'status' => 'pending',
                'customer_phone' => '+8801412345683',
                'customer_email' => 'lisa.taylor@email.com',
                'customer_name' => 'Lisa Taylor',
                'woocommerce_order_id' => 12349,
                'scheduled_date' => now()->addHours(1),
                'assigned_to' => 1,
                'created_by' => 1,
                'tags' => ['complaint', 'keyboard', 'replacement']
            ],
            [
                'title' => 'Check-in with Robert Anderson',
                'description' => 'Regular relationship maintenance check-in',
                'type' => 'general_check_in',
                'priority' => 'low',
                'status' => 'pending',
                'customer_phone' => '+8801312345684',
                'customer_email' => 'robert.anderson@email.com',
                'customer_name' => 'Robert Anderson',
                'scheduled_date' => now()->addDays(2),
                'assigned_to' => 1,
                'created_by' => 1,
                'tags' => ['relationship', 'vip-customer']
            ],
            [
                'title' => 'Product recommendation for Amy White',
                'description' => 'Present mouse and keyboard accessories based on recent computer purchase',
                'type' => 'upsell_opportunity',
                'priority' => 'medium',
                'status' => 'pending',
                'customer_phone' => '+8801212345685',
                'customer_email' => 'amy.white@email.com',
                'customer_name' => 'Amy White',
                'woocommerce_order_id' => 12350,
                'scheduled_date' => now()->addDays(5),
                'assigned_to' => 1,
                'created_by' => 1,
                'tags' => ['upsell', 'accessories', 'computer']
            ]
        ];

        foreach ($sampleFollowUps as $followUpData) {
            $followUp = CustomerFollowUp::create($followUpData);

            // Add a sample note to some follow-ups
            if (in_array($followUp->status, ['completed', 'in_progress'])) {
                FollowUpNote::create([
                    'follow_up_id' => $followUp->id,
                    'user_id' => 1,
                    'note' => 'Initial contact made. Customer was responsive and provided feedback.',
                    'type' => 'note'
                ]);
            }
        }
    }
}
