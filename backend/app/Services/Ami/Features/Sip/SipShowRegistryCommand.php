<?php

namespace App\Services\Ami\Features\Sip;

use App\Services\Ami\Support\AmiCommand;
use App\Services\Ami\Support\CommandTypes;
use App\Services\Ami\Support\ResponseTypes;

class SipShowRegistryCommand extends AmiCommand
{
    public function __construct()
    {
        parent::__construct();
        $this->setExpectsMultipleEvents(true, ResponseTypes::REGISTRATIONS_COMPLETE);
        $this->setTimeout(15000);
    }

    public function getAction(): string
    {
        return CommandTypes::SIP_SHOW_REGISTRY;
    }
}