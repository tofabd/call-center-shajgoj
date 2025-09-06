##  📄 Enhanced Database Operation Logging in Laravel.log

When "Refresh from Asterisk" button is clicked, the following detailed database operation logs will be written to `backend/storage/logs/laravel.log`:

### 1. SELECT Operations (Finding Existing Extensions)
```json
[2025-01-15 10:30:15] local.INFO: 🔍 [DB Operation] SELECT Extension - Starting {
    "operation_type": "SELECT",
    "table": "extensions", 
    "extension": "1001",
    "query": "SELECT * FROM extensions WHERE extension = '1001'",
    "timestamp": "2025-01-15T10:30:15.123456Z"
}

[2025-01-15 10:30:15] local.INFO: ✅ [DB Operation] SELECT Extension - Found {
    "operation_type": "SELECT",
    "table": "extensions",
    "extension": "1001", 
    "record_id": 25,
    "found_record": {
        "id": 25,
        "extension": "1001",
        "agent_name": "John Doe",
        "team_id": 2,
        "status_code": 0,
        "status_text": "Not In Use",
        "availability_status": "online",
        "status_changed_at": "2025-01-15T10:25:00.000000Z",
        "is_active": true,
        "created_at": "2025-01-15T09:00:00.000000Z",
        "updated_at": "2025-01-15T10:25:00.000000Z"
    },
    "timestamp": "2025-01-15T10:30:15.125000Z"
}
```

### 2. CREATE Operations (New Extensions from AMI)
```json
[2025-01-15 10:30:16] local.INFO: 📝 [DB Operation] SELECT Extension - Not Found {
    "operation_type": "SELECT",
    "table": "extensions",
    "extension": "1005",
    "result": "NO_RECORD_FOUND", 
    "action": "WILL_CREATE_NEW",
    "timestamp": "2025-01-15T10:30:16.100000Z"
}

[2025-01-15 10:30:16] local.INFO: 🆕 [DB Operation] CREATE Extension - Starting {
    "operation_type": "CREATE",
    "table": "extensions",
    "extension": "1005",
    "data_to_insert": {
        "extension": "1005",
        "status": "online",
        "status_code": 0, 
        "device_state": "NOT_INUSE",
        "status_text": "Not In Use",
        "last_status_change": "2025-01-15T10:30:16.000000Z",
        "last_seen": "2025-01-15T10:30:16.000000Z",
        "is_active": true,
        "agent_name": null,
        "team": null
    },
    "timestamp": "2025-01-15T10:30:16.105000Z"
}

[2025-01-15 10:30:16] local.INFO: ✅ [DB Operation] CREATE Extension - Success {
    "operation_type": "CREATE", 
    "table": "extensions",
    "extension": "1005",
    "new_record_id": 28,
    "created_at": "2025-01-15T10:30:16.000000Z",
    "updated_at": "2025-01-15T10:30:16.000000Z",
    "full_record": {
        "id": 28,
        "extension": "1005",
        "agent_name": null,
        "team_id": null,
        "status_code": 0,
        "status_text": "Not In Use", 
        "availability_status": "online",
        "status_changed_at": "2025-01-15T10:30:16.000000Z",
        "is_active": true,
        "created_at": "2025-01-15T10:30:16.000000Z",
        "updated_at": "2025-01-15T10:30:16.000000Z"
    },
    "timestamp": "2025-01-15T10:30:16.110000Z"
}
```

### 3. UPDATE Operations (Status Changes)
```json
[2025-01-15 10:30:17] local.INFO: 🔄 [DB Operation] UPDATE Extension - Starting {
    "operation_type": "UPDATE",
    "table": "extensions",
    "extension": "1002", 
    "record_id": 26,
    "original_data": {
        "id": 26,
        "extension": "1002",
        "status_code": 0,
        "device_state": "NOT_INUSE",
        "status": "online"
    },
    "update_data": {
        "status": "online",
        "status_code": 1,
        "device_state": "INUSE", 
        "status_text": "In Use",
        "last_status_change": "2025-01-15T10:30:17.000000Z",
        "last_seen": "2025-01-15T10:30:17.000000Z"
    },
    "changes_detected": {
        "status_code": "0 → 1",
        "device_state": "NOT_INUSE → INUSE",
        "status": "online → online"
    },
    "timestamp": "2025-01-15T10:30:17.120000Z"
}

[2025-01-15 10:30:17] local.INFO: ✅ [DB Operation] UPDATE Extension - Success {
    "operation_type": "UPDATE",
    "table": "extensions", 
    "extension": "1002",
    "record_id": 26,
    "update_result": true,
    "rows_affected": 1,
    "updated_record": {
        "id": 26,
        "extension": "1002",
        "agent_name": "Jane Smith",
        "team_id": 1,
        "status_code": 1,
        "status_text": "In Use",
        "availability_status": "online", 
        "status_changed_at": "2025-01-15T10:30:17.000000Z",
        "is_active": true,
        "updated_at": "2025-01-15T10:30:17.000000Z"
    },
    "updated_at": "2025-01-15T10:30:17.000000Z",
    "timestamp": "2025-01-15T10:30:17.125000Z"
}
```

### 4. TIMESTAMP UPDATE Operations (No Status Change)
```json
[2025-01-15 10:30:18] local.INFO: 📝 [DB Operation] UPDATE Extension - No Changes {
    "operation_type": "TIMESTAMP_UPDATE",
    "table": "extensions",
    "extension": "1003",
    "record_id": 27,
    "status_code": 0,
    "action": "UPDATE_LAST_SEEN_ONLY",
    "timestamp": "2025-01-15T10:30:18.100000Z"
}

[2025-01-15 10:30:18] local.INFO: ✅ [DB Operation] UPDATE Extension - Timestamp Only {
    "operation_type": "TIMESTAMP_UPDATE",
    "table": "extensions", 
    "extension": "1003",
    "record_id": 27,
    "update_result": true,
    "updated_fields": ["last_seen"],
    "new_last_seen": "2025-01-15T10:30:18.000000Z",
    "timestamp": "2025-01-15T10:30:18.105000Z"
}
```

### 5. MARK OFFLINE Operations (Missing from AMI)
```json
[2025-01-15 10:30:19] local.INFO: 🔍 [DB Operation] SELECT Missing Extensions - Starting {
    "operation_type": "BULK_SELECT",
    "table": "extensions",
    "query": "SELECT * FROM extensions WHERE is_active = 1 AND extension NOT IN (1001,1002,1003,1005) AND status != 'offline'",
    "ami_extensions_found": ["1001", "1002", "1003", "1005"],
    "timestamp": "2025-01-15T10:30:19.100000Z"
}

[2025-01-15 10:30:19] local.INFO: ✅ [DB Operation] SELECT Missing Extensions - Found {
    "operation_type": "BULK_SELECT", 
    "table": "extensions",
    "found_count": 1,
    "missing_extensions": ["1004"],
    "action": "WILL_MARK_OFFLINE",
    "timestamp": "2025-01-15T10:30:19.105000Z"
}

[2025-01-15 10:30:19] local.INFO: 🔴 [DB Operation] UPDATE Extension - Mark Offline Starting {
    "operation_type": "MARK_OFFLINE",
    "table": "extensions",
    "extension": "1004",
    "record_id": 24,
    "original_data": {
        "id": 24,
        "extension": "1004",
        "status": "online",
        "status_code": 0,
        "device_state": "NOT_INUSE"
    },
    "offline_data": {
        "status": "offline",
        "status_code": 4,
        "device_state": "UNAVAILABLE",
        "last_status_change": "2025-01-15T10:30:19.000000Z",
        "last_seen": "2025-01-15T10:30:19.000000Z"
    },
    "reason": "MISSING_FROM_AMI_RESPONSE", 
    "timestamp": "2025-01-15T10:30:19.110000Z"
}

[2025-01-15 10:30:19] local.INFO: ✅ [DB Operation] UPDATE Extension - Mark Offline Success {
    "operation_type": "MARK_OFFLINE",
    "table": "extensions",
    "extension": "1004", 
    "record_id": 24,
    "update_result": true,
    "updated_record": {
        "id": 24,
        "extension": "1004",
        "agent_name": "Bob Johnson",
        "team_id": 3,
        "status_code": 4,
        "status_text": "Unavailable",
        "availability_status": "offline",
        "status_changed_at": "2025-01-15T10:30:19.000000Z",
        "is_active": true,
        "updated_at": "2025-01-15T10:30:19.000000Z"
    },
    "changes_made": {
        "status": "online → offline", 
        "status_code": "0 → 4",
        "device_state": "NOT_INUSE → UNAVAILABLE"
    },
    "timestamp": "2025-01-15T10:30:19.115000Z"
}
```

### 6. Database Operations Summary
```json
[2025-01-15 10:30:20] local.INFO: 📊 [DB Operations] Summary - All Operations Complete {
    "operation_type": "SUMMARY",
    "table": "extensions",
    "total_operations": 5,
    "statistics": {
        "updated": 1,
        "unchanged": 1, 
        "created": 1,
        "errors": 0,
        "marked_offline": 1
    },
    "breakdown": {
        "CREATE_operations": 1,
        "UPDATE_operations": 1,
        "TIMESTAMP_operations": 1,
        "MARK_OFFLINE_operations": 1,
        "ERROR_operations": 0
    },
    "success_rate": "100%",
    "timestamp": "2025-01-15T10:30:20.000000Z"
}
```

## 📋 Log File Location
**File Path**: `backend/storage/logs/laravel.log`

## 🎯 Log Features Added:
- ✅ **Detailed SELECT queries** with results
- ✅ **CREATE operations** with full record data
- ✅ **UPDATE operations** with before/after comparisons  
- ✅ **TIMESTAMP-only updates** for unchanged records
- ✅ **MARK OFFLINE operations** for missing extensions
- ✅ **Error logging** with full stack traces
- ✅ **Operations summary** with statistics
- ✅ **Timestamps** for all operations
- ✅ **Record IDs** for database tracking
- ✅ **SQL query information** for debugging