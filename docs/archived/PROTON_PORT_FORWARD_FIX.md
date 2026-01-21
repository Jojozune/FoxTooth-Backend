# Proton VPN Port Forwarding - Connection Reset Fix

**Your Situation:**
- ✅ Localhost works: `http://localhost:7777`
- ✅ Server listening on `0.0.0.0:7777`
- ❌ Proton VPN address fails: `http://159.26.103.121:7777`
- ✅ Server is running and responding

**This means: Server is fine, port forwarding is the issue.**

---

## 🎯 Your Network Setup

```
Your Machine:
  ├─ Local IP: 192.168.0.31
  ├─ VPN IP: 10.98.0.22
  ├─ Public IP via Proton: 159.26.103.121
  └─ Server Port: 7777

Proton VPN Should Forward:
   159.26.103.121:7777 → Your Machine → 127.0.0.1:7777
```

---

## 🔧 Step 1: Verify Port Forwarding is ACTIVE

This is the most common issue. **Port forwarding expires or doesn't auto-renew.**

### In Proton VPN App:

1. **Open Proton VPN**
2. **Look for "Ports" or "Port Forwarding" section**
3. Find the forwarding rule for port **7777**
4. Check if it shows: **ACTIVE** (usually green)

**If it shows "Disabled" or is missing:**
- Click the refresh/enable button
- Make sure it says "Port forwarding active"
- Port forwarding may need to be re-enabled after VPN reconnects

**Note:** Different Proton VPN servers have different support. You might need to:
- Use a specific server that supports P2P
- Some servers: Go to Settings → Features → Toggle "Secure Core" OFF (if on)

---

## 🔍 Step 2: Find Which Proton Server You're On

Proton VPN P2P forwarding only works on specific servers. Check:

1. **Click Proton VPN window title/status area** showing current server
2. Look for server name like `US-TX#1` or `NL-FREE#2`
3. **Important:** Some free/basic Proton VPN servers don't support P2P
4. **Solution:** Connect to a different Proton VPN server that supports P2P

**Which servers support P2P forwarding?**
- Check Proton VPN's server list
- Look for badge/icon indicating "P2P" support
- Usually paid plan servers support it better

---

## 🧪 Step 3: Test Your Port Forwarding

### Option A: From Another Network (Most Reliable)
Use your phone on mobile data (not connected to your WiFi):

```
Open browser and try: http://159.26.103.121:7777
```

If it connects: ✅ Port forwarding is working!
If "Connection Reset": ❌ Port forwarding not active or misconfigured

### Option B: Use Online Port Checker Tool
Go to: `https://www.yougetsignal.com/tools/open-ports/`

Enter:
- IP: `159.26.103.121`
- Port: `48799`

Click "Check Port"

Result:
- ✅ "Port is open" = forwarding working
- ❌ "Port is closed" = forwarding not active

### Option C: Telnet Test (From Another Network)
If you have access to another machine on a different network:

```
telnet 159.26.103.121 48799
```

Result:
- ✅ Blank screen with blinking cursor = port responding
- ❌ "Connection refused" or timeout = port not forwarding

---

## ⚡ Step 4: Verify Proton VPN Configuration

### Common Issues & Fixes

**Issue 1: Port Forwarding Shows "Disabled"**
```
Fix: Click the toggle/button to enable port forwarding
     Wait 10 seconds for it to activate
     It should show green/ACTIVE
```

**Issue 2: Wrong Proton Server**
```
Fix: Disconnect VPN → Connect to different server
     (Preferably one with P2P badge)
     Then re-enable port forwarding
```

**Issue 3: VPN Disconnected**
```
Fix: If VPN shows "disconnected", reconnect
     Port forwarding resets after reconnect
     Must manually re-enable port forwarding
```

**Issue 4: Firewall Blocking**
```
Fix: Even though localhost works, external firewall rules might differ
     You may need to allow port 7777 from external IPs
```

---

## 🛡️ Step 5: Windows Firewall Double-Check

Even though localhost works, the firewall might block external connections. Let's be thorough:

```powershell
# 1. Check if firewall rule exists and is enabled
Get-NetFirewallRule -DisplayName "*Node*" | Format-List DisplayName,Enabled

# 2. If nothing found, create comprehensive rule
New-NetFirewallRule -DisplayName "Node.js Backend All Traffic" `
  -Direction Inbound `
  -Action Allow `
  -Protocol TCP `
  -LocalPort 7777 `
  -RemoteAddress Any

# 3. Verify it's created
Get-NetFirewallRule -DisplayName "*Node*" | Format-List DisplayName,Enabled
```

---

## 🔄 Step 6: Restart Everything in Order

**Sometimes the simplest fix works:**

1. **Stop server:**
   ```powershell
   taskkill /F /IM node.exe
   ```

2. **Reconnect Proton VPN:**
   - Click disconnect in Proton VPN app
   - Wait 5 seconds
   - Click connect again
   - Wait for "Connected" status

3. **Re-enable port forwarding:**
      - In Proton VPN app, enable port forwarding for port 7777
   - Wait 10 seconds for green/ACTIVE status

4. **Start server again:**
   ```powershell
   cd "C:\Users\rapto\OneDrive\Desktop\game_invites_backend\server"
   npm start
   ```

5. **Test local first:**
   ```powershell
   curl http://localhost:7777
   ```

6. **Test external (from different network):**
   ```
   http://159.26.103.121:7777
   ```

---

## 📋 Complete Diagnostic Checklist

- [ ] Port 7777 listening? `netstat -ano | findstr :7777` → Should show LISTENING
- [ ] Proton VPN connected? Check app status → Should show green Connected
- [ ] Port 7777 forwarding active? Check Proton app → Should show green ACTIVE
- [ ] Correct server? Using P2P-compatible server? Check server name/badges
- [ ] Local connection works? `curl http://localhost:7777` → Should work
- [ ] Windows firewall allows? Run firewall rule check above
- [ ] Can test from different network? Use phone mobile data to verify
- [ ] Tried port checker tool? https://www.yougetsignal.com/tools/open-ports/

---

## 🚀 Quick Fixes to Try (In Order)

1. **First:** Disable and re-enable port forwarding in Proton VPN (most common fix)
2. **Second:** Restart Node.js server
3. **Third:** Reconnect to Proton VPN entirely
4. **Fourth:** Switch to different Proton VPN server
5. **Fifth:** Check port with online tool
6. **Sixth:** Test from different network (mobile hotspot)

---

## 📞 If Still Not Working

Run this complete diagnostic and share output:

```powershell
Write-Host "=== SERVER DIAGNOSTIC ===" -ForegroundColor Cyan
Write-Host "`n1. Server Status:"
Get-Process node -ErrorAction SilentlyContinue | Select-Object ProcessName, Id, CPU, Memory

Write-Host "`n2. Port Listening:"
netstat -ano | findstr :7777 | findstr LISTENING

Write-Host "`n3. Local Test:"
try {
    $response = Invoke-WebRequest -Uri http://localhost:7777 -TimeoutSec 5
    Write-Host "✅ Local connection works"
} catch {
    Write-Host "❌ Local connection failed: $($_.Exception.Message)"
}

Write-Host "`n4. Network Adapter Info:"
ipconfig | findstr -A 1 "IPv4 Address"

Write-Host "`n5. Firewall Status:"
Get-NetFirewallRule -DisplayName "*Node*" | Format-Table DisplayName, Enabled

Write-Host "`n6. Proton VPN Status:"
Write-Host "⚠️ Check manually in Proton VPN app:"
Write-Host "   - Connected: [YES/NO]"
Write-Host "   - Port Forwarding: [ACTIVE/INACTIVE]"
Write-Host "   - Server Name: [Write it down]"
Write-Host "   - Has P2P Badge: [YES/NO]"
```

---

## 🎯 The Root Cause (99% of the Time)

**Most common reason for "Connection Reset":**
- Port forwarding is DISABLED in Proton VPN app
- OR Port forwarding expired after VPN reconnect
- OR Using a server that doesn't support P2P

**The fix:**
1. Open Proton VPN app
2. Find Port Forwarding section
3. Enable port 7777
4. Wait for green/ACTIVE status
5. Try connection again

---

## 💡 Pro Tips

**Persistent Issue? Try This:**
- Some Proton VPN plans have limited P2P forwarding
- Switch to higher tier (Plus/Visionary)
- OR use different VPN service that's better for P2P
- OR run server directly on public IP without VPN

**Testing While On Proton VPN:**
- You can't test your own forwarding from same Proton VPN
- Must use different network (mobile hotspot, etc.)
- OR use the online port checker tool

**Alternative: Use Local IP for Testing**
While you fix port forwarding, test with local IP:
```
http://192.168.0.31:7777
```
This works on your local network and proves server is fine.

---

**Next Steps:**
1. Follow Step 1-6 above
2. Run the diagnostic if it still doesn't work
3. Share any error messages you see
4. Check that Proton VPN port forwarding is actually ACTIVE

You're super close - this is almost certainly just the port forwarding being disabled or needing a fresh activation! 🚀
