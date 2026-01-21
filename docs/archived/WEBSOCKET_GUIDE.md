# WebSocket Real-Time Events Guide

## Overview

Your backend now supports **WebSocket connections** for real-time events. This replaces polling for invites, friends, and status updates. Instead of constantly asking "Did I get an invite?", the server tells you instantly: "You got an invite!"

**Key Benefits:**
- ✅ **Instant notifications** - No delay waiting for polling
- ✅ **Less bandwidth** - No constant polling requests
- ✅ **Better UX** - Users see updates immediately
- ✅ **Lower server load** - Fewer HTTP requests
- ✅ **Automatic online status** - Connected = online, disconnected = offline

---

## Architecture

### What uses WebSocket vs HTTP?

**WebSocket (Real-time) - Use for:**
- Invites (send/receive/respond)
- Heartbeat acknowledgments
- Real-time notifications
- Live status updates

**HTTP REST (Polling) - Use for:**
- User authentication
- Account creation/login
- Check-alive status (fallback)
- Data that doesn't need real-time updates

### Connection Flow

```
1. Client: Login via HTTP to get access token
2. Client: Connect to WebSocket with access token
3. Client: Emit heartbeat every 5-10 seconds
4. Client: Listen for invite:received events
5. Client: Emit invite:send to send invite
6. Server: Broadcasts invite:received to target player
7. Client: Emits invite:respond with accept/decline
8. Server: Notifies both players of response
```

---

## WebSocket Events

### Connection Setup

**Client connects with:**
```javascript
const socket = io('http://10.252.7.171:7777', {
  auth: {
    token: 'your_jwt_access_token'
  }
});
```

**Server authenticates** using your JWT token. Connection fails if token is invalid or expired.

---

## Events Reference

### 1. Heartbeat Events

#### Client sends heartbeat:
```javascript
socket.emit('heartbeat', {
  game_open: true  // true if game window is focused, false if alt-tabbed
});
```

#### Server acknowledges:
```javascript
socket.on('heartbeat:ack', (data) => {
  console.log('Heartbeat received:', data);
  // {
  //   status: 'success',
  //   timestamp: '2025-10-26T12:34:56.789Z',
  //   game_open: true
  // }
});
```

**Recommended:** Send heartbeat every **5-10 seconds** while connected.

---

### 2. Invite Send Events

#### Client sends invite:
```javascript
socket.emit('invite:send', {
  receiver_id: 42,           // Player to invite
  session_code: 'ABC123'     // Session they're in
});
```

#### Success response:
```javascript
socket.on('invite:send:success', (data) => {
  console.log('Invite sent:', data);
  // {
  //   status: 'success',
  //   invite_id: 999,
  //   receiver_id: 42,
  //   receiver_name: 'PlayerName#1234',
  //   session_code: 'ABC123',
  //   expires_in: 120
  // }
});
```

#### Error response:
```javascript
socket.on('invite:send:error', (data) => {
  console.error('Failed to send invite:', data.message);
  // {
  //   status: 'error',
  //   message: 'Receiver not found or offline'
  // }
});
```

---

### 3. Invite Receive Events

#### Receiver gets notified in real-time:
```javascript
socket.on('invite:received', (data) => {
  console.log('Got an invite!', data);
  // {
  //   invite_id: 999,
  //   sender_id: 10,
  //   sender_name: '#1234',
  //   session_code: 'ABC123',
  //   server_ip: '192.168.1.100',
  //   server_port: 7778,
  //   created_at: '2025-10-26T12:34:56Z',
  //   expires_in: 120
  // }
  
  // Show popup/notification to user
  ShowInviteNotification(data);
});
```

#### Player acknowledges they saw the invite:
```javascript
socket.emit('invite:acknowledged', {
  invite_id: 999
});
```

#### Server confirms acknowledgment:
```javascript
socket.on('invite:acknowledged:ack', (data) => {
  console.log('Acknowledgment received');
});
```

---

### 4. Invite Response Events

#### Client responds (accept or decline):
```javascript
// Accept invite
socket.emit('invite:respond', {
  invite_id: 999,
  response: 'accept'  // or 'decline'
});

// Or decline
socket.emit('invite:respond', {
  invite_id: 999,
  response: 'decline'
});
```

#### Accept success - player gets connection info:
```javascript
socket.on('invite:respond:success', (data) => {
  if (data.status === 'accepted') {
    console.log('Invite accepted!', data);
    // {
    //   status: 'accepted',
    //   invite_id: 999,
    //   server_ip: '192.168.1.100',
    //   server_port: 7778,
    //   session_code: 'ABC123',
    //   message: 'Connecting to game session...'
    // }
    
    // Connect to game server with these details
    ConnectToGameServer(data.server_ip, data.server_port);
  } else if (data.status === 'declined') {
    console.log('Invite declined');
  }
});
```

#### Error response:
```javascript
socket.on('invite:respond:error', (data) => {
  console.error('Failed to respond:', data.message);
});
```

#### Sender gets notified:
```javascript
// If receiver accepts
socket.on('invite:accepted', (data) => {
  console.log('Your invite was accepted!', data);
  // {
  //   invite_id: 999,
  //   receiver_id: 42,
  //   message: 'Invite was accepted'
  // }
});

// If receiver declines
socket.on('invite:declined', (data) => {
  console.log('Your invite was declined', data);
  // {
  //   invite_id: 999,
  //   receiver_id: 42,
  //   message: 'Invite was declined'
  // }
});
```

---

## Unity C# Implementation

### Installation

First, install Socket.IO client for Unity:
```bash
# Option 1: Via package manager (recommended)
com.socketio.socket.io-client-unity

# Option 2: Manual - Download from:
# https://github.com/socketio/socket.io-client-csharp/releases
```

### Complete Example

```csharp
using SocketIOClient;
using UnityEngine;
using System;

public class GameInviteManager : MonoBehaviour
{
    private SocketIOUnity socket;
    private string accessToken;
    private float heartbeatTimer = 0f;
    private const float HEARTBEAT_INTERVAL = 5f;

    public void ConnectWebSocket(string token)
    {
        accessToken = token;

        var uri = new Uri("http://10.252.7.171:7777");
        
        // Configure Socket.IO options
        var socketIOOptions = new SocketIOOptions
        {
            Transport = SocketIOClient.Transport.TransportProtocol.WebSocket,
            Auth = new Dictionary<string, string>
            {
                { "token", token }
            },
            ReconnectionDelay = 1000,
            ReconnectionDelayMax = 5000,
            ReconnectionAttempts = int.MaxValue
        };

        socket = new SocketIOUnity(uri, socketIOOptions);

        // Register event listeners
        RegisterEventListeners();

        // Connect
        socket.Connect();
    }

    private void RegisterEventListeners()
    {
        // Connection events
        socket.On("connect", () =>
        {
            Debug.Log("✅ Connected to WebSocket server");
        });

        socket.On("disconnect", (response) =>
        {
            Debug.Log("🔌 Disconnected from WebSocket");
        });

        socket.OnError += (socket, e) =>
        {
            Debug.LogError($"❌ WebSocket error: {e}");
        };

        // Heartbeat acknowledgments
        socket.On("heartbeat:ack", (response) =>
        {
            // Server acknowledged our heartbeat
            Debug.Log($"💓 Heartbeat ack: {response}");
        });

        // Invite events
        socket.On("invite:received", (response) =>
        {
            var data = response.GetValue();
            Debug.Log($"📨 Invite received: {data}");
            
            // Parse the invite data
            var inviteId = data["invite_id"].GetValue<int>();
            var senderId = data["sender_id"].GetValue<int>();
            var senderName = data["sender_name"].GetValue<string>();
            var sessionCode = data["session_code"].GetValue<string>();
            var serverIp = data["server_ip"].GetValue<string>();
            var serverPort = data["server_port"].GetValue<int>();
            
            // Show notification to player
            ShowInviteNotification(inviteId, senderName, serverIp, serverPort, sessionCode);
        });

        socket.On("invite:send:success", (response) =>
        {
            var data = response.GetValue();
            Debug.Log($"✅ Invite sent successfully: {data}");
        });

        socket.On("invite:send:error", (response) =>
        {
            var data = response.GetValue();
            Debug.LogError($"❌ Failed to send invite: {data["message"]}");
        });

        socket.On("invite:respond:success", (response) =>
        {
            var data = response.GetValue();
            var status = data["status"].GetValue<string>();
            
            if (status == "accepted")
            {
                Debug.Log("✅ Invite accepted!");
                var serverIp = data["server_ip"].GetValue<string>();
                var serverPort = data["server_port"].GetValue<int>();
                var sessionCode = data["session_code"].GetValue<string>();
                
                // Connect to game server
                ConnectToGameServer(serverIp, serverPort, sessionCode);
            }
            else if (status == "declined")
            {
                Debug.Log("❌ Invite was declined");
            }
        });

        socket.On("invite:respond:error", (response) =>
        {
            var data = response.GetValue();
            Debug.LogError($"❌ Failed to respond to invite: {data["message"]}");
        });

        socket.On("invite:accepted", (response) =>
        {
            var data = response.GetValue();
            var receiverId = data["receiver_id"].GetValue<int>();
            Debug.Log($"🎉 Player {receiverId} accepted your invite!");
        });

        socket.On("invite:declined", (response) =>
        {
            var data = response.GetValue();
            var receiverId = data["receiver_id"].GetValue<int>();
            Debug.Log($"😞 Player {receiverId} declined your invite");
        });
    }

    private void Update()
    {
        // Send heartbeat periodically
        if (socket != null && socket.IsConnected)
        {
            heartbeatTimer += Time.deltaTime;
            
            if (heartbeatTimer >= HEARTBEAT_INTERVAL)
            {
                SendHeartbeat();
                heartbeatTimer = 0f;
            }
        }
    }

    private void SendHeartbeat()
    {
        var gameOpen = Application.isFocused ? 1 : 0;
        
        socket.Emit("heartbeat", new
        {
            game_open = gameOpen == 1
        });
    }

    public void SendInvite(int receiverId, string sessionCode)
    {
        if (socket == null || !socket.IsConnected)
        {
            Debug.LogError("Not connected to WebSocket");
            return;
        }

        socket.Emit("invite:send", new
        {
            receiver_id = receiverId,
            session_code = sessionCode
        });
    }

    public void RespondToInvite(int inviteId, string response)
    {
        if (socket == null || !socket.IsConnected)
        {
            Debug.LogError("Not connected to WebSocket");
            return;
        }

        if (response != "accept" && response != "decline")
        {
            Debug.LogError("Response must be 'accept' or 'decline'");
            return;
        }

        socket.Emit("invite:respond", new
        {
            invite_id = inviteId,
            response = response
        });
    }

    public void AcknowledgeInvite(int inviteId)
    {
        if (socket == null || !socket.IsConnected)
        {
            Debug.LogError("Not connected to WebSocket");
            return;
        }

        socket.Emit("invite:acknowledged", new
        {
            invite_id = inviteId
        });
    }

    private void ShowInviteNotification(int inviteId, string senderName, string serverIp, int serverPort, string sessionCode)
    {
        Debug.Log($"📬 Showing invite notification: {senderName} invited you to join!");
        
        // TODO: Show UI popup with Accept/Decline buttons
        // When user clicks Accept: RespondToInvite(inviteId, "accept");
        // When user clicks Decline: RespondToInvite(inviteId, "decline");
    }

    private void ConnectToGameServer(string ip, int port, string sessionCode)
    {
        Debug.Log($"🎮 Connecting to game server: {ip}:{port} (Session: {sessionCode})");
        
        // TODO: Implement game server connection logic
        // Connect to the Tidal Hunters game server using ip, port, sessionCode
    }

    private void OnDestroy()
    {
        if (socket != null)
        {
            socket.Disconnect();
            socket.Dispose();
        }
    }
}
```

### Usage in Your Game

```csharp
// In your login/authentication flow
public void OnLoginSuccess(string accessToken)
{
    GameInviteManager inviteManager = GetComponent<GameInviteManager>();
    inviteManager.ConnectWebSocket(accessToken);
}

// When sending an invite
public void OnInviteButtonClicked(int playerId, string sessionCode)
{
    GameInviteManager inviteManager = GetComponent<GameInviteManager>();
    inviteManager.SendInvite(playerId, sessionCode);
}

// When responding to invite
public void OnAcceptInvite(int inviteId)
{
    GameInviteManager inviteManager = GetComponent<GameInviteManager>();
    inviteManager.RespondToInvite(inviteId, "accept");
}

public void OnDeclineInvite(int inviteId)
{
    GameInviteManager inviteManager = GetComponent<GameInviteManager>();
    inviteManager.RespondToInvite(inviteId, "decline");
}
```

---

## Event Timing & Flow Examples

### Example 1: Sending an Invite

```
1. You select Player2 and click "Invite"
   Client: socket.emit('invite:send', {receiver_id: 2, session_code: 'ABC123'})

2. Server receives, validates, creates invite
   Server: Verifies session exists and you're the host
   Server: Checks Player2 is online
   Server: Inserts invite into database

3. You get confirmation
   Client receives: invite:send:success
   UI shows: "Invite sent to Player2"

4. Player2 gets notified immediately
   Player2 client receives: invite:received
   UI shows: Popup "Player1 invited you to join"

5. Player2 clicks "Accept"
   Client: socket.emit('invite:respond', {invite_id: 999, response: 'accept'})

6. You get notified immediately
   Your client receives: invite:accepted
   UI shows: "Player2 joined your session!"
```

### Example 2: Player Crashes

```
1. Everything normal, you're in a game session
   You send heartbeat every 5 seconds

2. Your game crashes
   Heartbeat stops being sent
   Server has no event

3. Server cleanup runs (every 10 seconds)
   Checks for heartbeats older than 30 seconds
   Your last_heartbeat is now 35 seconds old
   Server: UPDATE players SET is_online = 0 WHERE id = your_id

4. Friends checking your status see you offline
   REST API: GET /player/check-alive/:playerId → is_alive: false
   Or via WebSocket if you implement live status updates
```

---

## Performance Considerations

### Bandwidth Usage

| Method | Heartbeat Payload | Frequency | Total/min |
|--------|------------------|-----------|----------|
| HTTP   | ~200 bytes | Every 5s | ~2.4 KB |
| WebSocket | ~50 bytes | Every 5s | ~600 bytes | **76% less!** |

### When to Use Each

**WebSocket:**
- ✅ Invites (real-time)
- ✅ Heartbeats (continuous)
- ✅ Notifications
- ✅ Status updates

**HTTP REST:**
- ✅ Login/Auth (one-time)
- ✅ Create account (one-time)
- ✅ Fallback checks
- ✅ Admin operations

---

## Troubleshooting

### Connection fails with "Authentication error"
- Check token is valid and not expired
- Token must be JWT access_token, not refresh_token
- Verify token is passed in `auth: { token: '...' }`

### "Player not found" when sending invite
- Receiver must be online (is_online = 1)
- Receiver must have accepted a login (not just created account)
- Check receiver_id is correct integer

### Invites don't appear in real-time
- Confirm receiver is connected to WebSocket
- Check browser console for connection errors
- Verify auth token is valid

### High memory usage
- Disconnect players who've been idle 30+ min
- Implement max connection limits
- Use browser dev tools to check for memory leaks

### Latency issues
- Use CDN for static files
- Consider regional WebSocket servers for scaled deployment
- Monitor server CPU (may need to scale horizontally)

---

## Future Enhancements

1. **Friend status updates**: Live notification when friends come online
2. **Party system**: Create parties with real-time member updates
3. **Chat messages**: Real-time direct messaging via WebSocket
4. **Game events**: Broadcast match results, leaderboard updates
5. **Reconnection**: Auto-reconnect if connection drops
6. **Rooms**: Socket.IO rooms for targeted broadcasts
