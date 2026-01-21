# Complete API Reference - All Endpoints

**This is the complete list of every single endpoint your backend has. Updated for the full WebSocket + HTTP system.**

---

## Base URL

```
HTTP:       http://10.252.7.171:7777
WebSocket:  ws://10.252.7.171:7777
```

---

## Authentication

### JWT Tokens

All protected endpoints require an `Authorization` header:

```
Authorization: Bearer {access_token}
```

### Token Types

**Access Token (2-hour expiry):**
- Used for every HTTP request
- Generated on login
- Expires after 2 hours
- Use refresh token to get new one

**Refresh Token (7-day expiry):**
- Used to get new access token when expired
- Stored in database (can be revoked)
- Long-lived, secure storage
- Used for remember-me feature

---

## HTTP REST Endpoints

### Account Management (PUBLIC)

#### Create Account
```
POST /account/create
Rate Limit: 5 per 15 minutes per IP

Body:
{
  "username": "player1",
  "password": "mypassword123",
  "display_name": "Player One",
  "player_tag": "1234"
}

Response (201 - Created):
{
  "status": "success",
  "message": "Account created",
  "player_id": 1,
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI..."
}

Errors:
- 400: Invalid input (validation error)
- 409: Username already taken
- 500: Server error
```

#### Login
```
POST /account/login
Rate Limit: 5 failed attempts per 15 minutes per IP

Body (Option 1 - Email):
{
  "email": "player@example.com",
  "password": "mypassword123"
}

Body (Option 2 - Display Name + Tag):
{
  "display_name": "Player One",
  "player_tag": "#1234",
  "password": "mypassword123"
}

Response (200 - OK):
{
  "status": "success",
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI...",
  "player_id": 1,
  "display_name": "Player One",
  "player_tag": "#1234"
}

Errors:
- 400: Missing password or both login methods missing
- 401: Wrong credentials
- 500: Server error

Notes:
- Must provide EITHER email OR (display_name + player_tag)
- Password is always required
- Player tag must include hashtag: #1234 (not 1234)
```

#### Remember-Me Login
```
POST /player/remember-login
No authentication required

Body:
{
  "remember_token": "long_token_string_from_storage"
}

Response (200 - OK):
{
  "status": "success",
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI...",
  "player_id": 1
}

Errors:
- 400: Missing token
- 401: Invalid or expired token
- 404: Player not found
```

### Authentication (PUBLIC)

#### Player Connect
```
POST /player/connect
No authentication required (used on login)

Body:
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI..."
}

Response (200 - OK):
{
  "status": "success",
  "player_id": 1,
  "is_online": true
}
```

#### Refresh Token
```
POST /player/refresh-token
No authentication required

Body:
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI..."
}

Response (200 - OK):
{
  "status": "success",
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI..."
}

Errors:
- 400: Missing refresh token
- 401: Invalid or expired refresh token
```

### Player Management (PUBLIC)

#### Get All Online Players
```
GET /players?exclude_player_id=1

Query Parameters:
- exclude_player_id (optional): Player ID to exclude (usually yourself)

Response (200 - OK):
{
  "players": [
    {
      "id": 2,
      "display_name": "Player Two",
      "player_tag": "#5678"
    },
    {
      "id": 3,
      "display_name": "Player Three",
      "player_tag": "#9012"
    }
  ]
}
```

#### Lookup Player by Name & Tag
```
GET /player/lookup?display_name=Player One&player_tag=1234

Query Parameters:
- display_name: Player's display name (required)
- player_tag: Player's tag number (required)

Response (200 - OK):
{
  "player_id": 1,
  "display_name": "Player One",
  "player_tag": "#1234",
  "is_online": true
}

Errors:
- 400: Missing display_name or player_tag
- 404: Player not found
```

### Authentication (PROTECTED)

#### Validate Token
```
GET /player/validate-token
Authorization: Bearer {access_token}

Response (200 - OK):
{
  "status": "success",
  "valid": true,
  "player_id": 1,
  "expires_at": 1729894800
}

Errors:
- 401: Invalid or expired token
```

#### Logout
```
POST /player/logout
Authorization: Bearer {access_token}

Body: {} (empty)

Response (200 - OK):
{
  "status": "success",
  "message": "Logged out successfully"
}

Errors:
- 401: Invalid token
```

#### Disconnect Player (Sessions)
```
POST /player/disconnect
Authorization: Bearer {access_token}

Body: {} (empty)

Response (200 - OK):
{
  "status": "success",
  "message": "Player disconnected and session handled"
}

What it does:
- Finds player's game session
- If only player in session: deletes session
- If other players: transfers host to another player
- Updates server player count
- Marks player offline
```

---

## Heartbeat System (PROTECTED)

#### Send Heartbeat (HTTP)
```
POST /player/heartbeat
Authorization: Bearer {access_token}

Body:
{
  "game_open": true
}

Response (200 - OK):
{
  "status": "success",
  "message": "Heartbeat received",
  "timestamp": "2025-10-26T12:34:56.789Z"
}

Purpose: Tell server "I'm alive and game is open"
Send every: 5-10 seconds
Set game_open to false when player alt-tabs
```

#### Check If Player Is Alive
```
GET /player/check-alive/{playerId}?timeout_seconds=30
Authorization: Bearer {access_token}

Path Parameters:
- playerId: ID of player to check (required)

Query Parameters:
- timeout_seconds (optional): How many seconds without heartbeat = dead (default: 30)

Response (200 - OK):
{
  "player_id": 1,
  "display_name": "Player One",
  "is_online": true,
  "game_open": true,
  "last_heartbeat": "2025-10-26T12:34:56Z",
  "seconds_since_heartbeat": 2,
  "is_alive": true,
  "timeout_seconds": 30
}

Security: Can only check self unless admin
Errors:
- 403: Cannot check other players
- 404: Player not found
```

#### Check Multiple Players (Batch)
```
POST /player/check-alive-batch
Authorization: Bearer {access_token}

Body:
{
  "player_ids": [1, 2, 3, 4],
  "timeout_seconds": 30
}

Response (200 - OK):
{
  "status": "success",
  "timeout_seconds": 30,
  "players": [
    {
      "player_id": 1,
      "display_name": "Player One",
      "is_online": true,
      "game_open": true,
      "last_heartbeat": "2025-10-26T12:34:56Z",
      "seconds_since_heartbeat": 2,
      "is_alive": true
    },
    {
      "player_id": 2,
      "display_name": "Player Two",
      "is_online": true,
      "game_open": false,
      "last_heartbeat": "2025-10-26T12:30:00Z",
      "seconds_since_heartbeat": 300,
      "is_alive": false
    }
  ],
  "alive_count": 1,
  "total_checked": 2
}

Errors:
- 400: player_ids not an array or empty
- 400: More than 100 players requested
```

---

## Invite System (PROTECTED)

#### Send Invite
```
POST /invite/send
Authorization: Bearer {access_token}

Body:
{
  "receiver_id": 2,
  "session_code": "ABC123"
}

Response (200 - OK):
{
  "status": "success",
  "invite_id": 999,
  "session_code": "ABC123",
  "expires_in": 120
}

Validation:
- You must be host of the session
- Receiver must be online
- No pending invite already exists
- Invite expires in 120 seconds

Errors:
- 400: Missing receiver_id or session_code
- 404: Session not found or receiver offline
- 409: Pending invite already exists
```

#### Check Invites
```
GET /invite/check/{playerId}
Authorization: Bearer {access_token}

Path Parameters:
- playerId: Your own player ID (required)

Response (200 - OK):
{
  "invites": [
    {
      "invite_id": 999,
      "sender_id": 1,
      "sender_name": "Player One#1234",
      "session_code": "ABC123",
      "created_at": "2025-10-26T12:34:56Z",
      "expires_at": "2025-10-26T12:36:56Z"
    }
  ]
}

Security: Can only check own invites
Returns: Only pending, non-expired invites
Errors:
- 403: Cannot check other players' invites
```

#### Respond to Invite
```
POST /invite/respond
Authorization: Bearer {access_token}

Body:
{
  "invite_id": 999,
  "response": "accept"  // or "decline"
}

Response on Accept (200 - OK):
{
  "status": "accepted",
  "invite_id": 999,
  "server_ip": "192.168.1.100",
  "server_port": 7778,
  "session_code": "ABC123",
  "message": "Connecting to game session..."
}

Response on Decline (200 - OK):
{
  "status": "declined",
  "invite_id": 999,
  "message": "Invite declined"
}

What it does on accept:
- Updates invite status to 'accepted'
- Adds you to the game session
- Increments session player count
- Increments server player count

Errors:
- 400: Missing invite_id or response
- 400: Response must be "accept" or "decline"
- 404: Invite not found or expired
```

#### Cleanup Invites (ADMIN)
```
DELETE /invite/cleanup

Response (200 - OK):
{
  "deleted_count": 5,
  "message": "Cleaned up 5 expired invites"
}

Purpose: Remove expired/already-responded invites
Can be called as cron job or manually
```

---

## Server Management (PUBLIC)

#### Update Server Info
```
POST /server/update
No authentication required (for game servers)

Body:
{
  "server_id": 1,
  "ip_address": "192.168.1.100",
  "port": 7778,
  "server_secret": "secret_key_here"
}

Response (200 - OK):
{
  "status": "success",
  "message": "Server updated"
}
```

#### Update Player Count
```
POST /server/update-players
No authentication required

Body:
{
  "server_id": 1,
  "player_count": 5,
  "server_secret": "secret_key_here"
}

Response (200 - OK):
{
  "status": "success",
  "message": "Player count updated"
}
```

#### Server Heartbeat
```
POST /server/heartbeat
No authentication required

Body:
{
  "server_id": 1,
  "is_alive": true,
  "player_count": 5,
  "server_secret": "secret_key_here"
}

Response (200 - OK):
{
  "status": "success",
  "message": "Heartbeat received"
}

Purpose: Tell backend "this game server is alive"
Send every: 30-60 seconds
Server marked offline if no heartbeat for > 5 minutes
```

#### Link Session to Server
```
POST /session/link-server
No authentication required

Body:
{
  "session_code": "ABC123",
  "server_id": 1,
  "server_secret": "secret_key_here"
}

Response (200 - OK):
{
  "status": "success",
  "message": "Session linked to server"
}
```

#### Register Server (ADMIN ONLY)
```
POST /server/register
X-Admin-Token: {admin_token}

Body:
{
  "ip_address": "192.168.1.100",
  "port": 7778,
  "server_secret": "secret_key_here"
}

Response (201 - Created):
{
  "status": "success",
  "message": "Server registered",
  "server_id": 1
}

How to get admin token:
1. Login as admin player
2. GET /admin/generate-token (with Authorization header)
3. Use returned admin_token in X-Admin-Token header
```

#### Remove Server (ADMIN ONLY)
```
POST /server/remove
X-Admin-Token: {admin_token}

Body:
{
  "server_id": 1
}

Response (200 - OK):
{
  "status": "success",
  "message": "Server removed"
}

What it does:
- Deletes server from database
- Marks all sessions on that server as orphaned
```

---

## Admin Functions (PROTECTED)

#### Generate Admin Token
```
GET /admin/generate-token
Authorization: Bearer {access_token}

Response (200 - OK):
{
  "status": "success",
  "admin_token": "eyJhbGciOiJIUzI1NiIsInR5cCI...",
  "expires_in": "15 minutes",
  "purpose": "server_registration",
  "generated_by": "AdminPlayer",
  "message": "Use this token in X-Admin-Token header for admin operations"
}

Requirements:
- Must be logged in as admin (is_admin=1 in database)
- Token expires in 15 minutes
- Used for admin operations like server registration

Errors:
- 401: Not authenticated
- 403: User is not admin
```

#### Force Player Offline (ADMIN ONLY)
```
POST /player/{playerId}/force-offline
X-Admin-Token: {admin_token}

Path Parameters:
- playerId: Player ID to force offline (required)

Body: {} (empty)

Response (200 - OK):
{
  "status": "success",
  "message": "Player 5 marked as offline",
  "affected_rows": 1
}

Purpose: Manually mark player offline (if server detects crash)
Errors:
- 401: No admin token
- 404: Player not found
```

---

## Friend System (PROTECTED)

#### Send Friend Request
```
POST /friend/request
Authorization: Bearer {access_token}

Body:
{
  "receiver_id": 2
}

Response (200 - OK):
{
  "status": "success",
  "request_id": 5,
  "receiver_id": 2,
  "message": "Friend request sent"
}

Errors:
- 400: Missing receiver_id
- 404: Receiver not found
- 409: Already friends or request pending
```

#### Get Friend Requests
```
GET /friend/requests
Authorization: Bearer {access_token}

Response (200 - OK):
{
  "requests": [
    {
      "request_id": 5,
      "sender_id": 1,
      "sender_name": "Player One#1234",
      "created_at": "2025-10-26T12:34:56Z"
    }
  ]
}

Returns: Pending friend requests sent to you
```

#### Accept Friend Request
```
POST /friend/accept
Authorization: Bearer {access_token}

Body:
{
  "request_id": 5
}

Response (200 - OK):
{
  "status": "success",
  "message": "Friend request accepted",
  "friend_id": 1,
  "friend_name": "Player One#1234"
}

What it does:
- Updates request status to accepted
- Creates friendship record
- Both players now see each other as friends
```

#### Decline Friend Request
```
POST /friend/decline
Authorization: Bearer {access_token}

Body:
{
  "request_id": 5
}

Response (200 - OK):
{
  "status": "success",
  "message": "Friend request declined"
}
```

#### Get Friends List
```
GET /friends
Authorization: Bearer {access_token}

Response (200 - OK):
{
  "friends": [
    {
      "friend_id": 1,
      "display_name": "Player One",
      "player_tag": "#1234",
      "is_online": true
    },
    {
      "friend_id": 2,
      "display_name": "Player Two",
      "player_tag": "#5678",
      "is_online": false
    }
  ]
}

Returns: All your confirmed friends
```

#### Remove Friend
```
POST /friend/remove
Authorization: Bearer {access_token}

Body:
{
  "friend_id": 1
}

Response (200 - OK):
{
  "status": "success",
  "message": "Friend removed"
}

What it does:
- Deletes friendship record
- Both players no longer friends
```

#### Block Player
```
POST /friend/block
Authorization: Bearer {access_token}

Body:
{
  "player_id": 1
}

Response (200 - OK):
{
  "status": "success",
  "message": "Player blocked"
}

What it does:
- Blocked player can't see you online
- Blocked player can't invite you
- Blocked player can't see your profile
```

#### Unblock Player
```
POST /friend/unblock
Authorization: Bearer {access_token}

Body:
{
  "player_id": 1
}

Response (200 - OK):
{
  "status": "success",
  "message": "Player unblocked"
}
```

#### Get Blocked List
```
GET /friend/blocked
Authorization: Bearer {access_token}

Response (200 - OK):
{
  "blocked": [
    {
      "player_id": 1,
      "display_name": "Player One",
      "player_tag": "#1234"
    }
  ]
}

Returns: All players you've blocked
```

#### Check If Player Is Friend
```
GET /friend/check/{friend_id}
Authorization: Bearer {access_token}

Path Parameters:
- friend_id: ID of player to check (required)

Response (200 - OK):
{
  "is_friend": true,
  "friend_id": 1,
  "display_name": "Player One",
  "is_blocked": false
}

Returns: Friendship status with this player
```

---

## WebSocket Events (Real-Time)

### Connection

#### Connect to WebSocket

```javascript
const socket = io('http://10.252.7.171:7777', {
  auth: {
    token: 'your_access_token_here'
  }
});

socket.on('connect', () => {
  console.log('Connected to server');
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
});

socket.on('error', (error) => {
  console.error('WebSocket error:', error);
});
```

**What happens:**
1. Client connects with access token
2. Server authenticates token
3. If valid: connection established, player marked online
4. If invalid: connection rejected

### Heartbeat Events (WebSocket)

#### Send Heartbeat
```javascript
socket.emit('heartbeat', {
  game_open: true  // Set to false if alt-tabbed
});
```

#### Receive Heartbeat Acknowledgment
```javascript
socket.on('heartbeat:ack', (data) => {
  console.log(data);
  // {
  //   status: 'success',
  //   timestamp: '2025-10-26T12:34:56.789Z',
  //   game_open: true
  // }
});
```

**Send every:** 5-10 seconds while connected

### Invite Events (WebSocket)

#### Send Invite
```javascript
socket.emit('invite:send', {
  receiver_id: 2,
  session_code: 'ABC123'
});
```

#### Receive Invite Send Success
```javascript
socket.on('invite:send:success', (data) => {
  console.log(data);
  // {
  //   status: 'success',
  //   invite_id: 999,
  //   receiver_id: 2,
  //   receiver_name: 'Player Two#5678',
  //   session_code: 'ABC123',
  //   expires_in: 120
  // }
});
```

#### Receive Invite Send Error
```javascript
socket.on('invite:send:error', (data) => {
  console.error(data);
  // {
  //   status: 'error',
  //   message: 'Receiver not found or offline'
  // }
});
```

#### Receive Invite (Someone Invited You)
```javascript
socket.on('invite:received', (data) => {
  console.log('Got invited!', data);
  // {
  //   invite_id: 999,
  //   sender_id: 1,
  //   sender_name: '#1234',
  //   session_code: 'ABC123',
  //   server_ip: '192.168.1.100',
  //   server_port: 7778,
  //   created_at: '2025-10-26T12:34:56Z',
  //   expires_in: 120
  // }
  
  // Show popup to player
  ShowInviteNotification(data);
});
```

#### Acknowledge Invite (Tell Server You Saw It)
```javascript
socket.emit('invite:acknowledged', {
  invite_id: 999
});
```

#### Receive Acknowledgment Confirmation
```javascript
socket.on('invite:acknowledged:ack', (data) => {
  console.log('Server got your acknowledgment');
});
```

#### Respond to Invite
```javascript
socket.emit('invite:respond', {
  invite_id: 999,
  response: 'accept'  // or 'decline'
});
```

#### Receive Response Success
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
    
    // Connect to game server
    ConnectToGameServer(data.server_ip, data.server_port);
  } else if (data.status === 'declined') {
    console.log('Invite declined');
  }
});
```

#### Receive Response Error
```javascript
socket.on('invite:respond:error', (data) => {
  console.error(data);
  // {
  //   status: 'error',
  //   message: 'Invite not found, expired, or already responded'
  // }
});
```

#### Receive Invite Accepted (Someone Accepted Your Invite)
```javascript
socket.on('invite:accepted', (data) => {
  console.log('Someone accepted your invite!', data);
  // {
  //   invite_id: 999,
  //   receiver_id: 2,
  //   message: 'Invite was accepted'
  // }
});
```

#### Receive Invite Declined (Someone Declined Your Invite)
```javascript
socket.on('invite:declined', (data) => {
  console.log('Someone declined your invite', data);
  // {
  //   invite_id: 999,
  //   receiver_id: 2,
  //   message: 'Invite was declined'
  // }
});
```

---

## Error Responses

### Common HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success | Request completed successfully |
| 201 | Created | Resource created (account, server registered) |
| 400 | Bad Request | Missing/invalid fields |
| 401 | Unauthorized | Invalid/expired token |
| 403 | Forbidden | Not admin, or can't access resource |
| 404 | Not Found | Player/session/invite not found |
| 409 | Conflict | Resource already exists |
| 500 | Server Error | Database error or unexpected error |

### Error Response Format

```json
{
  "status": "error",
  "message": "Human readable error message"
}
```

### Rate Limiting

When you exceed rate limits:

```
HTTP 429 - Too Many Requests

Response:
{
  "status": "error",
  "message": "Too many requests, try again later"
}

Reset after 15 minutes
```

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| `/account/create` | 5 per 15 min per IP |
| `/account/login` | 5 failed attempts per 15 min per IP |
| All routes (default) | 100 per 15 min per IP |

---

## Server Connection Info

```
Host:     10.252.7.171
Port:     7777
Protocol: HTTP (REST) + WebSocket
CORS:     Enabled (all origins)
```

---

## Implementation Checklist for Unity

**Essential Endpoints (Must Implement):**
- [ ] POST /account/create - Account creation
- [ ] POST /account/login - Login
- [ ] POST /player/heartbeat - Heartbeat (or WebSocket equivalent)
- [ ] GET /players - List online players
- [ ] GET /player/lookup - Search for player
- [ ] WebSocket: invite:send - Send invite
- [ ] WebSocket: invite:respond - Respond to invite
- [ ] WebSocket: invite:received - Receive invite notification
- [ ] GET /invite/check - Fallback: check invites if WS down

**Optional But Recommended:**
- [ ] POST /player/refresh-token - Token refresh
- [ ] POST /friend/request - Add friend
- [ ] GET /friends - Get friends list
- [ ] GET /friend/check - Check friendship
- [ ] GET /player/validate-token - Validate token before requests

**Debug/Admin (Not Needed for Players):**
- [ ] GET /admin/generate-token - Generate admin token
- [ ] POST /server/register - Register game server
- [ ] POST /player/:playerId/force-offline - Force offline

---

## Example Workflows

### Login Workflow
```
1. POST /account/login
   ↓
2. Receive: access_token, refresh_token
   ↓
3. Store refresh_token in secure storage
   ↓
4. Connect WebSocket with access_token
```

### Send Invite Workflow
```
1. GET /players (find who to invite)
   ↓
2. Create/host game session
   ↓
3. WebSocket: socket.emit('invite:send', {receiver_id, session_code})
   ↓
4. WebSocket: socket.on('invite:send:success')
   ↓
5. Receiver gets WebSocket: socket.on('invite:received')
```

### Receive & Accept Invite Workflow
```
1. WebSocket: socket.on('invite:received')
   ↓
2. Show popup to player
   ↓
3. Player clicks "Accept"
   ↓
4. WebSocket: socket.emit('invite:respond', {invite_id, response: 'accept'})
   ↓
5. WebSocket: socket.on('invite:respond:success', {server_ip, server_port, session_code})
   ↓
6. Connect to game server
```

### Token Refresh Workflow
```
1. Make request with access_token
   ↓
2. Get 401 Unauthorized (token expired)
   ↓
3. POST /player/refresh-token with refresh_token
   ↓
4. Receive new access_token
   ↓
5. Retry original request
```

---

## Notes

- All timestamps are ISO 8601 format: `2025-10-26T12:34:56Z`
- All IDs are integers
- Display names + tags format: `{display_name}#{player_tag}` or `{display_name}#XXXX`
- WebSocket events are real-time, HTTP endpoints are request-response
- For maximum performance: use WebSocket for real-time (invites), use HTTP for one-time (login)
- Keep access tokens in memory only, refresh tokens in secure storage
- Heartbeat keeps player online - without it, player marked offline after 30 seconds

---

This is the COMPLETE API reference. Every endpoint, every event, every response is documented here. 📖
