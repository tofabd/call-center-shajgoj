# Enhanced Extension Status Implementation

## Overview
This implementation enhances the extension status management system with detailed Asterisk status tracking, including status codes, device states, and precise timestamp management.

## Database Schema Changes

### New Extension Collection Structure
```javascript
{
  _id: ObjectId("..."),
  
  // 1. IDENTIFICATION
  extension: "1001",                       // Extension number (unique, required)
  agent_name: "John Doe",                  // Agent's full name
  department: "Sales",                     // Department assignment
  
  // 2. STATUS INFORMATION
  status_code: 0,                          // Raw Asterisk status: 0,1,2,4,8,16
  device_state: "NOT_INUSE",               // Asterisk device state
  status: "online",                        // Simplified: online/offline/unknown
  
  // 3. TIMESTAMPS
  last_status_change: ISODate("..."),      // When status actually changed
  last_seen: ISODate("..."),               // When last updated by system
  
  // 4. CONFIGURATION
  is_active: true,                         // Whether extension is enabled
  createdAt: ISODate("..."),               // When extension was created
  updatedAt: ISODate("...")                // When extension was last updated
}
```

## Status Code Mapping

### Asterisk Status Codes
| Code | Device State | Status | Description |
|------|--------------|---------|-------------|
| 0 | NOT_INUSE | online | Available for calls |
| 1 | INUSE | online | Currently on a call |
| 2 | BUSY | online | Busy/engaged |
| 4 | UNAVAILABLE | offline | Not available |
| 8 | RINGING | online | Ringing (incoming call) |
| 16 | RING*INUSE | online | Ringing while on another call |
| -1 | UNKNOWN | unknown | Status unknown |

## Implementation Details

### Backend Changes

#### 1. Extension Model (`api/models/Extension.js`)
- Added `status_code`, `device_state`, `last_status_change` fields
- Enhanced validation and indexing
- New utility methods for status management

#### 2. AMI Listener (`api/services/AmiListener.js`)
- Updated `handleExtensionStatus` to process new fields
- Added `mapDeviceState` method for device state mapping
- Enhanced status code processing

#### 3. Extension Controller (`api/controllers/extensionController.js`)
- Updated CRUD operations for new schema
- Protected status fields from manual updates
- Enhanced validation

#### 4. Broadcast Service (`api/services/BroadcastService.js`)
- Enhanced extension status broadcasting
- Includes all new fields in real-time updates

### Frontend Changes

#### 1. Type Definitions (`frontend/src/types/extension.ts`)
- New TypeScript interfaces for enhanced schema
- Constants for status codes and device states
- Request/response type definitions

#### 2. Extension Service (`frontend/src/services/extensionService.ts`)
- Updated Extension interface
- Enhanced data mapping for new fields
- Backward compatibility maintained

#### 3. ExtensionsStatus Component (`frontend/src/components/CallConsole/ExtensionsStatus.tsx`)
- Displays device state information
- Shows status change timestamps
- Enhanced real-time updates

## Usage

### 1. Database Setup
```bash
# Run the new seed script
node api/scripts/seedExtensionsNew.js
```

### 2. API Endpoints
```bash
# Get all extensions
GET /api/extensions

# Create extension
POST /api/extensions
{
  "extension": "1001",
  "agent_name": "John Doe",
  "department": "Sales"
}

# Update extension
PUT /api/extensions/:id
{
  "agent_name": "John Smith",
  "department": "Support"
}
```

### 3. Real-time Updates
The system automatically broadcasts extension status changes via WebSocket:
```javascript
// Frontend subscription
socketService.onExtensionStatusUpdated((update) => {
  console.log('Extension updated:', update);
  // update.extension, update.status, update.device_state, etc.
});
```

## Benefits

### 1. **Detailed Status Tracking**
- Raw Asterisk status codes preserved
- Human-readable device states
- Precise timestamp management

### 2. **Real-time Monitoring**
- Immediate status updates via AMI events
- WebSocket broadcasting for frontend
- Automatic fallback to database polling

### 3. **Performance Optimized**
- Efficient indexing on status fields
- Minimal database writes
- Smart status change detection

### 4. **Business Intelligence**
- Agent availability tracking
- Status duration analysis
- Department-level monitoring

## Monitoring and Debugging

### 1. **Logs**
- AMI event processing logs
- Database update confirmations
- Real-time broadcast notifications

### 2. **Status Verification**
```javascript
// Check extension status
const extension = await Extension.findOne({ extension: '1001' });
console.log('Status:', extension.status);
console.log('Device State:', extension.device_state);
console.log('Last Change:', extension.last_status_change);
```

### 3. **Health Checks**
- Connection status monitoring
- Update frequency tracking
- Error rate monitoring

## Future Enhancements

### 1. **Advanced Status Types**
- Break status management
- Custom status codes
- Status history tracking

### 2. **Analytics Dashboard**
- Status duration charts
- Agent performance metrics
- Department comparisons

### 3. **Integration Features**
- CRM system integration
- Workforce management
- Reporting automation

## Troubleshooting

### Common Issues

#### 1. **Status Not Updating**
- Check AMI connection
- Verify extension registration
- Check database connectivity

#### 2. **Real-time Updates Not Working**
- Verify WebSocket connection
- Check broadcast service
- Monitor event emission

#### 3. **Database Errors**
- Validate schema compatibility
- Check field constraints
- Verify indexes

### Debug Commands
```bash
# Check MongoDB connection
mongosh call_center_shajgoj

# View extensions
db.extensions.find().pretty()

# Check indexes
db.extensions.getIndexes()

# Monitor real-time updates
db.extensions.watch()
```

## Support

For issues or questions:
1. Check the logs for error messages
2. Verify database connectivity
3. Test AMI connection status
4. Review real-time update flow

---

**Version**: 2.0.0  
**Last Updated**: January 2024  
**Compatibility**: Asterisk 18.19.0+, Node.js 16+
