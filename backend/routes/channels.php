<?php

use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

// Channel for call console real-time notifications
Broadcast::channel('call-received-{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

// Channel for extension status updates (public channel)
Broadcast::channel('extensions', function () {
    return true; // Allow anyone to listen to extension updates
});

// Public channel for call console real-time updates
Broadcast::channel('call-console', function () {
    return true; // Allow anyone to listen to call updates
});

// Public channel for live call updates (active calls only)
Broadcast::channel('live-calls', function () {
    return true; // Allow anyone to listen to live call updates
});

// Public channel for call history updates (completed calls only)
Broadcast::channel('call-history', function () {
    return true; // Allow anyone to listen to completed call updates
});
