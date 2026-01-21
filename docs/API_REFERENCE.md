# Complete API Reference

**Game Invites Backend API**  
**Base URL:** `http://localhost:41043` (or your domain)  
**All authenticated endpoints require:** `Authorization: Bearer <access_token>` header

---

## Table of Contents
1. [Account Management](#account-management)
2. [Authentication](#authentication)
3. [Player Management](#player-management)
4. [Game Invites](#game-invites)
5. [Game Sessions](#game-sessions)
6. [Server Management](#server-management)
7. [Admin Operations](#admin-operations)
8. [Error Codes](#error-codes)

---

## Account Management

### Create Account
**Endpoint:** `POST /account/create`  
**Auth:** None  
**Rate Limit:** 3 per IP per hour

**Request:**
```json
{
  "display_name": "PlayerName",
  "player_tag": "#0001",
  "email": "player@example.com",
  "password": "SecurePass123"
}
```

**Validation:**
- display_name: 2-20 chars, alphanumeric + underscores
- player_tag: # + 3-6 uppercase alphanumeric
- email: valid email format
- password: 8+ chars, uppercase, lowercase, digit

**Response (Success):**
```json
{
  "status": "success",
  "player_id": 42,
  "message": "Account created successfully. Please login."
}
```

**Response (Error - Duplicate):**
```json
{
  "status": "error",
  "message": "The combination PlayerName#0001 is already taken"
}
```

---

### Login
**Endpoint:** `POST /account/login`  
**Auth:** None  
**Rate Limit:** 5 per IP per 15 minutes

**Request:**
```json
{
  "display_name": "PlayerName",
  "player_tag": "#0001",
  "password": "SecurePass123",
  "remember_me": true
}
```

**Response (Success):**
```json
{
  "status": "success",
  "player_id": 42,
  "session_code": "ABC123",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "a1b2c3d4e5f6...",
  "remember_token": "x9y8z7w6v5u4...",
  "token_expires_in": "2 hours",
  "refresh_token_expires_in": "7 days",
  "server": {
    "ip": "192.168.1.100",
    "port": 7777
  },
  "message": "Connected to game server"
}
```

**Notes:**
- `remember_token` only included if `remember_me: true`
- `token` is a JWT, use in `Authorization: Bearer` header
- `refresh_token` is a hashed token, store securely
- `remember_token` is a hashed token, store **very securely** (Keychain/Vault)

---

## Authentication

### Validate Token
**Endpoint:** `GET /player/validate-token`  
**Auth:** Required (JWT)

**Request:**
```
Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (Success):**
```json
{
  "status": "valid",
  "player": {
    "playerId": 42,
    "displayName": "PlayerName",
    "playerTag": "#0001"
  },
  "message": "Token is valid"
}
```

**Response (Error):**
```json
{
  "status": "error",
  "message": "Invalid or expired token"
}
```

---

### Refresh Access Token
**Endpoint:** `POST /player/refresh-token`  
**Auth:** None

**Request:**
```json
{
  "refresh_token": "a1b2c3d4e5f6...",
  "player_id": 42
}
```

**Response (Success):**
```json
{
  "status": "success",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_expires_in": "2 hours",
  "message": "Token refreshed successfully"
}
```

---

### Remember Login (Passwordless)
**Endpoint:** `POST /player/remember-login`  
**Auth:** None  
**Purpose:** Exchange remember token for new access + refresh tokens

**Request:**
```json
{
  "player_id": 42,
  "remember_token": "x9y8z7w6v5u4..."
}
```

**Response (Success):**
```json
{
  "status": "success",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "a1b2c3d4e5f6...",
  "token_expires_in": "2 hours",
  "refresh_token_expires_in": "7 days",
  "message": "Remember login successful"
}
```

---

### Logout
**Endpoint:** `POST /player/logout`  
**Auth:** Required (JWT)

**Request (Global Sign-Out - All Devices):**
```json
{
  // Empty body - logout globally
}
```

**Request (Per-Device Sign-Out - This Device Only):**
```json
{
  "remember_token": "x9y8z7w6v5u4..."
}
```

**Response (Success):**
```json
{
  "status": "success",
  "message": "Logged out successfully - session cleaned up"
}
```

---

## Player Management

### Get All Online Players
**Endpoint:** `GET /players`  
**Auth:** None

**Request:**
```
Query (optional):
  ?exclude_player_id=42
```

**Response:**
```json
{
  "players": [
    {
      "id": 10,
      "display_name": "Player1",
      "player_tag": "#0001"
    },
    {
      "id": 20,
      "display_name": "Player2",
      "player_tag": "#0002"
    }
  ]
}
```

---

### Lookup Player
**Endpoint:** `GET /player/lookup`  
**Auth:** None

**Request:**
```
Query (required):
  ?display_name=PlayerName&player_tag=%230001
```

**Response (Found):**
```json
{
  "player_id": 42,
  "display_name": "PlayerName",
  "player_tag": "#0001",
  "is_online": true
}
```

**Response (Not Found):**
```json
{
  "status": "error",
  "message": "Player not found"
}
```

---

### Connect Existing Player
**Endpoint:** `POST /player/connect`  
**Auth:** None  
**Purpose:** Reconnect player without password

**Request:**
```json
{
  "display_name": "PlayerName",
  "player_tag": "#0001",
  "remember_me": false
}
```

**Response:**
```json
{
  "status": "success",
  "player_id": 42,
  "session_code": "ABC123",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "a1b2c3d4e5f6...",
  "server": {
    "ip": "192.168.1.100",
    "port": 7777
  },
  "message": "Connected to game server"
}
```

---

### Disconnect Player
**Endpoint:** `POST /player/disconnect`  
**Auth:** Required (JWT)

**Request:**
```json
{}
```

**Response:**
```json
{
  "status": "success",
  "message": "Player disconnected and session handled"
}
```

---

## Game Invites

### Send Invite
**Endpoint:** `POST /invite/send`  
**Auth:** Required (JWT)  
**Purpose:** Invite another player to join your game session

**Request:**
```json
{
  "receiver_id": 50,
  "session_code": "ABC123"
}
```

**Response (Success):**
```json
{
  "status": "success",
  "invite_id": 123,
  "session_code": "ABC123",
  "expires_in": 120
}
```

**Response (Error - Already Pending):**
```json
{
  "status": "error",
  "message": "Already have a pending invite to this player"
}
```

**Notes:**
- Invites expire after 120 seconds
- Receiver must be online
- Sender must be in the session

---

### Check Pending Invites
**Endpoint:** `GET /invite/check/:playerId`  
**Auth:** Required (JWT)  
**Purpose:** Get list of pending invites for this player

**Request:**
```
Path parameter: :playerId (must match authenticated player)
```

**Response:**
```json
{
  "invites": [
    {
      "invite_id": 123,
      "sender_id": 10,
      "sender_name": "PlayerName#0001",
      "session_code": "ABC123",
      "created_at": "2025-10-19T10:30:45Z",
      "expires_at": "2025-10-19T10:32:45Z"
    }
  ]
}
```

---

### Respond to Invite
**Endpoint:** `POST /invite/respond`  
**Auth:** Required (JWT)

**Request (Accept):**
```json
{
  "invite_id": 123,
  "response": "accept"
}
```

**Request (Decline):**
```json
{
  "invite_id": 123,
  "response": "decline"
}
```

**Response (Accepted):**
```json
{
  "status": "accepted",
  "session_code": "ABC123",
  "server": {
    "ip": "192.168.1.100",
    "port": 7777
  },
  "message": "Joined session successfully"
}
```

**Response (Declined):**
```json
{
  "status": "declined",
  "message": "Invite declined"
}
```

**Notes:**
- Accepting moves player to new session
- Old session cleaned up if player was alone
- Player count updated on both servers

---

## Game Sessions

### Session Info (Implicit in Login/Connect)
When you login or connect, you receive:
```json
{
  "session_code": "ABC123",
  "server": {
    "ip": "192.168.1.100",
    "port": 7777
  }
}
```

**Usage:**
1. Connect to game server at the provided IP:Port
2. Send your session_code to the game server
3. Game server validates you in the session

---

## Server Management

### Update Server Info
**Endpoint:** `POST /server/update`  
**Auth:** None  
**Called by:** Game server (reports current status)

**Request:**
```json
{
  "session_code": "ABC123",
  "server_ip": "192.168.1.100",
  "server_port": 7777,
  "current_players": 3
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Server updated"
}
```

---

### Update Player Count
**Endpoint:** `POST /server/update-players`  
**Auth:** None  
**Called by:** Game server (reports player count change)

**Request:**
```json
{
  "session_code": "ABC123",
  "current_players": 4
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Player count updated"
}
```

---

### Server Heartbeat
**Endpoint:** `POST /server/heartbeat`  
**Auth:** None  
**Called by:** Game server (every 30 seconds, prevents timeout)

**Request:**
```json
{
  "server_id": 5
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Heartbeat received"
}
```

**Notes:**
- Servers marked dead if no heartbeat for 2 minutes
- Dead servers cannot accept new players

---

## Admin Operations

### Generate Admin Token
**Endpoint:** `GET /admin/generate-token`  
**Auth:** Required (JWT + Admin Account)  
**Purpose:** Get short-lived admin token for sensitive operations

**Request:**
```
Headers:
  Authorization: Bearer <admin_player_access_token>
```

**Response (Success - User is Admin):**
```json
{
  "status": "success",
  "admin_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": "15 minutes",
  "purpose": "server_registration",
  "generated_by": "AdminName",
  "message": "Use this token in X-Admin-Token header for admin operations"
}
```

**Response (Error - Not Admin):**
```json
{
  "status": "error",
  "message": "Insufficient permissions - admin access required"
}
```

**Notes:**
- Admin token expires after 15 minutes
- Need to regenerate for each session
- Separate secret from user access tokens

---

### Register Game Server
**Endpoint:** `POST /server/register`  
**Auth:** Required (X-Admin-Token header)

**Request:**
```json
{
  "ip_address": "192.168.1.100",
  "port": 7777,
  "max_players": 8,
  "region": "us-east"
}
```

**Request Headers:**
```
X-Admin-Token: <admin_token_from_/admin/generate-token>
```

**Response:**
```json
{
  "status": "success",
  "server_id": 5,
  "message": "Game server registered"
}
```

---

### Remove Game Server
**Endpoint:** `POST /server/remove`  
**Auth:** Required (X-Admin-Token header)

**Request:**
```json
{
  "session_code": "ABC123"
}
```

**Request Headers:**
```
X-Admin-Token: <admin_token>
```

**Response:**
```json
{
  "status": "success",
  "message": "Server removed"
}
```

---

## Error Codes

### 400 - Bad Request
```json
{
  "status": "error",
  "message": "Missing required field: display_name"
}
```
**Cause:** Invalid input, missing fields, validation failed

---

### 401 - Unauthorized
```json
{
  "status": "error",
  "message": "Access token required"
}
```
**Cause:** Missing or invalid authorization token

---

### 403 - Forbidden
```json
{
  "status": "error",
  "message": "Invalid or expired token"
}
```
**Cause:** Token invalid/expired, insufficient permissions, admin check failed

---

### 404 - Not Found
```json
{
  "status": "error",
  "message": "Player not found"
}
```
**Cause:** Player/invite/session doesn't exist

---

### 409 - Conflict
```json
{
  "status": "error",
  "message": "The combination PlayerName#0001 is already taken"
}
```
**Cause:** Duplicate entry (account exists, invite pending, etc.)

---

### 429 - Too Many Requests
```json
{
  "status": "error",
  "message": "Too many login attempts, please try again after 15 minutes"
}
```
**Cause:** Rate limit exceeded

---

### 500 - Internal Server Error
```json
{
  "status": "error",
  "message": "Database error"
}
```
**Cause:** Server error, database issue, unexpected failure

---

### 503 - Service Unavailable
```json
{
  "status": "error",
  "message": "No game servers available"
}
```
**Cause:** All servers full/offline, temporary service issue

---

## Token Lifetimes

| Token Type | Lifetime | Usage |
|-----------|----------|-------|
| Access Token (JWT) | 2 hours | API requests (`Authorization: Bearer`) |
| Refresh Token | 7 days | Get new access token |
| Remember Token | 30 days | Auto-login on app restart |
| Admin Token | 15 minutes | Admin operations |

---

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/account/create` | 3 | Per hour per IP |
| `/account/login` | 5 | Per 15 minutes per IP |
| All endpoints | 100 | Per minute per IP |

---

## Example Client Flows

### Flow 1: First-Time Login
```
1. POST /account/create
   ↓ success
2. POST /account/login (with remember_me: true)
   ↓ receive access_token, refresh_token, remember_token
3. Store remember_token securely in Keychain/Vault
4. Use access_token in Authorization header for API calls
```

### Flow 2: App Restart (Stay Logged In)
```
1. Retrieve remember_token from Keychain/Vault
2. POST /player/remember-login (with remember_token)
   ↓ receive new access_token, refresh_token
3. Player is logged in without password
```

### Flow 3: Token Expiry
```
1. Make API call with access_token
   ↓ 403 Invalid/Expired Token
2. POST /player/refresh-token (with refresh_token)
   ↓ receive new access_token
3. Retry original API call
```

### Flow 4: Invite to Game
```
1. GET /players (find someone to invite)
   ↓ receive list of online players
2. POST /invite/send (with receiver_id, session_code)
   ↓ invite_id returned
3. Receiver calls GET /invite/check/:playerId
   ↓ sees pending invite
4. Receiver calls POST /invite/respond (accept)
   ↓ joins your session
```

---

## Testing with cURL

```bash
# Create account
curl -X POST http://localhost:41043/account/create \
  -H "Content-Type: application/json" \
  -d '{"display_name":"Test","player_tag":"#0001","email":"test@example.com","password":"Pass123456"}'

# Login
curl -X POST http://localhost:41043/account/login \
  -H "Content-Type: application/json" \
  -d '{"display_name":"Test","player_tag":"#0001","password":"Pass123456","remember_me":true}'

# Validate token (replace TOKEN with actual access_token)
curl http://localhost:41043/player/validate-token \
  -H "Authorization: Bearer TOKEN"

# Get online players
curl http://localhost:41043/players

# Check invites (replace PLAYER_ID with actual player id)
curl http://localhost:41043/invite/check/PLAYER_ID \
  -H "Authorization: Bearer TOKEN"
```

---

## Version
**API Version:** 1.0  
**Last Updated:** October 19, 2025  
**Status:** Production Ready ✅
