<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
	public function up(): void
	{
		Schema::create('call_legs', function (Blueprint $table) {
			$table->id();
			$table->string('uniqueid')->unique();
			$table->string('linkedid')->index();
			$table->string('channel')->nullable();
			$table->string('exten')->nullable();
			$table->string('context')->nullable();
			$table->string('channel_state')->nullable();
			$table->string('channel_state_desc')->nullable();
			$table->string('state')->nullable();
			$table->string('callerid_num')->nullable();
			$table->string('callerid_name')->nullable();
			$table->string('connected_line_num')->nullable();
			$table->string('connected_line_name')->nullable();
			$table->timestamp('start_time')->nullable();
			$table->timestamp('answer_at')->nullable();
			$table->timestamp('hangup_at')->nullable();
			$table->string('hangup_cause')->nullable();
			$table->string('agent_exten_if_leg')->nullable();
			$table->string('other_party_if_leg')->nullable();
			$table->timestamps();

			$table->foreign('linkedid')->references('linkedid')->on('calls')->cascadeOnDelete();
		});
	}

	public function down(): void
	{
		Schema::dropIfExists('call_legs');
	}
};


