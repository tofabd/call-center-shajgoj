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
        // NOTE: This command supports both Windows and Linux environments.
        // - For Windows: Uncomment the Windows-specific code block at the end of this method and comment out the Linux code below.
        // - For Linux (Alma Linux): Keep the Linux code active (as it is now) and ensure tmux is installed for best results.
        // To switch: Simply comment/uncomment the respective code blocks and adjust the return statement if needed.

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

        // Original Windows-specific code (commented out for Linux compatibility)
        /*
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
        */
    }

    private function stopServices()
    {
        $this->info('Stopping all services...');

        // Kill tmux session if exists
        $tmuxKill = shell_exec('tmux kill-session -t call-center-services 2>/dev/null');
        if ($tmuxKill !== null) {
            $this->info('Tmux session killed.');
        }

        // Kill background processes
        $processes = ['artisan serve', 'artisan queue:work', 'artisan reverb:start', 'artisan app:listen-to-ami'];
        foreach ($processes as $proc) {
            $pids = shell_exec("ps aux | grep '$proc' | grep -v grep | awk '{print \$2}'");
            if ($pids) {
                shell_exec("kill $pids 2>/dev/null");
                $this->info("Killed processes for: $proc");
            }
        }

        $this->info('All services stopped.');
    }

    private function showStatus()
    {
        $this->info('Checking status of services...');

        // Check tmux session
        $tmuxStatus = shell_exec('tmux list-sessions 2>/dev/null | grep call-center-services');
        if ($tmuxStatus) {
            $this->info('Tmux session "call-center-services" is running.');
            $panes = shell_exec('tmux list-panes -t call-center-services 2>/dev/null | wc -l');
            $this->info('Number of panes: ' . trim($panes));
        } else {
            $this->info('No tmux session found.');
        }

        // Check individual processes
        $processes = [
            'Laravel Server' => 'artisan serve',
            'Queue Worker' => 'artisan queue:work',
            'Reverb WebSocket' => 'artisan reverb:start',
            'AMI Connection' => 'artisan app:listen-to-ami'
        ];

        foreach ($processes as $name => $proc) {
            $running = shell_exec("ps aux | grep '$proc' | grep -v grep");
            if ($running) {
                $this->info("$name: Running");
            } else {
                $this->info("$name: Not running");
            }
        }
    }
}
