<?php

namespace App\Services\Ami\Features\Extensions;

use App\Services\Ami\Support\AmiCommand;
use App\Services\Ami\Support\CommandTypes;

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