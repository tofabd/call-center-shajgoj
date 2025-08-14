<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\ExternalApiConfig;

class ExternalApiConfigSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        ExternalApiConfig::updateOrCreate(
            ['name' => 'shajgoj_api'],
            [
                'base_url' => 'https://newshop.shajgoj.com/api',
                'email' => 'crm1@test.com',
                'password' => 'crm@1234',
                'is_active' => true,
                'additional_config' => [
                    'description' => 'Shajgoj API integration for CRM system',
                    'created_by' => 'system',
                ],
            ]
        );
    }
}
