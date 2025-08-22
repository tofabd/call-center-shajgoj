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
