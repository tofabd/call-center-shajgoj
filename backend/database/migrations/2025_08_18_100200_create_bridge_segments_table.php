<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
	public function up(): void
	{
		Schema::create('bridge_segments', function (Blueprint $table) {
			$table->id();
			$table->string('linkedid')->index();
			$table->string('agent_exten')->nullable()->index();
			$table->string('party_channel')->nullable();
			$table->timestamp('entered_at');
			$table->timestamp('left_at')->nullable();
			$table->timestamps();

			$table->foreign('linkedid')->references('linkedid')->on('calls')->cascadeOnDelete();
		});
	}

	public function down(): void
	{
		Schema::dropIfExists('bridge_segments');
	}
};


