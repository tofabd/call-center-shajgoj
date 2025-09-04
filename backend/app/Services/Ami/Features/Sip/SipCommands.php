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

class SipShowPeerCommand extends AmiCommand
{
    public function __construct(string $peer)
    {
        parent::__construct([
            'Peer' => $peer
        ]);
    }

    public function getAction(): string
    {
        return CommandTypes::SIP_SHOW_PEER;
    }
}

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