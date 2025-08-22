# Real-Time Extension Status Setup Guide

This guide will help you set up real-time extension status updates for your call center application.

## Overview

The system now provides real-time extension status updates using Laravel's broadcasting system. When an extension's status changes (online/offline), the change is immediately broadcasted to all connected frontend clients.

## Backend Setup

### 1. Install Broadcasting Dependencies

```bash
cd backend
composer require pusher/pusher-php-server
# OR for Redis
composer require predis/predis
```

### 2. Configure Broadcasting

Copy the configuration from `broadcasting-config-example.txt` to your `.env` file:

```env
# For Pusher (recommended for production)
BROADCAST_CONNECTION=pusher
PUSHER_APP_KEY=your_pusher_key
PUSHER_APP_SECRET=your_pusher_secret
PUSHER_APP_ID=your_pusher_app_id
PUSHER_APP_CLUSTER=mt1

# Enable broadcasting
BROADCAST_DRIVER=pusher
```

### 3. Queue Configuration (Required for Broadcasting)

```env
QUEUE_CONNECTION=redis
# OR
QUEUE_CONNECTION=database
```

### 4. Start Queue Worker

```bash
php artisan queue:work
```

### 5. Start AMI Listener

```bash
php artisan app:listen-to-ami
```

## Frontend Setup

### 1. Install Dependencies

```bash
cd frontend
npm install laravel-echo pusher-js
```

### 2. Environment Configuration

Copy the configuration from `frontend-env-example.txt` to your `.env` file:

```env
# For Pusher (production)
VITE_PUSHER_APP_KEY=your_pusher_key
VITE_PUSHER_APP_CLUSTER=mt1

# For Reverb (local development)
VITE_REVERB_APP_KEY=your_reverb_key
VITE_REVERB_HOST=127.0.0.1
VITE_REVERB_PORT=8080
VITE_REVERB_SCHEME=http
```

### 3. Start Development Server

```bash
npm run dev
```

## Testing Real-Time Updates

### 1. Backend Test

1. **Test Broadcasting System**:
   ```bash
   php artisan app:test-extension-broadcasting 1001 online
   ```

2. **Start the AMI listener**:
   ```bash
   php artisan app:listen-to-ami
   ```

3. **Change an extension's status in Asterisk**

4. **Check Laravel logs for broadcast events**:
   ```bash
   tail -f storage/logs/laravel.log
   ```

### 2. Frontend Test

1. Open the Agents Status component
2. Look for the "Live" indicator (green dot)
3. Change an extension status in Asterisk
4. Watch for immediate updates without page refresh

### 3. Debugging Commands

```bash
# Test broadcasting without AMI
php artisan app:test-extension-broadcasting

# Test specific extension and status
php artisan app:test-extension-broadcasting 1001 offline

# Check queue status
php artisan queue:work --once

# Check broadcasting configuration
php artisan config:show broadcasting
```

## Troubleshooting

### Broadcasting Not Working

1. Check queue worker is running: `php artisan queue:work`
2. Verify broadcasting configuration in `.env`
3. Check Laravel logs for errors

### Frontend Not Receiving Updates

1. Verify Echo.js is properly initialized
2. Check browser console for WebSocket errors
3. Ensure environment variables are set correctly

### AMI Connection Issues

1. Verify Asterisk AMI credentials
2. Check network connectivity to Asterisk server
3. Ensure AMI is enabled in Asterisk

## Features

- **Real-time Status Updates**: Extension status changes are broadcasted immediately
- **Live Connection Indicator**: Shows real-time connection status
- **Fallback Polling**: 60-second polling as backup
- **Status Animations**: Visual feedback for status changes
- **Last Update Timestamp**: Shows when last real-time update was received

## Architecture

```
Asterisk AMI → ListenToAmi Command → ExtensionService → ExtensionStatusUpdated Event → Broadcasting → Frontend Echo.js → Real-time UI Updates
```

## Performance Considerations

- Real-time updates reduce server load by eliminating constant polling
- Fallback polling ensures reliability
- Connection status monitoring provides user feedback
- Efficient event broadcasting using Laravel's queue system
