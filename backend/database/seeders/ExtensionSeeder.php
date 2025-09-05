<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Extension;
use App\Models\Team;

class ExtensionSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Create teams first
        $teams = [
            ['name' => 'Sales', 'description' => 'Sales team', 'color' => '#10b981'],
            ['name' => 'Support', 'description' => 'Customer support team', 'color' => '#3b82f6'],
            ['name' => 'Marketing', 'description' => 'Marketing team', 'color' => '#8b5cf6'],
            ['name' => 'Admin', 'description' => 'Administration team', 'color' => '#ef4444'],
        ];

        $teamModels = [];
        foreach ($teams as $teamData) {
            $team = Team::updateOrCreate(
                ['name' => $teamData['name']],
                $teamData
            );
            $teamModels[$teamData['name']] = $team;
        }

        // Create extensions with proper team relationships and new field structure
        $extensions = [
            ['extension' => '1001', 'agent_name' => 'John Smith', 'team' => 'Sales', 'status_code' => 0, 'status_text' => 'NOT_INUSE'],
            ['extension' => '1002', 'agent_name' => 'Jane Doe', 'team' => 'Sales', 'status_code' => 1, 'status_text' => 'INUSE'],
            ['extension' => '1003', 'agent_name' => 'Mike Johnson', 'team' => 'Support', 'status_code' => 3, 'status_text' => 'UNAVAILABLE'],
            ['extension' => '1004', 'agent_name' => 'Sarah Wilson', 'team' => 'Sales', 'status_code' => 0, 'status_text' => 'NOT_INUSE'],
            ['extension' => '1005', 'agent_name' => 'David Brown', 'team' => 'Support', 'status_code' => 3, 'status_text' => 'UNAVAILABLE'],
            ['extension' => '1006', 'agent_name' => 'Kevin Anderson', 'team' => 'Sales', 'status_code' => 4, 'status_text' => 'RINGING'],
            ['extension' => '1007', 'agent_name' => 'Rachel Green', 'team' => 'Marketing', 'status_code' => 3, 'status_text' => 'UNAVAILABLE'],
            ['extension' => '1008', 'agent_name' => 'Mark Thompson', 'team' => 'Support', 'status_code' => 0, 'status_text' => 'NOT_INUSE'],
            ['extension' => '1009', 'agent_name' => 'Laura Williams', 'team' => 'Marketing', 'status_code' => 3, 'status_text' => 'UNAVAILABLE'],
            ['extension' => '1010', 'agent_name' => 'James Parker', 'team' => 'Sales', 'status_code' => 1, 'status_text' => 'INUSE'],
            ['extension' => '2001', 'agent_name' => 'Emily Chen', 'team' => 'Support', 'status_code' => 0, 'status_text' => 'NOT_INUSE'],
            ['extension' => '2002', 'agent_name' => 'Alex Rodriguez', 'team' => 'Sales', 'status_code' => 3, 'status_text' => 'UNAVAILABLE'],
            ['extension' => '2003', 'agent_name' => 'Lisa Thompson', 'team' => 'Marketing', 'status_code' => 5, 'status_text' => 'RING*INUSE'],
            ['extension' => '2004', 'agent_name' => 'Robert Kim', 'team' => 'Support', 'status_code' => 3, 'status_text' => 'UNAVAILABLE'],
            ['extension' => '2005', 'agent_name' => 'Amanda Foster', 'team' => 'Sales', 'status_code' => 0, 'status_text' => 'NOT_INUSE'],
            ['extension' => '2006', 'agent_name' => 'Michael Davis', 'team' => 'Marketing', 'status_code' => 3, 'status_text' => 'UNAVAILABLE'],
            ['extension' => '2007', 'agent_name' => 'Jennifer Lee', 'team' => 'Support', 'status_code' => 2, 'status_text' => 'BUSY'],
            ['extension' => '2008', 'agent_name' => 'Christopher White', 'team' => 'Sales', 'status_code' => 3, 'status_text' => 'UNAVAILABLE'],
            ['extension' => '2009', 'agent_name' => 'Jessica Martinez', 'team' => 'Marketing', 'status_code' => 0, 'status_text' => 'NOT_INUSE'],
            ['extension' => '2010', 'agent_name' => 'Daniel Taylor', 'team' => 'Support', 'status_code' => 3, 'status_text' => 'UNAVAILABLE'],
            ['extension' => '5000', 'agent_name' => 'Mellohost', 'team' => 'Admin', 'status_code' => 3, 'status_text' => 'UNAVAILABLE'],
        ];

        foreach ($extensions as $ext) {
            $teamModel = $teamModels[$ext['team']];
            
            Extension::updateOrCreate(
                ['extension' => $ext['extension']],
                [
                    'agent_name' => $ext['agent_name'],
                    'team_id' => $teamModel->id,
                    'status_code' => $ext['status_code'],
                    'status_text' => $ext['status_text'],
                    'availability_status' => $this->getAvailabilityStatus($ext['status_code']),
                    'status_changed_at' => now(),
                    'is_active' => true,
                ]
            );
        }

        $this->command->info('Teams and extensions seeded successfully with new structure!');
    }

    /**
     * Map status codes to availability status
     */
    private function getAvailabilityStatus(int $statusCode): string
    {
        return match ($statusCode) {
            0 => 'online',      // NOT_INUSE
            1 => 'online',      // INUSE (agent is online and taking calls)
            2 => 'online',      // BUSY (still online, just busy)
            3 => 'offline',     // UNAVAILABLE
            4 => 'online',      // RINGING (still online, receiving call)
            5 => 'online',      // RING*INUSE (still online, multitasking)
            default => 'offline'
        };
    }
}
