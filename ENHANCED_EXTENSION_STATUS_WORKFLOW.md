# Enhanced Extension Status Workflow

## Overview

Both manual and periodic extension status updates now follow the same comprehensive workflow with detailed Pino logging that shows exactly which extensions changed and which remained unchanged.

## Workflow Steps

### 1. Get Extensions List from Database
- **Action**: Fetch all active extensions (`is_active: true`) from MongoDB
- **Logging**: 
  ```
  📋 STEP 1: Fetching active extensions from database...
  📋 STEP 1 COMPLETE: Found X active extensions in database
  📋 Database Extensions List: [detailed list of all extensions with current status]
  ```

### 2. Query AMI using Action: ExtensionStateList
- **Action**: Send `ExtensionStateList` command to Asterisk AMI
- **Logging**:
  ```
  📊 STEP 2: Querying AMI using Action: ExtensionStateList...
  📊 STEP 2 COMPLETE: AMI returned X extension statuses
  📊 AMI Extensions List: [detailed list of all extensions from AMI]
  ```

### 3. Get All Extensions Status
- **Action**: Parse AMI response and map status codes to readable statuses
- **Logging**:
  ```
  🔄 STEP 3: Creating AMI status map for comparison...
  🔄 STEP 3 COMPLETE: Created status map for X extensions
  ```

### 4. Update Database with New Status
- **Action**: Compare AMI status with database status and update if changed
- **Logging**:
  ```
  📝 STEP 4: Comparing and updating database...
  📝 UPDATED: Extension 1001: offline → online (4 → 0)
  ✅ UNCHANGED: Extension 1002 - Status: online (0)
  ⚠️ NOT FOUND: Extension 1003 not found in AMI response
  ```

### 5. Show Changes vs Unchanged Extensions
- **Action**: Log comprehensive summary with detailed lists
- **Logging**:
  ```
  📊 STEP 5: Extension Status Update Summary: {
    totalExtensions: 40,
    updated: 5,
    unchanged: 33,
    notFound: 2,
    updateDetails: [...]
  }
  ✅ UNCHANGED EXTENSIONS LIST: 1002, 1004, 1005, 1006, ...
  📝 UPDATED EXTENSIONS LIST: 1001, 1007, 1008, 1009, 1010
  ⚠️ NOT FOUND EXTENSIONS LIST: 1003, 1011
  ```

## Manual vs Periodic Updates

### Manual Refresh
- **Trigger**: User clicks refresh button in frontend
- **API Call**: `POST /api/extensions/refresh`
- **Backend Method**: `AmiQueryService.manualRefresh()`
- **Logging**: 
  ```
  🔄 MANUAL REFRESH: Manual extension refresh triggered via API
  🔄 MANUAL REFRESH: Following same workflow as periodic updates
  🔄 MANUAL REFRESH: Executing performStatusCheck() workflow...
  ✅ MANUAL REFRESH COMPLETE: {details}
  ```

### Periodic Refresh
- **Trigger**: Automatic every 30 seconds
- **Backend Method**: `AmiQueryService.performStatusCheck()`
- **Logging**: Same detailed workflow as manual refresh

## Key Features

### ✅ **Unified Workflow**
- Both manual and periodic updates use identical `performStatusCheck()` method
- Same 5-step process for both types of updates
- Consistent logging and error handling

### ✅ **Detailed Pino Logging**
- Structured logging with component identification
- Step-by-step progress tracking
- Clear lists of changed vs unchanged extensions
- Performance metrics and timing information

### ✅ **Change Detection**
- Only updates database when status actually changes
- Tracks old vs new status for each extension
- Shows status code changes and device state changes

### ✅ **Error Handling**
- Graceful fallback if AMI query fails
- Individual extension update error tracking
- Connection health monitoring

## Console Output Example

```
[2025-01-XX 10:30:00.123] INFO: 🔄 MANUAL REFRESH: Manual extension refresh triggered via API
[2025-01-XX 10:30:00.124] INFO: 🔄 MANUAL REFRESH: Following same workflow as periodic updates
[2025-01-XX 10:30:00.125] INFO: 🔄 MANUAL REFRESH: Executing performStatusCheck() workflow...
[2025-01-XX 10:30:00.126] INFO: 📋 STEP 1: Fetching active extensions from database...
[2025-01-XX 10:30:00.234] INFO: 📋 STEP 1 COMPLETE: Found 40 active extensions in database
[2025-01-XX 10:30:00.235] INFO: 📋 Database Extensions List: {extensions: [...]}
[2025-01-XX 10:30:00.236] INFO: 📊 STEP 2: Querying AMI using Action: ExtensionStateList...
[2025-01-XX 10:30:00.456] INFO: 📊 STEP 2 COMPLETE: AMI returned 38 extension statuses
[2025-01-XX 10:30:00.457] INFO: 📊 AMI Extensions List: {extensions: [...]}
[2025-01-XX 10:30:00.458] INFO: 🔄 STEP 3: Creating AMI status map for comparison...
[2025-01-XX 10:30:00.459] INFO: 🔄 STEP 3 COMPLETE: Created status map for 38 extensions
[2025-01-XX 10:30:00.460] INFO: 📝 STEP 4: Comparing and updating database...
[2025-01-XX 10:30:00.461] INFO: 📝 UPDATED: Extension 1001: offline → online (4 → 0)
[2025-01-XX 10:30:00.462] INFO: ✅ UNCHANGED: Extension 1002 - Status: online (0)
[2025-01-XX 10:30:00.463] INFO: ⚠️ NOT FOUND: Extension 1003 not found in AMI response
[2025-01-XX 10:30:00.500] INFO: 📊 STEP 5: Extension Status Update Summary: {...}
[2025-01-XX 10:30:00.501] INFO: ✅ UNCHANGED EXTENSIONS LIST: 1002, 1004, 1005, 1006, ...
[2025-01-XX 10:30:00.502] INFO: 📝 UPDATED EXTENSIONS LIST: 1001, 1007, 1008, 1009, 1010
[2025-01-XX 10:30:00.503] INFO: ⚠️ NOT FOUND EXTENSIONS LIST: 1003, 1011
[2025-01-XX 10:30:00.504] INFO: ✅ MANUAL REFRESH COMPLETE: {...}
```

## Benefits

1. **Transparency**: Clear visibility into what changed and what didn't
2. **Debugging**: Easy to identify issues with specific extensions
3. **Performance**: Only updates when necessary
4. **Consistency**: Same process for manual and automatic updates
5. **Monitoring**: Detailed logs for system health monitoring

