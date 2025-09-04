<?php

namespace App\Services\Ami\Features\Sip;

use App\Services\Ami\Core\AmiManager;

class SipService
{
    private AmiManager $amiManager;

    public function __construct(AmiManager $amiManager)
    {
        $this->amiManager = $amiManager;
    }

    public function getAllPeers(): array
    {
        // TODO: Implement SIP peers listing
        return [];
    }

    public function getPeerDetails(string $peer): ?array
    {
        // TODO: Implement individual peer details
        return null;
    }

    public function getRegistryStatus(): array
    {
        // TODO: Implement SIP registry status
        return [];
    }
}