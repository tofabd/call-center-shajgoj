<?php

namespace App\Services\Ami\Support;

class CommandTypes
{
    // Extension Commands
    public const EXTENSION_STATE_LIST = 'ExtensionStateList';
    public const EXTENSION_STATE = 'ExtensionState';
    public const DEVICE_STATE_LIST = 'DeviceStateList';
    public const DEVICE_STATE = 'DeviceState';

    // SIP Commands
    public const SIP_PEERS = 'SIPpeers';
    public const SIP_SHOW_PEER = 'SIPshowpeer';
    public const SIP_SHOW_REGISTRY = 'SIPshowregistry';
    public const SIP_QUALIFY_PEER = 'SIPqualifypeer';

    // Channel Commands  
    public const CORE_SHOW_CHANNELS = 'CoreShowChannels';
    public const STATUS = 'Status';
    public const HANGUP = 'Hangup';

    // Queue Commands
    public const QUEUE_STATUS = 'QueueStatus';
    public const QUEUE_SUMMARY = 'QueueSummary';
    public const QUEUE_ADD = 'QueueAdd';
    public const QUEUE_REMOVE = 'QueueRemove';

    // System Commands
    public const PING = 'Ping';
    public const CORE_STATUS = 'CoreStatus';
    public const COMMAND = 'Command';
    public const LOGIN = 'Login';
    public const LOGOFF = 'Logoff';

    // Call Control Commands
    public const ORIGINATE = 'Originate';
    public const TRANSFER = 'Transfer';
    public const PARK = 'Park';
    public const MONITOR = 'Monitor';

    public static function getListCommands(): array
    {
        return [
            self::EXTENSION_STATE_LIST,
            self::DEVICE_STATE_LIST,
            self::SIP_PEERS,
            self::SIP_SHOW_REGISTRY,
            self::CORE_SHOW_CHANNELS,
            self::QUEUE_STATUS,
        ];
    }

    public static function getSingleCommands(): array
    {
        return [
            self::EXTENSION_STATE,
            self::DEVICE_STATE,
            self::SIP_SHOW_PEER,
            self::SIP_QUALIFY_PEER,
            self::STATUS,
            self::PING,
            self::CORE_STATUS,
        ];
    }

    public static function getActionCommands(): array
    {
        return [
            self::HANGUP,
            self::QUEUE_ADD,
            self::QUEUE_REMOVE,
            self::ORIGINATE,
            self::TRANSFER,
            self::PARK,
            self::MONITOR,
        ];
    }

    public static function isListCommand(string $command): bool
    {
        return in_array($command, self::getListCommands());
    }

    public static function isSingleCommand(string $command): bool
    {
        return in_array($command, self::getSingleCommands());
    }

    public static function isActionCommand(string $command): bool
    {
        return in_array($command, self::getActionCommands());
    }
}