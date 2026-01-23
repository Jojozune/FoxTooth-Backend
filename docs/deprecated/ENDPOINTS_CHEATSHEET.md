# API Endpoints Cheat Sheet

**Quick Reference for All Backend Endpoints**  
**Base URL:** `https://your-backend-domain.com`

---

## Authentication Endpoints

### Create Account
```
POST /account/create
Content-Type: application/json

{
  "display_name": "PlayerName",
  "player_tag": "#XXXX",
  "email": "player@example.com",
  "password": "SecurePassword123"
}

Response 201:
{
  "status": "success",
  "player_id": 123,
  "message": "Account created"
}

Errors:
400 - Bad input (name too short, tag invalid format, password too weak)
409 - Duplicate account (display_name#tag already exists)
```

### Login
```
POST /account/login
Content-Type: application/json

{
  "display_name": "PlayerName",
  "player_tag": "#XXXX",
  "password": "SecurePassword123",
  "remember_me": true
}

Response 200:
{
  "status": "success",
  "player_id": 123,
  "session_code": "ABC-123-DEF",
  "token": "eyJhbGc...",
  "refresh_token": "50_byte_random_string",
  "remember_token": "48_byte_random_string",
  "token_expires_in": "2h",
  "refresh_token_expires_in": "7d",
  "server": {
    "ip": "game-server.com",
    "port": 5050
  }
}

Errors:
401 - Wrong password
404 - Player not found
429 - Too many login attempts (wait 15 min)
```

### Remember Login (Passwordless)
```
POST /player/remember-login
Content-Type: application/json

{
  "player_id": 123,
  "remember_token": "48_byte_random_string"
}

Response 200:
{
  "status": "success",
  "player_id": 123,
  "token": "eyJhbGc...",
  "refresh_token": "50_byte_random_string",
  "server": {
    "ip": "game-server.com",
    "port": 5050
  }
}

Errors:
401 - Invalid or expired remember token
404 - Player not found
```

### Refresh Access Token
```
POST /player/refresh-token
Content-Type: application/json

{
  "refresh_token": "50_byte_random_string",
  "player_id": 123
}

Response 200:
{
  "status": "success",
  "token": "eyJhbGc...",
  "token_expires_in": "2h"
}

Errors:
401 - Invalid or expired refresh token
404 - Player not found
```

### Logout
```
POST /player/logout
Authorization: Bearer <access_token>
Content-Type: application/json

// Global logout (all devices)
{}

// OR per-device logout (single device)
{
  "remember_token": "48_byte_random_string"
}

Response 200:
{
  "status": "success",
  "message": "Logged out"
}

Errors:
401 - Invalid token
```

---

## Player Endpoints

### Get All Online Players
```
GET /players
GET /players?exclude_player_id=123

Response 200:
{
  "players": [
    {
      "id": 1,
      "display_name": "Player1",
      "player_tag": "#ABCD"
    },
    {
      "id": 2,
      "display_name": "Player2",
      "player_tag": "#EFGH"
    }
  ]
}
```

### Lookup Player
```
GET /player/lookup?display_name=PlayerName&player_tag=%23XXXX

Response 200:
{
  "player_id": 123,
  "display_name": "PlayerName",
  "player_tag": "#XXXX",
  "is_online": true
}

Errors:
404 - Player not found
```

### Disconnect Player
```
POST /player/disconnect
Authorization: Bearer <access_token>
Content-Type: application/json

{}

Response 200:
{
  "status": "success",
  "message": "Disconnected"
}

Errors:
401 - Invalid token
```

---

## Invite Endpoints

### Send Invite
```
POST /invite/send
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "receiver_id": 456,
  "session_code": "ABC-123-DEF"
}

Response 201:
{
  "status": "success",
  "invite_id": 789,
  "session_code": "ABC-123-DEF",
  "expires_in": 120
}

Errors:
401 - Invalid token
404 - Receiver not found
409 - Invite already pending
```

### Check Pending Invites
```
GET /invite/check/:player_id
Authorization: Bearer <access_token>

Response 200:
{
  "invites": [
    {
      "invite_id": 789,
      "sender_id": 123,
      "sender_name": "InviterName",
      "session_code": "ABC-123-DEF",
      "created_at": "2025-01-15T10:30:00Z",
      "expires_at": "2025-01-15T10:32:00Z"
    }
  ]
}

Errors:
401 - Invalid token
```

### Respond to Invite
```
POST /invite/respond
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "invite_id": 789,
  "response": "accept"  // or "decline"
}

Response 200 (if accept):
{
  "status": "success",
  "session_code": "ABC-123-DEF",
  "server": {
    "ip": "game-server.com",
    "port": 5050
  }
}

Response 200 (if decline):
{
  "status": "success",
  "message": "Invite declined"
}

Errors:
401 - Invalid token
404 - Invite not found
410 - Invite expired
```

---

## Session Endpoints

### Create Session
```
POST /session/create
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "server_id": 1,
  "game_mode": "deathmatch",
  "max_players": 4
}

Response 201:
{
  "status": "success",
  "session_code": "ABC-123-DEF",
  "server": {
    "ip": "game-server.com",
    "port": 5050
  }
}

Errors:
401 - Invalid token
503 - No available game servers
```

### Join Session
```
POST /session/join
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "session_code": "ABC-123-DEF"
}

Response 200:
{
  "status": "success",
  "session_info": {
    "session_code": "ABC-123-DEF",
    "current_players": 2,
    "max_players": 4
  },
  "server": {
    "ip": "game-server.com",
    "port": 5050
  }
}

Errors:
401 - Invalid token
404 - Session not found
410 - Session full
```

---

## Server Management (Admin Only)

### Register Game Server
```
POST /server/register
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "server_name": "ServerName",
  "ip": "game-server.com",
  "port": 5050,
  "max_players": 16
}

Response 201:
{
  "status": "success",
  "server_id": 1
}

Errors:
401 - Invalid or non-admin token
403 - Admin token expired (need new one)
```

### Update Server Status
```
POST /server/update-status
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "server_id": 1,
  "status": "online",
  "current_sessions": 2
}

Response 200:
{
  "status": "success"
}

Errors:
401 - Invalid token
403 - Not admin
```

### Remove Game Server
```
POST /server/remove
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "server_id": 1
}

Response 200:
{
  "status": "success"
}

Errors:
401 - Invalid token
403 - Not admin
404 - Server not found
```

---

## Token Information

### Access Token
- **Type:** JWT
- **Expiry:** 2 hours
- **Header:** `Authorization: Bearer <token>`
- **Used for:** Regular API calls, player identity
- **When expired:** Use refresh token to get new one

### Refresh Token
- **Type:** 40-byte random string (bcrypt hashed in DB)
- **Expiry:** 7 days
- **Used for:** Getting new access tokens
- **When expired:** Player must login again

### Remember Token
- **Type:** 48-byte random string (bcrypt hashed in DB)
- **Expiry:** 30 days
- **Used for:** Passwordless login on app restart
- **When expired:** Player must login with password
- **Per-device:** Can be revoked individually or all at once

### Admin Token
- **Type:** 32-byte random string (bcrypt hashed in DB)
- **Expiry:** 15 minutes
- **Used for:** Admin-only endpoints
- **Requirement:** Account must have `is_admin=1` flag in database

---

## Rate Limits

**Per IP Address:**
- Login attempts: 5 per 15 minutes
- Invite operations: 20 per 15 minutes
- Other requests: 100 per 15 minutes
- Admin requests: 50 per 15 minutes

**Error:** 429 Too Many Requests  
**Wait:** 15 minutes before retry

---

## Error Codes Reference

| Code | Meaning | Action |
|------|---------|--------|
| 200 | OK | Success |
| 201 | Created | Resource created |
| 400 | Bad Request | Check input validation |
| 401 | Unauthorized | Invalid/expired token, refresh or re-login |
| 403 | Forbidden | Insufficient permissions or admin token expired |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate entry or state conflict |
| 429 | Too Many Requests | Rate limited, wait 15 min |
| 500 | Server Error | Retry after 5 seconds |
| 503 | Unavailable | No game servers, try later |

---

## Quick Test Commands (cURL)

### Create Account
```bash
curl -X POST https://your-backend.com/account/create \
  -H "Content-Type: application/json" \
  -d '{
    "display_name": "TestPlayer",
    "player_tag": "#TEST",
    "email": "test@example.com",
    "password": "TestPass123"
  }'
```

### Login
```bash
curl -X POST https://your-backend.com/account/login \
  -H "Content-Type: application/json" \
  -d '{
    "display_name": "TestPlayer",
    "player_tag": "#TEST",
    "password": "TestPass123",
    "remember_me": true
  }'
```

### Get Online Players
```bash
curl https://your-backend.com/players
```

### Send Invite (requires access token)
```bash
curl -X POST https://your-backend.com/invite/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "receiver_id": 456,
    "session_code": "ABC-123-DEF"
  }'
```

### Logout (requires access token)
```bash
curl -X POST https://your-backend.com/player/logout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{}'
```

### Logout from Single Device (per-device logout)
```bash
curl -X POST https://your-backend.com/player/logout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "remember_token": "48_BYTE_REMEMBER_TOKEN"
  }'
```

---

## Postman Collection Quick Reference

**Import this into Postman:**

```json
{
  "info": {
    "name": "Game Invites API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Auth",
      "item": [
        {
          "name": "Create Account",
          "request": {
            "method": "POST",
            "url": "{{base_url}}/account/create"
          }
        },
        {
          "name": "Login",
          "request": {
            "method": "POST",
            "url": "{{base_url}}/account/login"
          }
        }
      ]
    },
    {
      "name": "Players",
      "item": [
        {
          "name": "Get Online Players",
          "request": {
            "method": "GET",
            "url": "{{base_url}}/players"
          }
        }
      ]
    },
    {
      "name": "Invites",
      "item": [
        {
          "name": "Send Invite",
          "request": {
            "method": "POST",
            "url": "{{base_url}}/invite/send"
          }
        },
        {
          "name": "Check Pending Invites",
          "request": {
            "method": "GET",
            "url": "{{base_url}}/invite/check/{{player_id}}"
          }
        }
      ]
    }
  ]
}
```

---

## Common Workflows

### Workflow 1: Login & Auto-Reconnect
1. `POST /account/login` (with `remember_me: true`)
2. Store: `token`, `refresh_token`, `remember_token`
3. On app restart: `POST /player/remember-login`
4. If expired: `POST /account/login` again

### Workflow 2: Send & Accept Invite
1. Get online players: `GET /players`
2. Pick target: receiver_id
3. Create session: `POST /session/create`
4. Send invite: `POST /invite/send`
5. Receiver polls: `GET /invite/check/:player_id`
6. Receiver accepts: `POST /invite/respond` (accept)
7. Both connect to server IP:port

### Workflow 3: Token Refresh Flow
1. Make API call with expired token
2. Receive: 401 or 403
3. Use refresh token: `POST /player/refresh-token`
4. Get new access token
5. Retry original request

### Workflow 4: Global Logout All Devices
1. `POST /player/logout` with empty body `{}`
2. ALL remember tokens deleted
3. Player must login again

### Workflow 5: Per-Device Logout (Stay Logged In on Other Device)
1. `POST /player/logout` with `remember_token`
2. ONLY that specific token deleted
3. Other devices stay logged in

---

## Response Time Expectations

- Login: 200-500ms
- Token refresh: 100-200ms
- Get players: 100-300ms
- Send invite: 150-400ms
- Remember login: 150-400ms

**If slower:** Check network latency, backend performance, or database query optimization

---

## Best Practices

✅ **DO:**
- Use HTTPS only in production
- Store tokens securely (Keychain/Credential Manager, not PlayerPrefs)
- Implement auto-refresh on 401/403 responses
- Handle 429 rate limit errors gracefully
- Implement retry logic with exponential backoff
- Validate user input before sending
- Use Bearer token format: `Authorization: Bearer <token>`

❌ **DON'T:**
- Hardcode API URLs (use configuration)
- Expose tokens in logs
- Use HTTP in production
- Store passwords client-side
- Ignore rate limit errors
- Use remember tokens as access tokens
- Trust unvalidated user input

---

## Support

**Issue:** "403 Forbidden"
- Check token expiry
- Refresh access token
- Verify admin token (if admin endpoint)

**Issue:** "404 Not Found"
- Verify resource exists
- Check player_id/invite_id are correct

**Issue:** "429 Too Many Requests"
- Wait 15 minutes
- Implement request batching
- Reduce request frequency

**Issue:** "503 Service Unavailable"
- No game servers available
- Retry after 30 seconds
- Show "Finding a server..." message to player
