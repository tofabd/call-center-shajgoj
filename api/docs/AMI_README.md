# Asterisk AMI Integration for Call Center

This Node.js application provides comprehensive Asterisk Manager Interface (AMI) integration for real-time call monitoring and management. It has been designed to match the functionality of the PHP Laravel implementation while providing additional production-ready features.

## 🚀 Features

### Core AMI Functionality
- **Real-time Call Monitoring** - Tracks all incoming/outgoing calls
- **Extension Status Tracking** - Monitors agent extension status (online/offline/unknown)
- **Call Flow Management** - Handles call states, bridging, and hangups
- **Direction Detection** - Automatically detects call direction (incoming/outgoing)
- **Number Normalization** - Properly formats phone numbers and extensions

### Event Processing
- `Newchannel` - New call channel creation
- `Newstate` - Channel state changes (ringing, answered, etc.)
- `Hangup` - Call termination events
- `DialBegin` - Outgoing call initiation
- `DialEnd` - Call disposition (answered, busy, etc.)
- `BridgeEnter/Leave` - Call bridging for agent connections
- `ExtensionStatus` - Agent extension status updates

### Advanced Features
- **Auto-reconnection** - Automatically reconnects on connection loss
- **Graceful Shutdown** - Proper cleanup on process termination
- **Process Monitoring** - Memory usage and heartbeat monitoring
- **Comprehensive Logging** - Detailed logging similar to Laravel's Log facade
- **Broadcasting Service** - Real-time event broadcasting for frontend integration
- **Database Integration** - MongoDB with optimized schemas and indexes

## 📋 Requirements

- Node.js 16+ 
- MongoDB 4.4+
- Asterisk Server with AMI enabled
- Network access to Asterisk AMI port (default: 5038)

## ⚙️ Configuration

### Environment Variables (.env)
```env
# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/call_center_shajgoj

# Asterisk AMI Configuration
AMI_HOST=103.177.125.83
AMI_PORT=5038
AMI_USERNAME=admin
AMI_PASSWORD=Tractor@0152

# Enable AMI Listener
ENABLE_AMI_LISTENER=true

# Logging Level (error, warn, info, debug)
LOG_LEVEL=info
```

## 🚀 Installation & Setup

### 1. Install Dependencies
```bash
cd api
npm install
```

### 2. Configure Environment
```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your Asterisk AMI credentials
nano .env
```

### 3. Seed Database (Optional)
```bash
npm run seed
```

### 4. Start AMI Listener

#### Option 1: Simple Start
```bash
npm run ami-process
```

#### Option 2: Development Mode (Auto-restart)
```bash
npm run ami-dev
```

#### Option 3: Using Scripts
**Windows:**
```cmd
start-ami-listener.bat
```

**Linux/Mac:**
```bash
chmod +x start-ami-listener.sh
./start-ami-listener.sh
```

## 📊 Database Schema

### Collections

#### calls
- `linkedid` (String, unique) - Asterisk call identifier
- `direction` ('incoming'|'outgoing') - Call direction
- `other_party` (String) - External phone number
- `agent_exten` (String) - Agent extension handling the call
- `started_at` (Date) - Call start time
- `answered_at` (Date) - When call was answered
- `ended_at` (Date) - Call end time
- `ring_seconds` (Number) - Ring duration
- `talk_seconds` (Number) - Talk duration
- `disposition` (String) - Final call result

#### calllegs
- `uniqueid` (String, unique) - Channel unique identifier
- `linkedid` (String) - Links to parent call
- `channel` (String) - Asterisk channel name
- `callerid_num` (String) - Caller ID number
- `start_time` (Date) - Channel start time
- `hangup_at` (Date) - Channel hangup time

#### extensions
- `extension` (String, unique) - Extension number
- `agent_name` (String) - Agent name
- `status` ('online'|'offline'|'unknown') - Current status
- `last_seen` (Date) - Last activity timestamp

#### bridgesegments
- `linkedid` (String) - Call identifier
- `agent_exten` (String) - Agent extension
- `entered_at` (Date) - Bridge entry time
- `left_at` (Date) - Bridge exit time

## 🔧 API Integration

### Real-time Events
The AMI listener broadcasts real-time events that can be consumed by your application:

```javascript
import broadcast from './services/BroadcastService.js';

// Listen to call updates
broadcast.onCallUpdated((call) => {
    console.log('Call updated:', call);
    // Update frontend, send notifications, etc.
});

// Listen to extension status changes
broadcast.onExtensionStatusUpdated((extension) => {
    console.log('Extension status changed:', extension);
    // Update agent status displays
});
```

### REST API Integration
The AMI listener works alongside the main API server. Calls and extensions can be queried via REST endpoints while AMI provides real-time updates.

## 🔍 Monitoring & Logging

### Log Levels
- **ERROR**: Critical errors and exceptions
- **WARN**: Warning conditions and high memory usage
- **INFO**: General information, call events, status changes
- **DEBUG**: Detailed debugging information, heartbeats

### Health Monitoring
```javascript
// Get health status programmatically
const health = amiProcess.getHealthStatus();
console.log(health);
```

Output:
```json
{
  "status": "healthy",
  "uptime": 3600,
  "pid": 12345,
  "memory": { "rss": 67108864, "heapUsed": 45088768 },
  "ami": { "connected": true, "reconnectAttempts": 0 },
  "mongodb": { "connected": true },
  "timestamp": "2024-08-25T10:30:00.000Z"
}
```

## 🐛 Troubleshooting

### Common Issues

#### AMI Connection Failed
- Verify AMI credentials in `.env`
- Check network connectivity to Asterisk server
- Ensure AMI is enabled in Asterisk configuration
- Check firewall settings for port 5038

#### MongoDB Connection Issues
- Verify MongoDB is running
- Check MONGODB_URI in `.env`
- Ensure database permissions are correct

#### High Memory Usage
- Monitor log warnings for memory alerts
- Consider restarting the process periodically in production
- Check for memory leaks in custom event handlers

### Log Examples

#### Successful Connection
```
[2024-08-25T10:30:00.000Z] INFO: 🚀 Starting AMI Listener Process...
[2024-08-25T10:30:01.000Z] INFO: ✅ Connected to MongoDB
[2024-08-25T10:30:02.000Z] INFO: 🔌 Connecting to Asterisk AMI at 103.177.125.83:5038...
[2024-08-25T10:30:03.000Z] INFO: ✅ AMI Authentication successful
```

#### Call Processing
```
[2024-08-25T10:35:00.000Z] INFO: AMI Newchannel event
{
  "linkedid": "1756118386.202808",
  "uniqueid": "1756118386.202808", 
  "channel": "SIP/2003-000052b3",
  "exten": "s",
  "context": "from-trunk",
  "callerIdNum": "01234567890"
}
[2024-08-25T10:35:01.000Z] INFO: Call direction decision: Call direction decided
{
  "linkedid": "1756118386.202808",
  "direction": "incoming",
  "context": "from-trunk",
  "is_master": true
}
```

## 🔄 Production Deployment

### Process Management
For production deployment, consider using a process manager like PM2:

```bash
# Install PM2
npm install -g pm2

# Start AMI listener with PM2
pm2 start ami-listener-process.js --name "ami-listener"

# Monitor
pm2 status
pm2 logs ami-listener

# Auto-restart on system boot
pm2 startup
pm2 save
```

### Docker Deployment
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .

CMD ["node", "ami-listener-process.js"]
```

## 📈 Performance Optimization

### Database Indexes
The application automatically creates optimized indexes:
- `calls.linkedid` (unique)
- `calls.started_at` (descending)
- `calls.agent_exten + started_at` (compound)
- `calllegs.uniqueid` (unique)
- `extensions.extension` (unique)

### Memory Management
- Automatic memory monitoring with alerts
- Graceful handling of high memory usage
- Process restart recommendations for long-running instances

## 🤝 Integration with Frontend

The AMI listener provides real-time data that can be consumed by WebSocket connections in your frontend application. See the existing `extensionRealtimeService.ts` for implementation patterns.

## 📞 Supported Call Flows

### Incoming Calls
1. External caller → Trunk → Queue/Extension
2. AMI detects via `from-trunk` context
3. Tracks through ringing → answered → ended states

### Outgoing Calls  
1. Agent Extension → Trunk → External number
2. AMI detects via `from-internal` or `macro-dialout-trunk` context
3. Extracts dialed number from DialString

### Extension Status
1. SIP registration events → Extension online/offline
2. Call activity → Extension busy/available
3. Real-time status broadcasting to frontend

## 🔗 Related Files
- `services/AmiListener.js` - Main AMI event processor
- `services/BroadcastService.js` - Real-time event broadcasting
- `services/LogService.js` - Comprehensive logging
- `models/` - Database schema definitions
- `listen-to-ami.js` - Simple AMI listener (legacy)
- `ami-listener-process.js` - Production-ready process manager