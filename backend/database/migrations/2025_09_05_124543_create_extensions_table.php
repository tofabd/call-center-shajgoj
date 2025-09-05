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
        Schema::create('extensions', function (Blueprint $table) {
            $table->id();
            
            // Core Identity
            $table->string('extension', 10)->unique(); // Extension number like "1001"
            $table->string('agent_name', 255)->nullable(); // Agent's full name
            $table->foreignId('team_id')->nullable()->constrained('teams')->onDelete('set null'); // Team relationship
            
            // Asterisk Status (Raw Data)
            $table->integer('status_code')->default(-1); // Raw Asterisk status (-1,0,1,2,4,8,16,32)
            $table->string('status_text', 50)->nullable(); // Human readable status text from Asterisk
            
            // Availability Status (Business Logic)
            $table->string('availability_status', 20)->default('unknown'); // 'online', 'offline', 'unknown', 'invalid'
            $table->timestamp('status_changed_at')->nullable(); // When availability status last changed
            
            // System Fields
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            
            // Indexes for performance
            $table->index(['availability_status']);
            $table->index(['team_id', 'availability_status']);
            $table->index(['status_code']);
            $table->index(['is_active']);
            $table->index(['status_changed_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('extensions');
    }
};
