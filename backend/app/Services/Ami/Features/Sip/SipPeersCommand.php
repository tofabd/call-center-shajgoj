<?php

namespace App\Services\Ami\Features\Sip;

use App\Services\Ami\Support\AmiCommand;
use App\Services\Ami\Support\CommandTypes;
use App\Services\Ami\Support\ResponseTypes;

class SipPeersCommand extends AmiCommand
{
    public function __construct()
    {
        parent::__construct();
        $this->setExpectsMultipleEvents(true, ResponseTypes::PEER_LIST_COMPLETE);
        $this->setTimeout(20000);
    }

    public function getAction(): string
    {
        return CommandTypes::SIP_PEERS;
    }
}