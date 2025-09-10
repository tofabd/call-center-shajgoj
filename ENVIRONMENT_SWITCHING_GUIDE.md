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
cd backend && php artisan config:clear
```

**Frontend:**
```bash
cp frontend/.env.development frontend/.env
cd frontend && npm run dev
```

**Access at:** `http://localhost:5173`

### 🚧 Staging Mode
**Backend:**
```bash
cp backend/.env.staging backend/.env
cd backend && php artisan config:clear && php artisan config:cache
```

**Frontend:**
```bash
cp frontend/.env.staging frontend/.env
cd frontend && npm run build
```

**Access at:** `https://staging.cc.shajgoj.shop`

### 🚀 Production Mode
**Backend:**
```bash
cp backend/.env.production backend/.env
cd backend && php artisan config:clear && php artisan config:cache
```

**Frontend:**
```bash
cp frontend/.env.production frontend/.env
cd frontend && npm run build
sudo systemctl reload nginx
```

**Access at:** `https://cc.shajgoj.shop`

## 🔍 Key Differences

| Environment | Domain | SSL | Debug | Cache | WebSocket | Database |
|-------------|--------|-----|-------|-------|-----------|----------|
| Development | localhost:8000 | No | Yes | Redis | HTTP:8080 | call_center_shajgoj_db |
| Staging | staging.cc.shajgoj.shop | Yes | Yes | Redis | HTTPS:8081 | call_center_shajgoj_staging_db |
| Production | cc.shajgoj.shop | Yes | No | Redis | HTTPS:8080 | call_center_shajgoj_db |

## ⚠️ Important Notes

### Supervisor Services Impact:
When switching backend environments, supervisor services (queue:work, reverb:start, app:listen-to-ami) may need restart:
```bash
sudo supervisorctl restart all
```

### Development Mode:
- Requires manual start: `php artisan serve` (backend) + `npm run dev` (frontend)
- Switching backend to dev breaks production until switched back
- Consider keeping backend in production, only switching frontend for UI development

### Production/Staging:
- Frontend served by Nginx from `/dist` folder
- Requires `npm run build` after environment change
- Nginx reload needed for cache clearing

## 📋 After Switching:

1. **Clear Laravel cache** (backend) - Always required
2. **Rebuild frontend** (staging/production) - Required for static builds
3. **Restart supervisor services** - If switching backend environment
4. **Check configuration** with `php artisan config:show` (backend)
5. **Verify access URLs** - Ensure correct domain/port access