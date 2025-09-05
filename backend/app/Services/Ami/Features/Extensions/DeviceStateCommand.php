<?php

namespace App\Services\Ami\Features\Extensions;

use App\Services\Ami\Support\AmiCommand;
use App\Services\Ami\Support\CommandTypes;

class DeviceStateCommand extends AmiCommand
{
    public function __construct(string $device)
    {
        parent::__construct([
            'Device' => $device
        ]);
    }

    public function getAction(): string
    {
        return CommandTypes::DEVICE_STATE;
    }
}