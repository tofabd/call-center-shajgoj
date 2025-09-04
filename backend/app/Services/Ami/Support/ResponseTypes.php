<?php

namespace App\Services\Ami\Support;

class ResponseTypes
{
    // Extension Events
    public const EXTENSION_STATUS = 'ExtensionStatus';
    public const EXTENSION_STATE_LIST_COMPLETE = 'ExtensionStateListComplete';
    public const DEVICE_STATE_CHANGE = 'DeviceStateChange';
    public const DEVICE_STATE_LIST_COMPLETE = 'DeviceStateListComplete';

    // SIP Events
    public const PEER_ENTRY = 'PeerEntry';
    public const PEER_LIST_COMPLETE = 'PeerlistComplete';
    public const REGISTRY_ENTRY = 'RegistryEntry';
    public const REGISTRATIONS_COMPLETE = 'RegistrationsComplete';

    // Channel Events
    public const CORE_SHOW_CHANNEL = 'CoreShowChannel';
    public const CORE_SHOW_CHANNELS_COMPLETE = 'CoreShowChannelsComplete';
    public const NEWCHANNEL = 'Newchannel';
    public const HANGUP_EVENT = 'Hangup';

    // Queue Events
    public const QUEUE_PARAMS = 'QueueParams';
    public const QUEUE_MEMBER = 'QueueMember';
    public const QUEUE_STATUS_COMPLETE = 'QueueStatusComplete';

    // System Events
    public const PONG = 'Pong';
    public const RESPONSE = 'Response';

    // Status Response Messages
    public const SUCCESS = 'Success';
    public const ERROR = 'Error';
    public const FOLLOWS = 'Follows';

    public static function getCompletionEvents(): array
    {
        return [
            self::EXTENSION_STATE_LIST_COMPLETE,
            self::DEVICE_STATE_LIST_COMPLETE,
            self::PEER_LIST_COMPLETE,
            self::REGISTRATIONS_COMPLETE,
            self::CORE_SHOW_CHANNELS_COMPLETE,
            self::QUEUE_STATUS_COMPLETE,
        ];
    }

    public static function getDataEvents(): array
    {
        return [
            self::EXTENSION_STATUS,
            self::DEVICE_STATE_CHANGE,
            self::PEER_ENTRY,
            self::REGISTRY_ENTRY,
            self::CORE_SHOW_CHANNEL,
            self::QUEUE_PARAMS,
            self::QUEUE_MEMBER,
        ];
    }

    public static function isCompletionEvent(string $event): bool
    {
        return in_array($event, self::getCompletionEvents());
    }

    public static function isDataEvent(string $event): bool
    {
        return in_array($event, self::getDataEvents());
    }

    public static function getCompletionEventFor(string $command): ?string
    {
        $mapping = [
            CommandTypes::EXTENSION_STATE_LIST => self::EXTENSION_STATE_LIST_COMPLETE,
            CommandTypes::DEVICE_STATE_LIST => self::DEVICE_STATE_LIST_COMPLETE,
            CommandTypes::SIP_PEERS => self::PEER_LIST_COMPLETE,
            CommandTypes::SIP_SHOW_REGISTRY => self::REGISTRATIONS_COMPLETE,
            CommandTypes::CORE_SHOW_CHANNELS => self::CORE_SHOW_CHANNELS_COMPLETE,
            CommandTypes::QUEUE_STATUS => self::QUEUE_STATUS_COMPLETE,
        ];

        return $mapping[$command] ?? null;
    }

    public static function getDataEventFor(string $command): ?string
    {
        $mapping = [
            CommandTypes::EXTENSION_STATE_LIST => self::EXTENSION_STATUS,
            CommandTypes::DEVICE_STATE_LIST => self::DEVICE_STATE_CHANGE,
            CommandTypes::SIP_PEERS => self::PEER_ENTRY,
            CommandTypes::SIP_SHOW_REGISTRY => self::REGISTRY_ENTRY,
            CommandTypes::CORE_SHOW_CHANNELS => self::CORE_SHOW_CHANNEL,
            CommandTypes::QUEUE_STATUS => [self::QUEUE_PARAMS, self::QUEUE_MEMBER],
        ];

        return $mapping[$command] ?? null;
    }
}