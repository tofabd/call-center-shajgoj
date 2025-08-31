# Asterisk AMI Integration for MongoDB API

This implementation provides real-time call tracking and extension status monitoring by connecting to Asterisk Manager Interface (AMI), similar to the Laravel version but adapted for MongoDB and Node.js.

## Features

### 📞 **Call Tracking**
- **Real-time call monitoring** from Asterisk AMI events
- **Call lifecycle management** (Newchannel → Newstate → DialBegin → BridgeEnter → BridgeLeave → Hangup)
- **Direction detection** (incoming/outgoing) based on context and number patterns
- **Phone number extraction** from various AMI fields (DialString, CallerIDNum, etc.)
- **Call statistics** and analytics

### 📱 **Extension Status Monitoring**
- **Real-time extension status updates** from ExtensionStatus events
- **Status mapping** for Asterisk 18.9.0 compatibility
- **Extension registration tracking**

### 📊 **Data Models**
- **Call** - Master call records with linkedid
- **CallLeg** - Individual channel legs within a call
- **BridgeSegment** - Call bridge tracking for agent connections
- **Extension** - Extension status and metadata

## API Endpoints

### Calls API (`/api/calls`)
```
GET    /api/calls              # Get all calls with pagination/filtering
GET    /api/calls/statistics   # Get call statistics  
GET    /api/calls/live         # Get active/live calls
GET    /api/calls/:id          # Get call details by ID
```

### Extensions API (`/api/extensions`)
```
GET    /api/extensions              # Get all extensions
GET    /api/extensions/statistics   # Get extension statistics
POST   /api/extensions              # Create new extension
PUT    /api/extensions/status       # Update extension status (AMI)
GET    /api/extensions/:id          # Get extension by ID
PUT    /api/extensions/:id          # Update extension
DELETE /api/extensions/:id          # Delete extension
```

## Configuration

### Environment Variables (`.env`)
```bash
# MongoDB
MONGODB_URI=mongodb://localhost:27017/call_center_shajgoj

# Asterisk AMI
AMI_HOST=103.177.125.83
AMI_PORT=5038
AMI_USERNAME=admin
AMI_PASSWORD=Tractor@0152
ENABLE_AMI_LISTENER=true
```

## Usage

### 1. Start API Server with Managed AMI Service
```bash
cd /path/to/api
npm run dev
```

### 2. Start Managed AMI Service Only (for testing)
```bash
cd /path/to/api
npm run listen-ami
```

### 3. Test API Endpoints
```bash
# Get recent calls
curl http://localhost:3000/api/calls

# Get call statistics
curl http://localhost:3000/api/calls/statistics

# Get extensions
curl http://localhost:3000/api/extensions

# Get extension statistics
curl http://localhost:3000/api/extensions/statistics
```

## AMI Event Handling

### Call Events
- **Newchannel** → Creates Call and CallLeg records
- **Newstate** → Updates call state, detects when answered
- **DialBegin** → Detects outgoing calls, extracts dialed number
- **DialEnd** → Sets call disposition (ANSWER, BUSY, NOANSWER, etc.)
- **BridgeEnter** → Tracks when calls are bridged to agents
- **BridgeLeave** → Tracks when calls leave bridges
- **Hangup** → Marks calls/legs as ended

### Extension Events
- **ExtensionStatus** → Updates extension online/offline status

## Key Differences from Laravel Version

### ✅ **Similarities**
- Same AMI event handling logic
- Same number normalization and extraction algorithms
- Same call flow tracking approach
- Same extension status mapping

### 🔄 **Adaptations**
- **MongoDB models** instead of Laravel Eloquent
- **Node.js net socket** instead of PHP socket functions
- **Express.js REST API** instead of Laravel API
- **No real-time broadcasting** (frontend uses polling)
- **Promise-based async/await** instead of PHP synchronous code

## Testing

### Monitor AMI Events
```bash
# Terminal 1: Start managed AMI service
npm run listen-ami

# Terminal 2: Make a test call through Asterisk
# Watch the console for AMI events and database updates

# Terminal 3: Check API
curl http://localhost:3000/api/calls | jq
```

### Extension Status Testing
```bash
# Check extension status via API
curl http://localhost:3000/api/extensions | jq

# Extension statuses will update automatically as AMI events are received
```

## Troubleshooting

### AMI Connection Issues
1. **Check network connectivity** to AMI server
2. **Verify AMI credentials** in `.env` file
3. **Check AMI user permissions** for event access
4. **Review firewall settings**

### Database Issues
1. **Ensure MongoDB is running**
2. **Check database connection string**
3. **Verify collections are created**

### Debugging
```bash
# Enable detailed logging
NODE_ENV=development npm run dev

# Or start the managed AMI service separately for focused debugging
npm run listen-ami
```

## Status Mapping

### Extension Status (Asterisk → API)
```
0  (NotInUse)    → online
1  (InUse)       → online  
2  (Busy)        → online
4  (Unavailable) → offline
8  (Ringing)     → online
16 (Ringinuse)   → online
-1 (Unknown)     → unknown
```

## Architecture

```
Asterisk AMI → AmiService → MongoDB Models → REST API → Frontend
     ↓              ↓              ↓            ↓         ↓
   Events      Parse & Map    Store Data   Expose API   Poll Data
```

This implementation provides the same core functionality as the Laravel version while being adapted for the MongoDB API architecture and maintaining compatibility with the existing frontend.