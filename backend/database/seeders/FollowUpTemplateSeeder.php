<?php

namespace Database\Seeders;

use App\Models\FollowUpTemplate;
use Illuminate\Database\Seeder;

class FollowUpTemplateSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $templates = [
            [
                'name' => 'Post-Purchase Follow-up',
                'description' => 'Follow up with customer after purchase to ensure satisfaction',
                'title_template' => 'Follow up with {customer_name} - Order #{order_id}',
                'description_template' => 'Check on customer satisfaction and address any concerns for recent order. Ensure delivery was successful and customer is happy with their purchase.',
                'type' => 'order_followup',
                'priority' => 'medium',
                'default_days_offset' => 3,
                'default_tags' => ['post-purchase', 'customer-service', 'satisfaction']
            ],
            [
                'name' => 'Payment Reminder',
                'description' => 'Remind customer about pending payment',
                'title_template' => 'Payment reminder for {customer_name} - Order #{order_id}',
                'description_template' => 'Contact customer regarding pending payment for order #{order_id}. Provide payment options and assistance if needed.',
                'type' => 'payment_reminder',
                'priority' => 'high',
                'default_days_offset' => 1,
                'default_tags' => ['payment', 'urgent', 'billing']
            ],
            [
                'name' => 'Delivery Confirmation',
                'description' => 'Confirm delivery and check satisfaction',
                'title_template' => 'Delivery confirmation - {customer_name}',
                'description_template' => 'Confirm delivery of order #{order_id} and check customer satisfaction. Address any delivery issues or concerns.',
                'type' => 'delivery_check',
                'priority' => 'medium',
                'default_days_offset' => 1,
                'default_tags' => ['delivery', 'satisfaction', 'logistics']
            ],
            [
                'name' => 'Feedback Request',
                'description' => 'Request customer feedback and reviews',
                'title_template' => 'Request feedback from {customer_name}',
                'description_template' => 'Ask for product review and overall experience feedback. Encourage customer to leave a review and share their experience.',
                'type' => 'feedback_request',
                'priority' => 'low',
                'default_days_offset' => 7,
                'default_tags' => ['feedback', 'review', 'testimonial']
            ],
            [
                'name' => 'Sales Call Follow-up',
                'description' => 'Follow up after initial sales call',
                'title_template' => 'Sales follow-up with {customer_name}',
                'description_template' => 'Follow up on our previous conversation. Address any questions and move forward with the sales process.',
                'type' => 'sales_call',
                'priority' => 'high',
                'default_days_offset' => 2,
                'default_tags' => ['sales', 'opportunity', 'conversion']
            ],
            [
                'name' => 'Upsell Opportunity',
                'description' => 'Present additional products to existing customers',
                'title_template' => 'Product recommendation for {customer_name}',
                'description_template' => 'Based on your recent purchase, we have some great product recommendations that might interest you.',
                'type' => 'upsell_opportunity',
                'priority' => 'medium',
                'default_days_offset' => 14,
                'default_tags' => ['upsell', 'recommendation', 'sales']
            ],
            [
                'name' => 'Complaint Resolution',
                'description' => 'Follow up on customer complaints',
                'title_template' => 'Complaint resolution follow-up - {customer_name}',
                'description_template' => 'Follow up on the complaint resolution to ensure customer satisfaction and that all issues have been properly addressed.',
                'type' => 'complaint_resolution',
                'priority' => 'urgent',
                'default_days_offset' => 1,
                'default_tags' => ['complaint', 'resolution', 'urgent']
            ],
            [
                'name' => 'General Check-in',
                'description' => 'Regular customer relationship maintenance',
                'title_template' => 'Check-in with {customer_name}',
                'description_template' => 'Regular check-in to maintain customer relationship and identify any new needs or opportunities.',
                'type' => 'general_check_in',
                'priority' => 'low',
                'default_days_offset' => 30,
                'default_tags' => ['relationship', 'maintenance', 'general']
            ]
        ];

        foreach ($templates as $template) {
            FollowUpTemplate::create(array_merge($template, [
                'created_by' => 1, // Assuming first user exists
                'is_active' => true
            ]));
        }
    }
}
