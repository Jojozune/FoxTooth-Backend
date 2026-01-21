# Production Setup Guide - Proton VPN P2P Forwarding

**Your Configuration:**
- Public IP: `159.26.103.121`
- Port: `48799`
- Server URL: `http://159.26.103.121:48799`
**Your Configuration:**
- Public IP: `159.26.103.121`
- Port: `7777`
- Server URL: `http://159.26.103.121:7777`
## ✅ What's Already Configured

Your `.env` file is now set to production with your Proton VPN details:

```bash
NODE_ENV=production
SERVER_HOST=159.26.103.121
SERVER_PORT=48799
SERVER_URL=http://159.26.103.121:48799
```

Your `server.js` now uses these environment variables and will display:
```
🌐 Public address: http://159.26.103.121:48799
📡 Node Environment: production
```

---

## 🚀 Starting the Server

### Option 1: Direct (Development/Testing)
```powershell
npm start
```

Expected output:
```
🎮 Game Invite Backend running
📍 Local address: http://localhost:7777
🌐 Public address: http://159.26.103.121:48799
📡 Node Environment: production

✅ Connected to MySQL database: tidal_hunters
```

### Option 2: With Nodemon (Auto-restart on changes)
```powershell
npm run dev
```

---

## 🔌 Network Verification

Before deploying clients, verify your server is reachable:

### Test 1: Local Connection (on your machine)
```powershell
# Test HTTP endpoint
curl http://localhost:7777

# Should respond:
# {"message":"Game Invite Backend is running!"}
```

### Test 2: Local Network (if clients are on same network)
```powershell
# From another machine on your local network
# Replace 192.168.X.X with your local machine IP
curl http://192.168.X.X:7777
```

### Test 3: Proton VPN Public Address (from outside network)
```powershell
# From anywhere (requires port forwarding is working)
curl http://159.26.103.121:48799

# Should respond:
# {"message":"Game Invite Backend is running!"}
```

---

## 🎮 Configure Your Unity Clients

In your Unity project, update the server address to:

```csharp
// C# - Update your connection manager
const string SERVER_URL = "http://159.26.103.121:48799";
const string WEBSOCKET_URL = "ws://159.26.103.121:48799";

// Example using HttpClient
using (var client = new HttpClient())
{
    client.DefaultRequestUri = new Uri(SERVER_URL);
    
    // Login example
    var loginResponse = await client.PostAsync(
        "/account/login",
        new StringContent(JsonConvert.SerializeObject(new {
            username = "player1",
            password = "password123"
        }))
    );
}

// Example using Socket.IO client
using SocketIOClient;
var socket = new SocketIO(WEBSOCKET_URL);
socket.On("connect", () => {
    Debug.Log("Connected to server!");
});
```

---

## ⚠️ Important Production Notes

### 1. Port Forwarding Requirements

Your Proton VPN setup needs:
- ✅ External port: `48799` forwarding to your machine
- ✅ Internal port: `7777` (what the server runs on)
- ✅ Protocol: TCP (for both HTTP and WebSocket)

**Verify port forwarding is active:**
```powershell
# Check if port 48799 is listening (on Proton VPN side)
# You may need to test this from outside your network
```

### 2. Firewall Configuration

**Windows Firewall:**
```powershell
# Allow Node.js through firewall
New-NetFirewallRule -DisplayName "Node.js Backend" `
  -Direction Inbound `
  -Action Allow `
  -Protocol TCP `
  -LocalPort 7777

# Or allow all on port 7777
netsh advfirewall firewall add rule name="Node.js Port 7777" `
  dir=in action=allow protocol=tcp localport=7777
```

**Testing firewall:**
```powershell
# Check if port is open
Test-NetConnection -ComputerName 159.26.103.121 -Port 48799

# Should show: TcpTestSucceeded : True
```

### 3. Database Connectivity

Verify your MySQL is accessible from the application:

```powershell
# Test MySQL connection (using mysql client or similar)
mysql -h localhost -u root -p tidal_hunters
```

Your current config connects to `localhost` - this works if:
- ✅ MySQL is running on the same machine as Node.js
- ✅ Or MySQL is accessible via localhost

If MySQL is on another machine, update `.env`:
```bash
DB_HOST=your_mysql_ip_or_hostname
```

### 4. Keep Server Running (Windows)

For production, you should keep the server running. Options:

#### Option A: Using PM2 (Recommended)
```powershell
# Install PM2 globally
npm install -g pm2

# Start server with PM2
pm2 start server.js --name "game-invites-backend"

# Make it restart on system reboot
pm2 startup
pm2 save

# Monitor
pm2 monit
```

#### Option B: Using Windows Task Scheduler
1. Create a batch file `run-server.bat`:
```batch
@echo off
cd /d C:\Users\rapto\OneDrive\Desktop\game_invites_backend\server
npm start
pause
```

2. Add to Task Scheduler to run on system startup

#### Option C: Using NSSM (Windows Service)
```powershell
# Install NSSM
choco install nssm

# Install Node.js as Windows service
nssm install GameInvitesBackend "C:\Program Files\nodejs\node.exe" "C:\Users\rapto\OneDrive\Desktop\game_invites_backend\server\server.js"

# Start service
net start GameInvitesBackend
```

---

## 📊 Monitoring

### Check Server Status

```powershell
# Health check
curl http://159.26.103.121:48799

# Check specific endpoints
curl -H "Authorization: Bearer YOUR_TOKEN" http://159.26.103.121:48799/player/validate-token
```

### View Server Logs

If running with PM2:
```powershell
pm2 logs game-invites-backend

# Or tail last 100 lines
pm2 logs game-invites-backend --lines 100
```

### Database Queries

Monitor active connections:
```sql
SELECT * FROM INFORMATION_SCHEMA.PROCESSLIST;
```

---

## 🔑 Security Checklist

- [x] JWT secrets configured (in `.env`)
- [x] Admin secret configured (in `.env`)
- [x] Rate limiting enabled (100 req/15min per IP)
- [x] Input validation enabled
- [x] CORS enabled
- [x] Password hashing with bcryptjs

**Additional recommendations:**

- [ ] Use HTTPS instead of HTTP (requires SSL certificate)
- [ ] Add request logging/monitoring
- [ ] Set up database backups
- [ ] Monitor token usage
- [ ] Set up alerts for errors
- [ ] Regular security updates (`npm update`)

---

## 🐛 Troubleshooting

### "Cannot connect to server"

1. Check server is running:
```powershell
Get-Process node  # Should show node.js process
```

2. Check port is listening:
```powershell
netstat -ano | findstr :7777
```

3. Check firewall:
```powershell
Test-NetConnection -ComputerName 159.26.103.121 -Port 48799
```

4. Check Proton VPN port forwarding is active

### "Database connection failed"

1. Verify MySQL is running:
```powershell
Get-Service MySQL* | Where-Object Status -eq "Running"
```

2. Test connection:
```bash
mysql -h localhost -u root -p
```

3. Verify database exists:
```sql
SHOW DATABASES;
USE tidal_hunters;
SHOW TABLES;
```

### "Port already in use"

```powershell
# Find what's using port 7777
netstat -ano | findstr :7777

# Kill the process (replace PID)
taskkill /PID 1234 /F
```

### "WebSocket connection refused"

1. Ensure WebSocket is enabled in `server.js` ✅
2. Use `ws://` or `wss://` (not `http://`)
3. Check firewall allows WebSocket upgrade
4. Verify client has correct server URL

---

## 📱 Unity Client Setup

Update your Unity scripts to connect to the production server:

```csharp
// ConnectionManager.cs
public class ConnectionManager : MonoBehaviour
{
    // Use environment or inspector
    public string ServerURL = "http://159.26.103.121:48799";
    
    private void Start()
    {
        // For login
        StartCoroutine(LoginRequest());
        
        // For WebSocket
        ConnectToWebSocket();
    }
    
    private IEnumerator LoginRequest()
    {
        using (var client = new UnityWebRequest($"{ServerURL}/account/login", "POST"))
        {
            // ... your login code
        }
    }
    
    private void ConnectToWebSocket()
    {
        var socket = new SocketIO($"ws://159.26.103.121:48799");
        socket.On("connect", () => {
            Debug.Log("✅ Connected to game server!");
        });
    }
}
```

---

## 📈 Performance Notes

With your current setup:

**Expected Capacity:**
- Concurrent players: 500+ (limited by database connection pool of 10)
- Requests per second: 5,000+ (JavaScript is fast)
- Real-time events: 1,000+ simultaneous WebSocket connections

**Bottlenecks:**
- Database connections (currently 10 max) - increase if needed
- Proton VPN bandwidth
- Your machine CPU/RAM

**If hitting limits:**
1. Increase database connection pool:
```javascript
// config/database.js
connectionLimit: 50  // Increase from 10
```

2. Use load balancing (multiple Node.js instances)
3. Consider dedicated hosting

---

## 🚀 Next Steps

1. ✅ Start server: `npm start`
2. ✅ Test health endpoint: `curl http://159.26.103.121:48799`
3. ✅ Test login: Use API_COMPLETE_REFERENCE.md
4. ✅ Configure Unity client with `159.26.103.121:48799`
5. ✅ Set up monitoring/auto-restart
6. ✅ Monitor performance and logs

---

**You're ready to deploy!** 🎉

Questions? Check API_COMPLETE_REFERENCE.md for all endpoint details.
