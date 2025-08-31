# API Tests Directory

This directory contains all test files for the Call Center Shajgoj API.

## Test Files

### Core AMI Tests
- **`test-extension-state-list.js`** - Tests ExtensionStateList functionality with full extension status events
- **`test-extension-2009.js`** - Tests specific extension 2009 functionality
- **`test-ami-service.js`** - Tests AmiService connection approach
- **`test-extension-update.js`** - Tests extension update functionality

### API Integration Tests
- **`test-api-integration.bat`** - Windows batch script for API integration testing
- **`test-api-integration.sh`** - Linux/Mac shell script for API integration testing
- **`test-database-driven.js`** - Tests database-driven functionality
- **`test-cleanup-debug.js`** - Tests cleanup and debug operations

### AMI Listener Tests
- **`listen-to-ami.js`** - Tests AMI event listening functionality

## Running Tests

### Individual Test Files
```bash
cd api/tests
node test-extension-state-list.js
node test-extension-2009.js
node test-ami-service.js
```

### Using Scripts
```bash
# Windows
cd api/tests
test-api-integration.bat

# Linux/Mac
cd api/tests
./test-api-integration.sh
```

## Test Configuration

All tests use the following AMI connection details:
- **Host**: 103.177.125.83
- **Port**: 5038
- **Username**: admin
- **Password**: Tractor@0152

## Test Output

Test results are saved to the `ami-logs/` directory in JSON format with timestamps.

## Notes

- Tests with `Events: on` will generate detailed extension events (224+ events)
- Tests with `Events: off` will generate minimal system events (3-5 events)
- All test output is cleaned and formatted for proper JSON without `\r\n` characters
