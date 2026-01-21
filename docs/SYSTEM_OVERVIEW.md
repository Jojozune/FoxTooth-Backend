# 🎮 Game Invites Backend - Complete System Documentation

**Last Updated:** January 20, 2026  
**System Status:** Production Ready  
**Version:** 1.0.0

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Core Components](#core-components)
4. [Database Schema](#database-schema)
5. [REST API Endpoints](#rest-api-endpoints)
6. [WebSocket Real-Time Events](#websocket-real-time-events)
7. [Authentication System](#authentication-system)
8. [Data Flow Diagrams](#data-flow-diagrams)
9. [Key Features](#key-features)
10. [Configuration & Environment](#configuration--environment)
11. [Deployment Guide](#deployment-guide)

---

## System Overview

The **Game Invites Backend** is a multiplayer game session management system that enables players to:
- Create accounts with unique identifiers
- Authenticate securely with JWT tokens
- Find and add friends
- Send/receive game session invites with real-time notifications
- Join multiplayer game sessions on distributed game servers
- Maintain persistent login (remember-me tokens)
- Track player online status via heartbeats
- Administer game servers

**Technology Stack:**
- **Runtime:** Node.js (v16+)
- **Framework:** Express.js 4.18.2
- **Real-Time:** Socket.IO 4.8.1 (WebSockets)
- **Database:** MySQL 5.7+ (mysql2 3.6.0)
- **Authentication:** JWT (jsonwebtoken 9.0.2) + bcryptjs (2.4.3)
- **Rate Limiting:** express-rate-limit 8.1.0
- **Validation:** express-validator 7.2.1

**Default Configuration:**
- Port: `7777` (local), configurable via `SERVER_PORT` env var
- Database: MySQL connection pool (10 connections)
- Heartbeat Timeout: 120 seconds (configurable)
- Invite Expiry: 120 seconds
- Token Expiry: Access (2 hours), Refresh (7 days)

---

## Architecture

### System Design

```
┌─────────────────────────────────────────────────────────────┐
│              Game Invites Backend (Express)                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ HTTP/REST Layer (Express Routes)                      │  │
│  ├──────────────┬──────────────┬──────────────┐          │  │
│  │ Auth Routes  │ Player Routes│ Invite Routes│          │  │
│  └──────────────┴──────────────┴──────────────┘          │  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ WebSocket Layer (Socket.IO)                           │  │
│  ├──────────────┬──────────────┬──────────────┐          │  │
│  │ Real-time    │ Live Invites │ Heartbeat    │          │  │
│  │ Connections  │ Notifications│ Updates      │          │  │
│  └──────────────┴──────────────┴──────────────┘          │  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Business Logic Layer (Controllers & Services)         │  │
│  ├────────────────────────────────────────────────────┐  │  │
│  │ • Authentication    • Invites    • Heartbeat       │  │  │
│  │ • Players           • Sessions   • Friends         │  │  │
│  │ • Servers           • Tokens     • Admin           │  │  │
│  └────────────────────────────────────────────────────┘  │  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Middleware Layer                                      │  │
│  ├────────────────────────────────────────────────────┐  │  │
│  │ • JWT Authentication  • Rate Limiting              │  │  │
│  │ • Input Validation    • Admin Token Auth           │  │  │
│  │ • CORS                • Error Handling             │  │  │
│  └────────────────────────────────────────────────────┘  │  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                           │
                           ↓
         ┌─────────────────────────────────┐
         │    MySQL Database               │
         │  (Persistent Data Storage)      │
         │                                 │
         │ • players                       │
         │ • invites                       │
         │ • game_sessions                 │
         │ • game_servers                  │
         │ • friendships                   │
         │ • refresh_tokens                │
         │ • admin_tokens                  │
         └─────────────────────────────────┘
                           │
                           ↓
         ┌─────────────────────────────────┐
         │   Game Servers (External)       │
         │                                 │
         │ • Server 1 (IP:Port)            │
         │ • Server 2 (IP:Port)            │
         │ • Server N (IP:Port)            │
         └─────────────────────────────────┘
```

### Component Architecture

```
EXPRESS SERVER (server.js)
│
├── Controllers (handlers for business logic)
│   ├── authController.js        → Account creation, login, token management
│   ├── playerController.js      → Player lookup and status
│   ├── inviteController.js      → Invite CRUD operations
│   ├── friendController.js      → Friend relationships
│   ├── sessionController.js     → Game session management
│   ├── serverController.js      → Game server registration/management
│   └── heartbeatController.js   → Player/server health tracking
│
├── Services (shared business logic)
│   ├── websocketService.js      → Socket.IO event handlers
│   ├── tokenService.js          → JWT and token utilities
│   ├── serverService.js         → Server health and cleanup
│   └── sessionService.js        → Session creation and management
│
├── Middleware (request processing)
│   ├── auth.js                  → JWT token verification
│   ├── adminAuth.js             → Admin token verification
│   ├── validation.js            → Input validation rules
│   └── rateLimit.js             → Rate limiting policies
│
└── Config
    ├── database_new.js          → MySQL pool configuration
    ├── jwt.js                   → JWT secrets and config
    └── .env                     → Environment variables
```

---

## Core Components

### 1. Authentication System

#### Account Management
- **Create Account:** Email + password + display name
- **Login:** Email or (display_name + player_tag)
- **Player Tag:** Auto-generated 4-digit numeric code (unique per display name)
- **Password Hashing:** bcryptjs with 12 rounds

#### Token Types

**1. Access Token (JWT)**
- Duration: 2 hours
- Claims: `playerId`, `playerTag`, `displayName`
- Usage: Authorization header `Bearer {token}`
- Renewal: Via `/player/refresh-token` endpoint

**2. Refresh Token**
- Duration: 7 days
- Stored in database with hash
- Used to issue new access tokens
- Automatically cleaned up after expiry

**3. Remember-Me Token**
- Duration: 30 days
- Stored in database with hash
- Allows silent re-login without password
- Endpoint: `/player/remember-login`

**4. Admin Token (Limited-use)**
- Duration: 15 minutes
- One-time use for server registration
- Requires player to be database-marked admin
- Generated via `/admin/generate-token`

### 2. Player Management

**Player Lifecycle:**
1. Account created (is_online = false)
2. Player logs in → is_online = true, last_seen = NOW()
3. Player sends heartbeat → last_heartbeat = NOW(), game_open = true/false
4. Player offline → is_online = false, sessions cleaned up
5. Account persists indefinitely

**Player Status Tracking:**
- `is_online`: Binary flag (updated on login/logout)
- `last_heartbeat`: Timestamp of last heartbeat
- `game_open`: Whether game client is open
- `last_seen`: Last login time
- Auto-cleanup: Players marked offline if heartbeat > timeout (120s default)

### 3. Invite System

**Invite Lifecycle:**
```
CREATE (pending)
   ↓
RECEIVED (awaiting response)
   ↓
ACCEPT/DECLINE
   ↓
COMPLETED (deleted from database after cleanup)
```

**Invite Properties:**
- Duration: 120 seconds (expires automatically)
- Status: `pending`, `accepted`, `declined`
- Constraints: One pending invite per sender-receiver pair
- Real-time: Notifications sent via WebSocket to receiver

**Invite Flow:**
1. Sender creates invite for receiver + session_code
2. Receiver notified in real-time via WebSocket
3. Receiver can accept (join session) or decline
4. Invite expires after 2 minutes if not responded to
5. Expired invites cleaned up automatically

### 4. Game Session System

**Session Properties:**
- `session_code`: 6-character unique identifier (uppercase + numbers)
- `host_player_id`: Creator/owner of session
- `server_id`: Assigned game server
- `current_players`: Number of players in session
- `status`: `waiting` (accepting players), `active`, `finished`

**Session Lifecycle:**
```
CREATE (host creates, status=waiting)
   ↓
INVITE (host invites players)
   ↓
JOIN (players accept invites)
   ↓
ACTIVE (game begins, status=active)
   ↓
DISCONNECT (players leave)
   ↓
DELETE (if last player) OR TRANSFER HOST (if others remain)
```

**Auto-cleanup:**
- Sessions in "waiting" status deleted if host offline > 120s
- Session deleted if all players disconnect
- Host transferred to remaining player if host disconnects

### 5. Game Servers

**Server Properties:**
- `server_name`: Display name
- `ip_address`: Public IP or localhost
- `port`: Listen port
- `max_players`: Maximum concurrent players
- `current_player_count`: Active players across all sessions
- `is_available`: Health status (auto-marked unavailable if no heartbeat)

**Server Registration:**
```
Game Server (external)
   │
   ├─→ POST /server/auto-register (with admin token)
   │   → Server registered in database
   │
   └─→ POST /server/heartbeat (periodic)
       → Marks server as alive
       → Updates last_heartbeat timestamp
```

**Auto-cleanup:**
- Servers marked unavailable if no heartbeat > 120s (configurable)
- Dead servers don't accept new sessions
- Manual removal via admin endpoint

### 6. Friends System

**Friendship Types:**
- `pending`: Awaiting acceptance
- `accepted`: Mutual friends
- `blocked`: Player has blocked another

**Friend Operations:**
- Send request → creates pending friendship
- Accept request → changes status to accepted
- Decline request → deletes friendship
- Remove friend → deletes friendship
- Block player → status = blocked (no reinvite possible)

---

## Database Schema

### Players Table
```sql
CREATE TABLE players (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  display_name VARCHAR(20) NOT NULL,
  player_tag VARCHAR(7) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  is_online TINYINT(1) DEFAULT 0,
  is_admin TINYINT(1) DEFAULT 0,
  last_heartbeat TIMESTAMP NULL,
  game_open TINYINT(1) DEFAULT 0,
  last_seen TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE KEY unique_player_tag (display_name, player_tag),
  INDEX idx_is_online (is_online),
  INDEX idx_last_heartbeat (last_heartbeat),
  INDEX idx_email (email)
);
```

### Game Sessions Table
```sql
CREATE TABLE game_sessions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  session_code VARCHAR(11) NOT NULL UNIQUE,
  server_id BIGINT NOT NULL,
  host_player_id BIGINT NOT NULL,
  current_players INT DEFAULT 1,
  status ENUM('waiting', 'active', 'finished') DEFAULT 'waiting',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (server_id) REFERENCES game_servers(id) ON DELETE CASCADE,
  FOREIGN KEY (host_player_id) REFERENCES players(id) ON DELETE CASCADE,
  INDEX idx_session_code (session_code),
  INDEX idx_host_player_id (host_player_id),
  INDEX idx_status (status)
);
```

### Invites Table
```sql
CREATE TABLE invites (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  sender_id BIGINT NOT NULL,
  receiver_id BIGINT NOT NULL,
  session_code VARCHAR(11) NOT NULL,
  status ENUM('pending', 'accepted', 'declined') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  
  FOREIGN KEY (sender_id) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES players(id) ON DELETE CASCADE,
  UNIQUE KEY unique_pending_invite (sender_id, receiver_id, status),
  INDEX idx_receiver_id (receiver_id),
  INDEX idx_expires_at (expires_at)
);
```

### Game Servers Table
```sql
CREATE TABLE game_servers (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  server_name VARCHAR(100) NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  port INT NOT NULL,
  max_players INT DEFAULT 16,
  current_player_count INT DEFAULT 0,
  is_available TINYINT(1) DEFAULT 1,
  last_heartbeat TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY unique_server (ip_address, port),
  INDEX idx_is_available (is_available),
  INDEX idx_last_heartbeat (last_heartbeat)
);
```

### Friendships Table
```sql
CREATE TABLE friendships (
  id INT AUTO_INCREMENT PRIMARY KEY,
  player_id INT NOT NULL,
  friend_id INT NOT NULL,
  status ENUM('pending', 'accepted', 'blocked') DEFAULT 'pending',
  requested_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY (friend_id) REFERENCES players(id) ON DELETE CASCADE,
  UNIQUE KEY unique_friendship (player_id, friend_id),
  INDEX idx_friend_id (friend_id),
  INDEX idx_status (status)
);
```

### Refresh Tokens Table
```sql
CREATE TABLE refresh_tokens (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  player_id BIGINT NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  INDEX idx_player_expires (player_id, expires_at),
  INDEX idx_expires_at (expires_at)
);
```

### Remember Tokens Table
```sql
CREATE TABLE remember_tokens (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  player_id BIGINT NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  INDEX idx_player_expires (player_id, expires_at),
  INDEX idx_expires_at (expires_at)
);
```

### Admin Tokens Table
```sql
CREATE TABLE admin_tokens (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  admin_id BIGINT NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  purpose VARCHAR(50),
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (admin_id) REFERENCES players(id) ON DELETE CASCADE,
  INDEX idx_expires_at (expires_at)
);
```

---

## REST API Endpoints

### Public Endpoints (No Authentication)

#### 1. Health Check
```
GET /health
```
- Returns server status and optional database health
- Set `ENABLE_DB_HEALTH=true` to include database check
- Response: `{server: 'ok', uptime_seconds: X, db?: {status: 'ok'}}`

#### 2. Create Account
```
POST /account/create
Content-Type: application/json

{
  "display_name": "PlayerOne",
  "email": "player@example.com",
  "password": "securePassword123"
}
```
- Validates email uniqueness
- Auto-generates 4-digit player tag
- Hashes password with bcryptjs (12 rounds)
- Response: `{status: 'success', player_id: 1, player_tag: '3847'}`
- Rate limit: 5 per 15 minutes per IP

#### 3. Login
```
POST /account/login
Content-Type: application/json

{
  "email": "player@example.com",
  "password": "securePassword123",
  "remember_me": true  // optional
}
```
- Supports email or (display_name + player_tag) login
- Returns access token (2h), refresh token (7d)
- Optional remember-me token (30d)
- Response: `{status: 'success', access_token: '...', refresh_token: '...', player_id: 1}`
- Rate limit: 10 per 15 minutes per IP

#### 4. Player Connect
```
POST /player/connect
Content-Type: application/json

{
  "player_id": 1,
  "access_token": "eyJhbGc..."
}
```
- Alternative connection method
- Validates token and marks player online
- Creates game session on available server
- Response: `{player_id: 1, session_code: 'ABC123', server: {ip: '...', port: 7777}}`

#### 5. Get Online Players
```
GET /players?exclude_player_id=1
```
- Returns all currently online players
- Optional filter to exclude self
- Response: `{players: [{id: 2, display_name: 'PlayerTwo', player_tag: '5294'}, ...]}`

#### 6. Lookup Player
```
GET /player/lookup?display_name=PlayerOne&player_tag=3847
```
- Find specific player by name + tag
- Returns: `{player_id: 1, display_name: 'PlayerOne', player_tag: '3847', is_online: true}`
- 404 if not found

#### 7. Server Registration (Admin)
```
POST /server/register
X-Admin-Token: {admin_token}
Content-Type: application/json

{
  "server_name": "Server 1",
  "ip_address": "192.168.1.100",
  "port": 7777,
  "max_players": 16
}
```
- Requires valid admin token
- Registers game server for session assignment
- Response: `{status: 'success', server_id: 1}`

#### 8. Server Auto-Register
```
POST /server/auto-register
X-Admin-Token: {admin_token}
Content-Type: application/json

{
  "server_name": "Server 1",
  "ip_address": "192.168.1.100",
  "port": 7777,
  "max_players": 16
}
```
- Single endpoint for servers to self-register
- Requires admin token (obtained from `/admin/generate-token`)

#### 9. Server Heartbeat
```
POST /server/heartbeat
Content-Type: application/json

{
  "server_id": 1
}
```
- Marks server as alive/available
- Called periodically by game servers (every 30-60 seconds)
- Response: `{status: 'success', message: 'Heartbeat received'}`

---

### Protected Endpoints (Require JWT Access Token)

**Authorization Header:** `Authorization: Bearer {access_token}`

#### 1. Validate Token
```
GET /player/validate-token
```
- Verifies access token is valid
- Returns player info: `{playerId: 1, playerTag: '3847', valid: true}`

#### 2. Refresh Token
```
POST /player/refresh-token
Content-Type: application/json

{
  "refresh_token": "..."
}
```
- Issues new access token from refresh token
- Response: `{access_token: '...', expires_in: 7200}`

#### 3. Remember-Me Login
```
POST /player/remember-login
Content-Type: application/json

{
  "remember_token": "..."
}
```
- Issues new access + refresh tokens from remember token
- Silent re-login (no password needed)
- Response: `{access_token: '...', refresh_token: '...', player_id: 1}`

#### 4. Logout
```
POST /player/logout
```
- Invalidates refresh token
- Marks player offline
- Response: `{status: 'success', message: 'Logged out'}`

#### 5. Player Heartbeat
```
POST /player/heartbeat
Content-Type: application/json

{
  "game_open": true  // is game running?
}
```
- Sends player heartbeat to backend
- Updates: `last_heartbeat`, `is_online = 1`, `game_open`
- Called by client every 30 seconds
- Response: `{status: 'success', timestamp: '...'}`

#### 6. Check Player Alive
```
GET /player/check-alive/:playerId
```
- Single player alive check
- Response: `{player_id: 1, is_online: true, last_heartbeat: '...'}`

#### 7. Check Multiple Players
```
POST /player/check-alive-batch
Content-Type: application/json

{
  "player_ids": [1, 2, 3]
}
```
- Batch check multiple players
- Response: `{players: [{player_id: 1, is_online: true}, ...]}`

#### 8. Disconnect Player
```
POST /player/disconnect
```
- Marks player offline
- Removes from session
- Transfers host if needed
- Cleans up empty sessions
- Response: `{status: 'success', message: '...'}`

#### 9. Send Invite
```
POST /invite/send
Content-Type: application/json

{
  "receiver_id": 50,
  "session_code": "ABC123"
}
```
- Creates game session invite
- Receiver must be online
- Expires in 120 seconds
- Can send via HTTP OR WebSocket
- Response: `{status: 'success', invite_id: 999, expires_in: 120}`

#### 10. Check Invites
```
GET /invite/check/:playerId
```
- Get all pending invites for player
- Response:
```json
{
  "invites": [
    {
      "invite_id": 999,
      "sender_id": 10,
      "sender_name": "PlayerOne3847",
      "session_code": "ABC123",
      "created_at": "2025-10-21T15:30:45Z",
      "expires_at": "2025-10-21T15:32:45Z"
    }
  ]
}
```

#### 11. Respond to Invite
```
POST /invite/respond
Content-Type: application/json

{
  "invite_id": 999,
  "response": "accept"  // or "decline"
}
```
- Accept invite → join session
- Decline invite → delete invite
- Response: 
```json
{
  "status": "success",
  "message": "Invite accepted",
  "session_code": "ABC123",
  "server": {
    "ip_address": "192.168.1.100",
    "port": 7777
  }
}
```

#### 12. Send Friend Request
```
POST /friend/request
Content-Type: application/json

{
  "friend_id": 50
}
```
- Creates pending friend request
- Cannot send to self, already friends, or if blocked
- Response: `{status: 'success', message: 'Friend request sent'}`

#### 13. Get Friend Requests
```
GET /friend/requests
```
- Get pending friend requests
- Response:
```json
{
  "status": "success",
  "count": 2,
  "requests": [
    {
      "request_id": 1,
      "player_id": 10,
      "display_name": "PlayerOne",
      "player_tag": "3847",
      "is_online": true,
      "created_at": "2025-01-20T10:30:00Z"
    }
  ]
}
```

#### 14. Accept Friend Request
```
POST /friend/accept
Content-Type: application/json

{
  "request_id": 1
}
```
- Accepts pending friend request
- Creates mutual friendship
- Response: `{status: 'success', message: 'Friend request accepted'}`

#### 15. Get Friends List
```
GET /friends
```
- Get all accepted friends
- Response:
```json
{
  "status": "success",
  "count": 5,
  "friends": [
    {
      "friend_id": 10,
      "display_name": "PlayerOne",
      "player_tag": "3847",
      "is_online": true
    }
  ]
}
```

#### 16. Generate Admin Token
```
GET /admin/generate-token
```
- Generate limited-use admin token (15 minutes)
- Requires authenticated admin player
- Response: `{status: 'success', admin_token: '...', expires_in: '15 minutes'}`

---

### Admin-Only Endpoints

**Requires Admin Token:** `X-Admin-Token: {token}`

#### 1. Remove Server
```
POST /server/remove
X-Admin-Token: {admin_token}
Content-Type: application/json

{
  "server_id": 1
}
```
- Unregisters game server
- Response: `{status: 'success', message: 'Server removed'}`

#### 2. Force Player Offline
```
POST /player/:playerId/force-offline
X-Admin-Token: {admin_token}
```
- Immediately marks player offline
- Cleans up their sessions
- Response: `{status: 'success', message: 'Player marked offline'}`

---

## WebSocket Real-Time Events

### Connection Setup

**Connect URL:**
```
ws://SERVER_HOST:PORT
// or with auth
ws://SERVER_HOST:PORT?token=JWT_ACCESS_TOKEN
```

**Socket.IO Namespaces:**
- `/` (default) - All events
- `/ws/invites` - Invite-specific events (legacy support)

**Authentication:**
- Token passed via `socket.handshake.auth.token` (preferred)
- Fallback: `socket.handshake.query.token` or `socket.handshake.query.authToken`
- Auto-disconnects if token invalid/missing

### Connection Lifecycle

```
1. Client connects with valid JWT
   ↓
2. Server authenticates token
   ↓
3. Socket authenticated → Server emits 'connected' event
   ↓
4. activeConnections map updated: {playerId: socket}
   ↓
5. Player marked online in database
   ↓
6. Listen for events (heartbeat, invites, etc)
   ↓
7. Client disconnects or timeout
   ↓
8. Player marked offline (2s grace period for reconnect)
   ↓
9. Session cleanup triggered
```

### Client-to-Server Events

#### 1. Heartbeat
```javascript
socket.emit('heartbeat', {
  game_open: true  // is game running?
});
```
- Sent periodically by client (every 30 seconds recommended)
- Server updates: `last_heartbeat`, `is_online`, `game_open`
- Prevents auto-offline timeout
- **Server Response (heartbeat:ack):**
```json
{
  "status": "success",
  "timestamp": "2025-01-20T10:30:00Z",
  "game_open": true
}
```

#### 2. Send Invite (WebSocket)
```javascript
socket.emit('invite:send', {
  receiver_id: 50,
  session_code: "ABC123"
});
```
- Real-time invite creation
- Same validation as HTTP `/invite/send`
- **Server Response (invite:send:success):**
```json
{
  "status": "success",
  "invite_id": 999,
  "session_code": "ABC123",
  "receiver_id": 50,
  "receiver_name": "PlayerTwo5294",
  "expires_in": 120
}
```
- **Error Response (invite:send:error):**
```json
{
  "status": "error",
  "message": "Session not found or you are not the host"
}
```

#### 3. Acknowledge Invite
```javascript
socket.emit('invite:acknowledged', {
  invite_id: 999
});
```
- Client confirms invite received
- Updates database acknowledgment timestamp
- Optional but useful for tracking

#### 4. Respond to Invite (WebSocket)
```javascript
socket.emit('invite:respond', {
  invite_id: 999,
  response: "accept"  // or "decline"
});
```
- Accept: Join session
- Decline: Reject invite
- **Server Response (invite:respond:success):**
```json
{
  "status": "success",
  "invite_id": 999,
  "session_code": "ABC123",
  "message": "Invite accepted. Joining session..."
}
```

### Server-to-Client Events

#### 1. Connected
```json
{
  "status": "connected",
  "player_id": 1,
  "socket_id": "...",
  "timestamp": "2025-01-20T10:30:00Z"
}
```
- Sent immediately after successful authentication
- Indicates WebSocket connection established
- Player can now listen for real-time events

#### 2. Invite Received
```json
{
  "invite_id": 999,
  "sender_id": 10,
  "sender_name": "PlayerOne3847",
  "session_code": "ABC123",
  "server_ip": "192.168.1.100",
  "server_port": 7777,
  "created_at": "2025-01-20T10:30:00Z",
  "expires_in": 120
}
```
- Real-time notification when receiving invite
- Include server info for direct connection if accepted
- Auto-expires in 120 seconds

#### 3. Invite Accepted
```json
{
  "invite_id": 999,
  "receiver_id": 50,
  "receiver_name": "PlayerTwo5294",
  "message": "Player accepted your invite"
}
```
- Sent to sender when receiver accepts
- Notifies sender of successful invite

#### 4. Invite Declined
```json
{
  "invite_id": 999,
  "receiver_id": 50,
  "receiver_name": "PlayerTwo5294",
  "message": "Player declined your invite"
}
```
- Sent to sender when receiver declines

#### 5. Heartbeat Acknowledgment
```json
{
  "status": "success",
  "timestamp": "2025-01-20T10:30:00Z",
  "game_open": true
}
```
- Response to client heartbeat
- Confirms heartbeat received

### Event Error Handling

**General Error Response:**
```json
{
  "status": "error",
  "message": "Descriptive error message"
}
```

**Common Errors:**
- "Authentication error: No token provided"
- "Authentication error: Invalid token"
- "Missing receiver_id or session_code"
- "Session not found or you are not the host"
- "Receiver not found or offline"
- "Pending invite already exists"

---

## Authentication System

### JWT Structure

**Access Token Payload:**
```json
{
  "playerId": 1,
  "playerTag": "3847",
  "displayName": "PlayerOne",
  "iat": 1234567890,
  "exp": 1234575890
}
```

**Refresh Token:**
- Stored as hash in `refresh_tokens` table
- Contains `playerId`, `tokenHash`, `expiresAt`
- Used to issue new access token without password

### Token Flow

```
1. User creates account or logs in
   ↓
2. Backend validates credentials
   ↓
3. Backend generates:
   - Access Token (2 hours) → return to client
   - Refresh Token (7 days) → store in database
   - Optional: Remember-Me Token (30 days)
   ↓
4. Client stores tokens (localStorage, etc)
   ↓
5. For each API request:
   - Send access token in Authorization header
   - Backend verifies token signature + expiry
   ↓
6. When access token expires:
   - Client sends refresh token to /player/refresh-token
   - Backend validates refresh token
   - Issues new access token
   ↓
7. On logout:
   - Client deletes local tokens
   - Backend marks refresh token as expired
```

### Security Measures

- **Password Hashing:** bcryptjs 12 rounds (100ms per hash)
- **Token Signing:** HS256 with `JWT_SECRET` from environment
- **HTTPS:** Recommended for production (enforce via proxy)
- **CORS:** Configurable via `CORS_ORIGINS` environment variable
- **Rate Limiting:** 
  - Account creation: 5 per 15 minutes per IP
  - Login: 10 per 15 minutes per IP
  - General: 100 per minute per IP
- **Admin Tokens:** Single-use, 15-minute expiry
- **Input Validation:** All inputs validated before database use

---

## Data Flow Diagrams

### Invite Creation & Acceptance Flow

```
SCENARIO: Player A sends invite to Player B

T0: Both players online and connected to WebSocket

T1: Player A sends invite
    ┌──────────────────────────────────────────┐
    │ HTTP POST /invite/send OR                │
    │ WebSocket emit('invite:send', {...})     │
    │ {                                        │
    │   receiver_id: 2,                        │
    │   session_code: "ABC123"                 │
    │ }                                        │
    └──────────────────────────────────────────┘
                      │
                      ↓
         Server validates request:
         • Receiver exists and online? ✓
         • Session exists and sender is host? ✓
         • No pending duplicate invite? ✓
                      │
                      ↓
    INSERT INTO invites (sender_id, receiver_id, session_code, status='pending', expires_at=NOW+120s)
                      │
                      ↓
         Send invite:send:success to Player A
         (HTTP response or WebSocket event)
                      │
                      ↓
    Check if Player B connected on WebSocket
         • Yes? → emit('invite:received', {...})
         • No? → stored in database, retrieved on next poll

T2: Player B receives real-time notification
    ┌──────────────────────────────────────────┐
    │ WebSocket event 'invite:received'        │
    │ {                                        │
    │   invite_id: 999,                        │
    │   sender_id: 1,                          │
    │   sender_name: "PlayerA3847",            │
    │   session_code: "ABC123",                │
    │   server_ip: "192.168.1.100",            │
    │   server_port: 7777,                     │
    │   expires_in: 120                        │
    │ }                                        │
    └──────────────────────────────────────────┘
                      │
          Player B can accept or decline

T3: Player B accepts invite
    ┌──────────────────────────────────────────┐
    │ HTTP POST /invite/respond OR             │
    │ WebSocket emit('invite:respond', {...})  │
    │ {                                        │
    │   invite_id: 999,                        │
    │   response: "accept"                     │
    │ }                                        │
    └──────────────────────────────────────────┘
                      │
                      ↓
         Server validates:
         • Invite exists and is receiver? ✓
         • Invite not expired? ✓
                      │
                      ↓
    UPDATE invites SET status='accepted' WHERE id=999
    UPDATE game_sessions SET current_players = current_players+1
    UPDATE game_servers SET current_player_count = current_player_count+1
                      │
                      ↓
         Send invite:respond:success to Player B
         Send invite:accepted to Player A
                      │
                      ↓
    Player B receives session details:
    {
      session_code: "ABC123",
      server: {ip: "192.168.1.100", port: 7777}
    }
    Player B connects to game server with session_code

T4: Both players in game session
    ┌────────────────────────────────────────┐
    │         Game Server                    │
    │  (Players exchange game data)          │
    │                                        │
    │  Players A & B exchanging:             │
    │  • Player position/rotation            │
    │  • Weapon actions                      │
    │  • Health/status updates               │
    │                                        │
    └────────────────────────────────────────┘
```

### Player Heartbeat & Cleanup Flow

```
BACKGROUND PROCESS: Continuous health tracking

Every 30 seconds:
┌─────────────────────────────────────────┐
│ Game client sends heartbeat via:        │
│ • HTTP: POST /player/heartbeat          │
│ • WebSocket: emit('heartbeat', {...})   │
│ {                                       │
│   game_open: true                       │
│ }                                       │
└─────────────────────────────────────────┘
          │
          ↓
UPDATE players SET last_heartbeat=NOW(), is_online=1, game_open=1
          │
          ↓
Emit 'heartbeat:ack' to client
          │
          ↓
Client continues...

---

Every 30 seconds (background cleanup):
┌─────────────────────────────────────────┐
│ Server checks for dead players:         │
│ • last_heartbeat < NOW() - 120 seconds? │
│ • is_online = 1 but no recent beat?     │
│                                         │
│ If true, mark as offline                │
└─────────────────────────────────────────┘
          │
          ↓
UPDATE players SET is_online=0 WHERE last_heartbeat < NOW()-120s AND is_online=1
          │
          ↓
For each offline player:
  1. Find their session(s)
  2. Remove them from session
  3. Decrement session player count
  4. If no players left: DELETE session
  5. If player was host: transfer host to another player or delete
  6. Update server player count
```

### Server Registration & Heartbeat Flow

```
T0: Game Server starts
    ┌────────────────────────────────────────┐
    │ Game Server (external process)         │
    │ • Running on 192.168.1.100:7777        │
    │ • Needs to register with backend       │
    └────────────────────────────────────────┘
                      │
                      ↓
T1: Server requests admin token
    Game App → Backend: GET /admin/generate-token
    (requires authenticated admin player)
                      │
                      ↓
    Backend response:
    {
      admin_token: "eyJhbGc...",
      expires_in: "15 minutes"
    }
                      │
                      ↓
T2: Server registers itself
    POST /server/auto-register
    X-Admin-Token: {admin_token}
    {
      server_name: "Server 1",
      ip_address: "192.168.1.100",
      port: 7777,
      max_players: 16
    }
                      │
                      ↓
    Backend validates admin token (must be valid admin)
    INSERT INTO game_servers (...)
                      │
                      ↓
    Response:
    {
      status: 'success',
      server_id: 1
    }
                      │
                      ↓
T3: Server sends heartbeat every 60 seconds
    POST /server/heartbeat
    {
      server_id: 1
    }
                      │
                      ↓
    UPDATE game_servers SET last_heartbeat=NOW(), is_available=1
                      │
                      ↓
    Response:
    {
      status: 'success',
      message: 'Heartbeat received'
    }
                      │
                      ↓
T4: If server stops sending heartbeats for 120+ seconds
    ┌─────────────────────────────────────┐
    │ Background cleanup (every 60s)       │
    │ UPDATE game_servers                  │
    │ SET is_available=0, current_player_count=0
    │ WHERE last_heartbeat < NOW()-120s    │
    └─────────────────────────────────────┘
          │
          ↓
    Server marked as unavailable
    • No new sessions assigned
    • Active sessions remain (client handles reconnect)
    • Admin can manually remove with /server/remove
```

---

## Key Features

### 1. Real-Time Notifications (WebSocket)
- Instant invite arrival notifications
- Live player online status updates
- Real-time heartbeat acknowledgments
- No polling needed for invites (push-based)

### 2. Automatic Cleanup
- Expired invites deleted after 120 seconds
- Offline players marked offline after 120+ seconds no heartbeat
- Empty sessions deleted automatically
- Dead servers marked unavailable after 120+ seconds no heartbeat
- Expired tokens cleaned up periodically

### 3. Session Management
- Automatic server assignment (load balancing)
- Host transfer if host disconnects
- Session cleanup if all players leave
- Prevents orphaned empty sessions

### 4. Friend System
- Friend requests with pending status
- Block list to prevent unwanted contact
- Accept/decline/remove operations
- View friends list

### 5. Rate Limiting
- Account creation: 5 per 15 minutes per IP
- Login: 10 per 15 minutes per IP
- General endpoints: 100 per minute per IP
- Prevents brute force and DoS attacks

### 6. Admin System
- Limited-use admin tokens (15 minutes)
- Server registration/removal
- Force player offline
- Requires database-level admin flag

### 7. Remember-Me Tokens
- 30-day persistent login tokens
- Silent re-login without password
- Hash-stored in database (secure)
- Automatic cleanup after expiry

---

## Configuration & Environment

### Required Environment Variables

```bash
# Database
DB_HOST=localhost
DB_USER=admin
DB_PASS=your_password
DB_NAME=game_invites_db
DB_PORT=3306

# Server
LOCAL_PORT=7777
SERVER_HOST=localhost
SERVER_PORT=7777
SERVER_URL=http://localhost:7777

# JWT
JWT_SECRET=your_super_secret_jwt_key

# Environment
NODE_ENV=development

# Optional CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:8080

# Database Health Check
ENABLE_DB_HEALTH=false

# WebSocket Debug
WS_DEBUG=false

# Cleanup Intervals & Timeouts (seconds)
SERVER_CLEANUP_INTERVAL_SECONDS=60
SERVER_HEARTBEAT_TIMEOUT_SECONDS=120
PLAYER_HEARTBEAT_TIMEOUT_SECONDS=120
PLAYER_CLEANUP_INTERVAL_SECONDS=30
```

### Configuration File (.env)

```bash
# Example .env file
DB_HOST=tidal-db.cvskckq2k2cl.us-east-2.rds.amazonaws.com
DB_USER=admin
DB_PASS=YourSecurePassword123
DB_NAME=tidal_hunters
DB_PORT=3306

LOCAL_PORT=7777
SERVER_HOST=yourdomain.com
SERVER_PORT=7777
SERVER_URL=https://yourdomain.com:7777

JWT_SECRET=your_very_long_and_secure_random_secret_key_here

NODE_ENV=production

CORS_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

ENABLE_DB_HEALTH=true
WS_DEBUG=false

SERVER_CLEANUP_INTERVAL_SECONDS=60
SERVER_HEARTBEAT_TIMEOUT_SECONDS=120
```

---

## Deployment Guide

### Prerequisites
- Node.js 16+ installed
- MySQL 5.7+ server accessible
- Admin access to register servers
- Port forwarding configured (if behind NAT)

### Local Development

```bash
# 1. Clone repository
git clone <repo-url>
cd game_invites_backend

# 2. Install dependencies
npm install

# 3. Create .env file
cp .env.example .env
# Edit .env with your database credentials

# 4. Run migrations
mysql -h DB_HOST -u DB_USER -p DB_NAME < server/migrations/001_add_heartbeat_columns.sql
mysql -h DB_HOST -u DB_USER -p DB_NAME < server/migrations/002_create_friendships_table.sql
mysql -h DB_HOST -u DB_USER -p DB_NAME < server/migrations/003_add_connected_at_column.sql

# 5. Start server
npm start

# 6. Server running on http://localhost:7777
```

### Production Deployment

```bash
# 1. Install PM2 (process manager)
npm install -g pm2

# 2. Deploy with PM2
pm2 start server/server.js --name "game-invites-backend"
pm2 startup
pm2 save

# 3. Check logs
pm2 logs game-invites-backend

# 4. Monitor
pm2 monit
```

### Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 7777

CMD ["node", "server/server.js"]
```

```bash
# Build and run
docker build -t game-invites-backend .
docker run -p 7777:7777 \
  -e DB_HOST=mysql \
  -e DB_USER=admin \
  -e DB_PASS=password \
  -e DB_NAME=game_invites_db \
  -e JWT_SECRET=your_secret \
  game-invites-backend
```

### Health Checks

```bash
# Check server health
curl http://localhost:7777/health

# Response:
# {
#   "server": "ok",
#   "uptime_seconds": 3600,
#   "timestamp": 1234567890
# }

# With database check
curl http://localhost:7777/health?db=true
```

### Monitoring

**Key Metrics to Monitor:**
- Server uptime (process health)
- Database connection pool utilization
- WebSocket connected clients
- API response times
- Active game sessions
- Invite creation/acceptance rate
- Player heartbeat frequency

**Recommended Tools:**
- PM2 (process monitoring)
- CloudWatch (AWS)
- Prometheus + Grafana
- ELK Stack (logging)
- New Relic (APM)

---

## Troubleshooting

### Common Issues

**1. Database Connection Failed**
```
Error: connect ECONNREFUSED 127.0.0.1:3306
```
- Check MySQL service running
- Verify DB_HOST, DB_USER, DB_PASS, DB_NAME in .env
- Check database network accessibility

**2. JWT Verification Failed**
```
Error: Invalid or expired token
```
- Ensure JWT_SECRET is consistent across server restarts
- Access tokens expire after 2 hours (use refresh token)
- Check client is sending Bearer token in Authorization header

**3. Players Not Marked Online**
```
Player marked offline despite heartbeats
```
- Check heartbeat endpoint being called
- Verify PLAYER_HEARTBEAT_TIMEOUT_SECONDS is sufficient (default 120s)
- Check last_heartbeat column is updating in database

**4. WebSocket Connection Refused**
```
WebSocket connection failed
```
- Ensure Socket.IO initialized properly
- Check CORS_ORIGINS configuration
- Verify client sending valid JWT token
- Check WS_DEBUG=true for detailed logs

**5. Invite Not Received**
```
Invite created but receiver doesn't see it
```
- If receiver online: WebSocket 'invite:received' should fire
- If receiver offline: stored in database, retrieved on next poll
- Check invite not expired (2-minute window)
- Verify receiver is actually online (is_online = 1)

---

## Additional Resources

- [API Reference](./API_REFERENCE.md)
- [Getting Started](./GETTING_STARTED.md)
- [WebSocket Guide](./WEBSOCKET_SUMMARY.md)
- [Friends System](./FRIENDS_SYSTEM.md)
- [Deployment Checklist](./DEPLOYMENT_GUIDE.md)

---

**Support:** Contact development team for issues or questions.

**Last Updated:** January 20, 2026
