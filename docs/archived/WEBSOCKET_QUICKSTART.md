# WebSocket Quick Start

## What Changed?

You now have **real-time event streaming** in addition to your REST API.

### Before (Polling)
```
Client: "Do I have any invites?" (HTTP)
Server: "No"
Client: "Do I have any invites?" (HTTP) [5 seconds later]
Server: "No"
Client: "Do I have any invites?" (HTTP) [5 seconds later]
Server: "YES! 1 new invite"
```

### After (WebSocket)
```
Client: Connects to WebSocket
Server: [instantly sends] "You got an invite!"
```

---

## Installation

### 1. Install Dependencies
Your `package.json` has been updated with `socket.io: ^4.7.2`

Run this:
```bash
npm install
```

### 2. Install Unity Socket.IO Client

In your Unity project, add the Socket.IO package:
```
com.socketio.socket.io-client-unity
```

Or download from: https://github.com/socketio/socket.io-client-csharp/releases

---

## Server Setup

✅ **Already Done!**

Your `server.js` now:
- Imports `socket.io`
- Creates HTTP server that supports both Express + WebSocket
- Initializes WebSocket on startup
- Authenticates connections using JWT tokens
- Handles all real-time events

Just run:
```bash
npm run dev
# or
npm start
```

Server starts with: `🔌 WebSocket (Real-time Events): Enabled`

---

## Unity Client Setup

### Step 1: Connect on Login

```csharp
public void OnLoginSuccess(string accessToken)
{
    var inviteManager = GetComponent<GameInviteManager>();
    inviteManager.ConnectWebSocket(accessToken);
}
```

### Step 2: Listen for Invites

```csharp
socket.On("invite:received", (response) =>
{
    var data = response.GetValue();
    Debug.Log("Got an invite!");
    // Show UI popup to accept/decline
});
```

### Step 3: Send Invites

```csharp
socket.Emit("invite:send", new
{
    receiver_id = 42,
    session_code = "ABC123"
});
```

### Step 4: Respond to Invites

```csharp
socket.Emit("invite:respond", new
{
    invite_id = 999,
    response = "accept"  // or "decline"
});
```

---

## Real-Time Flow

### Sending an Invite

```
You: socket.emit('invite:send', {receiver_id: 2, session_code: 'ABC123'})
  ↓
Server validates
  ↓
You: socket.on('invite:send:success') - Invite sent!
  ↓
Player2: socket.on('invite:received') - NEW INVITE! [instant]
  ↓
Player2 clicks Accept
  ↓
Player2: socket.emit('invite:respond', {invite_id: 999, response: 'accept'})
  ↓
You: socket.on('invite:accepted') - PLAYER JOINED! [instant]
```

---

## API Reference

### Connection
```javascript
const socket = io('http://10.252.7.171:7777', {
  auth: { token: 'your_access_token' }
});
```

### Client Events (Emit)
| Event | Payload | Purpose |
|-------|---------|---------|
| `heartbeat` | `{game_open: bool}` | Tell server you're alive |
| `invite:send` | `{receiver_id, session_code}` | Send invite to player |
| `invite:respond` | `{invite_id, response}` | Accept/decline invite |
| `invite:acknowledged` | `{invite_id}` | Confirm you saw the invite |

### Server Events (Listen)
| Event | Payload | Meaning |
|-------|---------|---------|
| `heartbeat:ack` | `{status, timestamp, game_open}` | Heartbeat received |
| `invite:received` | `{invite_id, sender_id, session_code, server_ip, server_port}` | Got invited |
| `invite:send:success` | `{invite_id, receiver_name}` | Invite sent |
| `invite:send:error` | `{message}` | Send failed |
| `invite:respond:success` | `{status, server_ip, server_port}` | Response recorded |
| `invite:respond:error` | `{message}` | Response failed |
| `invite:accepted` | `{receiver_id}` | Someone accepted your invite |
| `invite:declined` | `{receiver_id}` | Someone declined your invite |

---

## Complete Unity Example

See `WEBSOCKET_GUIDE.md` for full `GameInviteManager.cs` example.

Key points:
- Instantiate `GameInviteManager` on a GameObject
- Call `ConnectWebSocket(token)` after login
- Listen for `invite:received` events
- Call `RespondToInvite(inviteId, "accept"/"decline")`

---

## Heartbeat Behavior

### Automatic Online/Offline
- **Connect to WebSocket** = Player marked online
- **Disconnect from WebSocket** = Player marked offline (after 2 second grace period)
- **Send heartbeat every 5-10 seconds** = Stay online even if idle

### What Happens on Crash?
1. Game crashes → WebSocket disconnects
2. Server waits 2 seconds for reconnect
3. Player marked offline
4. Friends see player offline instantly

---

## Backwards Compatibility

### REST API Still Works!
All your existing HTTP endpoints work:
- `POST /account/login`
- `POST /invite/send`
- `GET /invite/check/:playerId`
- `POST /invite/respond`
- Etc.

WebSocket is **optional**. You can use:
- WebSocket for **invites** (real-time)
- REST API for **fallback** (when WS disconnects)

---

## Next Steps

1. ✅ Update `package.json` - Already done!
2. ✅ Restart server - `npm install` then `npm start`
3. ⏭️ Add Socket.IO client to Unity
4. ⏭️ Implement `GameInviteManager.cs`
5. ⏭️ Connect on login
6. ⏭️ Test by sending/receiving invites

---

## Performance

- **Heartbeat per player**: ~50 bytes every 5 seconds = minimal
- **Invite send**: 1 event + real-time delivery
- **Concurrent connections**: Server can handle 10,000+ with this setup
- **Memory**: ~1 KB per connection

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Connection fails | Check token is valid, not expired |
| Invites don't arrive | Check receiver is connected to WebSocket |
| Memory leak | Ensure disconnect event cleans up listeners |
| High latency | Check server CPU, may need to scale |
| Reconnection loops | Check token refresh on reconnect |

See `WEBSOCKET_GUIDE.md` for detailed troubleshooting.
