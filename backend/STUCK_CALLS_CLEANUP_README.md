# 🚀 Stuck Calls Cleanup System

This system automatically cleans up calls that get stuck in "in-progress" status due to network issues, AMI disconnections, or other problems.

## 🎯 **What It Does**

- **Detects stuck calls** that have been in progress for too long
- **Automatically cleans them up** every 10 minutes
- **Prevents multiple "in-progress" calls** for the same extension
- **Broadcasts updates** to the frontend in real-time
- **Logs all cleanup activities** for monitoring

## 🚀 **Quick Start**

### **1. Test the Command (Safe - No Changes Made)**
```bash
cd backend
php artisan app:cleanup-stuck-calls --dry-run
```

### **2. Run Cleanup Manually (Actually Clean Up)**
```bash
cd backend
php artisan app:cleanup-stuck-calls
```

### **3. Check Current Call Status**
```bash
cd backend
php test-cleanup.php
```

## 📋 **Command Options**

### **Basic Usage**
```bash
# Default: 30 minutes timeout, with confirmation
php artisan app:cleanup-stuck-calls

# Custom timeout (e.g., 15 minutes)
php artisan app:cleanup-stuck-calls --timeout=15

# Dry run (see what would be cleaned up)
php artisan app:cleanup-stuck-calls --dry-run

# Force cleanup without confirmation
php artisan app:cleanup-stuck-calls --timeout=30 --no-interaction
```

### **Timeout Values**
- **15 minutes**: Very aggressive (good for testing)
- **30 minutes**: Recommended (default)
- **60 minutes**: Conservative (good for production)

## 🔄 **Automatic Scheduling**

The cleanup runs **every 10 minutes** automatically via Laravel's scheduler.

### **Manual Scheduler Run**
```bash
# Run scheduled tasks manually
php artisan schedule:run

# List all scheduled tasks
php artisan schedule:list
```

### **Cron Job Setup (Production)**
Add this to your server's crontab:
```bash
* * * * * cd /path/to/your/backend && php artisan schedule:run >> /dev/null 2>&1
```

## 📊 **What Gets Cleaned Up**

### **Stuck Call Criteria**
- ✅ Call has `answered_at` timestamp (was answered)
- ❌ Call is missing `ended_at` timestamp (never ended)
- ⏰ Call has been in this state for >30 minutes (configurable)

### **Cleanup Actions**
- Sets `ended_at` to current time
- Sets `hangup_cause` to "timeout_cleanup"
- Calculates `talk_seconds` if missing
- Broadcasts update to frontend
- Logs the cleanup activity

## 🧪 **Testing & Monitoring**

### **Test Script**
```bash
cd backend
php test-cleanup.php
```

This script will:
- Run a dry-run cleanup
- Show current call statistics
- Display stuck calls details
- Provide usage instructions

### **Monitoring Logs**
```bash
# Check Laravel logs for cleanup activities
tail -f storage/logs/laravel.log | grep "Stuck call cleaned up"

# Check for cleanup failures
tail -f storage/logs/laravel.log | grep "Failed to clean up stuck call"
```

## 🚨 **Troubleshooting**

### **Command Not Found**
```bash
# Clear command cache
php artisan config:clear
php artisan cache:clear

# Check if command is registered
php artisan list | grep cleanup
```

### **Permission Issues**
```bash
# Make sure storage directory is writable
chmod -R 775 storage/
chmod -R 775 bootstrap/cache/
```

### **Database Connection Issues**
```bash
# Test database connection
php artisan tinker
>>> App\Models\Call::count()
```

## 📈 **Performance & Safety**

### **Safety Features**
- ✅ **Dry-run mode** to preview changes
- ✅ **Confirmation prompt** before cleanup
- ✅ **Error handling** for each call
- ✅ **Logging** of all activities
- ✅ **Non-overlapping** scheduler execution

### **Performance**
- **Runs every 10 minutes** (not continuously)
- **Background execution** (doesn't block other processes)
- **Batch processing** of stuck calls
- **Minimal database impact**

## 🎯 **Expected Results**

### **Before Cleanup**
```
Extension 2001: 2 calls in "in_progress" status
- Call 1: Stuck for 45 minutes (network issue)
- Call 2: Active for 5 minutes (normal)
```

### **After Cleanup**
```
Extension 2001: 1 call in "in_progress" status
- Call 1: Cleaned up (marked as ended)
- Call 2: Still active (normal)
```

## 🔧 **Customization**

### **Change Timeout Value**
Edit `backend/routes/console.php`:
```php
Schedule::command('app:cleanup-stuck-calls --timeout=45')
    ->everyTenMinutes()
    // ... rest of configuration
```

### **Change Schedule Frequency**
```php
// Every 5 minutes (more aggressive)
->everyFiveMinutes()

// Every 15 minutes (less aggressive)
->cron('*/15 * * * *')

// Twice daily
->twiceDaily(9, 17)
```

## 📞 **Support**

If you encounter issues:
1. Check the logs: `tail -f storage/logs/laravel.log`
2. Run test script: `php test-cleanup.php`
3. Test manually: `php artisan app:cleanup-stuck-calls --dry-run`

## 🎉 **Success Indicators**

- ✅ No more multiple "in-progress" calls per extension
- ✅ Stuck calls get cleaned up automatically
- ✅ Frontend shows accurate call statuses
- ✅ Logs show successful cleanup activities
- ✅ Extensions become available again after cleanup

---

**🚀 Your stuck calls problem is now solved!** 🎯✨
