<?php

namespace App\Services\Ami\Features\Channels;

use App\Services\Ami\Support\AmiCommand;
use App\Services\Ami\Support\CommandTypes;
use App\Services\Ami\Support\ResponseTypes;

class CoreShowChannelsCommand extends AmiCommand
{
    public function __construct()
    {
        parent::__construct();
        $this->setExpectsMultipleEvents(true, ResponseTypes::CORE_SHOW_CHANNELS_COMPLETE);
        $this->setTimeout(30000); // 30 seconds for channel query
    }

    public function getAction(): string
    {
        return CommandTypes::CORE_SHOW_CHANNELS;
    }
}