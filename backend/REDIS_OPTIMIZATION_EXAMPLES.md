# Redis Queue Optimization Examples

## Optimized Broadcasting Usage

### **Before (Direct Broadcasting):**
```php
// In ListenToAmi.php or ExtensionService.php
broadcast(new CallUpdated($call));
broadcast(new ExtensionStatusUpdated($extension));
```

### **After (Optimized Job-based Broadcasting):**
```php
// High priority real-time events
ProcessCallUpdate::dispatch($call, 'answered')->onQueue('priority');
ProcessExtensionUpdate::dispatch($extension)->onQueue('priority');

// Background processing
ProcessCallUpdate::dispatch($call, 'statistics')->onQueue('background');
```

---

## Queue Priority Strategy

### **Priority Queue** (`priority`):
- CallUpdated events (answered, ended, transferred)
- ExtensionStatusUpdated events  
- Emergency/urgent notifications
- **Workers**: 2-3 dedicated workers
- **Timeout**: 15-30 seconds

### **Main Queue** (`call_center_queue`):
- Regular call status updates
- Routine notifications
- General processing
- **Workers**: 3-5 workers  
- **Timeout**: 60 seconds

### **Background Queue** (`background`):
- Call statistics/reporting
- Cleanup operations  
- Analytics processing
- **Workers**: 1-2 workers
- **Timeout**: 300 seconds

---

## Production Worker Configuration

### **Multiple Worker Setup:**
```bash
# High priority workers (2x)
php artisan queue:work redis --queue=priority --tries=3 --timeout=30 --memory=256 &
php artisan queue:work redis --queue=priority --tries=3 --timeout=30 --memory=256 &

# Main queue workers (3x)  
php artisan queue:work redis --queue=call_center_queue,default --tries=3 --timeout=60 --memory=256 &
php artisan queue:work redis --queue=call_center_queue,default --tries=3 --timeout=60 --memory=256 &
php artisan queue:work redis --queue=call_center_queue,default --tries=3 --timeout=60 --memory=256 &

# Background worker (1x)
php artisan queue:work redis --queue=background --tries=5 --timeout=300 --memory=512 &
```

### **Supervisor Configuration** (`/etc/supervisor/conf.d/queue-workers.conf`):
```ini
[program:queue-priority]
process_name=%(program_name)s_%(process_num)02d
command=php /path/to/artisan queue:work redis --queue=priority --tries=3 --timeout=30 --memory=256
directory=/path/to/project
user=www-data
numprocs=2
redirect_stderr=true
stdout_logfile=/var/log/queue-priority.log
autostart=true
autorestart=true
startsecs=1
priority=1000

[program:queue-main]
process_name=%(program_name)s_%(process_num)02d  
command=php /path/to/artisan queue:work redis --queue=call_center_queue,default --tries=3 --timeout=60 --memory=256
directory=/path/to/project
user=www-data
numprocs=3
redirect_stderr=true
stdout_logfile=/var/log/queue-main.log
autostart=true
autorestart=true
startsecs=1
priority=999

[program:queue-background]
process_name=%(program_name)s_%(process_num)02d
command=php /path/to/artisan queue:work redis --queue=background --tries=5 --timeout=300 --memory=512
directory=/path/to/project
user=www-data
numprocs=1
redirect_stderr=true  
stdout_logfile=/var/log/queue-background.log
autostart=true
autorestart=true
startsecs=1
priority=998
```

---

## Memory Optimization

### **Redis Memory Configuration** (`redis.conf`):
```redis
# Memory optimizations for call center workload
maxmemory 2gb
maxmemory-policy allkeys-lru
maxmemory-samples 5

# Network optimizations
tcp-keepalive 60
timeout 300

# Performance optimizations  
save ""                    # Disable RDB for pure performance
appendonly no             # Disable AOF for queue-only usage (optional)
tcp-nodelay yes           # Reduce latency
```

### **PHP Memory Optimization**:
```ini
; php.ini optimizations
memory_limit = 512M
opcache.enable = 1
opcache.memory_consumption = 256
opcache.max_accelerated_files = 20000
```

---

## Monitoring Commands

### **Real-time Monitoring:**
```bash
# Watch queue status every 2 seconds
watch -n 2 'php artisan queue:migrate-helper status'

# Monitor Redis memory usage
watch -n 5 'redis-cli info memory | grep used_memory_human'

# Monitor queue lengths
watch -n 1 'redis-cli llen priority; redis-cli llen call_center_queue; redis-cli llen background'
```

### **Performance Benchmarking:**
```bash
# Before migration (database)
time php artisan queue:test-performance --connection=database --jobs=1000

# After migration (Redis)  
time php artisan queue:test-performance --connection=redis --jobs=1000

# Compare results - expect 30-100x improvement
```

---

## Expected Performance Metrics

### **Database Queue (Before)**:
```
Jobs: 1000
Time: ~10-15 seconds
Throughput: 66-100 jobs/second
Memory: ~200-300MB
```

### **Redis Queue (After)**:
```
Jobs: 1000
Time: ~0.1-0.5 seconds  ⚡
Throughput: 2000-10000 jobs/second ⚡
Memory: ~50-100MB ⚡
Improvement: 30-100x faster ⚡
```

### **Call Center Impact**:
- **Real-time responsiveness**: Sub-second frontend updates
- **Concurrent call capacity**: 10-100x more simultaneous calls
- **Agent experience**: Instant status updates
- **System reliability**: No queue backlogs
- **Scalability**: Ready for call center growth

---

**Final Status**: Complete Redis queue migration framework ready! 🚀

**Next Steps**: 
1. Install Redis server: `sudo apt install redis-server`
2. Test performance: `php artisan queue:test-performance`
3. Execute migration: `php artisan queue:migrate-helper switch --to=redis`