# Smart Parsing System for AMI ExtensionStateList

## Overview

The smart parsing system automatically detects and handles both `Events: on` and `Events: off` response formats from AMI `ExtensionStateList` queries.

## How It Works

### 1. Automatic Format Detection

The system automatically detects the response format by checking for the presence of `Event: ExtensionStatus`:

```javascript
parseExtensionStateListResponse(response) {
  // Smart parsing: automatically detect response format
  if (response.includes('Event: ExtensionStatus')) {
    return this.parseEventsOnFormat(response);
  } else {
    return this.parseEventsOffFormat(response);
  }
}
```

### 2. Events: on Format (Event-Driven)

**Response Structure:**
```
Response: Success
EventList: start
ListItems: 3

Event: ExtensionStatus
Exten: 1001
Context: from-internal
Status: 0
StatusText: Not in use

Event: ExtensionStatus
Exten: 1002
Context: from-internal
Status: 4
StatusText: Unavailable

EventList: Complete
ListItems: 3
```

**Parsing Method:** `parseEventsOnFormat()`
- Splits response by double newlines (`\r\n\r\n`)
- Extracts individual `ExtensionStatus` events
- Captures additional fields: `StatusText`, `Hint`
- More detailed information per extension

### 3. Events: off Format (Traditional)

**Response Structure:**
```
Response: Success
EventList: start
ListItems: 3

Extension: 1001
Status: 0
Context: from-internal

Extension: 1002
Status: 4
Context: from-internal

EventList: Complete
ListItems: 3
```

**Parsing Method:** `parseEventsOffFormat()`
- Parses single response with all extensions
- Simple line-by-line parsing
- Basic information: `Extension`, `Status`, `Context`

## Benefits

### ✅ **Automatic Detection**
- No manual configuration needed
- Works with any AMI server configuration
- Handles both modern and legacy AMI setups

### ✅ **Flexible Response Handling**
- Adapts to server's event mode
- No need to change code for different AMI configurations
- Future-proof for AMI protocol changes

### ✅ **Enhanced Information**
- `Events: on` provides more detailed status information
- `StatusText` and `Hint` fields when available
- Better debugging and monitoring capabilities

### ✅ **Robust Error Handling**
- Graceful fallback between parsing methods
- Detailed logging for troubleshooting
- Handles malformed responses gracefully

## Usage

### 1. **Automatic Parsing (Recommended)**
```javascript
// Just call the main parsing method
const extensions = amiService.parseExtensionStateListResponse(response);
// System automatically chooses the right parser
```

### 2. **Manual Format Selection**
```javascript
// If you know the format in advance
if (useEvents) {
  const extensions = amiService.parseEventsOnFormat(response);
} else {
  const extensions = amiService.parseEventsOffFormat(response);
}
```

### 3. **Testing the System**
```javascript
// Test both parsing methods
const result = amiService.testSmartParsing();
console.log('Smart parsing working:', result.smartParsingWorking);
```

## Configuration

### **Environment Variables**
```bash
# AMI connection settings
AMI_HOST=your_asterisk_server
AMI_PORT=5038
AMI_USERNAME=your_username
AMI_PASSWORD=your_password

# Event mode (optional - system auto-detects)
AMI_EVENTS=on  # or off, but smart parsing handles both
```

### **AMI Commands**
```javascript
// Both commands work with smart parsing
const command1 = `Action: ExtensionStateList\r\nContext: from-internal\r\nEvents: on\r\n\r\n`;
const command2 = `Action: ExtensionStateList\r\nContext: from-internal\r\n\r\n`;

// System automatically detects and parses correctly
```

## Testing

### **Run Test Script**
```bash
cd api
node test-smart-parsing.js
```

### **Expected Output**
```
🧪 Testing Smart Parsing System
================================
📊 Test Results:
================
Events: off format: 3 extensions
Events: on format: 3 extensions
Smart parsing working: true

📱 Events: off Extensions:
  1001: Status 0 (from-internal)
  1002: Status 4 (from-internal)
  1003: Status 1 (from-internal)

📱 Events: on Extensions:
  1001: Status 0 (from-internal) - Not in use
  1002: Status 4 (from-internal) - Unavailable
  1003: Status 1 (from-internal) - In use

✅ Smart parsing test completed successfully!
```

## Troubleshooting

### **Common Issues**

1. **Parsing Fails for Both Formats**
   - Check AMI response format in logs
   - Verify AMI server configuration
   - Check for malformed responses

2. **Wrong Format Detected**
   - Review AMI server event mode settings
   - Check response logs for format detection
   - Verify AMI protocol version

3. **Missing Extension Data**
   - Check AMI permissions for ExtensionStateList
   - Verify context exists (`from-internal`)
   - Check for AMI server errors

### **Debug Logging**
```javascript
// Enable debug logging to see parsing details
const logger = createComponentLogger('AmiQueryService');
logger.level = 'debug';
```

## Future Enhancements

- **Protocol Version Detection**: Auto-detect AMI protocol version
- **Custom Field Mapping**: Configurable field extraction
- **Response Validation**: Enhanced error checking and validation
- **Performance Optimization**: Caching and optimization for large extension lists
