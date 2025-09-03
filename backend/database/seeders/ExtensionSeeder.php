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
            ['extension' => '1001', 'agent_name' => 'John Smith', 'team' => 'Sales', 'status' => 'online', 'status_code' => 0, 'device_state' => 'NOT_INUSE'],
            ['extension' => '1002', 'agent_name' => 'Jane Doe', 'team' => 'Sales', 'status' => 'online', 'status_code' => 1, 'device_state' => 'INUSE'],
            ['extension' => '1003', 'agent_name' => 'Mike Johnson', 'team' => 'Support', 'status' => 'offline', 'status_code' => 3, 'device_state' => 'UNAVAILABLE'],
            ['extension' => '1004', 'agent_name' => 'Sarah Wilson', 'team' => 'Sales', 'status' => 'online', 'status_code' => 0, 'device_state' => 'NOT_INUSE'],
            ['extension' => '1005', 'agent_name' => 'David Brown', 'team' => 'Support', 'status' => 'offline', 'status_code' => 3, 'device_state' => 'UNAVAILABLE'],
            ['extension' => '1006', 'agent_name' => 'Kevin Anderson', 'team' => 'Sales', 'status' => 'online', 'status_code' => 4, 'device_state' => 'RINGING'],
            ['extension' => '1007', 'agent_name' => 'Rachel Green', 'team' => 'Marketing', 'status' => 'offline', 'status_code' => 3, 'device_state' => 'UNAVAILABLE'],
            ['extension' => '1008', 'agent_name' => 'Mark Thompson', 'team' => 'Support', 'status' => 'online', 'status_code' => 0, 'device_state' => 'NOT_INUSE'],
            ['extension' => '1009', 'agent_name' => 'Laura Williams', 'team' => 'Marketing', 'status' => 'offline', 'status_code' => 3, 'device_state' => 'UNAVAILABLE'],
            ['extension' => '1010', 'agent_name' => 'James Parker', 'team' => 'Sales', 'status' => 'online', 'status_code' => 1, 'device_state' => 'INUSE'],
            ['extension' => '2001', 'agent_name' => 'Emily Chen', 'team' => 'Support', 'status' => 'online', 'status_code' => 0, 'device_state' => 'NOT_INUSE'],
            ['extension' => '2002', 'agent_name' => 'Alex Rodriguez', 'team' => 'Sales', 'status' => 'offline', 'status_code' => 3, 'device_state' => 'UNAVAILABLE'],
            ['extension' => '2003', 'agent_name' => 'Lisa Thompson', 'team' => 'Marketing', 'status' => 'online', 'status_code' => 5, 'device_state' => 'RING*INUSE'],
            ['extension' => '2004', 'agent_name' => 'Robert Kim', 'team' => 'Support', 'status' => 'offline', 'status_code' => 3, 'device_state' => 'UNAVAILABLE'],
            ['extension' => '2005', 'agent_name' => 'Amanda Foster', 'team' => 'Sales', 'status' => 'online', 'status_code' => 0, 'device_state' => 'NOT_INUSE'],
            ['extension' => '2006', 'agent_name' => 'Michael Davis', 'team' => 'Marketing', 'status' => 'offline', 'status_code' => 3, 'device_state' => 'UNAVAILABLE'],
            ['extension' => '2007', 'agent_name' => 'Jennifer Lee', 'team' => 'Support', 'status' => 'online', 'status_code' => 2, 'device_state' => 'BUSY'],
            ['extension' => '2008', 'agent_name' => 'Christopher White', 'team' => 'Sales', 'status' => 'offline', 'status_code' => 3, 'device_state' => 'UNAVAILABLE'],
            ['extension' => '2009', 'agent_name' => 'Jessica Martinez', 'team' => 'Marketing', 'status' => 'online', 'status_code' => 0, 'device_state' => 'NOT_INUSE'],
            ['extension' => '2010', 'agent_name' => 'Daniel Taylor', 'team' => 'Support', 'status' => 'offline', 'status_code' => 3, 'device_state' => 'UNAVAILABLE'],
            ['extension' => '5000', 'agent_name' => 'Mellohost', 'team' => 'Admin', 'status' => 'offline', 'status_code' => 3, 'device_state' => 'UNAVAILABLE'],
        ];

        foreach ($extensions as $ext) {
            Extension::updateOrCreate(
                ['extension' => $ext['extension']],
                [
                    'agent_name' => $ext['agent_name'],
                    'team' => $ext['team'],
                    'status' => $ext['status'],
                    'status_code' => $ext['status_code'],
                    'device_state' => $ext['device_state'],
                    'last_status_change' => now(),
                    'last_seen' => now(),
                ]
            );
        }

        $this->command->info('Sample extensions seeded successfully with new fields!');
    }
}
