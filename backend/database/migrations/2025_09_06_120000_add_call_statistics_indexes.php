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
        Schema::table('calls', function (Blueprint $table) {
            // Composite index for date and direction queries
            $table->index(['started_at', 'direction'], 'idx_started_at_direction');
            
            // Composite index for date and agent queries  
            $table->index(['started_at', 'agent_exten'], 'idx_started_at_agent');
            
            // Composite index for answered and ended timestamps
            $table->index(['answered_at', 'ended_at'], 'idx_answered_ended');
            
            // Index for started_at for date range queries
            $table->index('started_at', 'idx_started_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('calls', function (Blueprint $table) {
            $table->dropIndex('idx_started_at_direction');
            $table->dropIndex('idx_started_at_agent'); 
            $table->dropIndex('idx_answered_ended');
            $table->dropIndex('idx_started_at');
        });
    }
};