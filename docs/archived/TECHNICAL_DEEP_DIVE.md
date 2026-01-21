# Complete Technical Deep Dive: Code Architecture & Data Flow

**This guide explains how the system actually works by reading through the code in dependency order.**

---

## Part 1: Core Infrastructure (What Runs First)

### Step 1: Server Bootstrap (`server.js`, lines 1-30)

```javascript
const express = require('express');
const cors = require('cors');
const http = require('http');

const app = express();
const PORT = 7777;

app.use(cors());
app.use(express.json());
app.use(generalLimiter); // Every request goes through rate limiting
```

**What's happening:**
- Express app created
- CORS enabled (allows cross-origin requests from Unity)
- HTTP module imported (needed because Socket.IO needs raw HTTP server, not just Express)
- Rate limiter applied globally to EVERY route

**Why HTTP module?**
- Express by itself runs on TCP sockets through `app.listen()`
- Socket.IO needs direct access to the raw HTTP server to handle WebSocket upgrades
- So we create raw HTTP server: `const httpServer = http.createServer(app)`
- Then pass it to BOTH Express AND Socket.IO
- Same port (7777), both protocols running together

### Step 2: Database Connection (`config/database.js`)

```javascript
const mysql = require('mysql2');

const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'tidal_hunters',
  connectionLimit: 10
});
```

**What's happening:**
- Connection pool created (max 10 simultaneous connections)
- This is used by EVERY module that needs database access
- `db.execute(query, params, callback)` is the function everything calls

**Why a pool?**
- Each query doesn't create new connection (expensive)
- Reuses existing connections
- Max 10 means if 11 queries happen simultaneously, the 11th waits
- Prevents database from getting hammered

**How it's used everywhere:**
```javascript
db.execute('SELECT * FROM players WHERE id = ?', [playerId], (err, results) => {
  // err = connection error or query error
  // results = array of rows
});
```

### Step 3: Middleware Stack (`middleware/`)

These run on EVERY HTTP request in this order:

```javascript
app.use(cors());              // Allow cross-origin
app.use(express.json());      // Parse JSON body
app.use(generalLimiter);      // Rate limit
```

Then per-route:
```javascript
app.post('/invite/send', 
  authenticateToken,          // Check JWT token
  inviteController.sendInvite  // Run actual handler
);
```

**Authentication middleware** (`middleware/auth.js`):
```javascript
function authenticateToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) return res.status(401).json({error: 'No token'});
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.player = {
      playerId: decoded.playerId,
      playerTag: decoded.playerTag
    };
    next();  // Continue to actual route handler
  } catch (err) {
    res.status(401).json({error: 'Invalid token'});
  }
}
```

**What's happening:**
- Extract token from `Authorization: Bearer {token}` header
- Decode JWT using secret
- If valid: attach `req.player` (now controller knows who is calling)
- If invalid: stop immediately, return 401
- If valid: `next()` moves to actual handler

---

## Part 2: Authentication & Tokens

### How Login Works (`controllers/authController.js`)

```javascript
function login(req, res) {
  const { username, password } = req.body;
  
  // 1. Find user
  const query = `SELECT id, password_hash FROM players WHERE username = ?`;
  db.execute(query, [username], (err, results) => {
    if (results.length === 0) {
      return res.status(401).json({error: 'User not found'});
    }
    
    const user = results[0];
    
    // 2. Check password
    const passwordValid = bcrypt.compareSync(password, user.password_hash);
    if (!passwordValid) {
      return res.status(401).json({error: 'Wrong password'});
    }
    
    // 3. Generate tokens
    const accessToken = jwt.sign(
      { playerId: user.id, playerTag: user.player_tag },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );
    
    const refreshToken = jwt.sign(
      { playerId: user.id, type: 'refresh' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // 4. Save refresh token to database
    db.execute(
      `INSERT INTO refresh_tokens (player_id, token, expires_at) VALUES (?, ?, ?)`,
      [user.id, refreshToken, expiresAt]
    );
    
    // 5. Mark player online
    db.execute(`UPDATE players SET is_online = 1 WHERE id = ?`, [user.id]);
    
    // 6. Return tokens to client
    res.json({
      status: 'success',
      access_token: accessToken,
      refresh_token: refreshToken
    });
  });
}
```

**Token Flow Explained:**

```
CLIENT REQUEST
├─ Username: "player1"
└─ Password: "mypass123"

SERVER
├─ Query database for player
├─ Compare hashed password (bcrypt)
├─ Generate 2-hour access token
├─ Generate 7-day refresh token
├─ Store refresh token in DB (can be invalidated)
└─ Mark player online

CLIENT RECEIVES
├─ access_token (short lived, used for requests)
└─ refresh_token (long lived, stored in device storage)

FUTURE REQUEST
├─ Client sends: Authorization: Bearer {access_token}
├─ Middleware decodes token
├─ If expired: refresh token to get new access token
└─ If both expired: re-login required
```

**Why two tokens?**
- Access token: Short-lived, used for every request, riskier if compromised
- Refresh token: Long-lived, only used when access expires, safer (stored securely)
- If hacker gets access token: only 2 hours of damage
- If hacker gets refresh token: need to also get it from secure storage

### Token Refresh

```javascript
function refreshToken(req, res) {
  const { refresh_token } = req.body;
  
  // 1. Verify refresh token signature
  try {
    var decoded = jwt.verify(refresh_token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({error: 'Invalid refresh token'});
  }
  
  // 2. Check if refresh token still in database (wasn't revoked)
  const query = `SELECT * FROM refresh_tokens 
                 WHERE player_id = ? AND token = ? AND expires_at > NOW()`;
  db.execute(query, [decoded.playerId, refresh_token], (err, results) => {
    if (results.length === 0) {
      return res.status(401).json({error: 'Refresh token expired or revoked'});
    }
    
    // 3. Generate new access token
    const newAccessToken = jwt.sign(
      { playerId: decoded.playerId, playerTag: decoded.playerTag },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );
    
    res.json({ access_token: newAccessToken });
  });
}
```

**Why store refresh tokens in DB?**
- JWT is stateless (server doesn't remember it)
- But we want ability to logout (invalidate token)
- Solution: DB stores all valid refresh tokens
- When token refresh requested: check DB first
- If token in DB: it's valid, generate new access token
- If token not in DB: it was revoked (user logged out), reject

---

## Part 3: WebSocket Connection & Authentication

### Socket.IO Initialization (`server.js`, lines 135-140)

```javascript
const httpServer = http.createServer(app);
const io = initializeWebSocket(httpServer);
httpServer.listen(PORT, '0.0.0.0', () => {
  // Server started
});
```

**What's happening:**
- Raw HTTP server created
- Express app mounted on it
- Socket.IO initialized on same HTTP server
- When client connects, Express handles REST routes, Socket.IO handles WebSocket

### WebSocket Service (`services/websocketService.js`)

```javascript
function initializeWebSocket(httpServer) {
  const socketIO = require('socket.io')(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] }
  });
  
  // MIDDLEWARE: Every connection must be authenticated
  socketIO.use(authenticateSocket);
  
  // EVENT: New client connected
  socketIO.on('connection', (socket) => {
    handlePlayerConnection(socket);
  });
  
  return socketIO;
}
```

**WebSocket authentication middleware:**

```javascript
function authenticateSocket(socket, next) {
  const token = socket.handshake.auth.token;
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.playerId = decoded.playerId;
    socket.playerTag = decoded.playerTag;
    next();  // Allow connection
  } catch (err) {
    next(new Error('Authentication error'));  // Reject connection
  }
}
```

**What's happening:**
- Client connects with token in auth header
- Server verifies JWT signature
- If valid: attach playerId to socket object
- If invalid: reject connection immediately

### Connection Handler

```javascript
function handlePlayerConnection(socket) {
  const playerId = socket.playerId;
  
  // STORE THIS CONNECTION
  activeConnections.set(playerId, socket);
  
  // MARK ONLINE
  db.execute(`UPDATE players SET is_online = 1, last_heartbeat = NOW() WHERE id = ?`, [playerId]);
  
  // REGISTER EVENT LISTENERS
  socket.on('heartbeat', (data) => handleHeartbeat(socket, data));
  socket.on('invite:send', (data) => handleInviteSend(socket, data));
  socket.on('invite:respond', (data) => handleInviteRespond(socket, data));
  
  // WHEN THEY DISCONNECT
  socket.on('disconnect', () => {
    activeConnections.delete(playerId);
    // Mark offline after 2 second grace period (for reconnection)
    setTimeout(() => {
      if (!activeConnections.has(playerId)) {
        db.execute(`UPDATE players SET is_online = 0 WHERE id = ?`, [playerId]);
      }
    }, 2000);
  });
}
```

**Key concept: `activeConnections` Map**

```javascript
// This is the secret sauce of real-time
const activeConnections = new Map();
// Stores: playerId -> socket object

// When player connects:
activeConnections.set(1, socket1);  // {1: socket1}
activeConnections.set(2, socket2);  // {1: socket1, 2: socket2}

// To send to specific player:
const targetSocket = activeConnections.get(2);
targetSocket.emit('invite:received', {invite_id: 999});

// When player disconnects:
activeConnections.delete(2);  // {1: socket1}
```

**This is how real-time works:**
- When invite sent to Player 2: find Player 2's socket in map
- Send event directly to that socket
- Event appears on Player 2's screen instantly
- NO DATABASE POLLING NEEDED

---

## Part 4: HTTP Routes (REST API)

### Route Registration (`server.js`)

```javascript
// PUBLIC (no auth needed)
app.post('/account/login', validateLogin, authController.login);
app.get('/players', playerController.getPlayers);

// PROTECTED (must be authenticated)
app.post('/invite/send', 
  authenticateToken,              // Middleware: verify token
  inviteController.sendInvite     // Handler
);

// ADMIN ONLY
app.post('/server/register', 
  authenticateAdmin,              // Check is_admin=1 in DB
  serverController.registerServer
);
```

**Execution order for `POST /invite/send`:**

```
1. Request arrives
2. Express matches route
3. authenticateToken middleware runs
   ├─ Extract token from header
   ├─ Decode JWT
   ├─ Attach req.player
   └─ Call next()
4. inviteController.sendInvite runs
   ├─ Access req.player.playerId (from middleware)
   ├─ Access req.body (from express.json)
   └─ Make database calls
5. Send response
```

### Example: REST Invite Send (`controllers/inviteController.js`)

```javascript
function sendInvite(req, res) {
  const sender_id = req.player.playerId;  // From auth middleware
  const { receiver_id, session_code } = req.body;
  
  // 1. VALIDATE INPUT
  if (!receiver_id || !session_code) {
    return res.status(400).json({error: 'Missing fields'});
  }
  
  // 2. CHECK SESSION EXISTS & SENDER IS HOST
  const sessionQuery = `
    SELECT gs.*, gsrv.ip_address, gsrv.port 
    FROM game_sessions gs
    JOIN game_servers gsrv ON gs.server_id = gsrv.id
    WHERE gs.session_code = ? AND gs.host_player_id = ?
  `;
  
  db.execute(sessionQuery, [session_code, sender_id], (err, results) => {
    if (results.length === 0) {
      return res.status(404).json({error: 'Session not found'});
    }
    
    const session = results[0];
    
    // 3. CHECK RECEIVER IS ONLINE
    const receiverQuery = `SELECT id FROM players WHERE id = ? AND is_online = 1`;
    db.execute(receiverQuery, [receiver_id], (err, results2) => {
      if (results2.length === 0) {
        return res.status(404).json({error: 'Receiver offline'});
      }
      
      // 4. CHECK NO EXISTING PENDING INVITE
      const existingQuery = `
        SELECT id FROM invites 
        WHERE sender_id = ? AND receiver_id = ? AND status = 'pending' 
        AND expires_at > NOW()
      `;
      db.execute(existingQuery, [sender_id, receiver_id], (err, results3) => {
        if (results3.length > 0) {
          return res.status(409).json({error: 'Already invited'});
        }
        
        // 5. CREATE INVITE
        const createQuery = `
          INSERT INTO invites (sender_id, receiver_id, session_code, status, created_at, expires_at)
          VALUES (?, ?, ?, 'pending', NOW(), DATE_ADD(NOW(), INTERVAL 120 SECOND))
        `;
        
        db.execute(createQuery, [sender_id, receiver_id, session_code], (err, result) => {
          res.json({
            status: 'success',
            invite_id: result.insertId
          });
        });
      });
    });
  });
}
```

**Callback Hell Warning:** Notice the nested callbacks? This is why async/await was invented. But this code works.

**Execution flow:**
```
sendInvite called
├─ Query 1: Get session
│  └─ Callback 1:
│     ├─ Query 2: Get receiver
│     └─ Callback 2:
│        ├─ Query 3: Check existing
│        └─ Callback 3:
│           ├─ Query 4: Insert invite
│           └─ Callback 4: Send response
└─ (REST returns immediately, database calls happen async)
```

---

## Part 5: WebSocket Events (Real-Time)

### WebSocket Invite Send

```javascript
function handleInviteSend(socket, data) {
  const senderId = socket.playerId;  // From auth middleware
  const { receiver_id, session_code } = data;
  
  // 1. SAME VALIDATION AS REST VERSION
  const sessionQuery = `SELECT ... FROM game_sessions WHERE session_code = ? AND host_player_id = ?`;
  
  db.execute(sessionQuery, [session_code, senderId], (err, sessionResults) => {
    if (sessionResults.length === 0) {
      return socket.emit('invite:send:error', {message: 'Session not found'});
    }
    
    // 2. CREATE INVITE
    const inviteQuery = `INSERT INTO invites (...)`;
    db.execute(inviteQuery, [...], (err, inviteResults) => {
      const inviteId = inviteResults.insertId;
      
      // 3. CONFIRM TO SENDER
      socket.emit('invite:send:success', {invite_id: inviteId});
      
      // 4. NOTIFY RECEIVER IN REAL-TIME
      const receiverSocket = activeConnections.get(receiver_id);
      if (receiverSocket) {
        receiverSocket.emit('invite:received', {
          invite_id: inviteId,
          sender_id: senderId,
          session_code: session_code
        });
      }
    });
  });
}
```

**Key difference from REST:**
```
REST INVITE:
  Client sends → Server creates → Server returns response
  Receiver must poll to find out

WEBSOCKET INVITE:
  Client sends → Server creates → Server sends to Receiver immediately
  Both get events, no polling needed
```

**Finding the receiver:**
```javascript
// This is the magic of real-time
const receiverSocket = activeConnections.get(receiver_id);
if (receiverSocket) {
  // Receiver is connected right now, send event directly
  receiverSocket.emit('invite:received', {...});
}
// If not connected, invite is still in database
// When they login later, they see it via REST API or next WS connection
```

### Heartbeat Handler

```javascript
function handleHeartbeat(socket, data) {
  const playerId = socket.playerId;
  const { game_open } = data;
  
  // Update database with heartbeat timestamp
  const query = `
    UPDATE players 
    SET last_heartbeat = NOW(), game_open = ?
    WHERE id = ?
  `;
  
  db.execute(query, [game_open ? 1 : 0, playerId], (err) => {
    // Send acknowledgment back
    socket.emit('heartbeat:ack', {
      status: 'success',
      timestamp: new Date().toISOString()
    });
  });
}
```

**Client sends this every 5 seconds:**
```
T0:  socket.emit('heartbeat', {game_open: true})
     └─> Server updates last_heartbeat = NOW()

T5:  socket.emit('heartbeat', {game_open: true})
     └─> Server updates last_heartbeat = NOW()

T10: socket.emit('heartbeat', {game_open: true})
     └─> Server updates last_heartbeat = NOW()

If crash between T10-T15:
     No heartbeat sent, so last_heartbeat stays at T10
     After 30 seconds without heartbeat:
     └─> Server cleanup marks player offline
```

---

## Part 6: Player Status & Cleanup

### Automatic Offline Detection

```javascript
// In server.js, runs every 10 seconds
setInterval(() => cleanupDeadPlayers(30), 10 * 1000);

function cleanupDeadPlayers(timeoutSeconds) {
  const query = `
    UPDATE players 
    SET is_online = 0
    WHERE is_online = 1 
    AND (last_heartbeat IS NULL OR TIMESTAMPDIFF(SECOND, last_heartbeat, NOW()) > ?)
  `;
  
  db.execute(query, [timeoutSeconds], (err, results) => {
    if (results.affectedRows > 0) {
      console.log(`Marked ${results.affectedRows} players offline`);
    }
  });
}
```

**What's happening:**
```
Every 10 seconds:
├─ Find all players where is_online=1
└─ But last_heartbeat is NULL or older than 30 seconds
   └─ Mark those players offline

Example:
├─ Player 1: last_heartbeat = 2 seconds ago → STAYS online
├─ Player 2: last_heartbeat = 35 seconds ago → MARKED offline
├─ Player 3: no heartbeat ever sent → MARKED offline
└─ Player 4: disconnected 2 seconds ago (grace period) → stays online (for now)
```

### Check If Player Is Alive (REST API)

```javascript
function checkPlayerAlive(req, res) {
  const { playerId } = req.params;
  const timeoutSeconds = parseInt(req.query.timeout_seconds) || 30;
  
  const query = `
    SELECT id, is_online, game_open, last_heartbeat,
           TIMESTAMPDIFF(SECOND, last_heartbeat, NOW()) as seconds_since_heartbeat
    FROM players
    WHERE id = ?
  `;
  
  db.execute(query, [playerId], (err, results) => {
    const player = results[0];
    
    // Calculate if player is "alive"
    const isAlive = player.game_open === 1 && 
                    player.seconds_since_heartbeat <= timeoutSeconds;
    
    res.json({
      is_alive: isAlive,
      is_online: player.is_online === 1,
      game_open: player.game_open === 1,
      last_heartbeat: player.last_heartbeat,
      seconds_since_heartbeat: player.seconds_since_heartbeat
    });
  });
}
```

**This API answers: "Is this player actively playing right now?"**

```
is_online = 1         → Logged in
game_open = 1         → Game window is open/focused
seconds_since = 2     → Sent heartbeat 2 seconds ago

is_alive = true       → YES, they're actively playing

Example scenarios:
├─ is_online=1, game_open=0, seconds_since=5 → is_alive=false (alt-tabbed)
├─ is_online=1, game_open=1, seconds_since=35 → is_alive=false (game crashed)
├─ is_online=1, game_open=1, seconds_since=3 → is_alive=true (actively playing)
└─ is_online=0, ... → is_alive=false (logged out)
```

---

## Part 7: Rate Limiting

### How Rate Limiting Works (`middleware/rateLimit.js`)

```javascript
const rateLimit = require('express-rate-limit');

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                   // Max 100 requests per IP
  message: 'Too many requests, try again later'
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,                     // Max 5 login attempts per 15 min
  skipSuccessfulRequests: true  // Failed attempts count, successful don't
});
```

**Applied to routes:**

```javascript
app.post('/account/login', loginLimiter, authController.login);
//         ^^^^^^^^^^^^^^  This middleware runs first
```

**What happens:**
```
Request comes in
├─ Check: Has IP made login attempts in last 15 minutes?
├─ Count is at 4
└─ Allow request (max is 5)

Next attempt:
├─ Count is at 5
└─ Allow request (at limit now)

Next attempt:
├─ Count is at 6
└─ REJECT: "Too many requests"
└─ Retry allowed after 15 minutes expire
```

**Why?**
- Prevents brute force login attacks
- Prevents DoS (denial of service)
- `generalLimiter` on ALL routes prevents any endpoint being hammered

---

## Part 8: Data Flow Examples

### Complete Flow: User Logs In & Gets Invite

```
STEP 1: CLIENT LOGIN
════════════════════════════════════════════════

Client sends:
POST /account/login
{
  username: "player1",
  password: "mypass123"
}

Server (middleware):
├─ loginLimiter checks: allowed? (max 5 per 15 min)
├─ express.json parses body
└─ Call authController.login

Server (controller):
├─ Query DB: SELECT * FROM players WHERE username = 'player1'
├─ bcrypt.compareSync(password, hash)
├─ If match: generate tokens
│  ├─ ACCESS_TOKEN (2 hour expiry)
│  ├─ REFRESH_TOKEN (7 day expiry)
│  └─ INSERT refresh token into DB
├─ UPDATE players SET is_online = 1 WHERE id = 1
└─ Return tokens

Client receives:
{
  access_token: "eyJhbGciOiJIUzI1NiIsInR5cCI...",
  refresh_token: "eyJhbGciOiJIUzI1NiIsInR5cCI..."
}

Client stores:
├─ access_token in RAM (used for requests)
└─ refresh_token in persistent storage (used for next login)


STEP 2: CLIENT CONNECTS WEBSOCKET
════════════════════════════════════════════════

Client:
io('http://10.252.7.171:7777', {
  auth: { token: 'access_token...' }
})

Server (websocketService.js):
├─ authenticateSocket middleware
│  ├─ Extract token from auth
│  ├─ jwt.verify(token, secret)
│  ├─ Attach socket.playerId = 1
│  └─ Allow connection
└─ handlePlayerConnection
   ├─ activeConnections.set(1, socket)
   ├─ UPDATE players SET is_online=1, last_heartbeat=NOW() WHERE id=1
   ├─ Register event handlers on socket
   └─ Listen for: heartbeat, invite:send, invite:respond

Client now connected, ready for real-time events


STEP 3: HEARTBEAT
════════════════════════════════════════════════

Client (every 5 seconds):
socket.emit('heartbeat', {game_open: true})

Server:
├─ Receives in handleHeartbeat
├─ UPDATE players SET last_heartbeat=NOW(), game_open=1 WHERE id=1
└─ socket.emit('heartbeat:ack', {status: 'success'})


STEP 4: CLIENT RECEIVES INVITE
════════════════════════════════════════════════

Other player sends:
socket.emit('invite:send', {receiver_id: 1, session_code: 'ABC123'})

Server (in handleInviteSend):
├─ Validate session exists, receiver online
├─ INSERT INTO invites (sender_id, receiver_id, session_code, status, expires_at)
├─ socket.emit('invite:send:success') to sender
└─ const receiverSocket = activeConnections.get(1)
   └─ IF receiverSocket EXISTS:
      └─ receiverSocket.emit('invite:received', {invite_id: 999, ...})

Client receives (INSTANTLY):
socket.on('invite:received', (data) => {
  // Show popup: "Player X invited you!"
})


STEP 5: CLIENT RESPONDS
════════════════════════════════════════════════

Client:
socket.emit('invite:respond', {invite_id: 999, response: 'accept'})

Server (in handleInviteRespond):
├─ UPDATE invites SET status='accepted' WHERE id=999
├─ UPDATE game_sessions SET current_players++ WHERE session_code='ABC123'
├─ UPDATE game_servers SET current_player_count++ WHERE id=...
├─ socket.emit('invite:respond:success') to responder
│  └─ Client receives: {server_ip, server_port, session_code}
└─ Find sender socket in activeConnections
   └─ IF senderSocket EXISTS:
      └─ senderSocket.emit('invite:accepted', {receiver_id: 1})

Both clients updated, both know response immediately
```

---

## Part 9: Request Lifecycle (How One Request Works)

### Trace: POST /invite/send (REST)

```javascript
// CLIENT
POST http://10.252.7.171:7777/invite/send
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI...
Content-Type: application/json

{
  receiver_id: 2,
  session_code: "ABC123"
}

// SERVER
├─ ROUTING LAYER (server.js line ~75)
│  ├─ Express matches route: /invite/send
│  └─ Executes handlers in order: [authenticateToken, inviteController.sendInvite]
│
├─ MIDDLEWARE #1: authenticateToken (middleware/auth.js)
│  ├─ Extract: token = "eyJhbGciOiJIUzI1NiIsInR5cCI..."
│  ├─ Verify: jwt.verify(token, JWT_SECRET)
│  │  └─ JWT signature matches? YES
│  │  └─ Token expired? NO
│  │  └─ Token.type = "access"? YES
│  ├─ Decode payload:
│  │  {
│  │    playerId: 1,
│  │    playerTag: "#1234",
│  │    exp: 1729894800,
│  │    iat: 1729880400
│  │  }
│  ├─ Attach to request: req.player = {playerId: 1, playerTag: "#1234"}
│  └─ Call: next()
│
├─ HANDLER: inviteController.sendInvite (controllers/inviteController.js)
│  ├─ Extract variables:
│  │  sender_id = req.player.playerId = 1
│  │  receiver_id = req.body.receiver_id = 2
│  │  session_code = req.body.session_code = "ABC123"
│  │
│  ├─ QUERY #1: SELECT game_sessions WHERE session_code='ABC123' AND host_player_id=1
│  │  └─ Database.execute(query, [sessionCode, sender_id], callback1)
│  │  └─ Non-blocking! Returns immediately
│  │  └─ Callback will run when database responds
│  │
│  └─ RETURN FROM sendInvite
│     (Note: we haven't sent response yet, that happens in callback)
│
├─ [WAITING FOR DATABASE]
│  └─ Event loop handles other requests while waiting
│
├─ DATABASE RESPONDS: callback1 executes
│  ├─ results = [{id: 5, host_player_id: 1, server_id: 10, ...}]
│  ├─ session = results[0]
│  │
│  ├─ QUERY #2: SELECT players WHERE id=2 AND is_online=1
│  │  └─ db.execute(query, [receiver_id], callback2)
│  │
│  └─ RETURN FROM callback1
│
├─ DATABASE RESPONDS: callback2 executes
│  ├─ results = [{id: 2, display_name: "player2", ...}]
│  │
│  ├─ QUERY #3: SELECT invites WHERE sender_id=1 AND receiver_id=2 AND status='pending'
│  │  └─ db.execute(query, [sender_id, receiver_id], callback3)
│  │
│  └─ RETURN FROM callback2
│
├─ DATABASE RESPONDS: callback3 executes
│  ├─ results = [] (no existing invite)
│  │
│  ├─ QUERY #4: INSERT INTO invites (sender_id, receiver_id, session_code, ...)
│  │  └─ db.execute(query, [sender_id, receiver_id, session_code], callback4)
│  │
│  └─ RETURN FROM callback3
│
├─ DATABASE RESPONDS: callback4 executes
│  ├─ insertId = 999 (new invite ID)
│  │
│  ├─ SEND RESPONSE TO CLIENT
│  │  res.json({
│  │    status: 'success',
│  │    invite_id: 999
│  │  })
│  │
│  └─ RETURN FROM callback4
│
└─ RESPONSE SENT
   HTTP 200 OK
   {
     "status": "success",
     "invite_id": 999
   }

// CLIENT RECEIVES
{
  status: "success",
  invite_id: 999
}

TOTAL TIME: ~100-200ms (depending on database)
```

---

## Part 10: Memory & Data Structures

### activeConnections Map

```javascript
// This stores every connected player's socket
const activeConnections = new Map();

// When Player 1 connects:
activeConnections.set(1, socket_1_object);

// When Player 2 connects:
activeConnections.set(2, socket_2_object);

// Current state:
activeConnections = {
  1: socket_1_object,
  2: socket_2_object
}

// To send event to Player 2:
const socket = activeConnections.get(2);
socket.emit('invite:received', {invite_id: 999});

// When Player 1 disconnects:
activeConnections.delete(1);

// Current state:
activeConnections = {
  2: socket_2_object
}

// Memory usage: ~1KB per connection
// 1000 players = ~1MB of memory just for this map
```

### JWT Token Structure

```javascript
// What gets encoded:
{
  playerId: 1,
  playerTag: "#1234",
  exp: 1729894800,  // Expiration timestamp
  iat: 1729880400   // Issued at timestamp
}

// Server signs with secret:
jwt.sign(payload, "my_secret_key_12345", {expiresIn: '2h'})

// Result (example):
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.
eyJwbGF5ZXJJZCI6MSwiZXhwIjoxNzI5ODk0ODAwfQ.
_hash_of_payload_and_signature_

// Client sends back:
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

// Server verifies:
jwt.verify(token, "my_secret_key_12345")
// If signature matches and not expired: decoded = {playerId: 1, ...}
// If signature doesn't match: throw error
// If expired: throw error
```

### Database Connection Pool

```javascript
const pool = mysql.createPool({
  connectionLimit: 10
});

// When queries happen:
Query 1 → Uses connection 1
Query 2 → Uses connection 2
Query 3 → Uses connection 3
...
Query 10 → Uses connection 10
Query 11 → WAITS for one of the above to finish

// When Query 1 finishes:
Query 11 → Uses connection 1 (now available)

// Benefits:
├─ Don't create new connection each query (expensive)
├─ Reuse existing connections
├─ Max 10 means won't overload database
└─ If all 10 busy, query waits (graceful degradation)
```

---

## Part 11: Error Handling Patterns

### Callback Error Pattern

```javascript
db.execute(query, params, (err, results) => {
  // THREE possible outcomes:

  // 1. DATABASE ERROR (network, syntax, etc)
  if (err) {
    console.error('Database error:', err);
    return res.status(500).json({status: 'error', message: 'Database error'});
  }

  // 2. QUERY SUCCESSFUL BUT NO RESULTS
  if (results.length === 0) {
    return res.status(404).json({status: 'error', message: 'Not found'});
  }

  // 3. SUCCESS
  const data = results[0];
  res.json({status: 'success', data: data});
});
```

**Early returns prevent nested callbacks:**
```javascript
// BAD (nested hell)
if (!err) {
  if (results.length > 0) {
    // finally do something
  }
}

// GOOD (early returns)
if (err) return res.status(500).json(...);
if (results.length === 0) return res.status(404).json(...);
// now do something
```

---

## Part 12: Key Files & Their Purposes

| File | Purpose | Key Functions |
|------|---------|---|
| `server.js` | Entry point, route registration | Sets up Express, WebSocket, cleanup intervals |
| `config/database.js` | Database connection pool | Exports `db` object used everywhere |
| `middleware/auth.js` | JWT verification for HTTP | Attaches `req.player` |
| `services/websocketService.js` | WebSocket handler | Manages connections, events, broadcasts |
| `controllers/authController.js` | Login/logout logic | JWT generation, token refresh |
| `controllers/inviteController.js` | REST invite endpoints | HTTP versions of invite operations |
| `controllers/heartbeatController.js` | Heartbeat logic | HTTP heartbeats, alive checks |
| `controllers/playerController.js` | Player queries | Get players list, lookup |
| `middleware/rateLimit.js` | Rate limiting | Prevents abuse |

---

## Part 13: Debugging Guide

### Enable Logging

Most handlers have console.log:
```javascript
console.log(`🔌 Player ${playerId} connected via WebSocket`);
console.log(`📨 Invite send from ${senderId} to ${receiver_id}`);
console.log(`✅ Invite created (ID: ${inviteId})`);
console.log(`❌ Heartbeat update error for player ${playerId}:`, err);
```

**Where to add more:**
```javascript
function myHandler(socket, data) {
  console.log('INPUT:', data);  // What did client send?
  
  db.execute(query, params, (err, results) => {
    console.log('QUERY RESULT:', results);  // What did DB return?
    
    if (results.length > 0) {
      console.log('FOUND:', results[0]);  // What did we find?
    }
  });
}
```

### Check Database State

```sql
-- See all players and their status
SELECT id, display_name, is_online, game_open, last_heartbeat FROM players;

-- See pending invites
SELECT i.*, p.display_name FROM invites i 
JOIN players p ON i.sender_id = p.id 
WHERE i.status = 'pending' AND i.expires_at > NOW();

-- See game sessions
SELECT * FROM game_sessions WHERE current_players > 0;

-- See who's connected
-- (No column for this, check activeConnections in memory)
```

### Check Server Logs

```bash
npm run dev

# Look for:
🎮 Game Invite Backend running on http://localhost:7777
🔌 WebSocket (Real-time Events): Enabled
🔌 Player 1 connected via WebSocket
📨 Invite send from 1 to 2
✅ Invite created (ID: 999)
📨 Invite received notification sent to player 2
```

---

## Summary: How It All Fits Together

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (Unity)                          │
├─────────────────────────────────────────────────────────────────┤
│  HTTP requests (login, check invites)                           │
│  WebSocket connection (heartbeat, real-time events)            │
└─────────────────────────────────────────┬───────────────────────┘
                                          │
                    ┌─────────────────────┴─────────────────────┐
                    │                                           │
         ┌──────────▼───────────────────────────────────────────┐
         │            EXPRESSJS + SOCKET.IO SERVER             │
         ├──────────────────────────────────────────────────────┤
         │ PORT 7777 (HTTP + WebSocket on same port)           │
         │                                                       │
         │  Express routes:                                     │
         │  ├─ POST /account/login → authController           │
         │  ├─ POST /invite/send → inviteController (REST)    │
         │  └─ etc...                                           │
         │                                                       │
         │  WebSocket events:                                   │
         │  ├─ invite:send → handleInviteSend (real-time)     │
         │  ├─ heartbeat → handleHeartbeat (real-time)        │
         │  └─ etc...                                           │
         │                                                       │
         │  activeConnections Map:                              │
         │  └─ {1: socket_1, 2: socket_2, 3: socket_3}        │
         └──────────────────────────────────────────────────────┘
                    │
         ┌──────────▼───────────────────────────────────────────┐
         │          MYSQL DATABASE (config/database.js)        │
         ├──────────────────────────────────────────────────────┤
         │                                                       │
         │  Tables:                                             │
         │  ├─ players (id, username, is_online, last_heartbeat)
         │  ├─ invites (id, sender_id, receiver_id, status)   │
         │  ├─ game_sessions (session_code, host_player_id)  │
         │  ├─ game_servers (ip_address, port, player_count) │
         │  └─ refresh_tokens (player_id, token, expires_at)  │
         │                                                       │
         │  Connection Pool: 10 max concurrent connections     │
         └──────────────────────────────────────────────────────┘
```

**Data flows:**
1. Client sends HTTP request or WebSocket event
2. Server middleware authenticates with JWT
3. Handler validates input
4. Handler queries database
5. Handler sends response via HTTP or WebSocket event
6. Client receives, updates UI

**Cleanup runs continuously:**
- Every 10 seconds: mark offline players with stale heartbeats
- Every 5 minutes: clean up dead game servers
- Every 1 hour: clean up expired tokens

This is a **real-time game backend**: HTTP for critical operations (login), WebSocket for real-time events (invites, heartbeat).

Done. Now you can read the code and understand it. 🔍
