# Extension Refresh Implementation - AMI Missing Extensions

## Overview
When the "Refresh from Asterisk" button is clicked in the Extension Management frontend, the system now properly handles extensions that are not found in the AMI extension list.

## Implementation Details

### Backend Changes (`ExtensionService.php`)

#### Issue Fixed
- **Bug Fixed**: Changed filter condition from `where('status', '!=', 'offline')` to `where('availability_status', '!=', 'offline')`
- **Enhancement**: Added `status_text => 'Unavailable'` when marking extensions as offline

#### Logic Flow
1. **AMI Query**: System queries Asterisk AMI using `ExtensionStateList` command
2. **Extension Comparison**: Compares AMI response with database extensions
3. **Missing Extensions**: Any active extension in database not found in AMI response gets marked as:
   - **Status Code**: 4 (UNAVAILABLE)
   - **Status Text**: "Unavailable"
   - **Availability Status**: "offline"
   - **Status Changed At**: Current timestamp

#### Code Location
File: `backend/app/Services/Ami/Features/Extensions/ExtensionService.php`
Method: `updateDatabaseExtensions()` - Lines 251-284

```php
// Mark extensions as offline if they exist in DB but not in AMI response
$amiExtensionNumbers = $amiExtensions->pluck('extension')->toArray();
$dbExtensions = Extension::where('is_active', true)
    ->whereNotIn('extension', $amiExtensionNumbers)
    ->where('availability_status', '!=', 'offline')
    ->get();

foreach ($dbExtensions as $dbExt) {
    $updateResult = $dbExt->update([
        'availability_status' => 'offline',
        'status_code' => 4,
        'status_text' => 'Unavailable', // NEW: Set status text
        'status_changed_at' => now(),
        'updated_at' => now()
    ]);
}
```

### Frontend Display

#### Extension Status Display
The frontend ExtensionManagement component already handles the status display correctly:

1. **Status Code Column**: Shows "4" for unavailable extensions
2. **Status Text Column**: Shows "Unavailable" (from database or computed)
3. **Availability Column**: Shows red dot + "offline" with proper styling

#### Status Mapping Logic
- `status_code: 4` → maps to `availability_status: 'offline'`
- `status_text: 'Unavailable'` → displayed in Status Text column
- Icon: 🔴 (red dot) for offline status
- Color: Red text styling

### Database Schema
Extensions table fields used:
- `status_code` (integer): Set to 4 for unavailable
- `status_text` (string): Set to "Unavailable"
- `availability_status` (string): Set to "offline"
- `status_changed_at` (timestamp): Updated to current time
- `is_active` (boolean): Only active extensions are processed

### Testing Scenarios

#### Scenario 1: Normal Operation
- Extension 1001 exists in AMI response → Status updated from AMI data
- Extension 1002 exists in AMI response → Status updated from AMI data

#### Scenario 2: Missing Extension
- Extension 1003 NOT in AMI response → Gets status_code=4, status_text="Unavailable", availability_status="offline"
- Extension 1004 NOT in AMI response → Gets status_code=4, status_text="Unavailable", availability_status="offline"

#### Scenario 3: Mixed Results
- Extensions 1001, 1002 in AMI → Updated with AMI data
- Extensions 1003, 1004 NOT in AMI → Marked as unavailable
- Statistics show both updated and marked_offline counts

### Error Handling
- Wrapped in try-catch blocks with proper logging
- Statistics tracking includes `marked_offline` count
- Debug files contain offline marking operations

### Performance Considerations
- Single query to find missing extensions using `whereNotIn()`
- Bulk processing with individual update tracking
- Database indexes on `availability_status` and `is_active` fields

## Usage

### Frontend User Flow
1. User clicks "Refresh from Asterisk" button
2. Confirmation modal appears
3. User confirms → AMI refresh begins
4. Extensions found in AMI get updated status
5. Extensions NOT found in AMI get marked as "Unavailable"
6. Frontend reloads extension list showing updated statuses
7. Success toast shows number of extensions processed

### Expected Results
- ✅ Extensions in AMI: Real-time status from Asterisk
- 🔴 Extensions NOT in AMI: Status Code 4, Status Text "Unavailable", Availability "offline"
- 📊 Statistics include both updated and offline counts
- 🎯 Frontend displays proper red styling for offline extensions

## Files Modified
1. `backend/app/Services/Ami/Features/Extensions/ExtensionService.php`
   - Fixed availability_status filter condition
   - Added status_text = "Unavailable" for missing extensions

## Dependencies
- Extension model with proper fillable fields
- Database migration with status fields
- Frontend ExtensionManagement component (already working)
- AMI connection and ExtensionStateList command

## Implementation Complete ✅
The system now properly marks extensions not found in AMI as unavailable with the correct status code, status text, and availability status as requested.