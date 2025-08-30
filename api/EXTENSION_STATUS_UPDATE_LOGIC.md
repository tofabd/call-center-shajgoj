# 🔄 Extension Status Update Logic

## 🎯 **Core Principles**

### **1. Smart Updates - Only Update What Changed**
- **Status Change Detection**: Compare current database status with new AMI status
- **Database Efficiency**: Only write to database when status actually changes
- **Performance**: Avoid unnecessary database operations

### **2. Extension Filtering - 3 to 5 Digit Numbers**
- **Valid Range**: Extensions with 3, 4, or 5 digits (100-99999)
- **Examples**: 100, 1001, 20000, 99999
- **Excluded**: Non-numeric, 1-2 digits, 6+ digits, special patterns

### **3. Offline Marking - Handle Missing Extensions**
- **AMI Not Found**: Extensions not in AMI response are marked as offline
- **Status Code**: Uses `4` (Unavailable) for offline extensions
- **Device State**: Sets to `UNAVAILABLE` for consistency

## 🔍 **Update Logic Flow**

### **Phase 1: Extension Found in AMI Response**
```javascript
if (amiExtension) {
  // Check if status actually changed
  const statusChanged = dbExtension.status !== statusResult.status || 
                       dbExtension.status_code !== statusResult.statusCode ||
                       dbExtension.device_state !== statusResult.statusText;
  
  if (statusChanged) {
    // Update database and broadcast change
    await Extension.findByIdAndUpdate(dbExtension._id, {...});
    broadcast.extensionStatusUpdated(updatedExtension);
    statusChanges++;
  } else {
    // No change needed
    noChanges++;
  }
}
```

### **Phase 2: Extension Not Found in AMI Response**
```javascript
else {
  // Extension not found - mark as offline
  if (dbExtension.status !== 'offline') {
    // Update to offline status
    await Extension.findByIdAndUpdate(dbExtension._id, {
      status: 'offline',
      status_code: '4',        // Unavailable
      device_state: 'UNAVAILABLE'
    });
    
    // Broadcast offline status
    broadcast.extensionStatusUpdated(updatedExtension);
    markedOffline++;
  } else {
    // Already offline - no change
    noChanges++;
  }
}
```

## 📊 **Statistics Tracking**

### **Metrics Collected**
- **`successfulQueries`**: Total successful operations
- **`failedQueries`**: Total failed operations
- **`statusChanges`**: Extensions that actually changed status
- **`noChanges`**: Extensions with no status change
- **`markedOffline`**: Extensions marked as offline (not found in AMI)

### **Example Log Output**
```
✅ [HybridAmiRefreshController] Separate connection refresh completed: separate-1234567890-abc123
{
  extensionsChecked: 25,
  successfulQueries: 25,
  failedQueries: 0,
  statusChanges: 3,        // 3 extensions changed status
  noChanges: 20,           // 20 extensions unchanged
  markedOffline: 2,        // 2 extensions marked offline
  resultsCount: 25,
  jsonFileCreated: true
}
```

## 🎯 **Benefits of New Logic**

### **1. Database Efficiency**
- ✅ **No unnecessary writes** - Only updates changed extensions
- ✅ **Reduced I/O** - Fewer database operations
- ✅ **Better performance** - Faster refresh operations

### **2. Accurate Status Tracking**
- ✅ **Real-time offline detection** - Extensions not in AMI are marked offline
- ✅ **Status consistency** - Database reflects actual AMI state
- ✅ **Change tracking** - Know exactly what changed

### **3. Better Monitoring**
- ✅ **Detailed statistics** - Track different types of updates
- ✅ **Change visibility** - See which extensions actually changed
- ✅ **Offline tracking** - Monitor extensions that disappear from AMI

## 🔄 **Real-World Scenarios**

### **Scenario 1: Extension Goes Offline (3-digit)**
```
Database: Extension 100 = online
AMI Response: Extension 100 not found
Action: Mark 100 as offline
Result: statusChanges = 1, markedOffline = 1
```

### **Scenario 2: Extension Status Changes (4-digit)**
```
Database: Extension 1001 = offline
AMI Response: Extension 1001 = online (status code 0)
Action: Update 1001 to online
Result: statusChanges = 1, noChanges = 0
```

### **Scenario 3: Extension Unchanged (5-digit)**
```
Database: Extension 20000 = online
AMI Response: Extension 20000 = online (status code 0)
Action: No database update needed
Result: statusChanges = 0, noChanges = 1
```

### **Scenario 4: Extension Already Offline (4-digit)**
```
Database: Extension 1002 = offline
AMI Response: Extension 1002 not found
Action: No change needed (already offline)
Result: statusChanges = 0, noChanges = 1
```

## 📝 **JSON Response Structure**

### **Updated Response Format**
```json
{
  "success": true,
  "data": {
    "statistics": {
      "successfulQueries": 25,
      "failedQueries": 0,
      "statusChanges": 3,
      "noChanges": 20,
      "markedOffline": 2
    },
    "results": [
      {
        "extension": "100",
        "status": "offline",
        "statusCode": "4",
        "statusText": "UNAVAILABLE",
        "statusChanged": true
      },
      {
        "extension": "1001",
        "status": "online",
        "statusCode": "0",
        "statusText": "AVAILABLE",
        "statusChanged": true
      },
      {
        "extension": "20000",
        "status": "online",
        "statusCode": "0",
        "statusText": "AVAILABLE",
        "statusChanged": false
      }
    ]
  }
}
```

## 🚀 **Usage Examples**

### **Frontend Integration**
```javascript
// Handle refresh response
const response = await extensionService.refreshStatus();
const { statistics } = response.data;

console.log(`Refresh completed: ${statistics.statusChanges} changes, ${statistics.markedOffline} offline`);
```

### **Monitoring and Alerts**
```javascript
// Alert if many extensions go offline
if (statistics.markedOffline > 5) {
  console.warn(`⚠️ High number of extensions marked offline: ${statistics.markedOffline}`);
}

// Track efficiency
const efficiency = (statistics.noChanges / statistics.successfulQueries) * 100;
console.log(`Update efficiency: ${efficiency.toFixed(1)}% unchanged`);
```

## ✅ **Summary**

The new extension status update logic provides:

1. **Smart Updates**: Only updates extensions that actually changed
2. **Offline Detection**: Automatically marks missing extensions as offline
3. **Detailed Statistics**: Tracks different types of updates
4. **Performance**: Reduces unnecessary database operations
5. **Real-time Updates**: Broadcasts changes immediately to frontend
6. **Monitoring**: Provides insights into update efficiency

**This ensures your extension status is always accurate, up-to-date, and efficiently managed.**
