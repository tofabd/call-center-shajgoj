<?php

namespace App\Services\Ami\Features\Extensions;

use App\Services\Ami\Support\AmiCommand;
use App\Services\Ami\Support\CommandTypes;
use App\Services\Ami\Support\ResponseTypes;

class ExtensionStateListCommand extends AmiCommand
{
    public function __construct()
    {
        parent::__construct();
        $this->setExpectsMultipleEvents(true, ResponseTypes::EXTENSION_STATE_LIST_COMPLETE);
        $this->setTimeout(20000); // 20 seconds for bulk query
    }

    public function getAction(): string
    {
        return CommandTypes::EXTENSION_STATE_LIST;
    }
}

class ExtensionStateCommand extends AmiCommand
{
    public function __construct(string $extension, string $context = 'ext-local')
    {
        parent::__construct([
            'Exten' => $extension,
            'Context' => $context
        ]);
    }

    public function getAction(): string
    {
        return CommandTypes::EXTENSION_STATE;
    }
}

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