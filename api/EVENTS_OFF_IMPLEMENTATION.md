# 🔌 Events: Off Implementation with ExtensionStateListComplete

## ✅ **What Changed**

### **1. Query Format Changed**
```javascript
// OLD: Events: on (real-time updates)
const query = `Action: ExtensionStateList\r\nActionID: ${actionId}\r\nContext: from-internal\r\nEvents: on\r\n\r\n`;

// NEW: Events: off (snapshot + completion event)
const query = `Action: ExtensionStateList\r\nActionID: ${actionId}\r\nContext: from-internal\r\nEvents: off\r\n\r\n`;
```

### **2. New Completion Flow**
```
1. Send ExtensionStateList with Events: off
2. Receive extension status events
3. Wait for Event: ExtensionStateListComplete
4. Send Action: Logoff to finish
5. Parse all events and update database
6. Broadcast changes to frontend
```

## 🔄 **Complete Flow Implementation**

### **Phase 1: Query Initiation**
```javascript
// Build the ExtensionStateList query with Events: off
const query = `Action: ExtensionStateList\r\nActionID: ${actionId}\r\nContext: from-internal\r\nEvents: off\r\n\r\n`;

// Send query to Asterisk
socket.write(query);
```

### **Phase 2: Event Collection**
```javascript
const dataHandler = (data) => {
  const dataStr = data.toString();
  responseBuffer += dataStr;
  lastEventTime = Date.now();
  eventCount++;

  // Count extensions in the response
  const extensionMatches = dataStr.match(/Extension: (\d+)/g);
  if (extensionMatches) {
    extensionCount += extensionMatches.length;
  }

  // Check for ExtensionStateListComplete event
  if (responseBuffer.includes('Event: ExtensionStateListComplete')) {
    completionEventDetected = true;
    console.log(`🎯 ExtensionStateListComplete event detected - list is complete`);
    
    // Send Logoff action to finish the query
    try {
      const logoffAction = `Action: Logoff\r\nActionID: ${actionId}-complete\r\n\r\n`;
      socket.write(logoffAction);
      console.log(`🔌 [HybridAmiService] Sent Logoff action after ExtensionStateListComplete`);
    } catch (logoffError) {
      console.warn(`⚠️ [HybridAmiService] Failed to send Logoff action:`, logoffError.message);
    }
    
    // Process response immediately after ExtensionStateListComplete
    setTimeout(() => {
      if (!isComplete) {
        isComplete = true;
        processResponse();
      }
    }, 500); // Shorter buffer since we have explicit completion
  }
};
```

### **Phase 3: Query Completion**
```javascript
// When ExtensionStateListComplete is received:
// 1. Mark completion event detected
// 2. Send Logoff action
// 3. Process response after 500ms buffer
// 4. Parse all extension data
// 5. Update database
// 6. Broadcast changes
```

## 🎯 **Key Benefits of Events: Off**

### **1. Predictable Completion**
- ✅ **Explicit completion signal** via ExtensionStateListComplete
- ✅ **No hanging queries** waiting for more events
- ✅ **Clean termination** with Logoff action
- ✅ **Deterministic behavior** for database updates

### **2. Efficient Processing**
- ✅ **Single snapshot** of all extension statuses
- ✅ **No real-time event noise** during query
- ✅ **Focused parsing** on extension data only
- ✅ **Faster completion** with explicit event

### **3. Better Resource Management**
- ✅ **Controlled query lifecycle** from start to finish
- ✅ **Proper cleanup** with Logoff action
- ✅ **No resource leaks** from hanging connections
- ✅ **Professional AMI protocol** compliance

## 📊 **Event Processing Flow**

### **Events: Off Response Structure**
```
Response: Follows
Event: ExtensionStatus
Extension: 1001
Status: 0
Context: from-internal

Event: ExtensionStatus
Extension: 1002
Status: 1
Context: from-internal

... (more extensions)

Event: ExtensionStateListComplete
ActionID: bulk-1234567890-abc123
EventList: Complete
```

### **Parsing Logic**
```javascript
// Parse extension data from Events: off format
if (line.startsWith('Event: ExtensionStatus') || line.startsWith('Event: ExtensionState')) {
  if (currentExtension) {
    extensions.push(currentExtension);
  }
  currentExtension = {
    extension: '',
    status: '',
    statusCode: '',
    context: '',
    eventType: line.split(': ')[1],
    timestamp: new Date().toISOString()
  };
} else if (currentExtension) {
  if (line.startsWith('Exten: ') || line.startsWith('Extension: ')) {
    currentExtension.extension = line.split(': ')[1];
  } else if (line.startsWith('Status: ')) {
    currentExtension.statusCode = line.split(': ')[1];
    currentExtension.status = this.mapExtensionStatus(line.split(': ')[1]);
  } else if (line.startsWith('Context: ')) {
    currentExtension.context = line.split(': ')[1];
  }
}
```

## 🔌 **Logoff Action Implementation**

### **When Logoff is Sent**
1. **✅ ExtensionStateListComplete received** - Send Logoff immediately
2. **⏰ Timeout reached** (20 seconds) - Send Logoff as fallback
3. **🔄 Manual stop request** - Send Logoff on demand

### **Logoff Action Format**
```javascript
// After ExtensionStateListComplete
const logoffAction = `Action: Logoff\r\nActionID: ${actionId}-complete\r\n\r\n`;

// On timeout
const logoffAction = `Action: Logoff\r\nActionID: ${actionId}-timeout\r\n\r\n`;

// Manual stop
const logoffAction = `Action: Logoff\r\nActionID: ${actionId}-stop\r\n\r\n`;
```

### **Expected Response**
```
Response: Goodbye
ActionID: {actionId}-complete
```

## 📝 **Database Update and Broadcasting**

### **After Query Completion**
```javascript
// 1. Parse all extension data
const extensions = this.parseExtensionStateListResponse(responseBuffer);

// 2. Update database for each extension
for (const dbExtension of validExtensions) {
  const amiExtension = amiExtensionMap.get(dbExtension.extension);
  
  if (amiExtension) {
    // Check if status changed
    const statusChanged = dbExtension.status !== amiExtension.status ||
                          dbExtension.status_code !== amiExtension.statusCode ||
                          dbExtension.device_state !== amiExtension.context;
    
    if (statusChanged) {
      // Update database
      await Extension.findByIdAndUpdate(dbExtension._id, {
        status: amiExtension.status,
        status_code: amiExtension.statusCode,
        device_state: amiExtension.context,
        last_seen: new Date(),
        last_status_change: new Date(),
        updated_at: new Date()
      });
      
      // Broadcast change
      const updatedExtension = await Extension.findById(dbExtension._id);
      if (updatedExtension) {
        broadcast.extensionStatusUpdated(updatedExtension);
      }
    }
  } else {
    // Mark as offline if not found
    if (dbExtension.status !== 'offline') {
      await Extension.findByIdAndUpdate(dbExtension._id, {
        status: 'offline',
        status_code: '4',
        device_state: 'UNAVAILABLE',
        last_seen: new Date(),
        last_status_change: new Date(),
        updated_at: new Date()
      });
      
      // Broadcast offline status
      const updatedExtension = await Extension.findById(dbExtension._id);
      if (updatedExtension) {
        broadcast.extensionStatusUpdated(updatedExtension);
      }
    }
  }
}
```

## 🚀 **API Endpoints**

### **Manual Refresh (Events: Off)**
```bash
POST /api/extensions/refresh
```

### **Stop Active Query**
```bash
POST /api/extensions/hybrid-refresh/{connectionId}/stop
```

### **Get Connection Status**
```bash
GET /api/extensions/hybrid-refresh/status
```

## 📊 **Logging and Monitoring**

### **Query Start**
```
🚀 [HybridAmiService] Starting ExtensionStateList query with Events: off...
📊 [HybridAmiService] Query initiated with ActionID: bulk-1234567890-abc123
```

### **ExtensionStateListComplete Received**
```
🎯 ExtensionStateListComplete event detected - list is complete
🔌 [HybridAmiService] Sent Logoff action after ExtensionStateListComplete
```

### **Query Completion**
```
✅ Events: off bulk query completed successfully
📊 [HybridAmiRefreshController] Events: off bulk query successful: {
  extensionsFound: 100,
  totalEvents: 101,
  extensionEvents: 100,
  bufferSize: 15420,
  completionEventDetected: true,
  queryFormat: 'Events: off with ExtensionStateListComplete'
}
```

### **Database Updates**
```
📝 [HybridAmiRefreshController] Extension 1001: online → busy (0 → 2)
📝 [HybridAmiRefreshController] Extension 1002: offline → online (4 → 0)
📝 [HybridAmiRefreshController] Extension 1003: online → offline (not found in AMI)
```

## 🎯 **Best Practices**

### **1. Use Events: Off for Manual Refresh**
- ✅ **Predictable completion** with ExtensionStateListComplete
- ✅ **Clean termination** with Logoff action
- ✅ **Efficient processing** without real-time noise
- ✅ **Reliable database updates**

### **2. Monitor Completion Events**
- ✅ **Track ExtensionStateListComplete** detection
- ✅ **Monitor Logoff actions** sent
- ✅ **Alert on missing** completion events
- ✅ **Log query completion** times

### **3. Handle Edge Cases**
- ✅ **Timeout fallback** if ExtensionStateListComplete missing
- ✅ **Manual stop capability** for long-running queries
- ✅ **Error handling** for Logoff failures
- ✅ **Resource cleanup** after completion

## ✅ **Summary**

The new **Events: off implementation** provides:

1. **✅ Predictable Query Completion**: ExtensionStateListComplete event
2. **✅ Clean Termination**: Automatic Logoff action after completion
3. **✅ Efficient Processing**: Single snapshot without real-time noise
4. **✅ Reliable Updates**: Database updates only after query completion
5. **✅ Real-time Broadcasting**: Frontend updates via Socket.IO
6. **✅ Professional Protocol**: Proper AMI protocol compliance

**Now your ExtensionStateList queries use Events: off, wait for ExtensionStateListComplete, send Logoff to finish, then update the database and broadcast changes!**
