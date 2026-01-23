# Quick Deployment Guide

**Status:** ✅ READY TO DEPLOY

---

## Pre-Launch Checklist (30 min)

### 1. Verify Configuration
```bash
cd c:\Users\rapto\OneDrive\Desktop\game_invites_backend\server
cat .env
```
✅ Check:
- [ ] DB_HOST correct
- [ ] DB_USER correct
- [ ] DB_PASSWORD correct
- [ ] DB_NAME = tidal_hunters
- [ ] JWT_SECRET present (64 chars)
- [ ] ADMIN_SECRET present (64 chars)

### 2. Verify Dependencies
```bash
npm install
```

### 3. Test Database Connection
```bash
node -e "
const db = require('./config/database.js');
setTimeout(() => {
  console.log('✅ Database connected successfully');
  process.exit(0);
}, 1000);
"
```

### 4. Create `remember_tokens` Table in Database
```sql
CREATE TABLE remember_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  player_id BIGINT UNSIGNED NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_player_id (player_id),
  INDEX idx_expires_at (expires_at),
  CONSTRAINT fk_remember_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 5. Verify `.gitignore` Contains `.env`
```bash
cat .gitignore | grep "\.env"
```
✅ Should show `.env` in output

### 6. Test Server Startup (Local)
```bash
node server/server.js
```
✅ Should show:
```
🎮 Game Invite Backend running on http://localhost:41043
✅ Connected to MySQL database: tidal_hunters
```

### 7. Test Health Endpoint
```bash
curl http://localhost:41043/
```
✅ Should return: `{"message":"Game Invite Backend is running!"}`

---

## Deployment Steps

### Option A: Direct Server Deployment (Linux/Windows)

```bash
# 1. Connect to server
ssh user@your-server.com

# 2. Clone/upload repository
git clone https://your-repo.git game_backend
cd game_backend/server

# 3. Install dependencies
npm install

# 4. Create .env file with production values
nano .env
# Enter production credentials

# 5. Start with PM2 (recommended for production)
npm install -g pm2
pm2 start server.js --name "game-backend" --env production

# 6. Enable auto-restart on reboot
pm2 startup
pm2 save

# 7. View logs
pm2 logs game-backend
```

### Option B: Docker Deployment

**Dockerfile:**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY server ./server
EXPOSE 41043
CMD ["node", "server/server.js"]
```

**Build & Run:**
```bash
docker build -t game-backend:1.0 .
docker run -d --name game-backend \
  --env-file .env.prod \
  -p 41043:41043 \
  game-backend:1.0
```

### Option C: Cloud Deployment (AWS/GCP/Azure)

Use your cloud provider's container/app service:
- **AWS:** Elastic Beanstalk or ECS
- **GCP:** Cloud Run or App Engine
- **Azure:** App Service or Container Instances

Each requires uploading `.env` secrets via their secret management system.

---

## HTTPS Setup (CRITICAL)

### Option 1: Reverse Proxy (Nginx)
```nginx
upstream game_backend {
  server localhost:41043;
}

server {
  listen 443 ssl;
  server_name api.yourgame.com;
  
  ssl_certificate /path/to/cert.pem;
  ssl_certificate_key /path/to/key.pem;
  
  location / {
    proxy_pass http://game_backend;
    proxy_set_header Authorization $http_authorization;
    proxy_pass_header Authorization;
  }
}
```

### Option 2: AWS Application Load Balancer
- Add HTTPS listener on port 443
- Point to backend on 41043
- Attach SSL certificate from ACM

### Option 3: Node Native HTTPS
```javascript
// Add to server/server.js
const https = require('https');
const fs = require('fs');

const options = {
  key: fs.readFileSync('/path/to/key.pem'),
  cert: fs.readFileSync('/path/to/cert.pem')
};

https.createServer(options, app).listen(PORT, '0.0.0.0');
```

---

## Post-Deployment Validation

### 1. Test Public Endpoints

**Create Account:**
```bash
curl -X POST http://localhost:41043/account/create \
  -H "Content-Type: application/json" \
  -d '{
    "display_name": "TestPlayer",
    "player_tag": "#0001",
    "email": "test@example.com",
    "password": "TestPass123"
  }'
```
✅ Should return: `{"status":"success","player_id":1}`

**Login:**
```bash
curl -X POST http://localhost:41043/account/login \
  -H "Content-Type: application/json" \
  -d '{
    "display_name": "TestPlayer",
    "player_tag": "#0001",
    "password": "TestPass123",
    "remember_me": true
  }'
```
✅ Should return tokens (access_token, refresh_token, remember_token)

### 2. Test Protected Endpoints

**Validate Token:**
```bash
curl http://localhost:41043/player/validate-token \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```
✅ Should return: `{"status":"valid","player":{...}}`

### 3. Test Admin Endpoints

**Generate Admin Token (requires admin account):**
```bash
# First, make your test player an admin in database:
mysql> UPDATE players SET is_admin = 1 WHERE id = 1;

# Then:
curl http://localhost:41043/admin/generate-token \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```
✅ Should return: `{"status":"success","admin_token":"..."}`

---

## Monitoring Setup

### Add Health Check Endpoint
```javascript
// Add to server/server.js routes
app.get('/health', (req, res) => {
  db.getConnection((err, conn) => {
    if (err) {
      return res.status(503).json({ status: 'unhealthy', db: 'disconnected' });
    }
    conn.release();
    res.json({ status: 'healthy', db: 'connected' });
  });
});
```

### Configure Load Balancer Health Check
- **Path:** `/health`
- **Interval:** 30 seconds
- **Timeout:** 5 seconds
- **Healthy Threshold:** 2 checks
- **Unhealthy Threshold:** 3 checks

---

## Log Monitoring

### Suggested Monitoring Tools
- **Application Logs:** PM2, CloudWatch, Stackdriver
- **Database Logs:** MySQL slow query log
- **Performance:** New Relic, DataDog, Prometheus

### Critical Alerts
```
IF database_connection_fails THEN alert "DB CRITICAL"
IF response_time > 2000ms FOR 5min THEN alert "Performance degraded"
IF error_rate > 1% FOR 10min THEN alert "High error rate"
IF no_heartbeat_from_server FOR 5min THEN alert "Server down"
```

---

## Troubleshooting

### Server Won't Start
```bash
# Check Node is installed
node --version

# Check port 41043 is free
netstat -an | grep 41043

# Check .env file exists
ls -la server/.env

# Check database connection
node server/config/database.js
```

### Tokens Not Working
```bash
# Verify JWT_SECRET in .env is set
grep JWT_SECRET server/.env

# Verify database credentials
mysql -h $DB_HOST -u $DB_USER -p $DB_PASSWORD -D $DB_NAME -e "SELECT COUNT(*) FROM players;"
```

### Database Errors
```bash
# Check tidal_hunters database exists
mysql -e "SHOW DATABASES;" | grep tidal_hunters

# Check required tables
mysql tidal_hunters -e "SHOW TABLES;"
# Should include: players, refresh_tokens, remember_tokens, game_sessions, game_servers, invites
```

---

## Rollback Plan

If deployment fails:

```bash
# 1. Stop current version
pm2 stop game-backend

# 2. Revert to previous version
git checkout previous-commit

# 3. Restart
pm2 start server.js --name "game-backend"

# 4. Verify
curl http://localhost:41043/
```

---

## Success Criteria

✅ Deploy successful when:
- [ ] Server starts without errors
- [ ] `/` endpoint returns 200
- [ ] `/health` endpoint returns `healthy`
- [ ] Account creation works
- [ ] Login returns tokens
- [ ] Protected endpoints require valid token
- [ ] Admin endpoints require admin token
- [ ] All traffic is HTTPS (if using reverse proxy)

---

## First Week Monitoring

**Day 1:**
- Monitor response times (should be < 500ms)
- Monitor error rate (should be < 0.1%)
- Monitor database connections (should be < 5)

**Days 2-7:**
- Check for memory leaks (process memory should stabilize)
- Check for token expiry issues (watch for refresh failures)
- Check for duplicate account attempts (monitor rate limiter)
- Check for admin token abuse

---

## Support Contact

If issues arise:
1. Check PRODUCTION_READINESS.md for detailed information
2. Review SECURITY_AUDIT.md for security questions
3. Review ADMIN_SYSTEM_AUDIT.md for admin-related issues

---

**Status:** ✅ Ready to launch! 🚀
