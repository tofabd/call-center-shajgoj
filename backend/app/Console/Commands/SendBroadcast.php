<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

use App\Models\User;
use App\Events\FetchCustomerAndNotifyExtension;

/**
 * SendBroadcast.php: This command is used to manually trigger broadcast
 * notifications to a specific user. It can be used for testing
 * or debugging purposes.
 * example: php artisan app:send-broadcast 1
 * 1 for user_id
 */

class SendBroadcast extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:send-broadcast {user_id : The ID of the user to notify}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Send a broadcast notification to a specific user';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $userId = $this->argument('user_id');

        $user = User::find($userId);

        if (!$user) {
            $this->error("User with ID {$userId} not found.");
            return 1;
        }

        broadcast(new FetchCustomerAndNotifyExtension($user, '01717104696'));

        $this->info("Broadcast sent successfully to user {$user->name}");
    }
}
