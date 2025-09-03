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
        Schema::table('extensions', function (Blueprint $table) {
            // Add the new status tracking fields
            $table->integer('status_code')->default(0)->after('status');
            $table->string('device_state', 20)->default('NOT_INUSE')->after('status_code');
            $table->timestamp('last_status_change')->nullable()->after('last_seen');
            
            // Add indexes for better query performance
            $table->index(['status_code', 'device_state']);
            $table->index('last_status_change');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('extensions', function (Blueprint $table) {
            $table->dropIndex(['status_code', 'device_state']);
            $table->dropIndex(['last_status_change']);
            $table->dropColumn(['status_code', 'device_state', 'last_status_change']);
        });
    }
};