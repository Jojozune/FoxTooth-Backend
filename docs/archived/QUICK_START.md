# Quick Start - Run Server Now

## 🚀 Get Server Running in 30 Seconds

### Step 1: Open PowerShell in Server Directory
```powershell
cd C:\Users\rapto\OneDrive\Desktop\game_invites_backend\server
```

### Step 2: Start Server
```powershell
npm start
```

### Step 3: Wait for Startup Message
You should see:
```
🎮 Game Invite Backend running
📍 Local address: http://localhost:7777
🌐 Public address: http://159.26.103.121:7777
📡 Node Environment: production

✅ Connected to MySQL database: tidal_hunters
```

### ✅ Server is Running!

---

## 🧪 Quick Test

### Option 1: Test Locally
Open new PowerShell window:
```powershell
curl http://localhost:7777
```

Expected:
```json
{"message":"Game Invite Backend is running!"}
```

### Option 2: Test via Proton VPN Address
```powershell
curl http://159.26.103.121:7777
```

Same response = ✅ Port forwarding is working

---

## 🎮 Connect from Unity

Update your connection URL in Unity to:
```
http://159.26.103.121:7777
```

---

## ⚠️ Common Issues

| Issue | Solution |
|-------|----------|
| "Port 7777 already in use" | See PRODUCTION_SETUP.md - Kill existing process |
| "Cannot connect to database" | Verify MySQL is running: `Get-Service MySQL*` |
| "Cannot reach server from outside" | Check port forwarding in Proton VPN settings |
| Server keeps crashing | Check error logs in terminal, see PRODUCTION_SETUP.md |

---

## 🔑 Key Server Addresses

**For Local Testing:**
- HTTP: `http://localhost:7777`
- WebSocket: `ws://localhost:7777`

**For Unity Clients (Anywhere):**
- HTTP: `http://159.26.103.121:7777`
- WebSocket: `ws://159.26.103.121:7777`

---

## 📖 Next Steps

1. ✅ Server running? → Test endpoints
2. Update Unity client URL
3. See PRODUCTION_SETUP.md for keeping server running 24/7
4. See API_COMPLETE_REFERENCE.md for all endpoints

---

**Done!** Your backend is now production-ready with Proton VPN port forwarding. 🎉
