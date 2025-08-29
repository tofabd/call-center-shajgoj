# Pino Logging Setup for Call Center API

## Overview

This API has been upgraded from basic `console.log` statements to **Pino**, the fastest Node.js logging library. Pino provides structured JSON logging with minimal overhead, making it perfect for production environments.

## Why Pino?

### Performance Benefits
- **2-3x faster** than Winston and other logging libraries
- **Minimal overhead** - doesn't impact application performance
- **Zero-dependency** core with optional transports

### Production Benefits
- **Structured JSON logs** - easy to parse and analyze
- **Log aggregation ready** - works with ELK stack, Splunk, etc.
- **Container friendly** - logs to stdout/stderr for orchestration
- **Request correlation** - track requests across services

## Installation

The required packages are already added to `package.json`:

```bash
npm install
```

This installs:
- `pino` - Core logging library
- `pino-http` - HTTP request logging middleware
- `pino-pretty` - Pretty printing for development

## Configuration

### Environment Variables

```bash
# Log level (error, warn, info, debug, trace)
LOG_LEVEL=info

# Environment (development, production, test)
NODE_ENV=development
```

### Log Levels

| Level | Description | Use Case |
|-------|-------------|----------|
| `error` | Error conditions | Application errors, exceptions |
| `warn` | Warning conditions | Deprecated features, recoverable errors |
| `info` | General information | Request logs, service status |
| `debug` | Debug information | Detailed debugging info |
| `trace` | Trace information | Very detailed debugging |

## Usage

### Basic Logging

```javascript
import LogService from './src/services/LogService.js';

// Simple messages
LogService.info('User logged in');
LogService.error('Database connection failed');

// With context
LogService.info('Call updated', {
  callId: '12345',
  status: 'answered',
  duration: 300
});
```

### HTTP Request Logging

The API automatically logs all HTTP requests using `pino-http` middleware:

```javascript
// Automatically logs:
// - Request method, URL, status code
// - Response time
// - User agent, IP address
// - Request/response headers
```

### Socket.IO Event Logging

```javascript
// Socket events are automatically logged
LogService.socketEvent('connected', socketId);
LogService.socketEvent('disconnected', socketId, { reason: 'timeout' });
```

### Database Operation Logging

```javascript
LogService.database('insert', 'users', { 
  userId: '12345', 
  operation: 'create' 
});
```

## Environment-Specific Behavior

### Development (`NODE_ENV=development`)
- **Pretty printed** logs with colors
- **Full debug information**
- **Human-readable timestamps**
- **All log levels enabled**

### Production (`NODE_ENV=production`)
- **JSON structured logs**
- **Info level and above only**
- **ISO timestamps**
- **Optimized for log aggregation**

### Test (`NODE_ENV=test`)
- **Error level only**
- **No pretty printing**
- **Minimal output for clean test runs**

## Log Output Examples

### Development (Pretty)
```
[12:34:56.789] INFO: Server started successfully
    port: 3000
    endpoints: {
      api: "http://localhost:3000"
      health: "http://localhost:3000/health"
    }
```

### Production (JSON)
```json
{
  "level": 30,
  "time": "2024-01-15T12:34:56.789Z",
  "pid": 1234,
  "hostname": "server-01",
  "msg": "Server started successfully",
  "port": 3000,
  "endpoints": {
    "api": "http://localhost:3000",
    "health": "http://localhost:3000/health"
  }
}
```

## Advanced Features

### Request Correlation
Each request gets a unique ID for tracking across services:

```javascript
// Logs automatically include requestId
LogService.info('Processing user request', { userId: '12345' });
// Output: { "requestId": "req-abc123", "userId": "12345", ... }
```

### Custom Serializers
Pino automatically serializes common objects:

```javascript
// Error objects are automatically serialized
LogService.error('Database error', { 
  error: new Error('Connection failed'),
  collection: 'users' 
});
```

### Performance Monitoring
Response times are automatically logged:

```javascript
// HTTP requests show response time
// Socket events can include performance metrics
LogService.socketEvent('message_processed', socketId, { 
  processingTime: '45ms' 
});
```

## Migration from Console.log

### Before (Console)
```javascript
console.log('User connected:', userId);
console.error('Database error:', error.message);
```

### After (Pino)
```javascript
LogService.info('User connected', { userId });
LogService.error('Database error', { 
  error: error.message, 
  stack: error.stack 
});
```

## Monitoring and Alerting

### Log Aggregation
- **ELK Stack** (Elasticsearch, Logstash, Kibana)
- **Splunk**
- **Datadog**
- **AWS CloudWatch**

### Performance Metrics
- **Request response times**
- **Error rates by endpoint**
- **Database operation timing**
- **Socket connection metrics**

## Troubleshooting

### Common Issues

1. **Logs not appearing**
   - Check `LOG_LEVEL` environment variable
   - Verify `NODE_ENV` is set correctly

2. **Performance impact**
   - Ensure `NODE_ENV=production` in production
   - Check log level isn't set too low

3. **Log format issues**
   - Development: Check `pino-pretty` is installed
   - Production: Verify JSON output format

### Debug Mode
Enable debug logging temporarily:

```bash
LOG_LEVEL=debug NODE_ENV=development npm run dev
```

## Best Practices

1. **Use structured logging** - Always include context objects
2. **Set appropriate log levels** - Don't log everything in production
3. **Include correlation IDs** - Track requests across services
4. **Monitor log volume** - Prevent log flooding
5. **Use appropriate log levels** - Error for errors, Info for normal operations

## Performance Impact

- **Development**: Minimal impact with pretty printing
- **Production**: Near-zero overhead with JSON logging
- **Memory usage**: Very low memory footprint
- **CPU usage**: Minimal CPU overhead

## Next Steps

1. **Install dependencies**: `npm install`
2. **Set environment variables** in your `.env` file
3. **Test logging** in development mode
4. **Monitor performance** in production
5. **Set up log aggregation** for production monitoring
