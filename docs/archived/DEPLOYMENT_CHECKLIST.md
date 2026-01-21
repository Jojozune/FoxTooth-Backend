# Production Deployment Checklist

## ✅ Server Configuration (DONE)

- [x] Updated `.env` with Proton VPN address: `159.26.103.121:48799`
- [x] Set `NODE_ENV=production`
- [x] Updated `server.js` to read from environment variables
- [x] Database configured: MySQL on localhost
- [x] WebSocket enabled
- [x] Rate limiting enabled
- [x] JWT authentication enabled

---

## 🚀 Before First Run

- [ ] **Verify MySQL is Running**
  ```powershell
  Get-Service MySQL*
  # Should show: Running
  ```

- [ ] **Verify Proton VPN Port Forwarding**
  - Open Proton VPN settings
  - Confirm port `48799` is forwarded to your machine
  - Note: Port forwarding may need to be re-enabled if VPN reconnects

- [ ] **Verify Windows Firewall**
  ```powershell
  # Allow Node.js on port 7777
  New-NetFirewallRule -DisplayName "Node.js" `
    -Direction Inbound -Action Allow -Protocol TCP -LocalPort 7777
  ```

- [ ] **Start Server**
  ```powershell
  cd C:\Users\rapto\OneDrive\Desktop\game_invites_backend\server
  npm start
  ```

- [ ] **Verify Server Startup**
  Look for:
  ```
  🎮 Game Invite Backend running
  📍 Local address: http://localhost:7777
  🌐 Public address: http://159.26.103.121:48799
  📡 Node Environment: production
  ✅ Connected to MySQL database: tidal_hunters
  ```

---

## 🧪 Immediate Tests (After Startup)

- [ ] **Health Check - Local**
  ```powershell
  curl http://localhost:7777
  # Response: {"message":"Game Invite Backend is running!"}
  ```

- [ ] **Health Check - Public Address**
  ```powershell
  curl http://159.26.103.121:48799
  # Same response = port forwarding works!
  ```

- [ ] **Test Login Endpoint**
  ```powershell
  $body = @{
    username = "testuser"
    password = "testpass123"
  } | ConvertTo-Json
  
  curl -Method POST `
    -Uri "http://localhost:7777/account/login" `
    -ContentType "application/json" `
    -Body $body
  ```

- [ ] **WebSocket Connection**
  - Use UNITY_CLIENT_TEMPLATE.cs to test
  - Should see: "Connected to WebSocket server"

---

## 📱 Unity Client Setup

- [ ] **Download Socket.IO Client for C#**
  - In Unity: Window → TextMesh Pro → Import TMP Essential Resources
  - Via NuGet or Asset Store: search "Socket.IO Client"

- [ ] **Copy UNITY_CLIENT_TEMPLATE.cs**
  - Location: `Assets/Scripts/Server/GameServerManager.cs`

- [ ] **Update Server URL in Client**
  ```csharp
  private const string SERVER_URL = "http://159.26.103.121:48799";
  private const string WEBSOCKET_URL = "ws://159.26.103.121:48799";
  ```

- [ ] **Test Login**
  ```csharp
  // In your UI or test script
  GameServerManager.Instance.Login("testuser", "testpass123");
  ```

- [ ] **Test Heartbeat**
  - Should see heartbeat messages in console
  - Server should confirm player is online

- [ ] **Test Invites**
  - Open 2 game instances
  - Player A sends invite to Player B
  - Player B receives notification via WebSocket

---

## 🔒 Security Checklist

- [ ] JWT secrets are unique (in `.env`)
  ```bash
  JWT_SECRET=0f252c32296b582420bccea5b7fdc9736db3eae1518286c9c196b1e9e55f1a2d
  ADMIN_SECRET=3ad44f833cae13a63f6edf6e5cafc14a3b719e02c719ec7d66ed5a791357223b
  ```

- [ ] Password hashing enabled (bcryptjs ✅)

- [ ] Rate limiting active:
  - 100 requests/15 min per IP
  - 5 failed login attempts/15 min per IP

- [ ] Input validation enabled ✅

- [ ] Database password stored in `.env` (not in code)

- [ ] CORS enabled for client connections ✅

---

## 🛠️ Keep Server Running 24/7

**Option 1: Using PM2 (Recommended)**
```powershell
npm install -g pm2
pm2 start server.js --name "game-invites-backend"
pm2 startup
pm2 save
```

**Option 2: Windows Task Scheduler**
- Create batch file to run `npm start`
- Schedule as task to run on system startup

**Option 3: Windows Service**
```powershell
# Install NSSM first
choco install nssm

# Create service
nssm install GameInvites "C:\Program Files\nodejs\node.exe" "C:\path\to\server.js"
net start GameInvites
```

**Monitor Status:**
```powershell
pm2 status
pm2 logs game-invites-backend
```

---

## 📊 Performance Optimization

- [ ] **Database Connection Pool**
  Current: 10 connections
  - If more than 100 concurrent players, increase to 50
  - Edit: `config/database.js` → `connectionLimit: 50`

- [ ] **Rate Limiting Tuning**
  If legitimate users hitting limits:
  - Edit: `middleware/rateLimit.js`
  - Increase windowMs or max values

- [ ] **WebSocket Optimization**
  - Real-time events work great
  - HTTP endpoints for non-urgent data (list players, etc.)

- [ ] **Server Specifications**
  - Minimum: 512MB RAM, 1GB available disk
  - Recommended: 2GB RAM, for 500+ concurrent players
  - CPU: Any modern multi-core CPU

---

## 🔍 Monitoring & Logging

- [ ] **Enable Detailed Logs**
  - Check terminal output for errors
  - Database connection issues
  - Failed authentications
  - WebSocket errors

- [ ] **Monitor Database**
  ```sql
  -- Check active connections
  SELECT * FROM INFORMATION_SCHEMA.PROCESSLIST;
  
  -- Check table sizes
  SELECT table_name, ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb
  FROM information_schema.TABLES WHERE table_schema = 'tidal_hunters';
  ```

- [ ] **Monitor Player Activity**
  ```sql
  SELECT COUNT(*) as online_players FROM players WHERE is_online = 1;
  SELECT * FROM players WHERE is_online = 1 LIMIT 10;
  ```

---

## 🐛 Troubleshooting Commands

```powershell
# Check if server is running
Get-Process node

# Check port 7777 usage
netstat -ano | findstr :7777

# Kill process on port 7777
taskkill /PID <PID> /F

# Check Windows Firewall
Get-NetFirewallRule -DisplayName "Node.js"

# Test connection to Proton address
Test-NetConnection -ComputerName 159.26.103.121 -Port 48799

# Check MySQL connection
mysql -h localhost -u root -p tidal_hunters

# View recent server logs
pm2 logs --lines 50
```

---

## 📋 Daily/Weekly Tasks

**Daily:**
- [ ] Monitor server logs for errors
- [ ] Check if server process is still running
- [ ] Monitor database size growth

**Weekly:**
- [ ] Review player statistics
- [ ] Check database backup
- [ ] Update npm dependencies: `npm update`
- [ ] Clean up old login tokens: Manual trigger or via cleanup intervals

**Monthly:**
- [ ] Security patches: `npm audit fix`
- [ ] Performance review
- [ ] Backup database

---

## 🚨 Emergency Procedures

**Server Crash:**
1. Check error logs: `pm2 logs game-invites-backend`
2. Restart: `pm2 restart game-invites-backend`
3. If still crashing, check database connection

**Database Down:**
1. Check if MySQL is running: `Get-Service MySQL*`
2. Try to connect: `mysql -h localhost -u root -p`
3. If corrupted, restore from backup

**Port Forwarding Down:**
1. Reconnect to Proton VPN
2. Re-enable port forwarding in settings
3. Test: `curl http://159.26.103.121:48799`

**High Latency/Timeouts:**
1. Check database connections: `SELECT COUNT(*) FROM INFORMATION_SCHEMA.PROCESSLIST;`
2. Increase connection pool if near limit
3. Check server CPU/RAM usage

---

## 📞 Quick Reference

**Server Address:**
- Local: `http://localhost:7777`
- Public: `http://159.26.103.121:48799`
- WebSocket: `ws://159.26.103.121:48799`

**API Reference:** See `API_COMPLETE_REFERENCE.md`

**Setup Guide:** See `PRODUCTION_SETUP.md`

**Quick Start:** See `QUICK_START.md`

**Unity Template:** See `UNITY_CLIENT_TEMPLATE.cs`

---

## ✨ Final Status

Your backend is production-ready when you've completed:
- [x] Server configuration with Proton VPN
- [ ] Initial startup and testing
- [ ] Database verified
- [ ] Firewall configured
- [ ] Unity clients connecting
- [ ] 24/7 keep-alive set up
- [ ] Monitoring in place

**Once all checked:** You're live! 🚀

---

**Last Updated:** October 26, 2025
**Server Version:** 1.0.0 with WebSocket + Heartbeat System
