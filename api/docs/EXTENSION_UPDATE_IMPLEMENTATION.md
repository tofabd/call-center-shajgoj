# Extension Status Update Implementation

## Overview

This implementation provides a comprehensive solution for managing extension status updates using AMI ExtensionStateList queries with detailed Pino logging and real-time broadcasting to the frontend.

## Key Features

### 1. ExtensionStateList Query
- **Single Query**: Uses `ExtensionStateList` instead of individual `ExtensionState` queries
- **Bulk Processing**: Fetches all extension statuses in one AMI call
- **Efficient**: Reduces AMI load and improves performance

### 2. Database-Driven Approach
- **Active Extensions Only**: Only processes extensions marked as `is_active: true`
- **Change Detection**: Only updates database when status actually changes
- **Audit Trail**: Tracks what changed and what remained unchanged

### 3. Pino Logging Integration
- **Structured Logging**: Detailed logs with component identification
- **Performance Metrics**: Tracks query times and success rates
- **Change Summary**: Shows which extensions were updated vs unchanged

### 4. Real-Time Broadcasting
- **Socket.IO Integration**: Broadcasts changes to connected frontend clients
- **Event-Driven**: Immediate updates when status changes
- **Frontend Sync**: Keeps frontend in sync with database state

## Implementation Details

### HybridAmiService Implementation

#### New Methods
```javascript
// Query all extensions at once (bulk)
async queryExtensionStateList()

// Query individual extension
async queryExtensionStatus(extensionNumber)

// Parse AMI response
parseExtensionStateListResponse(response)

// Map extension status codes
mapExtensionStatus(statusCode)
```

#### Enhanced Status Check Process
1. **Fetch Active Extensions**: Get all `is_active: true` extensions from database
2. **AMI Query**: Use `ExtensionStateList` to get all statuses
3. **Change Detection**: Compare current vs new status
4. **Database Update**: Only update changed extensions
5. **Broadcast**: Send updates to frontend
6. **Logging**: Detailed logs of the entire process

### Logging Structure

#### Component Loggers
- `HybridAmiService`: AMI connection and query operations
- `ExtensionController`: API endpoint operations
- `BroadcastService`: Real-time event broadcasting
- `MainApp`: Server lifecycle and Socket.IO events
- `HTTP`: Request/response logging

#### Log Levels
- `info`: Normal operations and status updates
- `warn`: Non-critical issues (extensions not found, etc.)
- `error`: Critical errors and failures
- `debug`: Detailed debugging information

### Database Schema

#### Extension Model Updates
```javascript
// Status update method with change detection
updateStatus(extension, statusCode, deviceState)

// Status mapping
mapStatus(statusCode)

// Device state mapping
mapDeviceState(statusCode)
```

## Usage

### Manual Refresh
```bash
# API endpoint
POST /api/extensions/refresh

# Test script
npm run test-extension-update

# Bulk query test
npm run test-bulk-extension-query
```

### Periodic Updates
- **Interval**: 30 seconds (configurable)
- **Automatic**: Runs in background
- **Logging**: Detailed logs for each cycle

### Frontend Integration
```javascript
// Socket.IO event listener
socket.on('extension-status-updated', (data) => {
  console.log('Extension updated:', data);
  // Update UI with new status
});
```

## Configuration

### Environment Variables
```bash
# AMI Connection
AMI_HOST=103.177.125.83
AMI_PORT=5038
AMI_USERNAME=admin
AMI_PASSWORD=Tractor@0152

# Query Service
ENABLE_AMI_QUERY_SERVICE=true
QUERY_INTERVAL_MS=30000

# Logging
LOG_LEVEL=info
```

### Logging Configuration
```javascript
// Component-specific logging
const logger = createComponentLogger('ComponentName');

// Usage examples
logger.info('Operation completed', { data: result });
logger.warn('Non-critical issue', { extension: '1001' });
logger.error('Critical error', { error: err.message });
```

## Monitoring and Debugging

### Log Output Examples

#### Successful Update Cycle
```
[Component:AmiQueryService] 🔍 Starting extension status check with ExtensionStateList...
[Component:AmiQueryService] 📋 Found 25 active extensions in database
[Component:AmiQueryService] 📊 AMI returned 23 extension statuses
[Component:AmiQueryService] 📝 Updated extension 1001: offline → online (4 → 0)
[Component:AmiQueryService] 📝 Updated extension 1002: online → offline (0 → 4)
[Component:AmiQueryService] ✅ Extensions unchanged: 1003, 1004, 1005
[Component:AmiQueryService] ⚠️ Extensions not found in AMI: 1006, 1007
[Component:AmiQueryService] 📊 Extension Status Update Summary: {
  "totalExtensions": 25,
  "updated": 2,
  "unchanged": 21,
  "notFound": 2
}
```

#### Error Handling
```
[Component:AmiQueryService] ❌ ExtensionStateList query failed: {
  "error": "Connection timeout"
}
[Component:AmiQueryService] 🔄 Scheduling reconnection attempt 1/10 in 5000ms
```

### Performance Metrics
- **Query Time**: Time taken for AMI ExtensionStateList query
- **Update Count**: Number of extensions actually updated
- **Success Rate**: Percentage of successful query cycles
- **Error Tracking**: Detailed error logging with context

## Testing

### Test Script
```bash
npm run test-extension-update
```

### Manual Testing
```bash
# Start API with query service
npm run start-with-query

# Monitor logs
tail -f logs/api.log

# Test manual refresh
curl -X POST http://localhost:3000/api/extensions/refresh
```

## Benefits

1. **Performance**: Single AMI query instead of multiple individual queries
2. **Reliability**: Comprehensive error handling and reconnection logic
3. **Observability**: Detailed logging for monitoring and debugging
4. **Real-time**: Immediate frontend updates via Socket.IO
5. **Efficiency**: Only updates changed extensions in database
6. **Scalability**: Handles large numbers of extensions efficiently

## Troubleshooting

### Common Issues

1. **AMI Connection Failed**
   - Check AMI credentials and network connectivity
   - Verify Asterisk AMI is enabled and accessible

2. **Extensions Not Found**
   - Verify extensions exist in database with `is_active: true`
   - Check AMI context configuration

3. **No Updates Broadcast**
   - Verify Socket.IO connection on frontend
   - Check broadcast service is properly initialized

### Debug Commands
```bash
# Check service status
curl http://localhost:3000/api/extensions/query-service-status

# View recent logs
tail -f logs/api.log | grep "AmiQueryService"

# Test AMI connection
telnet 103.177.125.83 5038
```

## Future Enhancements

1. **Metrics Dashboard**: Web-based monitoring interface
2. **Alert System**: Notifications for critical issues
3. **Historical Data**: Track status changes over time
4. **Performance Optimization**: Caching and query optimization
5. **Health Checks**: Automated health monitoring

