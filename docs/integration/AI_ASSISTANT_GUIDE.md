````markdown
# Game Invites Backend - AI System Documentation

**Purpose:** This document provides a complete overview of the backend system's functionality, architecture, and setup for AI assistants (DeepSeek, ChatGPT, Claude, etc.) to help you configure and troubleshoot the system.

**Document Version:** 1.0  
**Backend Type:** Node.js + Express + MySQL  
**Status:** Production-Ready

---

## Table of Contents
1. [System Overview](#system-overview)
2. [Core Architecture](#core-architecture)
3. [Complete Feature List](#complete-feature-list)
4. [Data Models](#data-models)
5. [Authentication System](#authentication-system)
6. [API Endpoints (21 Total)](#api-endpoints-21-total)
7. [File Structure](#file-structure)
8. [Key Implementation Details](#key-implementation-details)
9. [Setup Instructions](#setup-instructions)
10. [Deployment Checklist](#deployment-checklist)

---

## System Overview

### What This Backend Does
This is a **game session matchmaking and invite system** for a multiplayer game (Unity). It allows players to:
- Create accounts and authenticate
- See online players
- Send/receive game session invites with auto-expiry
- Join multiplayer game sessions on game servers
- Manage persistent login (remember-me tokens)
- Admin control over game servers

### Technology Stack
- **Runtime:** Node.js (v16+)
- **Framework:** Express 5.1.0
- **Database:** MySQL (with connection pooling)
- **Authentication:** JWT (jsonwebtoken 9.0.2)
- **Hashing:** bcryptjs 3.0.2 (12 rounds)
- **Token Generation:** Node crypto module
- **Rate Limiting:** express-rate-limit
- **Input Validation:** express-validator
- **Port:** 41043
- **Database:** tidal_hunters (MySQL)

### Key Statistics
- **21 REST API endpoints** (12 public, 6 protected, 3 admin)
- **5 controller files** (16 total functions)
- **3 service files** (14 total functions)
- **4 middleware files** (4 implementations)
- **3-tier token system** (Access JWT / Refresh token / Remember token)
- **2-minute invite expiry** (auto-cleanup)
- **Zero hardcoded secrets** (all in .env)

---

## Core Architecture

### 3-Tier Token System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    TOKEN ARCHITECTURE                    │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  TIER 1: ACCESS TOKEN (JWT)                             │
│  ├─ Type: JSON Web Token                                │
│  ├─ Expiry: 2 hours                                     │
│  ├─ Storage: Client-side (stateless)                    │
│  ├─ Usage: All API calls (header: Authorization)        │
│  ├─ When Expires: Refresh with TIER 2                   │
│  └─ Payload: player_id, display_name, player_tag        │
│                                                           │
│  TIER 2: REFRESH TOKEN (Random + Hashed)                │
│  ├─ Type: 40-byte random string                         │
│  ├─ Storage: Database (bcrypt hashed)                   │
│  ├─ Expiry: 7 days                                      │
│  ├─ Usage: Exchange for new access token                │
│  ├─ When Expires: Player must re-login with password    │
│  └─ Per-player: One stored per player (revoked on new)  │
│                                                           │
│  TIER 3: REMEMBER TOKEN (Random + Hashed)               │
│  ├─ Type: 48-byte random string                         │
│  ├─ Storage: Database (bcrypt hashed, remember_tokens)  │
│  ├─ Expiry: 30 days                                     │
│  ├─ Usage: Passwordless login on app restart            │
│  ├─ When Expires: Player must re-login with password    │
│  ├─ Per-device: Multiple tokens per player              │
│  └─ Feature: Per-device revocation supported            │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### Request Flow Diagram

```
CLIENT REQUEST
       │
       ├─→ [Middleware: CORS, JSON Parse]
       │
       ├─→ [Check Route Type]
       │   ├─ PUBLIC: /account/create, /account/login, /players, /player/lookup
       │   ├─ PROTECTED: Requires valid JWT access token (authMiddleware)
       │   └─ ADMIN: Requires JWT + admin token + is_admin=1 (adminAuthMiddleware)
       │
       ├─→ [Validate Input]
       │   └─ express-validator rules applied
       │
       ├─→ [Execute Controller]
       │   ├─ authController.js - Authentication flows
       │   ├─ playerController.js - Player lookups
       │   ├─ inviteController.js - Invite management
       │   ├─ sessionController.js - Session operations
       │   └─ serverController.js - Admin server management
       │
       ├─→ [Service Layer]
       │   ├─ tokenService - Token operations (generate, verify, cleanup)
       │   ├─ sessionService - Session logic
       │   └─ serverService - Server operations
       │
       ├─→ [Database Query]
       │   └─ MySQL connection pool executes query
       │
       └─→ JSON RESPONSE (with proper status codes)
```

### Database Connections

```
Node.js App
    ↓
Database Connection Pool (10 connections)
    ↓
MySQL Database: tidal_hunters
    ├─ players table
    ├─ refresh_tokens table
    ├─ remember_tokens table (NEW)
    ├─ game_sessions table
    ├─ invites table
    ├─ game_servers table
    └─ admin_tokens table
```

---

## Complete Feature List

### Authentication Features
✅ **Account Creation**
- Display name (2-20 chars)
- Player tag (#XXXX format, 3-6 chars after #)
- Email address
- Password (min 8 chars, bcrypt hashed with 12 rounds)
- Duplicate prevention (display_name#player_tag unique key)

✅ **Login**
- Password validation via bcrypt.compare()
- JWT access token generation (2h expiry)
- Refresh token generation (40-byte random, hashed, 7d expiry)
- Remember token generation (48-byte random, hashed, 30d expiry) - Optional
- Server allocation (assigns to available game server)
- Returns: access token, refresh token, remember token, server info

✅ **Token Management**
- Access token refresh (use refresh token to get new access token)
- Token expiry cleanup (automatic hourly for expired tokens)
- Per-device token revocation (delete specific remember token)
- Global logout (delete all tokens for player)

✅ **Passwordless Login (Remember-Me)**
- Exchange remember_token for new access+refresh tokens
- 30-day persistent login
- Per-device support (multiple remember tokens per player)
- Auto-expire after 30 days

✅ **Admin Authentication**
- Dual-gate system: Account flag (is_admin=1) + valid admin token (15-min expiry)
- Admin token generation on verification
- Automatic token cleanup after expiry

### Player Features
✅ **Player Lookup**
- Get all online players
- Search player by display_name + player_tag
- Optional exclude parameter (exclude self from list)

✅ **Session Management**
- Player online status tracking
- Server allocation tracking
- Player disconnect handling
- Session cleanup on disconnect

### Invite System Features
✅ **Send Invites**
- Send to online players only
- 2-minute auto-expiry
- Prevent duplicate pending invites
- Include game session code
- Automatic cleanup of expired invites

✅ **Receive Invites**
- Check pending invites for player
- List invites with sender info
- Auto-filter expired invites

✅ **Respond to Invites**
- Accept invite (transfer to game session)
- Decline invite (remove from list)
- Prevent accepting expired invites

### Game Server Features
✅ **Server Registration** (Admin only)
- Register new game server with IP, port, max players
- Server availability tracking

✅ **Server Management** (Admin only)
- Update server status
- Update session count
- Remove server from pool

✅ **Server Allocation**
- Auto-assign players to least-loaded server
- Return server IP and port in responses
- Handle "no servers available" error (503)

### Rate Limiting Features
✅ **Three-Level Rate Limiting**
- **Level 1:** Login attempts - 5 per 15 minutes per IP
- **Level 2:** Invite operations - 20 per 15 minutes per IP
- **Level 3:** General requests - 100 per 15 minutes per IP
- **Admin requests:** 50 per 15 minutes per IP
- **Error:** 429 Too Many Requests

---

## Data Models

### Players Table
```sql
CREATE TABLE players (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  display_name VARCHAR(20) NOT NULL,
  player_tag VARCHAR(7) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  is_online BOOLEAN DEFAULT FALSE,
  current_server_id BIGINT,
  current_session_code VARCHAR(11),
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_player_tag (display_name, player_tag),
  FOREIGN KEY (current_server_id) REFERENCES game_servers(id)
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
  INDEX (player_id, expires_at)
);
```

### Remember Tokens Table (NEW)
```sql
CREATE TABLE remember_tokens (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  player_id BIGINT NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  INDEX (player_id, expires_at),
  INDEX (expires_at)
);
```

### Game Sessions Table
```sql
CREATE TABLE game_sessions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  session_code VARCHAR(11) NOT NULL UNIQUE,
  server_id BIGINT NOT NULL,
  creator_id BIGINT NOT NULL,
  game_mode VARCHAR(50),
  max_players INT DEFAULT 4,
  current_players INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  FOREIGN KEY (server_id) REFERENCES game_servers(id),
  FOREIGN KEY (creator_id) REFERENCES players(id),
  INDEX (session_code, expires_at)
);
```

### Invites Table
```sql
CREATE TABLE invites (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  sender_id BIGINT NOT NULL,
  receiver_id BIGINT NOT NULL,
  session_code VARCHAR(11) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  FOREIGN KEY (sender_id) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES players(id) ON DELETE CASCADE,
  UNIQUE KEY unique_pending_invite (sender_id, receiver_id, session_code),
  INDEX (receiver_id, expires_at)
);
```

### Game Servers Table
```sql
CREATE TABLE game_servers (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  server_name VARCHAR(100) NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  port INT NOT NULL,
  max_players INT NOT NULL DEFAULT 16,
  current_sessions INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'online',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_server (ip_address, port)
);
```

### Admin Tokens Table
```sql
CREATE TABLE admin_tokens (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  player_id BIGINT NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  INDEX (player_id, expires_at)
);
```

---

## Authentication System

### Login Flow (Detailed)
```
1. Player sends: display_name, player_tag, password, remember_me (boolean)
2. Backend validates input (display_name length, tag format, password strength)
3. Query database for player by display_name + player_tag
   - If not found: Return 404
   - If found: Continue to step 4
4. Compare provided password with stored password_hash using bcrypt.compare()
   - If mismatch: Return 401 Unauthorized
   - If match: Continue to step 5
5. Mark player as online (is_online = true)
6. Find available game server (lowest current_sessions)
   - If none available: Return 503 Service Unavailable
   - If found: Continue to step 7
7. Allocate player to server (store server_id in players.current_server_id)
8. Generate tokens:
   a) Access Token: JWT with payload {player_id, display_name, player_tag}, 2h expiry
   b) Refresh Token: 40-byte crypto.randomBytes(), hash with bcrypt, store in DB, 7d expiry
   c) Remember Token (if remember_me=true): 48-byte crypto.randomBytes(), hash with bcrypt, store in DB, 30d expiry
9. Return 200 with: token, refresh_token, remember_token, server.ip, server.port

Response Example:
{
  "status": "success",
  "player_id": 123,
  "session_code": "ABC-123-DEF",
  "token": "eyJhbGc...",
  "refresh_token": "50_byte_random_hash",
  "remember_token": "48_byte_random_hash",
  "token_expires_in": "2h",
  "refresh_token_expires_in": "7d",
  "server": { "ip": "game-server.com", "port": 5050 }
}
```

### Token Refresh Flow
```
1. Player sends: refresh_token, player_id
2. Query database for refresh_token_hash matching player_id
   - If not found: Return 401 Unauthorized
   - If found: Continue to step 3
3. Use bcrypt.compare() to verify token against stored hash
   - If mismatch: Return 401 Unauthorized
   - If match: Check expiry
4. If expired: Return 401 Unauthorized
5. If valid: Generate new access token (JWT, 2h expiry)
6. Return 200 with: token, token_expires_in

Response Example:
{
  "status": "success",
  "token": "eyJhbGc...",
  "token_expires_in": "2h"
}
```

### Remember Login Flow (Passwordless)
```
1. Player sends: player_id, remember_token
2. Query database for remember_token_hash matching player_id in remember_tokens table
   - If not found: Return 401 Unauthorized
   - If found: Continue to step 3
3. Use bcrypt.compare() to verify token against stored hash
   - If mismatch: Return 401 Unauthorized
   - If match: Check expiry
4. If expired: Return 401 Unauthorized
5. If valid:
   a) Generate new access token (JWT, 2h expiry)
   b) Generate new refresh token (40-byte random, hashed, 7d expiry)
   c) Mark player online
   d) Allocate to available server
6. Return 200 with: token, refresh_token, server info

Response Example:
{
  "status": "success",
  "player_id": 123,
  "token": "eyJhbGc...",
  "refresh_token": "50_byte_random_hash",
  "server": { "ip": "game-server.com", "port": 5050 }
}
```

### Logout Flow
```
1. Player sends: Authorization header with access token + optional remember_token in body
2. Verify access token is valid (JWT, not expired)
   - If invalid: Return 401 Unauthorized
3. Determine logout type:
   a) Global logout (no remember_token in body):
      - Delete ALL refresh_tokens for this player_id
      - Delete ALL remember_tokens for this player_id
      - Mark player offline (is_online = false)
      - Return 200 success
   
   b) Per-device logout (remember_token in body):
      - Use bcrypt.compare() to find matching remember_token_hash
      - Delete ONLY that specific remember_token
      - Keep player online (may still be logged in on other devices)
      - Return 200 success

Response Example:
{
  "status": "success",
  "message": "Logged out"
}
```

---

## API Endpoints (21 Total)

### Category: Authentication (5 endpoints)

**1. POST /account/create**
- Public endpoint
- No auth required
- Input: display_name, player_tag, email, password
- Validation: Name 2-20 chars, tag #XXXX, password 8+ chars
- Creates player with bcrypt hashed password
- Error codes: 400 (validation), 409 (duplicate), 201 (success)
- Response: player_id, status message

**2. POST /account/login**
- Public endpoint
- No auth required
- Input: display_name, player_tag, password, remember_me (boolean)
- Process: Password validation → Token generation → Server allocation
- Error codes: 401 (wrong password), 404 (player not found), 503 (no servers), 200 (success)
- Response: All tokens, server IP/port, session code

**3. POST /player/remember-login**
- Public endpoint
- No auth required
- Input: player_id, remember_token
- Process: Token validation → New tokens generation → Server allocation
- Error codes: 401 (invalid/expired token), 404 (player not found), 200 (success)
- Response: Access token, refresh token, server IP/port

**4. POST /player/refresh-token**
- Public endpoint
- No auth required
- Input: refresh_token, player_id
- Process: Token validation and expiry check
- Error codes: 401 (invalid/expired), 404 (player not found), 200 (success)
- Response: New access token, expiry time

**5. POST /player/logout**
- Protected endpoint (requires access token)
- Input: Optional remember_token in body
- Process: If remember_token provided: delete specific token; If not: delete all tokens
- Error codes: 401 (invalid token), 200 (success)
- Response: Success message

### Category: Player Management (2 endpoints)

**6. GET /players**
- Public endpoint
- No auth required
- Query params: exclude_player_id (optional)
- Returns: Array of all online players with id, display_name, player_tag
- Error codes: 200 (success)

**7. GET /player/lookup**
- Public endpoint
- No auth required
- Query params: display_name, player_tag
- Returns: Player info including is_online status
- Error codes: 200 (found), 404 (not found)

### Category: Player Session (2 endpoints)

**8. POST /session/create**
- Protected endpoint (requires access token)
- Input: server_id, game_mode, max_players
- Process: Create session on server, generate session_code
- Returns: session_code, server IP/port
- Error codes: 401 (invalid token), 503 (no servers), 201 (success)

**9. POST /player/disconnect**
- Protected endpoint (requires access token)
- Input: None
- Process: Mark player offline, cleanup session
- Returns: Success message
- Error codes: 401 (invalid token), 200 (success)

### Category: Invites (3 endpoints)

**10. POST /invite/send**
- Protected endpoint (requires access token)
- Input: receiver_id, session_code
- Validation: Receiver must be online, no duplicate pending invite
- Process: Create invite record with 2-minute expiry
- Error codes: 401 (invalid token), 404 (receiver not found), 409 (duplicate invite), 201 (success)
- Response: invite_id, session_code, expires_in seconds

**11. GET /invite/check/:player_id**
- Protected endpoint (requires access token)
- Returns: Array of non-expired invites for player with sender_name, session_code, expiry
- Error codes: 401 (invalid token), 200 (success)

**12. POST /invite/respond**
- Protected endpoint (requires access token)
- Input: invite_id, response ("accept" or "decline")
- Validation: Invite must not be expired
- If accept: Transfer player to session, return server info
- If decline: Delete invite record
- Error codes: 401 (invalid token), 404 (invite not found), 410 (expired), 200 (success)

### Category: Admin - Server Management (3 endpoints)

**13. POST /server/register**
- Admin endpoint (requires access token + admin_token)
- Input: server_name, ip, port, max_players
- Process: Create game_server record
- Error codes: 401 (invalid token), 403 (not admin or admin token expired), 201 (success)
- Response: server_id

**14. POST /server/update-status**
- Admin endpoint (requires access token + admin_token)
- Input: server_id, status, current_sessions
- Process: Update server status and session count
- Error codes: 401 (invalid token), 403 (not admin), 200 (success)

**15. POST /server/remove**
- Admin endpoint (requires access token + admin_token)
- Input: server_id
- Process: Delete server record and cascade cleanup
- Error codes: 401 (invalid token), 403 (not admin), 404 (server not found), 200 (success)

### Category: Session Management (3 endpoints)

**16. POST /session/join**
- Protected endpoint (requires access token)
- Input: session_code
- Process: Add player to existing session
- Error codes: 401 (invalid token), 404 (session not found), 410 (session full), 200 (success)

**17. GET /session/:session_code**
- Protected endpoint (requires access token)
- Returns: Session info, player count, server info
- Error codes: 401 (invalid token), 404 (not found), 200 (success)

**18. POST /session/leave**
- Protected endpoint (requires access token)
- Input: session_code
- Process: Remove player from session
- Error codes: 401 (invalid token), 404 (session not found), 200 (success)

### Category: Admin - Player Management (3 endpoints)

**19. POST /admin/player/promote**
- Admin endpoint (requires access token + admin_token)
- Input: player_id
- Process: Set is_admin=true for player
- Error codes: 401 (invalid token), 403 (not admin), 404 (player not found), 200 (success)

**20. POST /admin/player/demote**
- Admin endpoint (requires access token + admin_token)
- Input: player_id
- Process: Set is_admin=false and revoke admin_token
- Error codes: 401 (invalid token), 403 (not admin), 404 (player not found), 200 (success)

**21. GET /admin/players**
- Admin endpoint (requires access token + admin_token)
- Returns: All players with full info (id, name, tag, online status, is_admin, created_at)
- Error codes: 401 (invalid token), 403 (not admin), 200 (success)

---

## File Structure

```
server/
├── server.js                    # Main Express app, routes definition, cleanup intervals
├── package.json                 # Dependencies, scripts
├── .env                         # Environment variables (NOT in git)
│
├── config/
│   ├── database.js              # MySQL connection pool (reads from .env)
│   └── jwt.js                   # JWT configuration (secret, algorithms)
│
├── controllers/                 # Business logic for each feature
│   ├── authController.js        # 10 functions: create, login, refresh, logout, remember login, etc.
│   ├── playerController.js      # 2 functions: getPlayers, lookupPlayer
│   ├── inviteController.js      # 3 functions: sendInvite, checkInvites, respondToInvite
│   ├── sessionController.js     # 1 function: disconnectPlayer
│   └── serverController.js      # 5 functions: register, update, remove, list, allocate
│
├── services/                    # Helper functions, reusable logic
│   ├── tokenService.js          # 8 functions: generate tokens, verify, delete, cleanup
│   ├── sessionService.js        # 3 functions: create, get, delete session
│   └── serverService.js         # 3 functions: allocate, update, get available
│
├── middleware/                  # Request processing pipeline
│   ├── auth.js                  # JWT validation middleware
│   ├── adminAuth.js             # Dual-gate admin validation (is_admin flag + token)
│   ├── rateLimit.js             # Three-level rate limiting by IP
│   └── validation.js            # Input validation rules
│
└── utils/
    └── generators.js            # Session code generation (ABC-123-DEF format)
```

### Controller Functions (16 Total)

**authController.js (10 functions)**
1. createAccount() - Account creation with validation
2. login() - Password auth + token generation + server allocation
3. handlePlayerSession() - Helper to set player online + allocate server
4. completePlayerConnection() - Helper to generate tokens
5. refreshAccessToken() - Exchange refresh token for new access token
6. rememberLogin() - Passwordless login with remember token
7. logout() - Global or per-device logout
8. deleteRememberTokenByToken() - Helper for per-device token deletion
9. playerConnect() - Alias for login flow
10. validateToken() - Check if token is valid (helper)

**playerController.js (2 functions)**
1. getPlayers() - Return all online players
2. lookupPlayer() - Find player by display_name + player_tag

**inviteController.js (3 functions)**
1. sendInvite() - Create invite with 2-minute expiry
2. checkInvites() - Get pending invites, filter expired
3. respondToInvite() - Accept/decline invite

**sessionController.js (1 function)**
1. disconnectPlayer() - Mark offline, cleanup

**serverController.js (5 functions)**
1. registerServer() - Create game server record
2. updateServerStatus() - Update status and session count
3. removeServer() - Delete server
4. listServers() - Get all servers (admin)
5. allocateServer() - Find least-loaded server

### Service Functions (14 Total)

**tokenService.js (8 functions)**
1. generateAccessToken() - Create JWT (2h expiry)
2. generateRefreshToken() - Create 40-byte random, hash, store in DB (7d expiry)
3. verifyAccessToken() - Validate JWT signature and expiry
4. verifyRefreshToken() - Check refresh token against hash in DB
5. generateRememberToken() - Create 48-byte random, hash, store in DB (30d expiry)
6. verifyRememberToken() - Check remember token against hash in DB
7. deleteRememberTokensForPlayer() - Delete all tokens for player
8. cleanupExpiredRememberTokens() - Periodic cleanup of expired tokens (called hourly)

**sessionService.js (3 functions)**
1. createSession() - Generate session_code, create record, return info
2. getSessionByCode() - Retrieve session from DB
3. deleteSession() - Remove session record

**serverService.js (3 functions)**
1. getAllServers() - Get list of all servers
2. allocateServer() - Find server with lowest current_sessions
3. updateServerStatus() - Update session count for server

### Middleware Functions (4 Total)

**auth.js (1 function)**
1. verifyToken() - Check Authorization header for Bearer token, validate JWT

**adminAuth.js (1 function)**
1. verifyAdminToken() - Dual gate: Check is_admin flag in DB + validate admin token

**rateLimit.js (1 function)**
1. Apply three-level rate limiting per IP address

**validation.js (1 function)**
1. Apply express-validator rules to sanitize and validate inputs

---

## Key Implementation Details

### Password Hashing Strategy
- **Algorithm:** bcryptjs with 12 rounds
- **Storage:** password_hash column in players table
- **Process:**
  1. User provides password during account creation
  2. Backend: `bcrypt.hash(password, 12)` → password_hash
  3. Store password_hash in database (never store plain password)
  4. During login: `bcrypt.compare(providedPassword, storedHash)` → boolean

### Token Hashing Strategy
- **Why hash tokens?** Even if database is compromised, tokens remain secret
- **Algorithm:** bcryptjs with 12 rounds
- **Storage:** token_hash column in refresh_tokens and remember_tokens tables
- **Process:**
  1. Generate: `crypto.randomBytes(40)` or `crypto.randomBytes(48)`
  2. Hash: `bcrypt.hash(token, 12)` → token_hash
  3. Store token_hash in database
  4. Send plain token to client (only once)
  5. Client stores token
  6. During verification: `bcrypt.compare(clientToken, storedHash)`

### Session Code Generation
- **Format:** ABC-123-DEF (11 characters total)
- **Pattern:** 3 random letters - 3 random digits - 3 random letters
- **Generation:** utilities/generators.js → generateSessionCode()
- **Storage:** game_sessions table
- **Uniqueness:** Unique constraint in database (very low collision chance with proper randomness)

### Database Connection Pooling
- **Pool Size:** 10 connections
- **Benefits:** Reuse connections, better performance under load
- **Configuration:** config/database.js
- **Usage:** Pass pool to all database queries

### Automatic Cleanup Tasks

**1. Token Expiry Cleanup**
- **Trigger:** Every 1 hour (setInterval in server.js)
- **Action:** Delete all records from remember_tokens where expires_at < NOW()
- **Reason:** Prevent table bloat from expired tokens

**2. Invite Expiry Cleanup**
- **Trigger:** When checking invites (GET /invite/check/:player_id)
- **Action:** Filter out invites where expires_at < NOW()
- **Reason:** Auto-remove expired invites from response (implicit cleanup)

### Rate Limiting Implementation

**Three-Level System:**
```
Level 1 - Login Attempts:
├─ Endpoint: /account/login, /account/create
├─ Limit: 5 requests per 15 minutes per IP
├─ Error: 429 Too Many Requests
└─ Reason: Prevent brute force attacks

Level 2 - Invite Operations:
├─ Endpoint: /invite/send, /invite/respond
├─ Limit: 20 requests per 15 minutes per IP
├─ Error: 429 Too Many Requests
└─ Reason: Prevent spam invites

Level 3 - General Requests:
├─ Endpoint: All other endpoints
├─ Limit: 100 requests per 15 minutes per IP
├─ Error: 429 Too Many Requests
└─ Reason: Prevent abuse and DoS
```

### Error Response Format
```json
{
  "status": "error",
  "message": "Human-readable error message",
  "code": 401
}
```

**Standard Error Codes:**
- 200 - OK
- 201 - Created
- 400 - Bad Request (validation failed)
- 401 - Unauthorized (invalid/expired token)
- 403 - Forbidden (not admin or admin token expired)
- 404 - Not Found (resource doesn't exist)
- 409 - Conflict (duplicate entry)
- 429 - Too Many Requests (rate limited)
- 500 - Internal Server Error
- 503 - Service Unavailable (no game servers)

---

## Setup Instructions

### Prerequisites
- Node.js v16+ installed
- MySQL 5.7+ installed and running
- npm or yarn package manager

### Step-by-Step Setup

**1. Clone/Extract Backend Folder**
```
C:\Users\rapto\OneDrive\Desktop\game_invites_backend\
```

**2. Install Dependencies**
```bash
cd server
npm install
```

**3. Create .env File**
Create `server/.env` with:
```
# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=tidal_hunters

# JWT
JWT_SECRET=your_64_char_hex_secret_here
JWT_EXPIRY=2h

# Refresh Token
REFRESH_TOKEN_EXPIRY=7d

# Remember Token
REMEMBER_TOKEN_EXPIRY=30d

# Admin
ADMIN_SECRET=your_64_char_hex_secret_here
ADMIN_TOKEN_EXPIRY=15m

# Server
PORT=41043
NODE_ENV=production
```

**4. Create MySQL Database**
```sql
CREATE DATABASE tidal_hunters;
USE tidal_hunters;

-- Run all CREATE TABLE statements from Data Models section above
```

**5. Create Remember Tokens Table (if not exists)**
```sql
CREATE TABLE remember_tokens (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  player_id BIGINT NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  INDEX (player_id, expires_at),
  INDEX (expires_at)
);
```

**6. Start Server**
```bash
node server.js
```

**Expected Output:**
```
Server running on port 41043
Database connected
Cleanup interval started (every 1 hour)
Ready for requests
```

**7. Verify Setup**
```bash
# Test public endpoint
curl http://localhost:41043/players

# Should return JSON with empty or existing players array
```

---

## Deployment Checklist

### Pre-Deployment
- [ ] All dependencies installed (`npm install`)
- [ ] .env file created with production values
- [ ] Database created and tables initialized
- [ ] Remember tokens table migration applied
- [ ] All 21 endpoints tested locally
- [ ] Environment variables in .env (not hardcoded)
- [ ] JWT_SECRET and ADMIN_SECRET are 64-character random hex strings
- [ ] Database credentials are strong and in .env only

### Deployment
- [ ] Backend code deployed to production server
- [ ] .env copied to production (with production values)
- [ ] Database connection verified from production server
- [ ] npm install run on production server
- [ ] Node process started (use PM2 or similar for auto-restart)
- [ ] HTTPS configured (reverse proxy with SSL, not plaintext HTTP)
- [ ] Firewall rules allow port 41043 from game clients
- [ ] Database backups configured

### Post-Deployment
- [ ] Test login from Unity game client
- [ ] Test account creation
- [ ] Test remember-me login
- [ ] Test invite system
- [ ] Test per-device logout
- [ ] Monitor server logs for errors
- [ ] Monitor database performance
- [ ] Set up alerts for high error rates
- [ ] Verify rate limiting is working (test with multiple requests)

### Production Hardening
- [ ] HTTPS enabled (never use HTTP for tokens)
- [ ] CORS configured to allow only game client domains
- [ ] Database user has limited permissions (not root)
- [ ] Backups automated and tested
- [ ] Monitoring and alerting configured
- [ ] SSL certificate renewed before expiry
- [ ] Regular security updates applied
- [ ] Database passwords rotated periodically

---

## Common AI Assistant Questions This Document Answers

### "What does this backend do?"
→ See: System Overview section

### "How does authentication work?"
→ See: Authentication System section + 3-Tier Token System Architecture

### "What are all the API endpoints?"
→ See: API Endpoints (21 Total) section

### "How do I set it up?"
→ See: Setup Instructions section

### "What's the database schema?"
→ See: Data Models section

### "How are tokens managed?"
→ See: Authentication System + Key Implementation Details

### "What are the error codes?"
→ See: Key Implementation Details → Error Response Format

### "How do I deploy this?"
→ See: Deployment Checklist section

### "What are the rate limits?"
→ See: Key Implementation Details → Rate Limiting Implementation

### "How does the remember-me feature work?"
→ See: Core Architecture → 3-Tier Token System

### "What middleware is applied?"
→ See: File Structure → Middleware Functions

### "How do tokens expire and get cleaned up?"
→ See: Key Implementation Details → Automatic Cleanup Tasks

### "What's the folder structure?"
→ See: File Structure section

### "How are passwords hashed?"
→ See: Key Implementation Details → Password Hashing Strategy

### "How are tokens stored securely?"
→ See: Key Implementation Details → Token Hashing Strategy

### "What invites expire?"
→ See: Complete Feature List → Invite System Features (2-minute auto-expiry)

### "How does per-device logout work?"
→ See: Authentication System → Logout Flow (steps 3b)

### "What's the server allocation algorithm?"
→ See: Complete Feature List → Game Server Features (least-loaded server)

---

## Quick Reference Commands

### For AI Assistant to Help You

When asking DeepSeek, ChatGPT, or Claude for help, provide this context:

**Example Prompt:**
```
I'm setting up a Node.js backend for a multiplayer game. Here's my system documentation:
[Paste content from this file]

Help me with: [YOUR SPECIFIC QUESTION]

Current issue: [DESCRIBE YOUR PROBLEM]
```

### Example Questions to Ask AI

1. **"I'm getting a 503 error when logging in. Based on this system, what should I check?"**
   → AI will know: Server allocation happens on login, means no available game servers

2. **"How do I debug why token refresh isn't working?"**
   → AI will know: Refresh token is hashed in DB, needs bcrypt.compare(), stored with 7-day expiry

3. **"I need to add a feature to ban players. Where in the system should this go?"**
   → AI will know: Could add is_banned flag to players table, check in login flow

4. **"Help me optimize database queries for 1000 concurrent players."**
   → AI will know: Connection pooling (10), rate limiting, index structure on token tables

5. **"I need to implement server health checks. How does this fit?"**
   → AI will know: serverService.js handles allocation, could add health check before allocation

6. **"Our game servers are getting overloaded. How can I load balance?"**
   → AI will know: allocateServer() finds least-loaded, could improve algorithm or add server weight

---

## Support Information

### If You Encounter Issues

**Token-related problems:**
- Refer to: Authentication System section
- Check: .env file has correct JWT_SECRET, ADMIN_SECRET
- Verify: Token expiry times in backend match client expectations

**Database problems:**
- Refer to: Data Models section
- Check: Database connection pooling in config/database.js
- Verify: All tables exist and have correct indexes

**Deployment problems:**
- Refer to: Deployment Checklist section
- Check: Port 41043 is open and accessible
- Verify: HTTPS is configured

**Rate limiting issues:**
- Refer to: Key Implementation Details → Rate Limiting Implementation
- Check: Same IP not making too many requests
- Verify: Rate limit reset timer (15 minutes per bucket)

---

## Document Information

**Last Updated:** October 19, 2025  
**Prepared For:** AI Assistants (DeepSeek, ChatGPT, Claude, etc.)  
**System Status:** Production-Ready  
**Total Endpoints:** 21  
**Total Functions:** 30+  
**Database Tables:** 7  
**Token Types:** 3 (Access JWT, Refresh, Remember)

**To Use With AI:**
1. Copy this entire document
2. Paste into AI chat along with your specific question
3. Ask AI to reference specific sections for context
4. AI now has full system knowledge without seeing source code

---

This document provides comprehensive system knowledge for any AI assistant to help you set up, deploy, and troubleshoot your backend without requiring access to the actual source code.


````