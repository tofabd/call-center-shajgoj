<?php

namespace App\Services\Ami\Features\System;

use App\Services\Ami\Support\AmiCommand;
use App\Services\Ami\Support\CommandTypes;

class PingCommand extends AmiCommand
{
    public function getAction(): string
    {
        return CommandTypes::PING;
    }
}

class CoreStatusCommand extends AmiCommand
{
    public function getAction(): string
    {
        return CommandTypes::CORE_STATUS;
    }
}

class CommandCommand extends AmiCommand
{
    public function __construct(string $cliCommand)
    {
        parent::__construct([
            'Command' => $cliCommand
        ]);
    }

    public function getAction(): string
    {
        return CommandTypes::COMMAND;
    }
}