# Player Heartbeat System Documentation

## Overview
The heartbeat system allows your game to detect when players crash or disconnect unexpectedly. Instead of just relying on the logout endpoint, players send periodic "I'm alive" signals that the server tracks.

## How It Works

### Client Side (Unity)
The client should send a heartbeat signal periodically (recommended: every 5-10 seconds):

```csharp
// Call this from your game client every 5-10 seconds
POST /player/heartbeat
Authorization: Bearer {access_token}

Body:
{
  "game_open": true  // Set to false if the game window loses focus
}
```

### Server Side
1. **Heartbeat Reception**: Each heartbeat updates `last_heartbeat` timestamp
2. **Automatic Cleanup**: Every 10 seconds, the server checks for stale heartbeats
3. **Mark Offline**: Players without a heartbeat for 30+ seconds are marked offline automatically
4. **Crash Detection**: If a client crashes, it stops sending heartbeats → detected as offline

---

## API Endpoints

### 1. Send Heartbeat (Authenticated)
**POST** `/player/heartbeat`

Your game client calls this periodically to signal it's alive.

**Headers:**
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "game_open": true
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Heartbeat received",
  "timestamp": "2025-10-26T12:34:56.789Z"
}
```

**When to use:**
- Every 5-10 seconds while game is running
- Send `game_open: false` when player alt-tabs out
- Send `game_open: true` when they come back

---

### 2. Check if Player is Alive (Authenticated)
**GET** `/player/check-alive/{playerId}?timeout_seconds=30`

Check if a specific player is currently active (has recent heartbeat).

**Headers:**
```
Authorization: Bearer {access_token}
```

**Query Parameters:**
- `timeout_seconds` (optional): How many seconds without heartbeat = dead (default: 30)

**Response:**
```json
{
  "player_id": 5,
  "display_name": "PlayerName",
  "is_online": true,
  "game_open": true,
  "last_heartbeat": "2025-10-26T12:34:56Z",
  "seconds_since_heartbeat": 2,
  "is_alive": true,
  "timeout_seconds": 30
}
```

**Use cases:**
- Check if a friend is actually in their game
- Verify a party member is active before starting match
- Debug player status

---

### 3. Check Multiple Players (Authenticated)
**POST** `/player/check-alive-batch`

Efficient way to check heartbeat status of many players at once.

**Headers:**
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "player_ids": [1, 2, 3, 4, 5],
  "timeout_seconds": 30
}
```

**Response:**
```json
{
  "status": "success",
  "timeout_seconds": 30,
  "players": [
    {
      "player_id": 1,
      "display_name": "Player1",
      "is_online": true,
      "game_open": true,
      "last_heartbeat": "2025-10-26T12:34:56Z",
      "seconds_since_heartbeat": 2,
      "is_alive": true
    },
    {
      "player_id": 2,
      "display_name": "Player2",
      "is_online": true,
      "game_open": false,
      "last_heartbeat": "2025-10-26T12:33:00Z",
      "seconds_since_heartbeat": 86,
      "is_alive": false
    }
  ],
  "alive_count": 1,
  "total_checked": 2
}
```

**Use cases:**
- Check if all party members are actively playing
- Show friend list with "active" status
- Matchmaking: only pair with players who are alive

---

### 4. Force Player Offline (Admin Only)
**POST** `/player/{playerId}/force-offline`

Admin endpoint to manually mark a player offline if you detect a crash server-side.

**Headers:**
```
Authorization: Bearer {admin_token}
X-Admin-Token: {admin_token}
```

**Response:**
```json
{
  "status": "success",
  "message": "Player 5 marked as offline",
  "affected_rows": 1
}
```

---

## Database Changes Required

Run this SQL on your database:

```sql
-- Add to players table
ALTER TABLE players ADD COLUMN last_heartbeat TIMESTAMP NULL DEFAULT NULL;
ALTER TABLE players ADD COLUMN game_open TINYINT(1) DEFAULT 0;

-- Add indices for performance
CREATE INDEX idx_last_heartbeat ON players(last_heartbeat);
CREATE INDEX idx_game_open ON players(game_open);
CREATE INDEX idx_is_online_heartbeat ON players(is_online, last_heartbeat);
```

Or run the migration file:
```bash
mysql -u your_user -p your_database < migrations/001_add_heartbeat_columns.sql
```

---

## Server-Side Cleanup

The server automatically cleans up stale heartbeats every 10 seconds:

```javascript
setInterval(() => cleanupDeadPlayers(30), 10 * 1000);
// This marks players offline if last_heartbeat is older than 30 seconds
```

**Configuration:**
- Cleanup interval: 10 seconds
- Timeout threshold: 30 seconds

You can adjust these in `server.js`:
```javascript
// Make timeout shorter = faster detection, more queries
// Make timeout longer = fewer queries, slower crash detection
setInterval(() => cleanupDeadPlayers(20), 10 * 1000); // 20 second timeout
```

---

## Client Implementation Example (Unity C#)

```csharp
public class HeartbeatManager : MonoBehaviour
{
    private float heartbeatInterval = 5f; // Send every 5 seconds
    private float timeSinceLastHeartbeat = 0f;
    private string accessToken;

    private void Update()
    {
        timeSinceLastHeartbeat += Time.deltaTime;
        
        if (timeSinceLastHeartbeat >= heartbeatInterval)
        {
            SendHeartbeat();
            timeSinceLastHeartbeat = 0f;
        }
    }

    private async void SendHeartbeat()
    {
        bool gameOpen = Application.isFocused; // Or check if game window is active
        
        var heartbeatData = new { game_open = gameOpen };
        
        try
        {
            using (var request = new UnityWebRequest("http://10.252.7.171:7777/player/heartbeat", "POST"))
            {
                request.SetRequestHeader("Authorization", $"Bearer {accessToken}");
                request.SetRequestHeader("Content-Type", "application/json");
                
                string jsonBody = JsonUtility.ToJson(heartbeatData);
                request.uploadHandler = new UploadHandlerRaw(System.Text.Encoding.UTF8.GetBytes(jsonBody));
                request.downloadHandler = new DownloadHandlerBuffer();
                
                await request.SendWebRequest();
                
                if (request.result == UnityWebRequest.Result.Success)
                {
                    Debug.Log("Heartbeat sent successfully");
                }
                else
                {
                    Debug.LogError($"Heartbeat failed: {request.error}");
                }
            }
        }
        catch (System.Exception ex)
        {
            Debug.LogError($"Heartbeat exception: {ex.Message}");
        }
    }
}
```

---

## Performance Considerations

### Request Load
- **1 heartbeat per player per 5 seconds** = Very lightweight
- 100 concurrent players = 20 requests/second (trivial for Node.js)
- Database: Simple UPDATE query, minimal overhead

### Database Load
- Each heartbeat: 1 UPDATE query (~1-2ms)
- Cleanup: 1 UPDATE query every 10 seconds (~5-10ms)
- Indices ensure fast queries

### Scalability
- This can easily handle 10,000+ concurrent players
- Bottleneck is DB connections, not heartbeat logic itself

### Optimization Tips
1. **Use batch checking** (`/player/check-alive-batch`) when checking multiple players
2. **Adjust cleanup interval** based on your tolerance for stale data
3. **Cache heartbeat results** client-side when possible (5-10 second cache)
4. **Use WebSockets** if you need real-time updates (future enhancement)

---

## Troubleshooting

### Players showing as offline when they're online
- Check heartbeat interval is short enough (recommend 5-10 seconds)
- Verify timeout threshold is appropriate (30 seconds usually good)
- Check if access tokens are expiring prematurely

### High database load
- Reduce cleanup frequency (change from 10s to 30s)
- Increase timeout threshold (30s to 60s)
- Implement caching on client-side checks

### False positives (crashing players still show online)
- Decrease timeout threshold (30s to 15s)
- Increase cleanup frequency (10s to 5s)
- Note: This increases database load slightly

---

## Future Enhancements

1. **WebSocket Support**: Real-time heartbeats instead of polling
2. **Heartbeat Events**: WebSocket broadcasts when players come online/offline
3. **Geo-location Tracking**: Track player heartbeat location for anti-cheat
4. **Connection Quality**: Include latency/packet loss in heartbeat
