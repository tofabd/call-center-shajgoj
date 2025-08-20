<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Symfony\Component\Process\Process;

class Start extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:start';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Start all required services: server, vite, queue, reverb, and AMI connection';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Starting all services for Call Center AI in a single window...');

        $projectPath = base_path();

        // Command to start all services in Windows Terminal tabs
        $command = "wt -d \"$projectPath\" cmd /k \"title Laravel Server && php artisan serve\" ; ";
        $command .= "new-tab -d \"$projectPath\" cmd /k \"title Queue Worker && php artisan queue:work\" ; ";
        $command .= "new-tab -d \"$projectPath\" cmd /k \"title Reverb WebSocket && php artisan reverb:start\" ; ";
        $command .= "new-tab -d \"$projectPath\" cmd /k \"title Scheduler && php artisan schedule:work\" ; ";
        $command .= "new-tab -d \"$projectPath\" cmd /k \"title AMI Connection && php artisan app:listen-to-ami\"";

        $process = Process::fromShellCommandline($command);
        $process->setWorkingDirectory($projectPath);
        $process->start();

        $this->info('All services started successfully in a single window with multiple tabs!');
        $this->info('Close the window or press Ctrl+C in each tab to stop the services when done.');

        return Command::SUCCESS;
    }
}
