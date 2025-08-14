<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('customer_follow_ups', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->text('description')->nullable();
            $table->enum('type', [
                'sales_call', 'order_followup', 'payment_reminder',
                'delivery_check', 'feedback_request', 'upsell_opportunity',
                'complaint_resolution', 'general_check_in'
            ]);
            $table->enum('priority', ['low', 'medium', 'high', 'urgent'])->default('medium');
            $table->enum('status', ['pending', 'in_progress', 'completed', 'cancelled', 'overdue'])->default('pending');

            // Customer Information
            $table->string('customer_phone')->nullable();
            $table->string('customer_email')->nullable();
            $table->string('customer_name')->nullable();
            $table->unsignedBigInteger('woocommerce_customer_id')->nullable();
            $table->unsignedBigInteger('woocommerce_order_id')->nullable();

            // Scheduling
            $table->timestamp('scheduled_date');
            $table->timestamp('completed_date')->nullable();
            $table->timestamp('reminder_date')->nullable();
            $table->boolean('is_recurring')->default(false);
            $table->string('recurring_pattern')->nullable(); // daily, weekly, monthly
            $table->integer('recurring_interval')->nullable(); // every X days/weeks/months

            // Assignment
            $table->foreignId('assigned_to')->nullable()->constrained('users')->onDelete('set null');
            $table->foreignId('created_by')->constrained('users')->onDelete('cascade');

            // Additional Data
            $table->json('tags')->nullable();
            $table->json('metadata')->nullable(); // Store additional context
            $table->text('outcome')->nullable(); // Result of the follow-up

            // Tracking
            $table->timestamp('last_reminder_sent')->nullable();
            $table->integer('reminder_count')->default(0);

            $table->timestamps();

            // Indexes
            $table->index(['scheduled_date', 'status']);
            $table->index(['assigned_to', 'status']);
            $table->index(['customer_phone']);
            $table->index(['woocommerce_customer_id']);
            $table->index(['type', 'priority']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('customer_follow_ups');
    }
};
