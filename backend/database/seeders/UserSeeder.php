<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use App\Models\User;
use Carbon\Carbon;

class UserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Create the CRM admin user - use firstOrCreate to avoid duplicates
        User::firstOrCreate(
            ['email' => 'tofa@gmail.com'],
            [
                'name' => 'Tofa',
                'email_verified_at' => Carbon::now(),
                'password' => bcrypt('12345678'),
                'extension' => '5000',
            ]
        );

        // You can add more users here if needed
        // User::firstOrCreate(
        //     ['email' => 'user@example.com'],
        //     [
        //         'name' => 'Another User',
        //         'email_verified_at' => Carbon::now(),
        //         'password' => Hash::make('password'),
        //     ]
        // );
    }
}
