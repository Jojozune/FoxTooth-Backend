# Heartbeat System - Quick Start

## What was added?

### New Files:
1. **`controllers/heartbeatController.js`** - All heartbeat logic
2. **`migrations/001_add_heartbeat_columns.sql`** - Database migration
3. **`HEARTBEAT_GUIDE.md`** - Full documentation

### New Routes:
- `POST /player/heartbeat` - Client sends "I'm alive"
- `GET /player/check-alive/:playerId` - Check if player is active
- `POST /player/check-alive-batch` - Check multiple players
- `POST /player/:playerId/force-offline` - Admin force offline

### New Database Columns:
- `last_heartbeat` - When player last sent heartbeat
- `game_open` - Is the game window active

---

## REQUIRED: Run Migration

Execute this SQL on your database BEFORE starting the server:

```sql
ALTER TABLE players ADD COLUMN last_heartbeat TIMESTAMP NULL DEFAULT NULL;
ALTER TABLE players ADD COLUMN game_open TINYINT(1) DEFAULT 0;

CREATE INDEX idx_last_heartbeat ON players(last_heartbeat);
CREATE INDEX idx_game_open ON players(game_open);
CREATE INDEX idx_is_online_heartbeat ON players(is_online, last_heartbeat);
```

---

## How to Use

### From Your Unity Client:
```csharp
// Every 5-10 seconds, send:
POST http://10.252.7.171:7777/player/heartbeat
Headers: Authorization: Bearer {token}
Body: { "game_open": true }
```

### Check if Friend is Active:
```csharp
GET http://10.252.7.171:7777/player/check-alive/42?timeout_seconds=30
Headers: Authorization: Bearer {token}
```

Response tells you if they're actively playing or just logged in.

### Check Multiple Friends:
```csharp
POST http://10.252.7.171:7777/player/check-alive-batch
Headers: Authorization: Bearer {token}
Body: { 
  "player_ids": [1, 2, 3, 4],
  "timeout_seconds": 30
}
```

---

## How It Works

1. **Client sends heartbeat** every 5-10 seconds → `last_heartbeat` timestamp updated
2. **Server runs cleanup** every 10 seconds
3. **Stale heartbeats detected** (no update for 30+ seconds) → Player marked offline
4. **Crash detection**: When game crashes, heartbeats stop → auto-detected as offline

---

## Configuration

You can adjust timeouts in `server.js`:

```javascript
// Shorter timeout = faster crash detection, more queries
// Longer timeout = fewer queries, slower detection
setInterval(() => cleanupDeadPlayers(15), 10 * 1000); // 15 second timeout
setInterval(() => cleanupDeadPlayers(60), 30 * 1000); // 60 second, check every 30s
```

---

## Performance Answer (Your Question)

**1 request/second per player will NOT kill your server.**

Reality check:
- 1 heartbeat/sec × 100 players = 100 req/sec (trivial)
- Node.js can handle 5,000+ req/sec easily
- Your database can easily handle this
- Rate limiting already protects you

You could have 1,000+ players checking invites every second without issues. The bottleneck would be database connections, not request handling.

**Recommendation:** 1 heartbeat every 5-10 seconds per player is efficient. Anything faster is wasting bandwidth.

---

## Files Modified:
- `server.js` - Added routes, imports, cleanup interval
- All changes are backwards compatible

---

## Next Steps:
1. Run the SQL migration on your database
2. Restart your server (it will auto-start the cleanup)
3. Implement heartbeat sending in your Unity client
4. Test with `/player/check-alive` endpoints
