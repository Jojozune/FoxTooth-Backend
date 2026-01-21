# WebSocket Event Flow Diagrams

## Complete Invite Journey

```
SCENARIO: Player1 sends invite to Player2, Player2 accepts

Timeline:

T0 ─ Player1 and Player2 both logged in and connected to WebSocket
     Player1: socket connected, playerId=1
     Player2: socket connected, playerId=2

T1 ─ Player1 is hosting a game session (session_code = "ABC123")
     Server tracking: activeConnections = {1: socket1, 2: socket2}

T2 ─ Player1 clicks "Invite Player2"
     Player1 Client:
     ┌─────────────────────────────────────────┐
     │ socket.emit('invite:send', {            │
     │   receiver_id: 2,                       │
     │   session_code: 'ABC123'                │
     │ })                                      │
     └─────────────────────────────────────────┘
                        │
                        ↓
     Server websocketService:
     ┌─────────────────────────────────────────────────┐
     │ handleInviteSend(socket, data) {               │
     │   1. Verify session exists and sender is host  │
     │   2. Check receiver is online                  │
     │   3. Check no existing pending invite          │
     │   4. INSERT INTO invites (...)                 │
     │   5. Find receiver socket in activeConnections │
     │   6. Get receiver socket                       │
     │ }                                              │
     └─────────────────────────────────────────────────┘

T3 ─ Confirmation back to Player1
     Server → Player1:
     ┌────────────────────────────────────────────┐
     │ socket.emit('invite:send:success', {       │
     │   invite_id: 999,                          │
     │   receiver_id: 2,                          │
     │   receiver_name: 'Player2#5678',           │
     │   expires_in: 120                          │
     │ })                                         │
     └────────────────────────────────────────────┘

T4 ─ Player2 gets INSTANT notification
     Server → Player2 (instant!):
     ┌────────────────────────────────────────────┐
     │ socket.emit('invite:received', {           │
     │   invite_id: 999,                          │
     │   sender_id: 1,                            │
     │   sender_name: '#1234',                    │
     │   session_code: 'ABC123',                  │
     │   server_ip: '192.168.1.100',              │
     │   server_port: 7778,                       │
     │   expires_in: 120                          │
     │ })                                         │
     └────────────────────────────────────────────┘
     
     Player2 sees: "Player1 invited you! [Accept] [Decline]"

T5 ─ Player2 acknowledges they saw the invite (optional)
     Player2 Client:
     ┌──────────────────────────────────┐
     │ socket.emit('invite:acknowledged',│
     │   {invite_id: 999}               │
     │ )                                │
     └──────────────────────────────────┘

T6 ─ Player2 clicks "Accept"
     Player2 Client:
     ┌──────────────────────────────────┐
     │ socket.emit('invite:respond', {  │
     │   invite_id: 999,                │
     │   response: 'accept'             │
     │ })                               │
     └──────────────────────────────────┘
                        │
                        ↓
     Server websocketService:
     ┌──────────────────────────────────────────────┐
     │ handleInviteRespond(socket, data) {         │
     │   1. Get invite details from database       │
     │   2. UPDATE invites SET status='accepted'   │
     │   3. Add player to session                  │
     │   4. Update player count on server          │
     │ }                                           │
     └──────────────────────────────────────────────┘

T7 ─ Player2 gets connection info
     Server → Player2:
     ┌────────────────────────────────────────────┐
     │ socket.emit('invite:respond:success', {    │
     │   status: 'accepted',                      │
     │   invite_id: 999,                          │
     │   server_ip: '192.168.1.100',              │
     │   server_port: 7778,                       │
     │   session_code: 'ABC123'                   │
     │ })                                         │
     └────────────────────────────────────────────┘
     
     Player2: Connects to game server

T8 ─ Player1 gets INSTANT notification
     Server → Player1:
     ┌────────────────────────────────────────────┐
     │ socket.emit('invite:accepted', {           │
     │   invite_id: 999,                          │
     │   receiver_id: 2,                          │
     │   message: 'Invite was accepted'           │
     │ })                                         │
     └────────────────────────────────────────────┘
     
     Player1 sees: "Player2 accepted your invite!"

Database updates:
┌─────────────────────────────────────────────┐
│ invites table:                              │
│ ┌─────┬────────┬────────┬──────────┐       │
│ │ id  │ sender │ recv   │ status   │       │
│ ├─────┼────────┼────────┼──────────┤       │
│ │ 999 │ 1      │ 2      │ accepted │       │
│ └─────┴────────┴────────┴──────────┘       │
│                                            │
│ game_sessions table:                       │
│ ┌──────────────────┬──────────┐           │
│ │ session_code     │ players  │           │
│ ├──────────────────┼──────────┤           │
│ │ ABC123           │ 2        │ (was 1)   │
│ └──────────────────┴──────────┘           │
│                                            │
│ game_servers table:                        │
│ ┌───────┬──────────────┐                  │
│ │ id    │ player_count │                  │
│ ├───────┼──────────────┤                  │
│ │ 7778  │ 2            │ (was 1)          │
│ └───────┴──────────────┘                  │
└─────────────────────────────────────────────┘

RESULT: Both players in session, both connected to game server
        Invite accepted, player counts updated
        Both got instant notifications
        NO POLLING required!
```

---

## Heartbeat Flow

```
SCENARIO: Player sending continuous heartbeats every 5 seconds

T0 ┐
   │  Client every 5 seconds:
   │  ┌──────────────────────────┐
   │  │ socket.emit('heartbeat', │
   │  │   {game_open: true}      │
   │  │ )                        │
   │  └──────────────────────────┘
   │
   ├─> Server updates database instantly:
   │   UPDATE players SET 
   │     last_heartbeat = NOW(),
   │     game_open = 1
   │   WHERE id = 1
   │
   └─> Client receives:
       ┌──────────────────────────┐
       │ socket.on('heartbeat:ack',│
       │   {status: 'success'}    │
       │ )                        │
       └──────────────────────────┘

T5 ┐
   │  [Same as T0]
   │
T10┐
   │  [Same as T0]
   │
   ...

CRASH SCENARIO:
─────────────────────────────────────────

T50 ─ Game crashes or player force-closes
      Player stops sending heartbeats
      (No error event, just silence)

T52 ─ WebSocket connection closed
      handlePlayerDisconnection():
      └─> activeConnections.delete(playerId)
      └─> Mark offline (after 2 second grace period)
      
T55 ─ Server cleanup runs (every 10 seconds)
      SELECT FROM players WHERE is_online=1
        AND last_heartbeat IS NULL OR 
        TIMESTAMPDIFF(SECOND, last_heartbeat, NOW()) > 30
      
      Player hasn't sent heartbeat for 5+ seconds
      UPDATE players SET is_online = 0

RESULT: Player marked offline within ~10 seconds of crash
        Other players see them offline instantly
```

---

## Comparison: Old vs New

```
OLD WAY (HTTP Polling)
═════════════════════════════════════════

Player A (wants to invite Player B):
   │
   └─> HTTP POST /invite/send
       └─> Database INSERT
       └─> Return 200 OK
           
Player B (checking for invites):
   T0:  HTTP GET /invite/check/B
        └─> Database SELECT
        └─> Return [] (no invites yet)
        └─> Wait 5 seconds...
   
   T5:  HTTP GET /invite/check/B
        └─> Database SELECT
        └─> Return [1 invite!]
        └─> DELAY: 5 seconds between send and receive!

Result: 5 second delay, lots of queries


NEW WAY (WebSocket)
═════════════════════════════════════════

Player A (wants to invite Player B):
   │
   └─> socket.emit('invite:send')
       └─> Database INSERT
       └─> socket.emit('invite:received') to Player B
           
Player B (listening for invites):
   IMMEDIATELY receives: socket.on('invite:received')
   └─> Popup appears instantly!
   └─> DELAY: <50ms!

Result: Instant notification, 1 event per invite
```

---

## Connection States

```
PLAYER LIFECYCLE
════════════════════════════════════════

1. NOT LOGGED IN
   is_online = 0
   last_heartbeat = NULL
   game_open = 0
   WebSocket: NOT connected
   
2. LOGGED IN (REST)
   is_online = 1
   last_heartbeat = NULL  (if REST heartbeat not sent)
   game_open = 0
   WebSocket: NOT connected
   
3. LOGGED IN + WEBSOCKET CONNECTED
   is_online = 1
   last_heartbeat = NOW()
   game_open = 1 (if game is open)
   WebSocket: CONNECTED
   Active in: activeConnections map
   
4. WEBSOCKET CONNECTED + SENDING HEARTBEAT
   is_online = 1
   last_heartbeat = NOW() (updated every 5s)
   game_open = 1 (updates every 5s)
   WebSocket: CONNECTED
   All events working
   
5. WEBSOCKET DISCONNECTED (intentional)
   is_online = 0 (after 2s grace)
   last_heartbeat = (old value)
   game_open = 0
   WebSocket: NOT connected
   Removed from: activeConnections map
   
6. WEBSOCKET CRASHED (no heartbeat)
   is_online = 1 → 0 (after 30s no heartbeat)
   last_heartbeat = (very old)
   game_open = 1 (stale value)
   WebSocket: NOT connected
   Cleanup marks offline


DETECTION TIMELINE
══════════════════════════════════════

Intentional Disconnect:
   T0: Player logs out
       socket.disconnect()
   └─> disconnect event fires
   └─> activeConnections.delete()
   └─> setTimeout(2s) to mark offline
   
   T2: Player marked offline
   
Crash/Unexpected Disconnect:
   T0: Game crashes
       (WebSocket closes)
   └─> disconnect event fires
   └─> activeConnections.delete()
   └─> setTimeout(2s) to mark offline
   
   T2: Player marked offline (tentatively)
   
   T10: Server cleanup runs
   │    Checks: is_online=1 AND
   │            (last_heartbeat IS NULL OR
   │             time since heartbeat > 30s)
   │    
   │    Confirms player should be offline
   │    
   └─> Mark definitely offline
   
Result: 10-12 seconds total to detect crash
```

---

## Concurrency: Multiple Players

```
4 PLAYERS, REAL-TIME INVITES
════════════════════════════════════════

activeConnections: {
  1: socket1,
  2: socket2,
  3: socket3,
  4: socket4
}

Scenario:
─────────

Player 1: socket1.emit('invite:send', {receiver: 2})
          ├─> INSERT invite into DB
          ├─> socket1.emit('invite:send:success')
          └─> socket2.emit('invite:received')  ← Instant to Player 2!

[Meanwhile]

Player 3: socket3.emit('invite:send', {receiver: 4})
          ├─> INSERT invite into DB  (different record)
          ├─> socket3.emit('invite:send:success')
          └─> socket4.emit('invite:received')  ← Instant to Player 4!

[Meanwhile]

Player 2: socket.on('invite:received', (data) => {
            // React to Player 1's invite
            console.log('Got invite from Player 1!');
            // This happens at SAME TIME as Player 1 sent it!
          })

All happening simultaneously:
✓ Player 1 → Player 2 invite (instant)
✓ Player 3 → Player 4 invite (instant)
✓ Each player gets independent event stream
✓ No interference, no queuing
✓ All within <50ms latency

Database consistency:
┌───┬────┬──────┬────────┐
│id │from│ to   │status  │
├───┼────┼──────┼────────┤
│1  │ 1  │ 2    │pending │
│2  │ 3  │ 4    │pending │
└───┴────┴──────┴────────┘
```

---

## Error Handling Flow

```
INVITE SEND ERROR SCENARIOS
═════════════════════════════════════════

Scenario 1: Receiver Not Found
───────────────────────────────
socket.emit('invite:send', {receiver_id: 999})
   │
   ├─> Check receiver online: SELECT ... WHERE id=999
   │   └─> 0 results
   │
   └─> socket.emit('invite:send:error', {
       status: 'error',
       message: 'Receiver not found or offline'
     })

Scenario 2: Session Not Exists
───────────────────────────────
socket.emit('invite:send', {session_code: 'INVALID'})
   │
   ├─> Check session exists: SELECT ... WHERE session_code='INVALID'
   │   └─> 0 results
   │
   └─> socket.emit('invite:send:error', {
       status: 'error',
       message: 'Session not found or access denied'
     })

Scenario 3: Already Have Pending Invite
────────────────────────────────────────
socket.emit('invite:send', {receiver_id: 2})
   │
   ├─> Check existing: SELECT ... WHERE sender=1 AND receiver=2 AND status='pending'
   │   └─> 1 result (already exists)
   │
   └─> socket.emit('invite:send:error', {
       status: 'error',
       message: 'Pending invite already exists'
     })

Scenario 4: Database Error
──────────────────────────
socket.emit('invite:send', {receiver_id: 2})
   │
   ├─> INSERT INTO invites (...)
   │   └─> MySQL error
   │
   └─> socket.emit('invite:send:error', {
       status: 'error',
       message: 'Failed to create invite'
     })
     └─> Server logs: ❌ error details


Client receives ANY error:
   │
   └─> socket.on('invite:send:error', (data) => {
         console.error(data.message);
         // Show error to user
         // Allow retry
       })
```

---

## Summary Table: What Happens When

| Event | Server Action | Client Receives | DB Updated | Time |
|-------|--------------|-----------------|------------|------|
| socket.emit('heartbeat') | Update last_heartbeat | heartbeat:ack | ✓ | <5ms |
| socket.emit('invite:send') | Create invite record | invite:send:success | ✓ | <10ms |
| [Receiver connected] | Find socket | invite:received | ✓ | <50ms |
| socket.emit('invite:respond', accept) | Update record, add to session | invite:respond:success | ✓ | <10ms |
| [Sender connected] | Find socket | invite:accepted | ✓ | <50ms |
| Disconnect (intentional) | Mark offline | (no event) | ✓ | 2s grace |
| Disconnect (crash) | No heartbeat > 30s | Cleanup runs | ✓ | 10-12s |

This is why WebSocket is SO much better than polling! ✨
