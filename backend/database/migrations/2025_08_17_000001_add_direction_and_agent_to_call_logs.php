<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('call_logs', function (Blueprint $table) {
            $table->string('direction')->nullable()->index();
            $table->string('agent_exten')->nullable();
            $table->string('other_party')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('call_logs', function (Blueprint $table) {
            if (Schema::hasColumn('call_logs', 'direction')) {
                $table->dropColumn('direction');
            }
            if (Schema::hasColumn('call_logs', 'agent_exten')) {
                $table->dropColumn('agent_exten');
            }
            if (Schema::hasColumn('call_logs', 'other_party')) {
                $table->dropColumn('other_party');
            }
        });
    }
};


