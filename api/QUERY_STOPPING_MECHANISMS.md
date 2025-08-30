# 🔌 Query Stopping Mechanisms

## ✅ **How Queries Are Stopped**

### **1. Automatic Completion Detection**
The system automatically detects when a query is complete using multiple signals:

```javascript
// Check if we have a complete response (multiple completion indicators)
const hasCompletionSignal = (
  responseBuffer.includes(`ActionID: ${actionId}`) && 
  (
    responseBuffer.includes('Response: Follows') || 
    responseBuffer.includes('Response: Success') ||
    responseBuffer.includes('Event: ExtensionStateListComplete') ||
    responseBuffer.includes('Response: Goodbye') // Logoff response
  )
);
```

### **2. Timeout-Based Stopping**
If no completion signal is received within 20 seconds, the query is automatically stopped:

```javascript
// Enhanced timeout: wait longer for comprehensive event collection
responseTimeout = setTimeout(async () => {
  if (!isComplete) {
    isComplete = true;
    console.log(`⏰ Enhanced bulk query timeout reached - processing ${eventCount} events received`);
    
    // Send Logoff action to cleanly terminate the query
    try {
      const logoffAction = `Action: Logoff\r\nActionID: ${actionId}-logoff\r\n\r\n`;
      socket.write(logoffAction);
      console.log(`🔌 [HybridAmiService] Sent Logoff action to terminate query`);
    } catch (logoffError) {
      console.warn(`⚠️ [HybridAmiService] Failed to send Logoff action:`, logoffError.message);
    }
    
    processResponse();
  }
}, 20000); // 20 seconds timeout
```

### **3. Manual Query Stopping**
You can manually stop an active query using the API:

```bash
POST /api/extensions/hybrid-refresh/{connectionId}/stop
```

## 🔌 **Logoff Action Implementation**

### **What is Logoff Action?**
```
Action: Logoff
ActionID: {actionId}-logoff
```

### **When It's Sent:**
1. **Timeout reached** (20 seconds)
2. **Manual stop request** via API
3. **Error conditions** requiring query termination

### **Response from Asterisk:**
```
Response: Goodbye
ActionID: {actionId}-logoff
```

## 📊 **Query Lifecycle Management**

### **Phase 1: Query Initiation**
```
1. Send ExtensionStateList query
2. Start collecting events
3. Monitor for completion signals
4. Set 20-second timeout
```

### **Phase 2: Active Query**
```
1. Collect all incoming events
2. Count events in real-time
3. Wait for completion signals
4. Continue until timeout or completion
```

### **Phase 3: Query Termination**
```
1. Detect completion signal OR timeout reached
2. Send Logoff action (if timeout)
3. Process collected response
4. Clean up listeners and timeouts
```

## 🎯 **Benefits of Logoff-Based Stopping**

### **1. Clean Termination**
- ✅ **Proper cleanup** of AMI session
- ✅ **No hanging connections** or queries
- ✅ **Resource management** for Asterisk
- ✅ **Professional AMI protocol** compliance

### **2. Reliable Stopping**
- ✅ **Multiple stopping methods** (completion, timeout, manual)
- ✅ **Fallback mechanisms** for edge cases
- ✅ **Error handling** during termination
- ✅ **Logging and monitoring** of stop events

### **3. Performance Optimization**
- ✅ **Prevents query hanging** indefinitely
- ✅ **Frees up AMI resources** quickly
- ✅ **Maintains system responsiveness**
- ✅ **Efficient connection management**

## 🚀 **API Endpoints for Query Control**

### **Stop Active Query**
```bash
POST /api/extensions/hybrid-refresh/{connectionId}/stop
```

**Response:**
```json
{
  "success": true,
  "message": "Query stopped successfully via Logoff action",
  "connectionId": "separate-1234567890-abc123",
  "actionId": "bulk-1234567890-abc123"
}
```

### **Get Connection Status**
```bash
GET /api/extensions/hybrid-refresh/status
```

### **Close All Connections**
```bash
POST /api/extensions/hybrid-refresh/close
```

## 🔧 **Implementation Details**

### **Logoff Action Format:**
```javascript
const logoffAction = `Action: Logoff\r\nActionID: ${actionId}-logoff\r\n\r\n`;
```

### **Manual Stop Method:**
```javascript
async stopExtensionStateListQuery(actionId) {
  if (!this.socket || !this.socket.writable) {
    console.warn(`⚠️ [HybridAmiService] Cannot stop query - socket not available`);
    return false;
  }

  try {
    const logoffAction = `Action: Logoff\r\nActionID: ${actionId}-stop\r\n\r\n`;
    this.socket.write(logoffAction);
    console.log(`🔌 [HybridAmiService] Manually sent Logoff action to stop query: ${actionId}`);
    return true;
  } catch (error) {
    console.error(`❌ [HybridAmiService] Failed to send Logoff action:`, error.message);
    return false;
  }
}
```

### **Enhanced Completion Detection:**
```javascript
// Now includes Logoff response
const hasCompletionSignal = (
  responseBuffer.includes(`ActionID: ${actionId}`) && 
  (
    responseBuffer.includes('Response: Follows') || 
    responseBuffer.includes('Response: Success') ||
    responseBuffer.includes('Event: ExtensionStateListComplete') ||
    responseBuffer.includes('Response: Goodbye') // Logoff response
  )
);
```

## 📝 **Logging and Monitoring**

### **Query Start:**
```
🚀 [HybridAmiService] Starting ExtensionStateList query...
📊 [HybridAmiService] Query initiated with ActionID: bulk-1234567890-abc123
```

### **Query Completion:**
```
✅ [HybridAmiService] ExtensionStateList query completed successfully
📊 [HybridAmiService] Processed 224 events, 100 extensions
```

### **Query Timeout:**
```
⏰ Enhanced bulk query timeout reached - processing 224 events received
🔌 [HybridAmiService] Sent Logoff action to terminate query
```

### **Manual Stop:**
```
🔌 [HybridAmiService] Manually sent Logoff action to stop query: bulk-1234567890-abc123
✅ [HybridAmiRefreshController] Query stopped via Logoff action: separate-1234567890-abc123
```

## 🎯 **Best Practices**

### **1. Use Timeout for Safety**
- **20-second timeout** prevents hanging queries
- **Automatic Logoff** ensures clean termination
- **Fallback mechanism** for edge cases

### **2. Monitor Query Status**
- **Check connection status** regularly
- **Monitor query completion** times
- **Alert on unusual** query durations

### **3. Manual Control When Needed**
- **Stop long-running queries** manually
- **Close connections** after use
- **Clean up resources** proactively

## ✅ **Summary**

Your ExtensionStateList queries are stopped using **multiple mechanisms**:

1. **✅ Automatic Completion Detection**: Response: Follows, Success, ExtensionStateListComplete
2. **✅ Timeout-Based Stopping**: 20-second timeout with automatic Logoff action
3. **✅ Manual Query Stopping**: API endpoint to stop active queries
4. **✅ Logoff Action**: Clean AMI protocol termination

**The system now properly uses `Action: Logoff` to ensure clean query termination and prevent hanging connections!**
