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
            ['extension' => '1006', 'agent_name' => 'Kevin Anderson', 'status' => 'online'],
            ['extension' => '1007', 'agent_name' => 'Rachel Green', 'status' => 'offline'],
            ['extension' => '1008', 'agent_name' => 'Mark Thompson', 'status' => 'online'],
            ['extension' => '1009', 'agent_name' => 'Laura Williams', 'status' => 'offline'],
            ['extension' => '1010', 'agent_name' => 'James Parker', 'status' => 'online'],
            ['extension' => '2001', 'agent_name' => 'Emily Chen', 'status' => 'online'],
            ['extension' => '2002', 'agent_name' => 'Alex Rodriguez', 'status' => 'offline'],
            ['extension' => '2003', 'agent_name' => 'Lisa Thompson', 'status' => 'online'],
            ['extension' => '2004', 'agent_name' => 'Robert Kim', 'status' => 'offline'],
            ['extension' => '2005', 'agent_name' => 'Amanda Foster', 'status' => 'online'],
            ['extension' => '2006', 'agent_name' => 'Michael Davis', 'status' => 'offline'],
            ['extension' => '2007', 'agent_name' => 'Jennifer Lee', 'status' => 'online'],
            ['extension' => '2008', 'agent_name' => 'Christopher White', 'status' => 'offline'],
            ['extension' => '2009', 'agent_name' => 'Jessica Martinez', 'status' => 'online'],
            ['extension' => '2010', 'agent_name' => 'Daniel Taylor', 'status' => 'offline'],
            ['extension' => '5000', 'agent_name' => 'Mellohost', 'status' => 'offline'],
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
