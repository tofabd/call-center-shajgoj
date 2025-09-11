# Environment Switching Guide

## 📁 Available Environment Files

### Backend:
- `.env.development` - Local development (localhost:8000)
- `.env.staging` - Staging server (staging.cc.shajgoj.shop)
- `.env.production` - Production server (cc.shajgoj.shop)
- `.env` - Currently active configuration

### Frontend:
- `.env.development` - Local development (localhost:5173)
- `.env.staging` - Staging server (staging.cc.shajgoj.shop)
- `.env.production` - Production server (cc.shajgoj.shop)
- `.env` - Currently active configuration

## ⚡ Quick Switch Commands

### 🔧 Development Mode
**Backend:**
```bash
cp backend/.env.development backend/.env
cd backend && php artisan config:clear && php artisan cache:clear
php artisan serve  # Start Laravel development server
```

**Frontend:**
```bash
cp frontend/.env.development frontend/.env
cd frontend && npm run dev
```

**Services Check:**
```bash
sudo supervisorctl status  # Verify ami-listener, laravel-queue, laravel-reverb are RUNNING
```

**Access at:** `http://localhost:5173`

### 🚧 Staging Mode
**Backend:**
```bash
cp backend/.env.staging backend/.env
cd backend && php artisan config:clear && php artisan config:cache && php artisan cache:clear
```

**Frontend:**
```bash
cp frontend/.env.staging frontend/.env
cd frontend && npm run build
sudo systemctl reload nginx
```

**Services:**
```bash
sudo supervisorctl restart all
```

**Access at:** `https://staging.cc.shajgoj.shop`

### 🚀 Production Mode
**Backend:**
```bash
cp backend/.env.production backend/.env
cd backend && php artisan config:clear && php artisan config:cache && php artisan cache:clear
```

**Frontend:**
```bash
cp frontend/.env.production frontend/.env
cd frontend && npm run build
sudo systemctl reload nginx
```

**Services:**
```bash
sudo supervisorctl restart all
```

**Access at:** `https://cc.shajgoj.shop`

## 🔍 Key Differences

| Environment | Domain | SSL | Debug | Cache | WebSocket | Database | Services |
|-------------|--------|-----|-------|-------|-----------|----------|----------|
| Development | localhost:8000 | No | Yes | Redis | HTTP:8080 | call_center_shajgoj_db | Supervisor + Manual |
| Staging | staging.cc.shajgoj.shop | Yes | Yes | Redis | HTTPS:8081 | call_center_shajgoj_staging_db | Supervisor |
| Production | cc.shajgoj.shop | Yes | No | Redis | HTTPS:8080 | call_center_shajgoj_db | Supervisor |

## ⚠️ Important Notes

### Supervisor Services Impact:
When switching backend environments, supervisor services (queue:work, reverb:start, app:listen-to-ami) may need restart:
```bash
sudo supervisorctl restart all
```

### Development Mode:
- **Requires manual start**: `php artisan serve` (backend) + `npm run dev` (frontend)
- **Supervisor services**: ami-listener, laravel-queue, laravel-reverb should be RUNNING
- **Database**: Uses same database as production (be careful with data changes!)
- **Real-time features**: WebSocket on port 8080, Queue processing enabled
- **Switching backend to dev**: Breaks production until switched back

### Production/Staging:
- **Frontend served by Nginx** from `/dist` folder
- **Requires `npm run build`** after environment change
- **Nginx reload needed** for cache clearing
- **SSL certificates required** for HTTPS/WebSocket connections

### Current Status (as of 2025-09-11):
- ✅ **Broadcasting**: Fixed - Reverb working, channels authorized
- ✅ **Queue processing**: Fixed - Workers listening to all queues
- ✅ **Real-time updates**: Working in development mode
- ✅ **Backup files**: Cleaned up (outdated files removed)

## 📋 After Switching:

1. **Clear Laravel cache** (backend) - Always required
   ```bash
   cd backend && php artisan config:clear && php artisan cache:clear && php artisan view:clear && php artisan route:clear
   ```

2. **Rebuild frontend** (staging/production) - Required for static builds
   ```bash
   cd frontend && npm run build
   ```

3. **Restart supervisor services** - If switching backend environment
   ```bash
   sudo supervisorctl restart laravel-queue laravel-reverb ami-listener
   ```

4. **Check configuration** with artisan commands
   ```bash
   cd backend && php artisan tinker --execute="echo 'APP_ENV: ' . env('APP_ENV') . ', APP_DEBUG: ' . env('APP_DEBUG')"
   ```

5. **Verify access URLs** - Ensure correct domain/port access
6. **Test real-time features** - Check WebSocket connections and queue processing

## 🔧 Troubleshooting

### Development Mode Issues:
```bash
# Check if Laravel server is running
netstat -tlnp | grep :8000

# Check if frontend dev server is running
netstat -tlnp | grep :5173

# Check supervisor services
sudo supervisorctl status

# Clear all caches
cd backend && php artisan config:clear && php artisan cache:clear
```

### Production Mode Issues:
```bash
# Check Nginx status
sudo systemctl status nginx

# Check SSL certificates
sudo certbot certificates

# Verify WebSocket connections
curl -I https://cc.shajgoj.shop
```

### Real-time Features Not Working:
```bash
# Check Reverb server
sudo supervisorctl status laravel-reverb

# Check queue workers
sudo supervisorctl status laravel-queue

# Check Redis connection
redis-cli ping

# Verify channel authorization
cd backend && php artisan tinker --execute="broadcast(new \App\Events\CallUpdated(\App\Models\Call::first()))"
```

## 📝 Environment File Management

### Backup Strategy:
- **Git version control**: Environment files are tracked for changes
- **Staging as template**: Use `.env.staging` as base for new environments
- **No manual backups**: Removed outdated `.env.production.backup` files
- **Timestamp backups**: Create when making major configuration changes

### File Status:
- ✅ **Tracked files**: `.env.development`, `.env.production`, `.env.staging`
- ✅ **Clean structure**: No redundant backup files
- ✅ **Version controlled**: All changes tracked in git history

## 🚀 Quick Environment Check

```bash
# Current backend environment
cd backend && grep "APP_ENV\|APP_DEBUG\|APP_URL" .env

# Current frontend environment
cd frontend && grep "VITE_API_URL\|VITE_REVERB" .env

# Service status
sudo supervisorctl status

# Web server status (development)
netstat -tlnp | grep -E ":(8000|5173|8080)"
```