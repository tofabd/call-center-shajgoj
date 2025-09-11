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
    protected $signature = 'app:start {action? : start, stop, or status}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Manage all required services: server, vite, queue, reverb, and AMI connection. Actions: start (default), stop, status';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $action = $this->argument('action') ?? 'start';

        switch ($action) {
            case 'start':
                $this->startServices();
                break;
            case 'stop':
                $this->stopServices();
                break;
            case 'status':
                $this->showStatus();
                break;
            default:
                $this->error('Invalid action. Use: start, stop, or status');
                return Command::FAILURE;
        }

        return Command::SUCCESS;
    }

    private function startServices()
    {
        // NOTE: This command is configured for Windows CMD environment.
        // - Uses Windows Terminal (wt) to open multiple tabs for each service.
        // - For Linux: Comment out the Windows code and uncomment the Linux code in startServices, stopServices, and showStatus methods.

        /*
        $this->info('Starting all services for Call Center AI...');

        $projectPath = base_path();

        // Check if tmux is available
        $tmuxAvailable = shell_exec('which tmux') !== null;

        if ($tmuxAvailable) {
            // Use tmux for Linux to create multiple panes in a single window
            $command = "tmux new-session -d -s call-center-services ; ";
            $command .= "tmux send-keys -t call-center-services:0.0 'cd \"$projectPath\" && php artisan serve' Enter ; ";
            $command .= "tmux split-window -t call-center-services -h ; ";
            $command .= "tmux send-keys -t call-center-services:0.1 'cd \"$projectPath\" && php artisan queue:work' Enter ; ";
            $command .= "tmux split-window -t call-center-services -v ; ";
            $command .= "tmux send-keys -t call-center-services:0.2 'cd \"$projectPath\" && php artisan reverb:start' Enter ; ";
            $command .= "tmux select-pane -t call-center-services:0.0 ; ";
            $command .= "tmux split-window -t call-center-services -v ; ";
            $command .= "tmux send-keys -t call-center-services:0.3 'cd \"$projectPath\" && php artisan app:listen-to-ami' Enter ; ";
            $command .= "tmux attach-session -t call-center-services";
        } else {
            // Fallback: Run sequentially in the current terminal (will block until stopped)
            $command = "cd \"$projectPath\" && ";
            $command .= "echo 'Starting Laravel Server...' && php artisan serve & ";
            $command .= "echo 'Starting Queue Worker...' && php artisan queue:work & ";
            $command .= "echo 'Starting Reverb WebSocket...' && php artisan reverb:start & ";
            $command .= "echo 'Starting AMI Connection...' && php artisan app:listen-to-ami & ";
            $command .= "wait";
        }

        $process = Process::fromShellCommandline($command);
        $process->setWorkingDirectory($projectPath);
        $process->start();

        if ($tmuxAvailable) {
            $this->info('All services started in tmux session "call-center-services".');
            $this->info('Attach to session: tmux attach-session -t call-center-services');
        } else {
            $this->info('All services started in background.');
        }
        $this->info('To stop services: php artisan app:start stop');
        */

        // Windows-specific code
        $this->info('Starting all services for Call Center AI in a single window...');

        $projectPath = base_path();

        // Command to start all services in Windows Terminal tabs
        $command = "wt -d \"$projectPath\" cmd /k \"title Laravel Server && php artisan serve\" ; ";
        $command .= "new-tab -d \"$projectPath\" cmd /k \"title Queue Worker && php artisan queue:work\" ; ";
        $command .= "new-tab -d \"$projectPath\" cmd /k \"title Reverb WebSocket && php artisan reverb:start\" ; ";
        $command .= "new-tab -d \"$projectPath\" cmd /k \"title AMI Connection && php artisan app:listen-to-ami\"";

        $process = Process::fromShellCommandline($command);
        $process->setWorkingDirectory($projectPath);
        $process->start();

        $this->info('All services started successfully in a single window with multiple tabs!');
        $this->info('Close the window or press Ctrl+C in each tab to stop the services when done.');

        return Command::SUCCESS;
    }

    private function stopServices()
    {
        $this->info('Stopping all services...');

        // Kill Windows Terminal tabs
        $titles = ['Laravel Server', 'Queue Worker', 'Reverb WebSocket', 'AMI Connection'];
        foreach ($titles as $title) {
            shell_exec("taskkill /FI \"WINDOWTITLE eq $title\" /F 2>nul");
            $this->info("Attempted to kill window: $title");
        }

        $this->info('All services stopped.');
    }

    private function showStatus()
    {
        $this->info('Checking status of services...');

        // Check Windows Terminal tabs
        $processes = [
            'Laravel Server' => 'Laravel Server',
            'Queue Worker' => 'Queue Worker',
            'Reverb WebSocket' => 'Reverb WebSocket',
            'AMI Connection' => 'AMI Connection'
        ];
        foreach ($processes as $name => $title) {
            $running = shell_exec("tasklist /FI \"WINDOWTITLE eq $title\" 2>nul | findstr \"$title\"");
            if ($running) {
                $this->info("$name: Running");
            } else {
                $this->info("$name: Not running");
            }
        }
    }
}
