# Extension Status Script Fixes

## Overview
Fixed multiple critical issues in `checkExtensionsStatus.js` script to ensure proper functionality and reliability.

## Issues Fixed

### 1. Function Signature Mismatch ✅
**Problem**: Script was calling `Extension.updateStatus(extensionNumber, newStatus)` but the model expected `(extension, statusCode, deviceState)`.

**Solution**: 
- Added helper functions to convert derived status back to raw AMI data:
  - `getStatusCodeFromDerivedStatus()` - Maps 'online'/'offline'/'unknown' to Asterisk status codes
  - `getDeviceStateFromDerivedStatus()` - Maps derived status to device states
- Updated all `updateStatus()` calls to use proper parameters

### 2. Status Mapping Inconsistency ✅
**Problem**: Script relied on derived status ('online'/'offline') instead of raw AMI data.

**Solution**: 
- Modified processing to handle raw AMI data properly
- Added conversion logic to maintain compatibility with current AmiQueryService
- Enhanced error handling for update failures

### 3. Redundant Processing Functions ✅
**Problem**: Script contained unused batch processing functions causing code bloat.

**Solution**: 
- Marked `queryAllExtensionsIndividually()` and `updateDatabaseWithBatchUpdates()` as DEPRECATED
- Added clear comments explaining why they're no longer used
- Kept functions for potential future batch processing needs

### 4. Missing Error Context ✅
**Problem**: Broadcasting errors were silently ignored, masking real-time update failures.

**Solution**: 
- Added explicit error logging for broadcast failures
- Improved error messages with specific context
- Enhanced troubleshooting guidance

### 5. Hard-coded Rate Limiting ✅
**Problem**: 200ms delay was hard-coded and not configurable.

**Solution**: 
- Added `RATE_LIMIT_DELAY` constant with environment variable support
- Default: 200ms, configurable via `AMI_QUERY_DELAY` environment variable
- Applied consistently across all query loops

### 6. Extension Validation Mismatch ✅
**Problem**: Schema allowed 3-5 digits but creation method only allowed 3-4 digits.

**Solution**: 
- Updated `Extension.createExtension()` method to accept 3-5 digits
- Aligned validation rules across schema and methods
- Fixed validation error messages

## Additional Improvements

### Enhanced Configuration Logging ✅
- Added startup configuration display
- Shows environment variable status
- Displays current rate limiting configuration

### Improved Error Guidance ✅
- Specific troubleshooting for AMI connection issues
- Database connection problem diagnosis
- Extension update error handling
- Environment variable verification

### Better Status Handling ✅
- Proper handling of extension not found scenarios
- Improved null check for inactive extensions
- Enhanced broadcast error recovery

## Configuration Options

### Environment Variables
```bash
# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/call_center

# AMI Configuration
AMI_HOST=your.asterisk.server
AMI_PORT=5038
AMI_USERNAME=admin
AMI_PASSWORD=your_password

# Script Configuration
AMI_QUERY_DELAY=200  # Delay between queries in milliseconds
```

## Usage

```bash
# Run with default settings
node scripts/checkExtensionsStatus.js

# Run with custom delay
AMI_QUERY_DELAY=500 node scripts/checkExtensionsStatus.js
```

## Key Benefits

1. **Reliability**: Fixed function signature mismatches preventing runtime errors
2. **Configurability**: Made rate limiting configurable via environment variables
3. **Observability**: Enhanced error logging and troubleshooting guidance
4. **Maintainability**: Marked deprecated functions and improved code organization
5. **Consistency**: Aligned validation rules across the codebase

## Testing Recommendations

1. Test with various AMI connection scenarios (success, failure, timeout)
2. Verify extension updates with different status transitions
3. Test rate limiting with different delay values
4. Validate error handling for broadcast failures
5. Confirm proper handling of inactive/missing extensions

## Future Improvements

1. Consider modifying `AmiQueryService` to return raw AMI data directly
2. Implement batch processing for better performance with large extension lists
3. Add metrics collection for monitoring script performance
4. Consider database transaction handling for consistency