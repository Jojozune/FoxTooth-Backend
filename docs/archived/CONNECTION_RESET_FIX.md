# Connection Reset - Diagnostic Guide

## What's Fixed ✅

Your server is now:
- ✅ Running on local port 7777
- ✅ Listening on 0.0.0.0 (all interfaces)
- ✅ Advertising public address: http://159.26.103.121:48799
- ✅ Connected to database

## Why "Connection Reset" Happens

This error specifically means:
1. The connection attempt reaches the server
2. BUT the server doesn't respond before closing

**Possible causes:**
1. ⚠️ Port forwarding not configured correctly
2. ⚠️ Proton VPN port forwarding not active
3. ⚠️ Windows Firewall blocking port 7777
4. ⚠️ Proton VPN disconnected

---

## ✅ Step 1: Verify Local Connection Works

Open new PowerShell and test:

```powershell
# From your machine
curl http://localhost:7777

# Should see:
# {"message":"Game Invite Backend is running!"}
```

If this works ✅, server is fine. Move to Step 2.

If this FAILS ❌, your server didn't start properly. Check:
```powershell
Get-Process node
netstat -ano | findstr :7777
```

---

## ⚠️ Step 2: Check Windows Firewall

Port 7777 must be allowed through firewall:

```powershell
# Check if rule exists
Get-NetFirewallRule -DisplayName "*Node*" 

# If nothing shows, create the rule:
New-NetFirewallRule -DisplayName "Node.js Backend" `
  -Direction Inbound `
  -Action Allow `
  -Protocol TCP `
  -LocalPort 7777
```

Then test again:
```powershell
curl http://localhost:7777
```

---

## 🌐 Step 3: Verify Proton VPN Port Forwarding

**This is the most likely issue.**

Your setup should be:
- External Port: `48799`
- Protocol: `TCP`
- Status: `Active` (green in P2P Forwarding)

**To check:**
1. Open Proton VPN
2. Go to Settings
3. Click "Advanced" or "P2P Forwarding"
4. Verify port `48799` is showing and enabled
5. If not enabled, click to enable it

**Important:** 
- This setting may reset if VPN disconnects
- After reconnecting VPN, re-enable port forwarding
- Some Proton VPN servers may not support P2P forwarding

---

## 🧪 Step 4: Test External Connection (If Behind Different Network)

Use a different network (mobile hotspot, different WiFi, etc.) and try:

```
http://159.26.103.121:48799
```

**If from same network as server:**
You might need to use local IP instead. Find your local IP:

```powershell
ipconfig

# Look for "IPv4 Address" under your active network adapter
# Probably: 192.168.X.X
```

Then test:
```
http://192.168.X.X:7777
```

---

## 🔧 Complete Diagnostic Script

Run this to check everything:

```powershell
# 1. Check if Node.js is running
Write-Host "1. Checking if server is running..."
Get-Process node -ErrorAction SilentlyContinue | Write-Host

# 2. Check if port 7777 is listening
Write-Host "`n2. Checking if port 7777 is listening..."
netstat -ano | findstr :7777

# 3. Test local connection
Write-Host "`n3. Testing local connection..."
$testLocal = curl http://localhost:7777 -ErrorAction SilentlyContinue
if ($testLocal) { 
    Write-Host "✅ Local connection works"
} else {
    Write-Host "❌ Local connection FAILED"
}

# 4. Check firewall
Write-Host "`n4. Checking firewall rules..."
Get-NetFirewallRule -DisplayName "*Node*" | Write-Host

# 5. Show local IP
Write-Host "`n5. Your local IP addresses:"
ipconfig | findstr "IPv4" | Write-Host

# 6. Check Proton VPN status
Write-Host "`n6. Proton VPN status:"
Write-Host "⚠️  Check manually in Proton VPN app for:"
Write-Host "   - VPN Connected (green)"
Write-Host "   - P2P Forwarding port 48799 Active (green)"
```

---

## 🚀 If Everything Checks Out

All working? Then try from your Unity game:

**Option 1: Local Testing (same network)**
```csharp
const string SERVER_URL = "http://192.168.X.X:7777";  // Use your local IP
```

**Option 2: Remote Testing (different network)**
```csharp
const string SERVER_URL = "http://159.26.103.121:48799";  // Use Proton address
```

**Make sure to test WebSocket too:**
```csharp
const string WEBSOCKET_URL = "ws://159.26.103.121:48799";
```

---

## 📋 Common Fixes Checklist

- [ ] Server running? → `Get-Process node`
- [ ] Port listening? → `netstat -ano | findstr :7777`
- [ ] Local connection works? → `curl http://localhost:7777`
- [ ] Firewall allows port 7777? → Check Net Firewall rules
- [ ] Proton VPN connected? → Check VPN app
- [ ] Port forwarding active? → Check P2P Forwarding settings
- [ ] Port forwarding on correct port? → Should be 48799
- [ ] Trying from different network? → Required for external test

---

## 🎯 Next Steps

1. ✅ Run the diagnostic script above
2. ✅ Fix any issues that show ❌
3. ✅ Once local (`localhost:7777`) works, test external
4. ✅ Once external works, connect from Unity
5. ✅ Monitor server logs for real-time feedback

---

**Still having issues?** Check:
- Terminal output for error messages
- Windows Event Viewer for firewall logs
- Proton VPN app status
- Try a different Proton VPN server (some don't support P2P)

You're close! The server is running correctly now. It's just about getting the port forwarding to talk to it. 🚀
