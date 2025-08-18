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
		Schema::create('calls', function (Blueprint $table) {
			$table->id();
			$table->string('linkedid')->unique();
			$table->string('direction')->nullable()->index();
			$table->string('other_party')->nullable();
			$table->string('agent_exten')->nullable()->index();
			$table->timestamp('started_at')->nullable();
			$table->timestamp('answered_at')->nullable();
			$table->timestamp('ended_at')->nullable();
			$table->integer('ring_seconds')->nullable();
			$table->integer('talk_seconds')->nullable();
			$table->string('dial_status')->nullable();
			$table->string('disposition')->nullable();
			$table->string('hangup_cause')->nullable();
			$table->string('recording_file')->nullable();
			$table->timestamps();
		});
	}

	/**
	 * Reverse the migrations.
	 */
	public function down(): void
	{
		Schema::dropIfExists('calls');
	}
};


