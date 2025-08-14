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
        Schema::create('call_logs', function (Blueprint $table) {
            $table->id();
            $table->string('uniqueid')->unique();
            $table->string('linkedid')->nullable();
            $table->string('channel')->nullable();
            $table->string('callerid_num')->nullable();
            $table->string('callerid_name')->nullable();
            $table->string('exten')->nullable();
            $table->string('context')->nullable();
            $table->string('channel_state')->nullable();
            $table->string('channel_state_desc')->nullable();
            $table->timestamp('start_time');
            $table->timestamp('end_time')->nullable();
            $table->string('status');
            $table->integer('duration')->nullable();
            $table->string('connected_line_num')->nullable();
            $table->string('connected_line_name')->nullable();
            $table->string('state')->nullable();
            $table->foreignId('call_instance_id')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('call_logs');
    }
};
