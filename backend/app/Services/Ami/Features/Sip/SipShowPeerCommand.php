<?php

namespace App\Services\Ami\Features\Sip;

use App\Services\Ami\Support\AmiCommand;
use App\Services\Ami\Support\CommandTypes;

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