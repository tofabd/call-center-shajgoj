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
            ['extension' => '1001', 'agent_name' => 'John Smith', 'status' => 'online', 'status_code' => 0, 'device_state' => 'NOT_INUSE'],
            ['extension' => '1002', 'agent_name' => 'Jane Doe', 'status' => 'online', 'status_code' => 1, 'device_state' => 'INUSE'],
            ['extension' => '1003', 'agent_name' => 'Mike Johnson', 'status' => 'offline', 'status_code' => 3, 'device_state' => 'UNAVAILABLE'],
            ['extension' => '1004', 'agent_name' => 'Sarah Wilson', 'status' => 'online', 'status_code' => 0, 'device_state' => 'NOT_INUSE'],
            ['extension' => '1005', 'agent_name' => 'David Brown', 'status' => 'offline', 'status_code' => 3, 'device_state' => 'UNAVAILABLE'],
            ['extension' => '1006', 'agent_name' => 'Kevin Anderson', 'status' => 'online', 'status_code' => 4, 'device_state' => 'RINGING'],
            ['extension' => '1007', 'agent_name' => 'Rachel Green', 'status' => 'offline', 'status_code' => 3, 'device_state' => 'UNAVAILABLE'],
            ['extension' => '1008', 'agent_name' => 'Mark Thompson', 'status' => 'online', 'status_code' => 0, 'device_state' => 'NOT_INUSE'],
            ['extension' => '1009', 'agent_name' => 'Laura Williams', 'status' => 'offline', 'status_code' => 3, 'device_state' => 'UNAVAILABLE'],
            ['extension' => '1010', 'agent_name' => 'James Parker', 'status' => 'online', 'status_code' => 1, 'device_state' => 'INUSE'],
            ['extension' => '2001', 'agent_name' => 'Emily Chen', 'status' => 'online', 'status_code' => 0, 'device_state' => 'NOT_INUSE'],
            ['extension' => '2002', 'agent_name' => 'Alex Rodriguez', 'status' => 'offline', 'status_code' => 3, 'device_state' => 'UNAVAILABLE'],
            ['extension' => '2003', 'agent_name' => 'Lisa Thompson', 'status' => 'online', 'status_code' => 5, 'device_state' => 'RING*INUSE'],
            ['extension' => '2004', 'agent_name' => 'Robert Kim', 'status' => 'offline', 'status_code' => 3, 'device_state' => 'UNAVAILABLE'],
            ['extension' => '2005', 'agent_name' => 'Amanda Foster', 'status' => 'online', 'status_code' => 0, 'device_state' => 'NOT_INUSE'],
            ['extension' => '2006', 'agent_name' => 'Michael Davis', 'status' => 'offline', 'status_code' => 3, 'device_state' => 'UNAVAILABLE'],
            ['extension' => '2007', 'agent_name' => 'Jennifer Lee', 'status' => 'online', 'status_code' => 2, 'device_state' => 'BUSY'],
            ['extension' => '2008', 'agent_name' => 'Christopher White', 'status' => 'offline', 'status_code' => 3, 'device_state' => 'UNAVAILABLE'],
            ['extension' => '2009', 'agent_name' => 'Jessica Martinez', 'status' => 'online', 'status_code' => 0, 'device_state' => 'NOT_INUSE'],
            ['extension' => '2010', 'agent_name' => 'Daniel Taylor', 'status' => 'offline', 'status_code' => 3, 'device_state' => 'UNAVAILABLE'],
            ['extension' => '5000', 'agent_name' => 'Mellohost', 'status' => 'offline', 'status_code' => 3, 'device_state' => 'UNAVAILABLE'],
        ];

        foreach ($extensions as $ext) {
            Extension::updateOrCreate(
                ['extension' => $ext['extension']],
                [
                    'agent_name' => $ext['agent_name'],
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
