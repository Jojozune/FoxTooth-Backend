# Code Reading Guide: The Complete Story

**Read through your actual code files in this exact order. This guide tells you what to look for in each file.**

---

## CHAPTER 1: Entry Point & Server Setup

### File: `server.js`

**Start here. This is your book's prologue - everything else happens because of this.**

**Read lines 1-30:**
```javascript
const express = require('express');
const cors = require('cors');
const http = require('http');

// All the controller/service imports
// Look at this list - these are the "characters" in your story

const app = express();
const PORT = 7777;

app.use(cors());
app.use(express.json());
app.use(generalLimiter);
```

**What to notice:**
- Line 1-3: Three libraries. Why http? See TECHNICAL_DEEP_DIVE Part 1.
- Line 5-11: All the imports. Each one is a chapter you'll read later.
- Line 22-24: More imports. `tokenService`, `cleanupDeadServers`, `cleanupDeadPlayers` run constantly.

**Read lines 32-65 (PUBLIC ROUTES):**
These are the first things clients can access without logging in.
- Line 33-35: Account creation/login - they happen here first
- Line 37-39: Player connection endpoints
- Line 41-43: Player lookup (no auth needed)

**Key concept:** Routes are just pointers. `app.post('/invite/send')` means:
1. Run `authenticateToken` middleware first
2. If that passes, run `inviteController.sendInvite`
3. The controller does the actual work

**Read lines 125-135 (Server startup):**
```javascript
const httpServer = http.createServer(app);
const io = initializeWebSocket(httpServer);
httpServer.listen(PORT, '0.0.0.0', () => {
```

**What's happening:**
- Create HTTP server that Express sits on
- Initialize WebSocket on same server
- When someone connects: Express handles REST, Socket.IO handles WebSocket
- Both on port 7777

**Read lines 145-155 (Cleanup intervals):**
These are jobs that run on timers:
```javascript
setInterval(tokenService.cleanupExpiredRefreshTokens, 60 * 60 * 1000);  // 1 hour
setInterval(cleanupDeadServers, 5 * 60 * 1000);                          // 5 min
setInterval(() => cleanupDeadPlayers(30), 10 * 1000);                   // 10 sec
```

**Question to answer for yourself:** "What does each cleanup job do?"
- Token cleanup: Remove expired refresh tokens from database
- Server cleanup: Remove dead game servers
- Player cleanup: Mark players offline if no heartbeat for 30 seconds

---

## CHAPTER 2: Authentication Foundation

### File: `middleware/auth.js`

**Before anything happens, players must prove who they are. This is how.**

**Read the entire file (should be small):**

This middleware runs on EVERY protected route. Look for:

```javascript
function authenticateToken(req, res, next) {
```

**Step by step:**
1. Extract token from header: `req.headers.authorization`
2. Parse it: `split(' ')[1]` (gets the part after "Bearer ")
3. Verify it: `jwt.verify(token, JWT_SECRET)`
4. If valid: attach to request: `req.player = decoded`
5. If invalid: return 401 immediately

**Question to answer:** "What happens if I send a request with no Authorization header?"
- Line with `if (!token)` - you get rejected with 401

**Question to answer:** "What happens if the token is expired?"
- `jwt.verify()` throws error, caught in try/catch, return 401

**Key insight:** After this middleware runs, the next handler can use `req.player.playerId` without checking if it's valid. The middleware guaranteed it.

---

## CHAPTER 3: Database Connection

### File: `config/database.js`

**Every query in your system goes through this file. It's the gateway to all data.**

**Read the entire file:**

```javascript
const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'tidal_hunters',
  connectionLimit: 10,
  queueLimit: 0
});
```

**Questions to answer:**
- What is `connectionLimit: 10`? Max 10 simultaneous database connections
- What happens if 11 queries run at once? The 11th waits for one to finish
- Why use `process.env`? Secrets shouldn't be in code. Use environment variables.

**Key function you'll see everywhere:**
```javascript
db.execute(query, params, (err, results) => {
  // err = database error
  // results = rows returned from query
});
```

This is used in EVERY database interaction. You'll see it hundreds of times.

---

## CHAPTER 4: Login System

### File: `controllers/authController.js`

**This is where players prove who they are and get the tokens they use everywhere else.**

**Read `login` function (probably lines 10-80):**

```javascript
function login(req, res) {
  const { username, password } = req.body;
```

Step through this:
1. Line ~15: Query database for user
2. Line ~25: Use bcrypt to check password (hashing, not comparing plaintext)
3. Line ~35: Generate access token (2 hour expiry)
4. Line ~40: Generate refresh token (7 day expiry)
5. Line ~45: INSERT refresh token into database
6. Line ~50: UPDATE players SET is_online = 1
7. Line ~55: Return both tokens

**Why two tokens?**
- Short access token: Expires in 2 hours, used for every request, small risk if leaked
- Long refresh token: Expires in 7 days, stored in DB, used only to get new access token

**Read `refreshToken` function:**

```javascript
function refreshToken(req, res) {
  const { refresh_token } = req.body;
```

This is called when access token expires. It:
1. Verify the refresh token signature
2. Check it's still in the database (wasn't revoked)
3. Generate new access token
4. Return it

**Key question:** "Can you use a refresh token to make a request?"
- No! Only to get a new access token. Each request needs access token.

**Read `logout` function:**

This should delete/revoke the refresh tokens so they can't be used again.

---

## CHAPTER 5: WebSocket Service (Real-Time Core)

### File: `services/websocketService.js`

**This is where real-time magic happens. Every WebSocket event gets handled here.**

**Read from top until you find `initializeWebSocket` function (lines 1-25):**

```javascript
function initializeWebSocket(httpServer) {
  const socketIO = require('socket.io')(httpServer, {...});
  
  socketIO.use(authenticateSocket);  // Middleware for WS
  
  socketIO.on('connection', (socket) => {
    handlePlayerConnection(socket);
  });
  
  return socketIO;
}
```

**What's happening:**
- Socket.IO initialized on HTTP server
- `authenticateSocket` middleware runs on every connection (same JWT check as HTTP)
- When client connects: `handlePlayerConnection` runs

**Read `authenticateSocket` function:**

```javascript
function authenticateSocket(socket, next) {
  const token = socket.handshake.auth.token;
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    socket.playerId = decoded.playerId;
    socket.playerTag = decoded.playerTag;
    next();
  } catch (err) {
    next(new Error('Authentication error: Invalid token'));
  }
}
```

**Compare this to HTTP auth middleware.** Same logic! Verify token, attach to request object.
- HTTP: attaches to `req.player`
- WebSocket: attaches to `socket.playerId` and `socket.playerTag`

**Read `handlePlayerConnection` function (biggest function in file, ~50 lines):**

This is the hub of all real-time activity. When a player connects:

```javascript
function handlePlayerConnection(socket) {
  const playerId = socket.playerId;
  
  // Line 1: Store this connection
  activeConnections.set(playerId, socket);
  
  // Line 2: Mark player online
  updatePlayerOnline(playerId, true);
  
  // Line 3: Register event listeners
  socket.on('heartbeat', (data) => handleHeartbeat(socket, data));
  socket.on('invite:send', (data) => handleInviteSend(socket, data));
  socket.on('invite:respond', (data) => handleInviteRespond(socket, data));
  
  // Line 4: Handle disconnect
  socket.on('disconnect', () => {
    activeConnections.delete(playerId);
    setTimeout(() => {
      if (!activeConnections.has(playerId)) {
        updatePlayerOnline(playerId, false);
      }
    }, 2000);
  });
}
```

**Key concept: `activeConnections` Map**

This is THE most important data structure for real-time:
```javascript
activeConnections = {
  1: socket_object_for_player_1,
  2: socket_object_for_player_2,
  3: socket_object_for_player_3
}
```

To send event to Player 2:
```javascript
activeConnections.get(2).emit('invite:received', {invite_id: 999});
```

That's how real-time works. No polling, just direct socket communication.

**Read `handleHeartbeat` function:**

```javascript
function handleHeartbeat(socket, data) {
  const playerId = socket.playerId;
  const { game_open } = data;
  
  const query = `UPDATE players SET last_heartbeat = NOW(), game_open = ? WHERE id = ?`;
  
  db.execute(query, [game_open ? 1 : 0, playerId], (err) => {
    socket.emit('heartbeat:ack', {status: 'success', timestamp: new Date().toISOString()});
  });
}
```

Every 5 seconds from client:
1. Server receives heartbeat
2. Update `last_heartbeat` timestamp in DB
3. Send acknowledgment back

**Read `handleInviteSend` function (long, ~60 lines):**

This is the real-time version of sending invites. Structure:
1. Validate session exists and sender is host
2. Check receiver is online
3. Check no existing pending invite
4. INSERT into invites table
5. Send success to sender
6. Find receiver in `activeConnections`
7. Send event directly to receiver (if connected)

**Key difference from REST:**
```javascript
// REST: Receiver has to poll to find out
// WebSocket: We send event directly
const receiverSocket = activeConnections.get(receiver_id);
if (receiverSocket) {
  receiverSocket.emit('invite:received', {invite_id, sender_id, ...});
}
```

**Read `handleInviteRespond` function:**

Similar structure, but now:
1. Get invite from DB
2. Check if accept or decline
3. UPDATE invites SET status = 'accepted'/'declined'
4. Send response to responder
5. Find sender in `activeConnections`
6. Send event to sender (if connected)

---

## CHAPTER 6: Heartbeat Controller (HTTP Version)

### File: `controllers/heartbeatController.js`

**This has both HTTP endpoints AND the cleanup function that marks players offline.**

**Read `playerHeartbeat` function:**

```javascript
function playerHeartbeat(req, res) {
  const playerId = req.player.playerId;  // From auth middleware
  const { game_open } = req.body;
  
  const query = `UPDATE players SET last_heartbeat = NOW(), game_open = ? WHERE id = ?`;
  
  db.execute(query, [game_open ? 1 : 0, playerId], (err, results) => {
    if (err) {
      return res.status(500).json({status: 'error', message: 'Failed to process heartbeat'});
    }
    
    res.json({status: 'success', message: 'Heartbeat received', timestamp: new Date().toISOString()});
  });
}
```

**Compare this to WebSocket heartbeat:**
- Both update `last_heartbeat` timestamp
- Both update `game_open` flag
- WebSocket is event-based, HTTP is request-based
- Same database effect

**Read `checkPlayerAlive` function:**

```javascript
function checkPlayerAlive(req, res) {
  const { playerId } = req.params;
  const timeoutSeconds = parseInt(req.query.timeout_seconds) || 30;
  
  const query = `
    SELECT id, is_online, game_open, last_heartbeat,
           TIMESTAMPDIFF(SECOND, last_heartbeat, NOW()) as seconds_since_heartbeat
    FROM players WHERE id = ?
  `;
  
  db.execute(query, [playerId], (err, results) => {
    const player = results[0];
    const isAlive = player.game_open === 1 && player.seconds_since_heartbeat <= timeoutSeconds;
    
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

**Key query: `TIMESTAMPDIFF(SECOND, last_heartbeat, NOW())`**

This calculates: "How many seconds since the last heartbeat?"
- If 2 seconds: player actively playing
- If 35 seconds: player probably crashed
- If NULL: never sent heartbeat

**Read `checkPlayersAlive` function:**

Same as above but checks multiple players in one request:
```javascript
const placeholders = player_ids.map(() => '?').join(',');
const query = `SELECT ... FROM players WHERE id IN (${placeholders})`;
```

This is more efficient than calling `checkPlayerAlive` N times.

**Read `cleanupDeadPlayers` function (THE MOST IMPORTANT):**

```javascript
function cleanupDeadPlayers(timeoutSeconds = 30) {
  const query = `
    UPDATE players 
    SET is_online = 0, game_open = 0
    WHERE is_online = 1 
    AND (last_heartbeat IS NULL OR TIMESTAMPDIFF(SECOND, last_heartbeat, NOW()) > ?)
  `;
  
  db.execute(query, [timeoutSeconds], (err, results) => {
    if (results.affectedRows > 0) {
      console.log(`⚠️ Marked ${results.affectedRows} players offline due to no heartbeat`);
    }
  });
}
```

**This runs every 10 seconds (from server.js line ~150).**

**What it does:**
1. Find all players where `is_online = 1`
2. AND their `last_heartbeat` is older than 30 seconds
3. Mark them `is_online = 0`

**This is crash detection!**
- Player crashes, stops sending heartbeats
- After 30 seconds: cleanup marks them offline
- Friends see them offline

---

## CHAPTER 7: Invite Controller (REST Version)

### File: `controllers/inviteController.js`

**The REST API version of invite system. Clients can use this OR WebSocket for same functionality.**

**Read `sendInvite` function (long, ~80 lines):**

This follows the pattern: validate → query → validate → query → validate → insert

```javascript
function sendInvite(req, res) {
  const { receiver_id, session_code } = req.body;
  const sender_id = req.player.playerId;  // From auth middleware
  
  // Validate
  if (!receiver_id || !session_code) {
    return res.status(400).json({status: 'error', message: 'Missing fields'});
  }
  
  // Query 1: Check session exists
  const sessionQuery = `SELECT ... FROM game_sessions WHERE session_code = ? AND host_player_id = ?`;
  db.execute(sessionQuery, [session_code, sender_id], (err, sessionResults) => {
    if (sessionResults.length === 0) {
      return res.status(404).json({status: 'error', message: 'Session not found'});
    }
    
    const session = sessionResults[0];
    
    // Query 2: Check receiver online
    const receiverQuery = `SELECT id FROM players WHERE id = ? AND is_online = 1`;
    db.execute(receiverQuery, [receiver_id], (err, receiverResults) => {
      if (receiverResults.length === 0) {
        return res.status(404).json({status: 'error', message: 'Receiver offline'});
      }
      
      // Query 3: Check no existing pending invite
      const existingQuery = `SELECT id FROM invites WHERE sender_id = ? AND receiver_id = ? AND status = 'pending'`;
      db.execute(existingQuery, [sender_id, receiver_id], (err, existingResults) => {
        if (existingResults.length > 0) {
          return res.status(409).json({status: 'error', message: 'Already invited'});
        }
        
        // Query 4: INSERT invite
        const insertQuery = `INSERT INTO invites (sender_id, receiver_id, session_code, status, created_at, expires_at) VALUES (?, ?, ?, 'pending', NOW(), DATE_ADD(NOW(), INTERVAL 120 SECOND))`;
        db.execute(insertQuery, [sender_id, receiver_id, session_code], (err, result) => {
          res.json({status: 'success', invite_id: result.insertId});
        });
      });
    });
  });
}
```

**This is callback hell.** Each query waits for previous one. Follow the nesting:
- Query 1 callback contains Query 2
- Query 2 callback contains Query 3
- Query 3 callback contains Query 4

**This is why async/await is better, but this code works.**

**Read `checkInvites` function:**

```javascript
function checkInvites(req, res) {
  const playerId = req.params.playerId;
  
  // Security check
  if (parseInt(playerId) !== req.player.playerId) {
    return res.status(403).json({status: 'error', message: 'Cannot check invites for other players'});
  }
  
  const query = `
    SELECT i.id, i.session_code, i.created_at, i.expires_at,
           p.id as sender_id, p.display_name, p.player_tag
    FROM invites i
    JOIN players p ON i.sender_id = p.id
    WHERE i.receiver_id = ? AND i.status = 'pending' AND i.expires_at > NOW()
  `;
  
  db.execute(query, [playerId], (err, results) => {
    res.json({invites: results});
  });
}
```

**Key security check:**
```javascript
if (parseInt(playerId) !== req.player.playerId) {
  return res.status(403).json({status: 'error'});
}
```

You can't check other people's invites. Even if you send the wrong ID, it rejects you.

**Read `respondToInvite` function:**

```javascript
function respondToInvite(req, res) {
  const { invite_id, response } = req.body;
  const player_id = req.player.playerId;
  
  // Validate response is accept or decline
  if (!['accept', 'decline'].includes(response)) {
    return res.status(400).json({status: 'error'});
  }
  
  // Get invite
  const inviteQuery = `SELECT ... FROM invites WHERE id = ? AND receiver_id = ? AND status = 'pending'`;
  db.execute(inviteQuery, [invite_id, player_id], (err, inviteResults) => {
    if (inviteResults.length === 0) {
      return res.status(404).json({status: 'error', message: 'Invite not found'});
    }
    
    const invite = inviteResults[0];
    
    if (response === 'decline') {
      // UPDATE to declined
      const declineQuery = `UPDATE invites SET status = 'declined' WHERE id = ?`;
      db.execute(declineQuery, [invite_id], (err) => {
        res.json({status: 'declined', message: 'Invite declined'});
      });
    } else {
      // UPDATE to accepted, then join session
      const acceptQuery = `UPDATE invites SET status = 'accepted' WHERE id = ?`;
      db.execute(acceptQuery, [invite_id], (err) => {
        // Then add to session and update counts
        const updateSessionQuery = `UPDATE game_sessions SET current_players = current_players + 1 WHERE session_code = ?`;
        db.execute(updateSessionQuery, [invite.session_code], (err) => {
          const updateServerQuery = `UPDATE game_servers SET current_player_count = current_player_count + 1 WHERE id = ?`;
          db.execute(updateServerQuery, [invite.server_id], (err) => {
            res.json({
              status: 'accepted',
              server_ip: invite.ip_address,
              server_port: invite.port,
              session_code: invite.session_code
            });
          });
        });
      });
    }
  });
}
```

**Key pattern:** Three UPDATEs in a row. First updates invite, then updates session count, then updates server count.

---

## CHAPTER 8: Rate Limiting & Validation

### File: `middleware/rateLimit.js`

**Short file. Read the entire thing.**

```javascript
const rateLimit = require('express-rate-limit');

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100                    // 100 requests per 15 min
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,                     // 5 login attempts per 15 min
  skipSuccessfulRequests: true
});
```

**What's happening:**
- `generalLimiter`: Every route has max 100 requests per IP per 15 min
- `loginLimiter`: Login has max 5 attempts per IP per 15 min (failed attempts count, successful ones don't)

**In server.js:**
```javascript
app.use(generalLimiter);  // Applied to ALL routes
app.post('/account/login', loginLimiter, ...);  // Additional limit just for login
```

### File: `middleware/validation.js`

**Read this short file.**

This uses `express-validator` to check input before it reaches controllers.

Example patterns:
```javascript
const { body, validationResult } = require('express-validator');

const validateLogin = [
  body('username').isLength({min: 3}).withMessage('Username too short'),
  body('password').isLength({min: 6}).withMessage('Password too short'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({errors: errors.array()});
    }
    next();
  }
];
```

**In server.js:**
```javascript
app.post('/account/login', validateLogin, authController.login);
```

This middleware checks username/password before login controller runs.

---

## CHAPTER 9: Player & Server Controllers

### File: `controllers/playerController.js`

**Short file. Two functions.**

**Read `getPlayers`:**
```javascript
function getPlayers(req, res) {
  const { exclude_player_id } = req.query;
  
  let query = `SELECT id, display_name, player_tag FROM players WHERE is_online = 1`;
  let params = [];
  
  if (exclude_player_id) {
    query += ` AND id != ?`;
    params.push(exclude_player_id);
  }
  
  db.execute(query, params, (err, results) => {
    res.json({players: results});
  });
}
```

This is simple: list all online players, optionally excluding self.

**Read `lookupPlayer`:**
```javascript
function lookupPlayer(req, res) {
  const { display_name, player_tag } = req.query;
  
  const query = `SELECT id, display_name, player_tag, is_online FROM players WHERE display_name = ? AND player_tag = ?`;
  
  db.execute(query, [display_name, player_tag], (err, results) => {
    if (results.length === 0) {
      return res.status(404).json({status: 'error', message: 'Player not found'});
    }
    
    res.json({
      player_id: results[0].id,
      display_name: results[0].display_name,
      player_tag: results[0].player_tag,
      is_online: results[0].is_online === 1
    });
  });
}
```

This finds player by name+tag combo.

### File: `controllers/serverController.js`

**Read the function names first to understand what exists. Then read each one.**

Likely contains:
- `registerServer` - Admin registers new game server
- `removeServer` - Admin removes server
- `updateServer` - Server sends heartbeat
- `updatePlayerCount` - Server updates player count
- `linkSessionToServer` - Link game session to server

Each of these does database operations.

---

## CHAPTER 10: Session & Friend Controllers

### File: `controllers/sessionController`

**Read `disconnectPlayer`:**

This is what happens when player disconnects:
1. Find session where player is host
2. If other players in session: transfer host to another player
3. If only player: delete session
4. Update server player count
5. Mark player offline

Involves multiple queries and complex logic.

### File: `controllers/friendController.js`

**Structure will be similar:**
- `sendFriendRequest`
- `getFriendRequests`
- `acceptFriendRequest`
- `declineFriendRequest`
- `getFriendsList`
- etc.

Each follows same pattern: validate → query → update → response.

---

## CHAPTER 11: Services (Background Jobs)

### File: `services/serverService.js`

Probably contains:
- `cleanupDeadServers` - Runs every 5 minutes, marks servers offline if no heartbeat
- `handleServerHeartbeat` - Game server sends heartbeat

Similar to player heartbeat system.

### File: `services/tokenService.js`

Probably contains:
- `cleanupExpiredRefreshTokens` - Runs every 1 hour, deletes old tokens
- `cleanupExpiredRememberTokens` - Same for remember-me tokens

---

## CHAPTER 12: Database Schema (The Data)

### File: Your database (not a code file, but important)

The tables store everything. Common pattern:

```sql
CREATE TABLE players (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50),
  password_hash VARCHAR(255),
  is_online TINYINT(1),
  last_heartbeat TIMESTAMP,
  game_open TINYINT(1),
  created_at TIMESTAMP
);

CREATE TABLE invites (
  id INT PRIMARY KEY AUTO_INCREMENT,
  sender_id INT,
  receiver_id INT,
  session_code VARCHAR(50),
  status ENUM('pending', 'accepted', 'declined'),
  created_at TIMESTAMP,
  expires_at TIMESTAMP,
  FOREIGN KEY (sender_id) REFERENCES players(id),
  FOREIGN KEY (receiver_id) REFERENCES players(id)
);

CREATE TABLE game_sessions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  session_code VARCHAR(50),
  host_player_id INT,
  current_players INT,
  server_id INT,
  FOREIGN KEY (host_player_id) REFERENCES players(id),
  FOREIGN KEY (server_id) REFERENCES game_servers(id)
);

CREATE TABLE game_servers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  ip_address VARCHAR(50),
  port INT,
  current_player_count INT,
  is_alive TINYINT(1),
  last_heartbeat TIMESTAMP
);

CREATE TABLE refresh_tokens (
  id INT PRIMARY KEY AUTO_INCREMENT,
  player_id INT,
  token TEXT,
  expires_at TIMESTAMP,
  created_at TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id)
);
```

Every query you see is talking to these tables.

---

## How to Actually Read Through Code

### Start with CHAPTER 1: `server.js`

1. Open the file
2. Read line by line
3. For each import, ask: "What does this do?"
4. For each route, ask: "Who can access this? What does it do?"

### Then go to CHAPTER 2-12 in order

1. Read the chapter
2. Open the actual file
3. Read the function mentioned
4. Find where it's called (use Ctrl+F to search for function name in `server.js`)
5. Understand the flow

### When reading a function, ask:

1. **Input**: What parameters come in?
2. **Processing**: What database queries happen? In what order?
3. **Validation**: What can go wrong? How is it handled?
4. **Output**: What gets returned? When?
5. **Side effects**: What changes in the database?

### Example: Reading `sendInvite`

**Input:** `receiver_id`, `session_code`, sender from auth
**Processing:**
- Query 1: Get session
- Query 2: Get receiver
- Query 3: Check existing
- Query 4: Insert invite
**Validation:**
- Session must exist, sender must be host
- Receiver must be online
- No pending invite already exists
**Output:**
- Success: `{invite_id: 999}`
- Error: `{error: "message"}`
**Side effects:**
- Inserts row in invites table
- (If WebSocket) sends event to receiver

---

## The Big Picture Reading Order

```
1. server.js                    (Entry point, all routes)
2. middleware/auth.js           (How players prove identity)
3. config/database.js           (How queries work)
4. controllers/authController.js (Login/logout)
5. services/websocketService.js (Real-time events)
6. controllers/heartbeatController.js (Crash detection)
7. controllers/inviteController.js (REST invites)
8. middleware/rateLimit.js      (Protection from abuse)
9. middleware/validation.js     (Input checking)
10. controllers/playerController.js (Player queries)
11. controllers/serverController.js (Game servers)
12. controllers/sessionController (Player disconnect)
13. controllers/friendController.js (Friends)
14. services/serverService.js   (Server cleanup)
15. services/tokenService.js    (Token cleanup)
```

Start with #1. When you don't understand something, jump to the relevant chapter.

**It's like reading a book where each chapter is a file, and they reference each other.**

Done. Now go read your code. 📖
