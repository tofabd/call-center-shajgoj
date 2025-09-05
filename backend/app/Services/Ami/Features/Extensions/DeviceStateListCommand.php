<?php

namespace App\Services\Ami\Features\Extensions;

use App\Services\Ami\Support\AmiCommand;
use App\Services\Ami\Support\CommandTypes;
use App\Services\Ami\Support\ResponseTypes;

class DeviceStateListCommand extends AmiCommand
{
    public function __construct()
    {
        parent::__construct();
        $this->setExpectsMultipleEvents(true, ResponseTypes::DEVICE_STATE_LIST_COMPLETE);
        $this->setTimeout(20000);
    }

    public function getAction(): string
    {
        return CommandTypes::DEVICE_STATE_LIST;
    }
}