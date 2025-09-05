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