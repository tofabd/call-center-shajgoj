# 🔌 Events: Off Flow - Complete Explanation

## ✅ **How Events: Off Actually Works**

### **Important: Events: off ≠ No Events**

Even with `Events: off`, Asterisk **STILL sends events** for extension statuses. The difference is:

- **Events: on**: Sends real-time events continuously + extension status events
- **Events: off**: Sends extension status events only + completion event

## 🔄 **Complete Flow with Events: Off**

### **Phase 1: Query Initiation**
```javascript
// Send query with Events: off
const query = `Action: ExtensionStateList\r\nActionID: ${actionId}\r\nContext: from-internal\r\nEvents: off\r\n\r\n`;
socket.write(query);
```

### **Phase 2: Asterisk Response (Events: off)**
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

Event: ExtensionStatus
Extension: 1003
Status: 4
Context: from-internal

... (one event per extension)

Event: ExtensionStateListComplete
ActionID: bulk-1234567890-abc123
EventList: Complete
```

### **Phase 3: Event Processing**
```javascript
// Each Event: ExtensionStatus gets parsed
if (line.startsWith('Event: ExtensionStatus') || line.startsWith('Event: ExtensionState')) {
  if (currentExtension) {
    extensions.push(currentExtension); // Save previous extension
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

### **Phase 4: Completion Detection**
```javascript
// Wait for ExtensionStateListComplete
if (responseBuffer.includes('Event: ExtensionStateListComplete')) {
  completionEventDetected = true;
  console.log(`🎯 ExtensionStateListComplete event detected - list is complete`);
  
  // Send Logoff to finish
  const logoffAction = `Action: Logoff\r\nActionID: ${actionId}-complete\r\n\r\n`;
  socket.write(logoffAction);
  
  // Process after 500ms buffer
  setTimeout(() => {
    if (!isComplete) {
      isComplete = true;
      processResponse();
    }
  }, 500);
}
```

### **Phase 5: Database Updates**
```javascript
// Parse all extension data from events
const extensions = this.parseExtensionStateListResponse(responseBuffer);

// Create map for quick lookup
const amiExtensionMap = new Map();
bulkAmiResponse.extensions.forEach(amiExt => {
  amiExtensionMap.set(amiExt.extension, amiExt);
});

// Update database for each extension
for (const dbExtension of validExtensions) {
  const amiExtension = amiExtensionMap.get(dbExtension.extension);
  
  if (amiExtension) {
    // Extension found - check if status changed
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
    // Extension not found - mark as offline
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

### **Phase 6: JSON File Creation**
```javascript
// Create JSON file with ALL AMI responses
const allAmiData = {
  individualResponses: amiResponses,
  bulkResponse: bulkAmiResponse,
  enhancedMetrics: bulkAmiResponse ? {
    totalEvents: bulkAmiResponse.eventCount || 0,
    extensionEvents: bulkAmiResponse.extensionCount || 0,
    bufferSize: bulkAmiResponse.bufferSize || 0,
    extensionsParsed: bulkAmiResponse.extensions?.length || 0,
    completionEventDetected: bulkAmiResponse.completionEventDetected || false
  } : null
};

const jsonFileInfo = await createAmiResponseJsonFile(allAmiData, connectionId);
```

## 📊 **What Gets Parsed from Events: Off**

### **Extension Status Events**
```
Event: ExtensionStatus
Extension: 1001
Status: 0
Context: from-internal

Event: ExtensionStatus
Extension: 1002
Status: 1
Context: from-internal
```

### **Parsed Data Structure**
```javascript
{
  extension: '1001',
  status: 'online',        // Mapped from status code 0
  statusCode: '0',         // Raw status code from AMI
  context: 'from-internal',
  eventType: 'ExtensionStatus',
  timestamp: '2024-01-15T10:30:00.000Z'
}
```

### **Status Code Mapping**
```javascript
const statusMap = {
  '0': 'online',    // NotInUse
  '1': 'online',    // InUse
  '2': 'online',    // Busy
  '4': 'offline',   // Unavailable
  '8': 'online',    // Ringing
  '16': 'online',   // Ringinuse
  '-1': 'unknown'   // Unknown
};
```

## 📝 **JSON File Contents**

### **File Location**
```
api/debug/ami-responses/ami-raw-responses-{timestamp}-{connectionId}.json
```

### **JSON Structure**
```json
{
  "metadata": {
    "refreshTimestamp": "2024-01-15T10:30:00.000Z",
    "connectionId": "separate-1234567890-abc123",
    "amiHost": "192.168.1.100",
    "amiPort": 5038,
    "generatedAt": "2024-01-15T10:30:00.000Z",
    "note": "This file contains RAW AMI responses from Asterisk, not processed database data"
  },
  "individualResponses": [...],
  "bulkResponse": {
    "extensions": [
      {
        "extension": "1001",
        "status": "online",
        "statusCode": "0",
        "context": "from-internal",
        "eventType": "ExtensionStatus",
        "timestamp": "2024-01-15T10:30:00.000Z"
      }
    ],
    "eventCount": 101,
    "extensionCount": 100,
    "bufferSize": 15420,
    "completionEventDetected": true
  },
  "summary": {
    "totalExtensions": 100,
    "successfulQueries": 100,
    "failedQueries": 0,
    "hasBulkResponse": true,
    "enhancedMetrics": {
      "totalEvents": 101,
      "extensionEvents": 100,
      "bufferSize": 15420,
      "extensionsParsed": 100,
      "completionEventDetected": true
    }
  }
}
```

## 🎯 **Key Points**

### **1. Events: Off Still Sends Extension Events**
- ✅ **ExtensionStatus events** for each extension
- ✅ **ExtensionStateListComplete** completion event
- ✅ **No real-time noise** from other AMI events

### **2. Complete Parsing**
- ✅ **All ExtensionStatus events** are parsed
- ✅ **Extension numbers** extracted from Extension: lines
- ✅ **Status codes** extracted from Status: lines
- ✅ **Contexts** extracted from Context: lines

### **3. Database Updates**
- ✅ **Only changed extensions** are updated
- ✅ **Missing extensions** marked as offline
- ✅ **All changes broadcasted** via Socket.IO

### **4. JSON File Creation**
- ✅ **Raw AMI responses** saved to file
- ✅ **Parsed extension data** included
- ✅ **Enhanced metrics** and completion detection
- ✅ **Timestamp and connection** information

## ✅ **Summary**

**Events: off does NOT mean no events - it means:**

1. **✅ ExtensionStatus events** are still sent for each extension
2. **✅ All events are parsed** and converted to extension objects
3. **✅ Database is updated** with parsed extension data
4. **✅ JSON file is created** with all AMI responses
5. **✅ Changes are broadcasted** to frontend in real-time
6. **✅ ExtensionStateListComplete** signals completion
7. **✅ Action: Logoff** cleanly terminates the query

**The system correctly handles Events: off by parsing all ExtensionStatus events, updating the database, creating JSON files, and broadcasting changes!**
