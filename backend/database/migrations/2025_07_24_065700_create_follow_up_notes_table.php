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
        Schema::create('follow_up_notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('follow_up_id')->constrained('customer_follow_ups')->onDelete('cascade');
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->text('note');
            $table->enum('type', ['note', 'status_change', 'system'])->default('note');
            $table->json('attachments')->nullable();
            $table->timestamps();

            $table->index(['follow_up_id', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('follow_up_notes');
    }
};
