<?php

namespace App\Services\Ami\Core;

use App\Services\Ami\Support\AmiCommand;
use App\Services\Ami\Support\CommandTypes;

class CommandBuilder
{
    public static function login(string $username, string $password): string
    {
        return implode("\r\n", [
            'Action: Login',
            "Username: {$username}",
            "Secret: {$password}",
            '',
            ''
        ]);
    }

    public static function logoff(): string
    {
        return "Action: Logoff\r\n\r\n";
    }

    public static function ping(): string
    {
        return implode("\r\n", [
            'Action: Ping',
            'ActionID: Ping-' . time(),
            '',
            ''
        ]);
    }

    public static function extensionStateList(): string
    {
        return implode("\r\n", [
            'Action: ExtensionStateList',
            'ActionID: ExtStateList-' . time(),
            '',
            ''
        ]);
    }

    public static function extensionState(string $extension, string $context = 'ext-local'): string
    {
        return implode("\r\n", [
            'Action: ExtensionState',
            "Exten: {$extension}",
            "Context: {$context}",
            'ActionID: ExtState-' . $extension . '-' . time(),
            '',
            ''
        ]);
    }

    public static function deviceStateList(): string
    {
        return implode("\r\n", [
            'Action: DeviceStateList',
            'ActionID: DevStateList-' . time(),
            '',
            ''
        ]);
    }

    public static function deviceState(string $device): string
    {
        return implode("\r\n", [
            'Action: DeviceState',
            "Device: {$device}",
            'ActionID: DevState-' . str_replace('/', '-', $device) . '-' . time(),
            '',
            ''
        ]);
    }

    public static function sipPeers(): string
    {
        return implode("\r\n", [
            'Action: SIPpeers',
            'ActionID: SIPPeers-' . time(),
            '',
            ''
        ]);
    }

    public static function sipShowPeer(string $peer): string
    {
        return implode("\r\n", [
            'Action: SIPshowpeer',
            "Peer: {$peer}",
            'ActionID: SIPShowPeer-' . $peer . '-' . time(),
            '',
            ''
        ]);
    }

    public static function sipShowRegistry(): string
    {
        return implode("\r\n", [
            'Action: SIPshowregistry',
            'ActionID: SIPShowReg-' . time(),
            '',
            ''
        ]);
    }

    public static function coreShowChannels(): string
    {
        return implode("\r\n", [
            'Action: CoreShowChannels',
            'ActionID: Channels-' . time(),
            '',
            ''
        ]);
    }

    public static function status(string $channel): string
    {
        return implode("\r\n", [
            'Action: Status',
            "Channel: {$channel}",
            'ActionID: Status-' . str_replace('/', '-', $channel) . '-' . time(),
            '',
            ''
        ]);
    }

    public static function queueStatus(string $queue = null): string
    {
        $command = [
            'Action: QueueStatus',
            'ActionID: QueueStatus-' . time(),
        ];

        if ($queue) {
            $command[] = "Queue: {$queue}";
        }

        $command[] = '';
        $command[] = '';

        return implode("\r\n", $command);
    }

    public static function hangup(string $channel, ?string $cause = null): string
    {
        $command = [
            'Action: Hangup',
            "Channel: {$channel}",
            'ActionID: Hangup-' . str_replace('/', '-', $channel) . '-' . time(),
        ];

        if ($cause) {
            $command[] = "Cause: {$cause}";
        }

        $command[] = '';
        $command[] = '';

        return implode("\r\n", $command);
    }

    public static function originate(array $params): string
    {
        $required = ['Channel', 'Context', 'Exten', 'Priority'];
        
        foreach ($required as $param) {
            if (!isset($params[$param])) {
                throw new \InvalidArgumentException("Missing required parameter: {$param}");
            }
        }

        $command = [
            'Action: Originate',
            "Channel: {$params['Channel']}",
            "Context: {$params['Context']}",
            "Exten: {$params['Exten']}",
            "Priority: {$params['Priority']}",
            'ActionID: Originate-' . time(),
        ];

        // Optional parameters
        $optionals = ['CallerID', 'Timeout', 'Variable', 'Account', 'Application', 'Data', 'Async'];
        foreach ($optionals as $optional) {
            if (isset($params[$optional])) {
                $command[] = "{$optional}: {$params[$optional]}";
            }
        }

        $command[] = '';
        $command[] = '';

        return implode("\r\n", $command);
    }

    public static function command(string $cliCommand): string
    {
        return implode("\r\n", [
            'Action: Command',
            "Command: {$cliCommand}",
            'ActionID: Command-' . time(),
            '',
            ''
        ]);
    }

    public static function formatCommand(AmiCommand $command): string
    {
        $formatted = "Action: {$command->getAction()}\r\n";
        
        foreach ($command->getParameters() as $key => $value) {
            if ($value !== null && $value !== '') {
                $formatted .= "{$key}: {$value}\r\n";
            }
        }
        
        $formatted .= "\r\n";
        
        return $formatted;
    }

    public static function isValidAction(string $action): bool
    {
        $validActions = [
            CommandTypes::EXTENSION_STATE_LIST,
            CommandTypes::EXTENSION_STATE,
            CommandTypes::DEVICE_STATE_LIST,
            CommandTypes::DEVICE_STATE,
            CommandTypes::SIP_PEERS,
            CommandTypes::SIP_SHOW_PEER,
            CommandTypes::SIP_SHOW_REGISTRY,
            CommandTypes::CORE_SHOW_CHANNELS,
            CommandTypes::STATUS,
            CommandTypes::QUEUE_STATUS,
            CommandTypes::HANGUP,
            CommandTypes::ORIGINATE,
            CommandTypes::PING,
            CommandTypes::COMMAND,
            CommandTypes::LOGIN,
            CommandTypes::LOGOFF,
        ];

        return in_array($action, $validActions);
    }

    public static function generateActionId(string $prefix = 'Action'): string
    {
        return $prefix . '-' . time() . '-' . substr(md5(uniqid()), 0, 8);
    }
}