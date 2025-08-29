# Database-Driven AMI Query Service Documentation

## Overview

The Database-Driven AMI Query Service provides **periodic extension status monitoring** by:
1. **Fetching extensions from database every 30 seconds**
2. **Querying each extension status via Asterisk AMI** 
3. **Updating database with latest status**
4. **Frontend fetches from database** (both automatic 30s refresh and manual refresh)

This approach ensures the database is the single source of truth while AMI provides real-time status updates.

## Key Features

### ✅ **Database-First Approach**
- **Source of Truth**: Database contains all extension data
- **Dynamic Discovery**: Extensions fetched from database each cycle
- **Automatic Sync**: New extensions automatically included
- **Consistent State**: All clients see same data from database

### ✅ **30-Second Periodic Updates** 
- **Backend Process**: AMI queries every 30 seconds
- **Frontend Auto-refresh**: Database fetch every 30 seconds  
- **Manual Override**: Immediate refresh on button click
- **Real-time Updates**: Socket.IO for instant notifications

### ✅ **Robust Status Management**
- **AMI Integration**: Direct ExtensionState queries
- **Database Updates**: Persistent status storage
- **Broadcasting**: Real-time frontend notifications
- **Fallback Handling**: Graceful error recovery

## Database-Driven Architecture

```
[Every 30 seconds]
AMI Query Service
    ↓ 1. Fetch Extensions
MongoDB Database (Extension.find({is_active: true}))
    ↓ 2. Query Status  
Asterisk AMI (ExtensionState for each extension)
    ↓ 3. Update Database
MongoDB Database (Extension.updateStatus())
    ↓ 4. Broadcast Updates
Socket.IO (extension-status-updated)
    ↓ 5. Frontend Updates
React Components (real-time via Socket.IO)

[Manual Refresh]
Frontend Refresh Button
    ↓ Triggers
POST /api/extensions/refresh
    ↓ Executes Same Process
AMI Query Service.manualRefresh()
    ↓ Then Frontend Reloads
GET /api/extensions (from database)

[Automatic Frontend Refresh]
Frontend Timer (30 seconds)
    ↓ Fetches
GET /api/extensions (from database)
```

## Configuration

### Environment Variables

```bash
# Enable/disable services
ENABLE_AMI_LISTENER=true          # Event-driven service
ENABLE_AMI_QUERY_SERVICE=true     # Query-driven service (NEW)

# AMI Connection
AMI_HOST=103.177.125.83
AMI_PORT=5038
AMI_USERNAME=admin
AMI_PASSWORD=Tractor@0152
```

### Query Interval

The query interval is set in `AmiQueryService.js`:

```javascript
this.queryIntervalMs = 30000; // 30 seconds
```

## API Endpoints

### Manual Refresh
```
POST /api/extensions/refresh
```

**Response:**
```json
{
  "success": true,
  "message": "Extension status refresh completed successfully",
  "data": {
    "success": true,
    "message": "Extension status refresh completed",
    "lastQueryTime": "2025-01-XX T XX:XX:XX.XXXZ",
    "extensionsChecked": 40,
    "statistics": {
      "successfulQueries": 15,
      "failedQueries": 0
    }
  }
}
```

### Service Status
```
GET /api/extensions/query-service/status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "connected": true,
    "queryInterval": 30000,
    "lastQueryTime": "2025-01-XX T XX:XX:XX.XXXZ",
    "extensionsMonitored": 40,
    "statistics": {
      "successfulQueries": 15,
      "failedQueries": 0
    },
    "isQuerying": false
  }
}
```

## Status Mapping

The service maps Asterisk extension states to simplified statuses:

| Asterisk Status | Description | Mapped Status |
|----------------|-------------|---------------|
| 0 | NotInUse (Available) | `online` |
| 1 | InUse (Busy but online) | `online` |
| 2 | Busy (Still registered) | `online` |
| 4 | Unavailable/Unregistered | `offline` |
| 8 | Ringing | `online` |
| 16 | Ringinuse | `online` |
| -1 | Unknown | `unknown` |

## Frontend Integration

### Manual Refresh Button

The `ExtensionsStatus.tsx` component now triggers AMI queries:

```typescript
const handleRefresh = useCallback(() => {
  console.log('🔄 Manual refresh triggered');
  setIsRefreshing(true);
  
  // Trigger AMI refresh
  extensionService.refreshStatus()
    .then((result) => {
      console.log('✅ AMI refresh completed:', result);
      return loadExtensions(true);
    })
    .catch((error) => {
      console.error('❌ AMI refresh failed:', error);
      return loadExtensions(true);
    })
    .finally(() => {
      setTimeout(() => {
        setIsRefreshing(false);
      }, 1000);
    });
}, []);
```

### Real-time Updates

Extension status updates are broadcast via Socket.IO:

```javascript
// Server-side broadcasting
broadcast.extensionStatusUpdated(updatedExtension);

// Frontend listening (existing code)
socketService.onExtensionStatusUpdated(handleExtensionUpdate);
```

## Usage

### Starting the Service

#### Option 1: Using npm scripts
```bash
# Start with both services
npm run start-with-query

# Development with auto-reload
npm run dev-with-query
```

#### Option 2: Using startup scripts
```bash
# Windows
start-with-ami-query.bat

# Linux/Mac
./start-with-ami-query.sh
```

#### Option 3: Environment variables
```bash
# Set environment variables
export ENABLE_AMI_QUERY_SERVICE=true
export ENABLE_AMI_LISTENER=true

# Start server
npm start
```

### Monitoring

#### Console Logs
```
🔌 Starting AMI Query Service - connecting to 103.177.125.83:5038...
🔗 AMI Query Service connected to Asterisk AMI
✅ AMI Query Service authentication successful
📋 Loading extension list from database...
📋 Loaded 40 active extensions for monitoring
⏰ Starting periodic extension status checks every 30 seconds
🔍 Starting periodic extension status check for 40 extensions...
📊 Query completed: 40 successful, 0 failed
✅ Extension status update completed: 40 extensions updated
```

#### Service Status API
```bash
curl http://localhost:3000/api/extensions/query-service/status
```

#### Manual Refresh API
```bash
curl -X POST http://localhost:3000/api/extensions/refresh
```

## Benefits

### 🎯 Reliable Status Updates
- **No missed events**: Direct queries ensure status accuracy
- **Consistent timing**: 30-second intervals provide regular updates
- **Fallback coverage**: Works even when events are disabled

### 🚀 Improved User Experience
- **Manual refresh**: Instant status updates on demand
- **Real-time updates**: Socket.IO integration for live frontend
- **Visual feedback**: Loading states and connection indicators

### 📊 Better Monitoring
- **Query statistics**: Success/failure tracking
- **Connection health**: Auto-reconnection and status monitoring
- **Service status**: API endpoints for monitoring tools

### 🔧 Flexibility
- **Configurable interval**: Easy to adjust query frequency
- **Independent operation**: Can run alongside or instead of event listener
- **Graceful degradation**: Handles connection failures and retries

## Troubleshooting

### Service Not Starting
1. Check AMI credentials in `.env`
2. Verify Asterisk AMI is accessible
3. Check console logs for connection errors

### No Status Updates
1. Verify extensions exist in database: `npm run check-extensions`
2. Check AMI Query Service status: `GET /api/extensions/query-service/status`
3. Test manual refresh: `POST /api/extensions/refresh`

### High Query Failures
1. Check Asterisk AMI performance
2. Verify network connectivity
3. Consider increasing query timeout
4. Review Asterisk AMI logs

### Frontend Not Updating
1. Check Socket.IO connection in browser console
2. Verify extension service is running
3. Test manual refresh button
4. Check for JavaScript errors

## Performance Considerations

### Query Load
- **40 extensions × 30-second interval = 1.33 queries/second**
- **Timeout**: 5 seconds per query
- **Concurrency**: All extensions queried simultaneously

### Database Impact
- **Updates**: Only when status changes
- **Indexes**: Optimized for extension lookups
- **Broadcasting**: Minimal overhead per update

### Network Usage
- **AMI connection**: Persistent socket connection
- **Query size**: ~50 bytes per query
- **Response size**: ~100 bytes per response

## Future Enhancements

1. **Dynamic intervals**: Adjust based on system load
2. **Selective monitoring**: Query only specific extension ranges
3. **Health metrics**: Detailed performance analytics
4. **Alert system**: Notifications for connection issues
5. **Load balancing**: Multiple AMI connections for high availability