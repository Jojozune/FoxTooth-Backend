# Migration Guide: HTTP to WebSocket Invites

## Overview

Your invite system now has **two parallel implementations**:

1. **REST API** (HTTP) - For traditional polling
2. **WebSocket** - For real-time events

Both work simultaneously. You can:
- Keep existing REST code working
- Gradually migrate to WebSocket
- Use WebSocket for new features
- Fallback to REST if WebSocket connection drops

---

## Architecture Decision

### Real-Time (WebSocket) vs Polling (REST)

| Feature | Best Via | Why |
|---------|----------|-----|
| **Sending Invites** | WebSocket | Instant confirmation |
| **Receiving Invites** | WebSocket | Instant notification |
| **Invite Response** | WebSocket | Instant sender feedback |
| **Fallback/Checking** | REST API | When WS disconnected |
| **Status Checks** | REST API | Doesn't need real-time |

---

## Current Implementation

### REST Endpoints (Still Available)

```
POST   /invite/send           - Send invite via HTTP
GET    /invite/check/:playerId - Poll for invites
POST   /invite/respond        - Respond to invite via HTTP
DELETE /invite/cleanup        - Admin cleanup
```

### WebSocket Events (New)

```
emit   invite:send            - Send invite via WS
on     invite:received        - Listen for incoming
emit   invite:respond         - Respond via WS
on     invite:accepted/declined - Listen for responses
```

---

## Migration Path

### Phase 1: Add WebSocket (Current)
✅ WebSocket server running
✅ All event handlers implemented
✅ Database unchanged
✅ REST API untouched

### Phase 2: Implement in Unity
1. Connect to WebSocket on login
2. Listen for `invite:received` events
3. Use `invite:send` event to send
4. Use `invite:respond` event for responses

### Phase 3: Deprecate REST (Optional)
Once all clients updated, could remove HTTP routes.
For now: **Keep both** for backward compatibility

---

## Data Flow Comparison

### REST (Polling) - Old Way

```
Client (every 5 sec):
  GET /invite/check/playerId
  
Server:
  SELECT FROM invites WHERE receiver_id = playerId AND status = 'pending'
  
Client:
  Parse response, show new invites
  
Sender never knows if invite was seen
```

### WebSocket - New Way

```
Sender:
  socket.emit('invite:send', {receiver_id, session_code})
  
Server:
  INSERT invite
  Find receiver socket
  socket.to(receiver).emit('invite:received', {invite_id, ...})
  
Receiver (instant):
  socket.on('invite:received', (data) => ShowNotification(data))
  
Sender (instant):
  socket.on('invite:accepted', (data) => UpdateUI(data))
```

---

## Database Schema (No Changes Required!)

The database remains **exactly the same**:

```sql
CREATE TABLE invites (
  id INT PRIMARY KEY AUTO_INCREMENT,
  sender_id INT NOT NULL,
  receiver_id INT NOT NULL,
  session_code VARCHAR(50),
  status ENUM('pending', 'accepted', 'declined'),
  created_at TIMESTAMP,
  expires_at TIMESTAMP,
  FOREIGN KEY (sender_id) REFERENCES players(id),
  FOREIGN KEY (receiver_id) REFERENCES players(id)
);
```

Both REST and WebSocket read/write to the same table. ✅ They're compatible!

---

## Implementation Examples

### Scenario 1: REST to WebSocket Migration (Partial)

**Old Code (Still Works)**
```csharp
// Check for invites every 5 seconds
IEnumerator PollForInvites()
{
    while (true)
    {
        yield return new WaitForSeconds(5f);
        
        var request = new UnityWebRequest("http://10.252.7.171:7777/invite/check/" + playerId);
        request.SetRequestHeader("Authorization", "Bearer " + token);
        
        yield return request.SendWebRequest();
        
        var invites = ParseResponse(request);
        foreach (var invite in invites)
        {
            ShowInviteNotification(invite);
        }
    }
}
```

**New Code (Real-Time)**
```csharp
// Just listen - instant notifications!
socket.On("invite:received", (response) =>
{
    var data = response.GetValue();
    ShowInviteNotification(data);
    
    // Auto-acknowledge that we received it
    socket.Emit("invite:acknowledged", new { invite_id = data["invite_id"] });
});
```

### Scenario 2: Hybrid (Best Practice)

```csharp
public class GameInviteManager : MonoBehaviour
{
    private SocketIOUnity socket;
    private bool isWebSocketConnected = false;

    public void SendInvite(int receiverId, string sessionCode)
    {
        if (isWebSocketConnected)
        {
            // Prefer WebSocket - instant, no polling
            socket.Emit("invite:send", new { receiver_id = receiverId, session_code = sessionCode });
        }
        else
        {
            // Fallback to REST if WebSocket is down
            StartCoroutine(SendInviteViaRest(receiverId, sessionCode));
        }
    }

    private IEnumerator SendInviteViaRest(int receiverId, string sessionCode)
    {
        var request = new UnityWebRequest("http://10.252.7.171:7777/invite/send", "POST");
        request.SetRequestHeader("Authorization", "Bearer " + accessToken);
        request.uploadHandler = new UploadHandlerRaw(System.Text.Encoding.UTF8.GetBytes(
            JsonUtility.ToJson(new { receiver_id = receiverId, session_code = sessionCode })
        ));
        
        yield return request.SendWebRequest();
        // ... handle response
    }
}
```

---

## Event Flow: Complete Invite Journey

### Sending via WebSocket

```
1. Your client UI: User clicks "Invite Player2"
   ↓
2. Client: socket.emit('invite:send', {receiver_id: 2, session_code: 'ABC'})
   ↓
3. Server websocketService.handleInviteSend():
   - Validate session exists
   - Check receiver online
   - INSERT into invites table
   ↓
4. You: socket.on('invite:send:success', (data) => {})
   UI shows: "Invite sent to Player2"
   ↓
5. Server finds Player2's socket & broadcasts:
   Player2Socket.emit('invite:received', {invite_id: 999, sender_id: 1, ...})
   ↓
6. Player2 (instantly): socket.on('invite:received', (data) => {})
   UI shows: "Player1 invited you!" [popup]
   ↓
7. Player2 clicks "Accept"
   Client: socket.emit('invite:respond', {invite_id: 999, response: 'accept'})
   ↓
8. Server websocketService.handleInviteRespond():
   - UPDATE invites SET status = 'accepted'
   - Add player to session
   ↓
9. Player2: socket.on('invite:respond:success', (data) => {})
   Gets server_ip, server_port, session_code
   ↓
10. You (instantly): socket.on('invite:accepted', (data) => {})
    UI shows: "Player2 accepted your invite!"
```

### Fallback with REST

If WebSocket disconnects, client can still:
```csharp
// REST fallback - synchronous querying
POST /invite/send          // Send invite
GET /invite/check/playerId // Poll for invites every 5 sec
POST /invite/respond       // Respond to invite
```

---

## Testing the Implementation

### Manual Test: Send Invite via WebSocket

**Test Setup:**
1. Player1 logged in, connected to WebSocket
2. Player2 logged in, connected to WebSocket
3. Player1 in a game session

**Steps:**
```javascript
// Player1's browser console
socket.emit('invite:send', {
  receiver_id: 2,
  session_code: 'TEST123'
});

// Should see in Player1 console:
// ✅ invite:send:success

// Should see in Player2 console (instantly):
// 📨 invite:received
```

**Verify Database:**
```sql
SELECT * FROM invites WHERE sender_id = 1 AND receiver_id = 2;
-- Should show status = 'pending'
```

### Manual Test: Respond via WebSocket

```javascript
// Player2's browser console
socket.emit('invite:respond', {
  invite_id: 999,
  response: 'accept'
});

// Should see in Player2 console:
// ✅ invite:respond:success (with server_ip, server_port)

// Should see in Player1 console (instantly):
// 🎉 invite:accepted
```

**Verify Database:**
```sql
SELECT * FROM invites WHERE id = 999;
-- Should show status = 'accepted'
```

---

## Configuration & Tuning

### Invite Expiration
Currently: **120 seconds**

In `websocketService.js`:
```javascript
// Change to 60 seconds (expires faster)
DATE_ADD(NOW(), INTERVAL 60 SECOND)

// Or change to 180 seconds (expires slower)
DATE_ADD(NOW(), INTERVAL 180 SECOND)
```

### Heartbeat Frequency
Currently: **Every 5 seconds recommended**

In your client:
```csharp
private const float HEARTBEAT_INTERVAL = 5f; // Change to 3f for faster, 10f for slower
```

### Cleanup Interval
Currently: **Check every 10 seconds, timeout 30 seconds**

In `server.js`:
```javascript
// More aggressive: Check every 5s, timeout 15s
setInterval(() => cleanupDeadPlayers(15), 5 * 1000);

// Less aggressive: Check every 30s, timeout 60s
setInterval(() => cleanupDeadPlayers(60), 30 * 1000);
```

---

## Monitoring & Debugging

### Enable Debug Logging

**Server-side:**
```javascript
// In websocketService.js, already logged:
console.log(`🔌 Player ${playerId} connected via WebSocket`);
console.log(`📨 Invite send from ${senderId} to ${receiver_id}`);
```

**Client-side (Unity):**
```csharp
socket.OnError += (socket, e) => {
    Debug.LogError($"Socket error: {e}");
};

socket.On("error", (response) => {
    Debug.LogError($"Socket error event: {response}");
});
```

### Check Active Connections

**Server-side:**
```javascript
// In websocketService.js
console.log(activeConnections.size); // Number of connected players
console.log(getOnlinePlayerIds());   // List of online player IDs
```

### Test Connection Quality

```csharp
// Measure latency
socket.Emit("heartbeat", new { game_open = true });
var sendTime = Time.realtimeSinceStartup;

socket.On("heartbeat:ack", (response) => {
    var latency = (Time.realtimeSinceStartup - sendTime) * 1000;
    Debug.Log($"Latency: {latency}ms");
});
```

---

## Troubleshooting Guide

### Issue: Invites not appearing in real-time

**Check:**
1. Is receiver connected to WebSocket?
   ```csharp
   Debug.Log(socket.IsConnected); // Should be true
   ```

2. Is receiver online in database?
   ```sql
   SELECT is_online FROM players WHERE id = 2;
   -- Should be 1
   ```

3. Check server logs for errors
   ```
   🔌 Player 2 connected via WebSocket (socket_id)
   ```

### Issue: "Receiver not found" error

**Causes:**
- Receiver hasn't logged in (is_online = 0)
- Wrong receiver_id
- Receiver disconnected

**Fix:**
- Have receiver login and connect to WebSocket
- Log receiver_id value before sending

### Issue: Memory leak / connections never close

**Check:**
```csharp
socket.OnDisconnect += () => {
    // Make sure you clean up event listeners
    socket.Off("invite:received");
    socket.Off("invite:send:success");
};
```

---

## Performance Metrics

### WebSocket vs REST Comparison

| Metric | HTTP Polling | WebSocket |
|--------|--------------|-----------|
| Invite latency | 2.5-5 sec (polling) | <50ms (instant) |
| Bandwidth per invite | 2 KB | 0.5 KB |
| Server CPU | Higher (queries every 5s) | Lower (event-driven) |
| Player experience | Delay on notifications | Instant |

### Scalability

- **10 concurrent players**: Both approaches fine
- **100 concurrent players**: WebSocket significantly better
- **1000 concurrent players**: WebSocket required (polling would overload)

---

## Next Steps

1. ✅ Server WebSocket implemented
2. ⏭️ Install Socket.IO in Unity
3. ⏭️ Implement `GameInviteManager.cs` from WEBSOCKET_GUIDE.md
4. ⏭️ Test sending/receiving invites
5. ⏭️ Implement fallback REST calls
6. ⏭️ Monitor performance & latency

See `WEBSOCKET_GUIDE.md` for complete implementation details.
