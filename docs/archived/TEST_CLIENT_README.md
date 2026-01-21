# 🧪 Local Test Client - Quick Start

## Prerequisites

Your backend server must be running on `http://localhost:7777`

## Installation

### 1. Install Dependencies

```powershell
cd c:\Users\rapto\OneDrive\Desktop\game_invites_backend\server
npm install socket.io-client axios dotenv
```

### 2. Verify Installation

```powershell
npm list socket.io-client axios dotenv
```

Should show:
```
test-server@1.0.0 C:\Users\rapto\OneDrive\Desktop\game_invites_backend\server
├── axios@x.x.x
├── dotenv@x.x.x
└── socket.io-client@x.x.x
```

## Running Tests

### Option 1: Quick Test (One-liner)

```powershell
node test-client.js
```

### Option 2: With Custom Server URL

```powershell
$env:SERVER_URL="http://your-server:7777"; $env:WS_URL="http://your-server:7777"; node test-client.js
```

### Option 3: Using .env File

```powershell
# Copy the .env.test file
cp .env.test .env

# Edit if needed, then run:
node test-client.js
```

## What Gets Tested

### ✅ Phase 1: Account Creation
- Creates 3 test players
- Validates player ID and tag generation

### ✅ Phase 2: Login
- Tests login with email/password
- Validates JWT token issuance

### ✅ Phase 3: WebSocket Connection
- Connects 3 players via Socket.IO
- Tests authentication via handshake

### ✅ Phase 4: Heartbeat
- Sends heartbeat via WebSocket
- Validates server acknowledgement

### ✅ Phase 5: Friend System
- Send friend request
- Accept friend request
- Decline friend request
- Check friends list
- Block player

### ✅ Phase 6: Invite System (Real-Time)
- Send invite via WebSocket
- Receive invite in real-time
- Acknowledge invite receipt
- Accept/decline invite

### ✅ Phase 7: Player Status
- Check online player list
- Verify player online flags

### ✅ Phase 8: Token Validation
- Validate JWT token

### ✅ Phase 9: Cleanup
- Disconnect all players gracefully

## Expected Output

```
[HH:MM:SS] 🧪 PHASE 1: Account Creation
[HH:MM:SS] ✅ Created TestPlayer1 (ID: 1, Tag: 2847)
[HH:MM:SS] ✅ Created TestPlayer2 (ID: 2, Tag: 5931)
[HH:MM:SS] ✅ Created TestPlayer3 (ID: 3, Tag: 4102)

[HH:MM:SS] 🧪 PHASE 2: Login
[HH:MM:SS] ✅ TestPlayer1 logged in (token received)
[HH:MM:SS] ✅ TestPlayer2 logged in (token received)
[HH:MM:SS] ✅ TestPlayer3 logged in (token received)

[HH:MM:SS] 🧪 PHASE 3: WebSocket Connection
[HH:MM:SS] ✅ TestPlayer1 WebSocket connected (ID: abc123)
[HH:MM:SS] ✅ TestPlayer2 WebSocket connected (ID: def456)
[HH:MM:SS] ✅ TestPlayer3 WebSocket connected (ID: ghi789)

... (more phases) ...

╔════════════════════════════════════════════════════════════╗
║                     📊 TEST SUMMARY                        ║
╚════════════════════════════════════════════════════════════╝

✅ Passed: 45
❌ Failed: 0
📈 Total: 45
✔️ Success Rate: 100.0%

🎉 ALL TESTS PASSED! System is working correctly.
```

## Troubleshooting

### Error: "Server is not responding"

**Problem:** Backend server not running
**Solution:**
```powershell
# Make sure your backend is running
npm start
# In another terminal, run the test client
node test-client.js
```

### Error: "Cannot find module 'socket.io-client'"

**Problem:** Dependencies not installed
**Solution:**
```powershell
npm install socket.io-client axios dotenv
```

### Error: "WebSocket timeout"

**Problem:** Server not accepting WebSocket connections
**Solution:**
1. Check server is running: `http://localhost:7777` in browser
2. Verify WebSocket is enabled in `server.js`
3. Check token is valid

### Error: "Cannot POST /account/create"

**Problem:** Server is running on wrong port
**Solution:**
Update `SERVER_URL` and `WS_URL` in test-client.js or .env file

### Test hangs on "WebSocket Connection"

**Problem:** Server WebSocket not responding
**Solution:**
1. Check server logs for errors
2. Verify `socket.io` is initialized in server.js
3. Restart backend server

## Running Multiple Times

Each test run creates new players with unique emails. You can run the test multiple times without issues.

If you want to reuse players:
- Modify test-client.js to use fixed email addresses
- Or clean up accounts between runs via admin endpoint

## Performance

Expected runtime: **10-15 seconds** for full test suite

Breakdown:
- Account creation: 2-3s
- Login: 1-2s
- WebSocket connection: 2-3s
- Friend system: 2-3s
- Invite system: 2-3s
- Remaining phases: 1-2s

## Next Steps After Passing

1. ✅ Run test client successfully
2. ✅ Verify all systems working locally
3. 📝 Implement UI in your game client
4. 🎮 Integrate with actual game
5. 🚀 Deploy to production

---

**Last Updated:** October 27, 2025
**Compatible With:** Node.js 14+, Windows/Mac/Linux
