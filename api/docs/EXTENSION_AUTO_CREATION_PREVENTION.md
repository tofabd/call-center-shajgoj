# Extension Auto-Creation Prevention

## Overview
This document describes the changes made to prevent the system from automatically creating extensions in the database when receiving AMI events, and to prevent updates to inactive extensions.

## Problem
The system was automatically creating extension records for any AMI-reported extension codes, including:
- AMI-generated temporary codes like `*47*1001*600`
- Invalid extension formats
- This caused database pollution and update failures

Additionally, the system was updating inactive extensions, which could cause unnecessary database writes and confusion.

## Changes Made

### 1. Modified Extension Model (`src/models/Extension.js`)

#### Before:
```javascript
extensionSchema.statics.updateStatus = async function(extension, statusCode, deviceState) {
  return this.findOneAndUpdate(
    { extension },
    { /* update data */ },
    { 
      upsert: true,  // ← This automatically created new extensions
      new: true,
      setDefaultsOnInsert: true
    }
  );
};
```

#### After:
```javascript
extensionSchema.statics.updateStatus = async function(extension, statusCode, deviceState) {
  // Only update existing active extensions, never create new ones
  const existingExtension = await this.findOne({ extension });
  
  if (!existingExtension) {
    console.log(`⚠️ Extension ${extension} not found in database - skipping update`);
    return null;
  }
  
  // Check if extension is active - don't update inactive extensions
  if (!existingExtension.is_active) {
    console.log(`🚫 Extension ${extension} is inactive - skipping status update`);
    return null;
  }
  
  // Update existing active extension only
  return this.findOneAndUpdate(
    { extension },
    { /* update data */ },
    { new: true }  // No upsert
  );
};
```

### 2. Managed AMI Service (`src/services/AmiService.js`)

#### Added Validation:
```javascript
async handleExtensionStatus(fields) {
  const extension = fields.Exten;
  
  // Validate extension format - only allow clean numeric extensions
  // Reject AMI-generated codes like *47*1001*600, *47*1001, etc.
  if (!/^\d{3,4}$/.test(extension)) {
    console.log(`🚫 Skipping AMI-generated extension code: ${extension}`);
    return;
  }
  
  // Only update if extension exists in database and is active
  const updatedExtension = await Extension.updateStatus(extension, statusCode, deviceState);
  
  if (updatedExtension) {
    broadcast.extensionStatusUpdated(updatedExtension);
  } else {
    console.log(`⚠️ Extension ${extension} not found in database or is inactive - status update skipped`);
  }
}
```

### 3. Fixed Seeding Script (`scripts/getAllExtensions.js`)

#### Before:
```javascript
await Extension.findOneAndUpdate(
  { extension: amiExt.extension },
  { /* data */ },
  { upsert: true, new: true }  // ← Auto-created extensions
);
```

#### After:
```javascript
// Only update existing active extensions, never create new ones
const existingExtension = await Extension.findOne({ extension: amiExt.extension });

if (!existingExtension) {
  console.log(`⚠️ Extension ${amiExt.extension} not found in database - skipping update`);
  continue;
}

// Check if extension is active - don't update inactive extensions
if (!existingExtension.is_active) {
  console.log(`🚫 Extension ${amiExt.extension} is inactive - skipping update`);
  continue;
}

// Update existing active extension only
await Extension.findOneAndUpdate(
  { extension: amiExt.extension },
  { /* data */ },
  { new: true }  // No upsert
);
```

### 4. Added Explicit Extension Creation Method

```javascript
// EXPLICIT EXTENSION CREATION METHOD - for manual creation only
extensionSchema.statics.createExtension = async function(extensionData) {
  // Validate extension format
  if (!/^\d{3,4}$/.test(extensionData.extension)) {
    throw new Error(`Invalid extension format: ${extensionData.extension}. Must be 3-4 digits only.`);
  }
  
  // Check if extension already exists
  const existing = await this.findOne({ extension: extensionData.extension });
  if (existing) {
    throw new Error(`Extension ${extensionData.extension} already exists in database.`);
  }
  
  // Create new extension with validation
  const newExtension = new this(extensionData);
  return await newExtension.save();
};
```

## Benefits

1. **Prevents Database Pollution**: No more AMI-generated codes like `*47*1001*600`
2. **Clean Extension List**: Only real phone extensions (1001, 1002, etc.) are stored
3. **Predictable Behavior**: Extensions are only created when explicitly requested
4. **Better Performance**: No unnecessary database writes for invalid or inactive extensions
5. **Data Integrity**: Database contains only valid, business-relevant extensions
6. **Inactive Extension Protection**: Inactive extensions are not updated, preserving their state

## How to Create Extensions Now

### 1. Via API Endpoint
```bash
POST /api/extensions
{
  "extension": "1001",
  "agent_name": "John Doe",
  "department": "Sales"
}
```

### 2. Via Code (using new method)
```javascript
const newExtension = await Extension.createExtension({
  extension: "1001",
  agent_name: "John Doe",
  department: "Sales"
});
```

### 3. Via Database Seeding
Use the existing seeding scripts that create extensions with proper validation.

## Impact on Existing System

- **Real-time Updates**: Still work for existing active extensions
- **AMI Integration**: Still functional but won't create new extensions
- **Frontend Display**: Will only show valid active extensions that exist in database
- **Manual Refresh**: Still works but won't create new extensions
- **Inactive Extensions**: Are preserved and not updated by AMI events

## Monitoring

The system now logs:
- `🚫 Skipping AMI-generated extension code: *47*1001*600`
- `⚠️ Extension 1001 not found in database - skipping update`
- `🚫 Extension 1002 is inactive - skipping status update`
- `📱 Extension status updated: 1001 -> 8 (Ringing) -> RINGING`

This provides clear visibility into what's being processed and what's being skipped.

## Extension Status Protection

### What Gets Updated:
- ✅ **Active extensions** with valid numeric codes (1001, 1002, etc.)
- ✅ **Existing extensions** that are found in database

### What Gets Skipped:
- ❌ **Non-existent extensions** (not in database)
- ❌ **Inactive extensions** (is_active = false)
- ❌ **AMI-generated codes** (*47*1001*600, etc.)
- ❌ **Invalid format extensions** (non-numeric)

This ensures that only business-relevant, active extensions receive status updates from AMI events.
