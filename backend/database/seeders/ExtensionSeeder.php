<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Extension;

class ExtensionSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $extensions = [
            ['extension' => '1001', 'agent_name' => 'John Smith', 'status' => 'online'],
            ['extension' => '1002', 'agent_name' => 'Jane Doe', 'status' => 'online'],
            ['extension' => '1003', 'agent_name' => 'Mike Johnson', 'status' => 'offline'],
            ['extension' => '1004', 'agent_name' => 'Sarah Wilson', 'status' => 'online'],
            ['extension' => '1005', 'agent_name' => 'David Brown', 'status' => 'offline'],
        ];

        foreach ($extensions as $ext) {
            Extension::updateOrCreate(
                ['extension' => $ext['extension']],
                [
                    'agent_name' => $ext['agent_name'],
                    'status' => $ext['status'],
                    'last_seen' => now(),
                ]
            );
        }

        $this->command->info('Sample extensions seeded successfully!');
    }
}
