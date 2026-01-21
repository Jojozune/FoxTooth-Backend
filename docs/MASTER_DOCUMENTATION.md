# 🎮 Game Invites Backend - Complete Master Documentation

> **The definitive guide to building gaming functionality with the Game Invites Backend API**

**Version:** 2.0 | **Last Updated:** October 21, 2025 | **Status:** ✅ Production Ready

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Architecture](#architecture)
4. [Authentication & Tokens](#authentication--tokens)
5. [Account Management](#account-management)
6. [Player System](#player-system)
7. [Friend System](#friend-system)
8. [Game Invites](#game-invites)
9. [Game Sessions](#game-sessions)
10. [Server Management](#server-management)
11. [Admin Operations](#admin-operations)
12. [Error Handling](#error-handling)
13. [Integration Guide](#integration-guide)
14. [Best Practices](#best-practices)
15. [Troubleshooting](#troubleshooting)

---

## Overview

The **Game Invites Backend** is a production-ready Node.js API designed to power multiplayer game experiences. It handles:

- 🔐 User authentication with multiple token types
- 👥 Friend management and relationships
- 🎮 Game session management and hosting
- 📨 Invite system for joining games
- 🖥️ Multi-server infrastructure
- ⚙️ Admin operations and monitoring

### Key Features

| Feature | Description | Status |
|---------|-------------|--------|
| JWT-based authentication | Stateless, scalable token system | ✅ |
| Remember-me functionality | Auto-login without passwords | ✅ |
| Friend system | Add, block, manage friends | ✅ |
| Game sessions | Create and join multiplayer games | ✅ |
| Invite system | Send session invites (2min expiry) | ✅ |
| Multi-server support | Load balancing across servers | ✅ |
| Rate limiting | DDoS/abuse protection | ✅ |
| Admin controls | Server registration, monitoring | ✅ |

### Technology Stack

- **Backend:** Node.js + Express.js
- **Database:** MySQL
- **Authentication:** JWT (JSON Web Tokens)
- **Security:** bcryptjs (password hashing)
- **Environment:** Docker-ready

---

## Quick Start

### 1. Create an Account

```bash
curl -X POST http://localhost:41043/account/create \
  -H "Content-Type: application/json" \
  -d '{
    "display_name": "PlayerOne",
    "email": "player@example.com",
    "password": "SecurePassword123"
  }'
```

**Response:**
```json
{
  "status": "success",
  "player_id": 42,
  "player_tag": "3847",
  "message": "Account created successfully. Please login."
}
```

> ⚡ **Note:** The `player_tag` is auto-generated as a random 4-digit number (0000-9999)

### 2. Login & Get Tokens

```bash
curl -X POST http://localhost:41043/account/login \
  -H "Content-Type: application/json" \
  -d '{
    "display_name": "PlayerOne",
    "player_tag": "3847",
    "password": "SecurePassword123",
    "remember_me": true
  }'
```

**Response:**
```json
{
  "status": "success",
  "player_id": 42,
  "session_code": "ABC123",
  "token": "eyJhbGc...",
  "refresh_token": "a1b2c3...",
  "remember_token": "x9y8z7...",
  "token_expires_in": "2 hours",
  "server": {
    "ip": "192.168.1.100",
    "port": 7777
  }
}
```

### 3. Use Your Token

All authenticated requests use the `Authorization` header:

```bash
curl http://localhost:41043/player/validate-token \
  -H "Authorization: Bearer eyJhbGc..."
```

---

## Architecture

### System Design

```
┌─────────────────────────────────────────────────────────┐
│                    Client Application                    │
│                  (Unity/Unreal/Web)                      │
└────────────────────────────┬────────────────────────────┘
                             │
                    ┌────────┴────────┐
                    ↓                 ↓
         ┌──────────────────┐  ┌──────────────────┐
         │  Authentication  │  │   API Endpoints  │
         │    (JWT Tokens)  │  │  (REST/HTTP)     │
         └────────┬─────────┘  └────────┬─────────┘
                  │                     │
                  └──────────┬──────────┘
                             ↓
                  ┌──────────────────────┐
                  │    Express.js API    │
                  │   Controllers Layer  │
                  └─────────┬────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ↓                   ↓                   ↓
   ┌─────────┐        ┌─────────┐       ┌─────────┐
   │ Auth    │        │ Player  │       │ Invite  │
   │Services │        │Services │       │Services │
   └────┬────┘        └────┬────┘       └────┬────┘
        │                  │                 │
        └──────────────────┼─────────────────┘
                           ↓
                  ┌──────────────────┐
                  │   MySQL Database │
                  │  (Persistent)    │
                  └──────────────────┘
                           
   ┌─────────────────────────────────────────────┐
   │        Multiple Game Servers                │
   │    (Connected via Session Codes)            │
   └─────────────────────────────────────────────┘
```

### Data Model

```
Players
├── id (unique)
├── display_name
├── player_tag (4 digits, auto-generated)
├── email (unique)
├── password_hash
├── is_online
├── created_at

Friendships
├── id
├── player_id (from)
├── friend_id (to)
├── status (pending/accepted/blocked)
├── requested_by
├── created_at

Game Sessions
├── id
├── session_code (6 chars)
├── host_player_id
├── server_id
├── current_players
├── status (waiting/active)
├── created_at

Invites
├── id
├── sender_id
├── receiver_id
├── session_code
├── status (pending/accepted/declined)
├── expires_at (120 seconds)
├── created_at

Tokens
├── refresh_tokens (7 day expiry)
├── remember_tokens (30 day expiry)
```

---

## Authentication & Tokens

### Token Types & Lifetimes

| Token | Lifetime | Purpose | Storage |
|-------|----------|---------|---------|
| **Access Token** (JWT) | 2 hours | API calls | Memory (app) |
| **Refresh Token** | 7 days | Get new access | Secure storage |
| **Remember Token** | 30 days | Auto-login | Keychain/Vault |
| **Admin Token** | 15 minutes | Admin ops | Memory (app) |

### JWT Payload Structure

```json
{
  "id": 42,
  "display_name": "PlayerOne",
  "player_tag": "3847",
  "iat": 1697810445,
  "exp": 1697817645
}
```

### Using Tokens

#### Access Token (Most Common)

```javascript
// Every authenticated request
fetch('http://localhost:41043/player/validate-token', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});
```

#### Refresh Token (When Access Expires)

```javascript
// Request
{
  "refresh_token": "a1b2c3d4e5f6...",
  "player_id": 42
}

// Response - Get new access token
{
  "token": "eyJhbGc...",
  "token_expires_in": "2 hours"
}
```

#### Remember Token (Auto-Login)

```javascript
// First time setup (keep securely)
const rememberToken = loginResponse.remember_token;
secureStorage.save('remember_token', rememberToken);

// On app restart
fetch('http://localhost:41043/player/remember-login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    player_id: 42,
    remember_token: secureStorage.get('remember_token')
  })
});
```

---

## Account Management

### Creating an Account

**Endpoint:** `POST /account/create`

**Request:**
```json
{
  "display_name": "PlayerOne",
  "email": "player@example.com",
  "password": "SecurePass123"
}
```

**Parameters:**
- `display_name` (string, 2-20 chars): Your player name
- `email` (string): Must be unique, valid email format
- `password` (string, 6+ chars): Account password

**Validation Rules:**
- Display name: alphanumeric + underscores, no spaces
- Email: standard email format, checked for uniqueness
- Password: minimum 6 characters recommended (8+ for security)

**Response:**
```json
{
  "status": "success",
  "player_id": 42,
  "player_tag": "3847",
  "message": "Account created successfully. Please login."
}
```

**Error Cases:**
```json
// Email already registered
{
  "status": "error",
  "message": "Email address already registered"
}

// Missing fields
{
  "status": "error",
  "message": "Missing display_name, email, or password"
}

// Password too short
{
  "status": "error",
  "message": "Password must be at least 6 characters long"
}
```

### Logging In

**Endpoint:** `POST /account/login`

**Request:**
```json
{
  "display_name": "PlayerOne",
  "player_tag": "3847",
  "password": "SecurePass123",
  "remember_me": true
}
```

**Parameters:**
- `display_name` (string): Your player name
- `player_tag` (string): 4-digit auto-generated tag
- `password` (string): Your password
- `remember_me` (boolean, optional): Enable auto-login

**Response (Success):**
```json
{
  "status": "success",
  "player_id": 42,
  "session_code": "ABC123",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "a1b2c3d4e5f6g7h8i9j0...",
  "remember_token": "x9y8z7w6v5u4t3s2r1q0...",
  "token_expires_in": "2 hours",
  "refresh_token_expires_in": "7 days",
  "server": {
    "ip": "192.168.1.100",
    "port": 7777
  },
  "message": "Connected to game server"
}
```

**Error Cases:**
```json
// Invalid credentials
{
  "status": "error",
  "message": "Invalid credentials"
}

// No servers available
{
  "status": "error",
  "message": "No game servers available"
}
```

### Password Reset (Future)

_Currently manual process - contact support_

---

## Player System

### Player Lifecycle

```
Create Account → Login → Connect to Server → Play → Disconnect → Logout
```

### Get Online Players

**Endpoint:** `GET /players`

**Query Parameters:**
- `exclude_player_id` (optional): Exclude yourself from list

**Response:**
```json
{
  "players": [
    {
      "id": 10,
      "display_name": "Player1",
      "player_tag": "1234"
    },
    {
      "id": 20,
      "display_name": "Player2",
      "player_tag": "5678"
    }
  ]
}
```

**Use Case:** Show available players to invite

### Lookup Player

**Endpoint:** `GET /player/lookup`

**Query Parameters:**
- `display_name` (required): Player's display name
- `player_tag` (required): Player's 4-digit tag

**Response (Found):**
```json
{
  "player_id": 42,
  "display_name": "PlayerOne",
  "player_tag": "3847",
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

**Use Case:** Find a specific player by name+tag

### Validate Token

**Endpoint:** `GET /player/validate-token`

**Auth:** Required (JWT)

**Response:**
```json
{
  "status": "valid",
  "player": {
    "playerId": 42,
    "displayName": "PlayerOne",
    "playerTag": "3847"
  },
  "message": "Token is valid"
}
```

**Use Case:** Verify token is still valid, refresh if needed

### Player Connection States

```
┌─────────────┐
│   Offline   │ (not connected)
└──────┬──────┘
       │ POST /account/login or /player/connect
       ↓
┌─────────────┐
│   Online    │ (connected to API, assigned to server)
└──────┬──────┘
       │ Assigned Game Session & Server
       ↓
┌─────────────┐
│  In-Game    │ (connected to game server)
└──────┬──────┘
       │ Logout or timeout
       ↓
┌─────────────┐
│   Offline   │
└─────────────┘
```

---

## Friend System

### Send Friend Request

**Endpoint:** `POST /friend/request/send`

**Auth:** Required (JWT)

**Request:**
```json
{
  "friend_id": 50
}
```

**Parameters:**
- `friend_id` (number): ID of player to befriend

**Response:**
```json
{
  "status": "success",
  "message": "Friend request sent"
}
```

**Error Cases:**
```json
// Already friends
{
  "status": "error",
  "message": "Already friends"
}

// Request pending
{
  "status": "error",
  "message": "Friend request already pending"
}

// Blocked by player
{
  "status": "error",
  "message": "This player has blocked you"
}

// Cannot befriend yourself
{
  "status": "error",
  "message": "Invalid friend_id"
}
```

### Respond to Friend Request

**Endpoint:** `POST /friend/request/respond`

**Auth:** Required (JWT)

**Request (Accept):**
```json
{
  "requester_id": 10,
  "response": "accept"
}
```

**Request (Decline):**
```json
{
  "requester_id": 10,
  "response": "decline"
}
```

**Response (Accepted):**
```json
{
  "status": "success",
  "message": "Friend request accepted"
}
```

### Get Friends List

**Endpoint:** `GET /friend/list`

**Auth:** Required (JWT)

**Response:**
```json
{
  "friends": [
    {
      "id": 10,
      "display_name": "Player1",
      "player_tag": "1234",
      "is_online": true
    },
    {
      "id": 20,
      "display_name": "Player2",
      "player_tag": "5678",
      "is_online": false
    }
  ]
}
```

### Block Player

**Endpoint:** `POST /friend/block`

**Auth:** Required (JWT)

**Request:**
```json
{
  "blocked_player_id": 50
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Player blocked"
}
```

### Unblock Player

**Endpoint:** `POST /friend/unblock`

**Auth:** Required (JWT)

**Request:**
```json
{
  "blocked_player_id": 50
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Player unblocked"
}
```

### Friendship States

```
┌──────────────┐
│  No Relation │
└──────┬───────┘
       │ sendFriendRequest
       ↓
┌──────────────────┐
│  Pending Request │
└──────┬───────────┘
       │
    ┌──┴──┐
    ↓     ↓ decline
accept    ┌─────────────┐
    │     │  No Relation│
    ↓     └─────────────┘
┌─────────┐
│ Friends │
└────┬────┘
     │ blockPlayer
     ↓
┌──────────┐
│ Blocked  │
└──────────┘
```

---

## Game Invites

### Send Invite to Session

**Endpoint:** `POST /invite/send`

**Auth:** Required (JWT)

**Request:**
```json
{
  "receiver_id": 50,
  "session_code": "ABC123"
}
```

**Parameters:**
- `receiver_id` (number): ID of player to invite
- `session_code` (string): Session to invite to (6 chars)

**Validation:**
- Receiver must be online
- Session must exist and be active
- Sender must be in the session
- No duplicate pending invites

**Response:**
```json
{
  "status": "success",
  "invite_id": 999,
  "session_code": "ABC123",
  "expires_in": 120
}
```

**Note:** Invites expire after 120 seconds (2 minutes)

**Error Cases:**
```json
// Receiver offline
{
  "status": "error",
  "message": "Receiver not found or offline"
}

// Invite already pending
{
  "status": "error",
  "message": "Already have a pending invite to this player"
}

// Session doesn't exist
{
  "status": "error",
  "message": "Session not found or access denied"
}
```

### Check Pending Invites

**Endpoint:** `GET /invite/check/:playerId`

**Auth:** Required (JWT)

**Path Parameters:**
- `:playerId` (number): Player ID (must match authenticated player)

**Response:**
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

**Use Case:** Check for new invites (client polls frequently)

### Respond to Invite

**Endpoint:** `POST /invite/respond`

**Auth:** Required (JWT)

**Request (Accept):**
```json
{
  "invite_id": 999,
  "response": "accept"
}
```

**Request (Decline):**
```json
{
  "invite_id": 999,
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

**What Happens:**
1. Receiver disconnects from old session (if any)
2. Receiver joins sender's session
3. Player count updated on both servers
4. Old session deleted if player was alone

### Invite Flow Diagram

```
┌─────────────┐
│   Pending   │ (expires in 120s)
└──────┬──────┘
       │
    ┌──┴──────────┐
    ↓             ↓ decline
  accept       ┌──────────┐
    │          │ Declined │
    ↓          └──────────┘
┌─────────┐
│Accepted │
└─────────┘
   │
   ├─→ Receiver moves to sender's session
   ├─→ Player count updated
   └─→ Old session cleaned up if empty
```

---

## Game Sessions

### Session Lifecycle

```
Create (Host creates session)
    ↓
Host joins + gets session_code
    ↓
Host invites friends
    ↓
Friends join
    ↓
Session active (multiple players)
    ↓
Host disconnects
    ↓
Transfer host to another player OR delete session
```

### Session Information

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
1. Connect to game server at `IP:Port`
2. Authenticate with `session_code` on game server
3. Game server validates you belong to that session
4. Game begins

### Session Details

**Session Code:**
- 6 characters (uppercase letters + numbers)
- Unique identifier
- Shared with players you invite
- Used by game server to validate players

**Server Assignment:**
- Automatic load balancing
- Next available server with capacity
- Server IP and port provided
- Connection is direct (no proxy)

**Session State:**
- `waiting`: Host waiting for players to join
- `active`: Game in progress
- `full`: Maximum players reached

### Disconnect & Cleanup

**Endpoint:** `POST /player/disconnect`

**Auth:** Required (JWT)

**Response:**
```json
{
  "status": "success",
  "message": "Player disconnected and session handled"
}
```

**What Happens:**
1. Player marked offline
2. Player removed from session
3. If other players exist: transfer host
4. If player was alone: delete session
5. Server player count updated

---

## Server Management

### Server Architecture

```
┌─────────────────────────────────────────────┐
│           Backend API Server                │
│        (This - handles matchmaking)         │
└──────────────────┬──────────────────────────┘
                   │
      ┌────────────┼────────────┐
      ↓            ↓            ↓
┌──────────┐ ┌──────────┐ ┌──────────┐
│ Game Srv │ │ Game Srv │ │ Game Srv │
│    #1    │ │    #2    │ │    #3    │
│ 8 slots  │ │ 8 slots  │ │ 8 slots  │
└──────────┘ └──────────┘ └──────────┘
   Port        Port          Port
   7777        7778          7779
```

### Register Game Server (Admin Only)

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
X-Admin-Token: <admin_token_from_generate-token>
```

**Parameters:**
- `ip_address` (string): Server IP address
- `port` (number): Game server port
- `max_players` (number): Maximum concurrent players
- `region` (string): Geographic region (for optimization)

**Response:**
```json
{
  "status": "success",
  "server_id": 5,
  "message": "Game server registered"
}
```

### Server Heartbeat (From Game Server)

**Endpoint:** `POST /server/heartbeat`

**Auth:** None (game server internal)

**Request:**
```json
{
  "server_id": 5
}
```

**Frequency:** Every 30 seconds

**Purpose:**
- Keep server marked as active
- Prevent automatic removal after 2 min inactivity

**Response:**
```json
{
  "status": "success",
  "message": "Heartbeat received"
}
```

### Update Server Info (From Game Server)

**Endpoint:** `POST /server/update`

**Auth:** None (game server internal)

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

### Remove Game Server (Admin Only)

**Endpoint:** `POST /server/remove`

**Auth:** Required (X-Admin-Token header)

**Request:**
```json
{
  "session_code": "ABC123"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Server removed"
}
```

---

## Admin Operations

### Admin Token Generation

**Endpoint:** `GET /admin/generate-token`

**Auth:** Required (JWT from admin player account)

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

**Important Notes:**
- Admin token expires after 15 minutes
- Regenerate for each admin session
- Separate from user access tokens
- Use only for admin operations

### Making Admin Requests

```javascript
// Step 1: Get admin token
const adminResponse = await fetch('http://localhost:41043/admin/generate-token', {
  headers: {
    'Authorization': `Bearer ${playerAccessToken}`
  }
});
const { admin_token } = await adminResponse.json();

// Step 2: Use admin token for admin operations
const result = await fetch('http://localhost:41043/server/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Admin-Token': admin_token
  },
  body: JSON.stringify({
    ip_address: '192.168.1.100',
    port: 7777,
    max_players: 8,
    region: 'us-east'
  })
});
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | When | Example |
|------|---------|------|---------|
| 200 | OK | Request succeeded | Any successful call |
| 201 | Created | Resource created | Account created |
| 400 | Bad Request | Invalid input | Missing fields |
| 401 | Unauthorized | Missing auth | No token provided |
| 403 | Forbidden | Auth failed | Invalid token |
| 404 | Not Found | Resource missing | Player not found |
| 409 | Conflict | Duplicate/conflict | Email already exists |
| 429 | Too Many Requests | Rate limit hit | 5 logins in 15m |
| 500 | Server Error | Server issue | Database error |
| 503 | Service Unavailable | Service down | No servers available |

### Error Response Format

```json
{
  "status": "error",
  "message": "Human-readable error message"
}
```

### Common Errors & Solutions

#### "Invalid or expired token"
```javascript
// Problem: Access token expired
// Solution: Refresh the token

const newToken = await refreshAccessToken();
retryRequest(newToken);
```

#### "No game servers available"
```javascript
// Problem: All servers full or offline
// Cause: Servers at capacity or crashed
// Solution: 
// 1. Wait and retry
// 2. Check admin panel
// 3. Bring servers online
```

#### "Email address already registered"
```javascript
// Problem: Email in use
// Solution: 
// 1. Use different email
// 2. Use forgot password flow
// 3. Contact support
```

#### "Too many login attempts"
```javascript
// Problem: Rate limit hit (5 attempts/15 min)
// Solution: Wait 15 minutes before retry
```

---

## Integration Guide

### For Game Developers (Unity/Unreal)

#### Step 1: Include HTTP Client

```csharp
// Unity example
using UnityEngine.Networking;
using System.Collections;
```

#### Step 2: Create Account on First Launch

```csharp
IEnumerator CreateAccount(string displayName, string email, string password)
{
    var request = new UnityWebRequest(
        "http://localhost:41043/account/create",
        "POST"
    );
    
    var body = JsonUtility.ToJson(new CreateAccountRequest
    {
        display_name = displayName,
        email = email,
        password = password
    });
    
    request.uploadHandler = new UploadHandlerRaw(System.Text.Encoding.UTF8.GetBytes(body));
    request.downloadHandler = new DownloadHandlerBuffer();
    request.SetRequestHeader("Content-Type", "application/json");
    
    yield return request.SendWebRequest();
    
    if (request.result == UnityWebRequest.Result.Success)
    {
        var response = JsonUtility.FromJson<CreateAccountResponse>(request.downloadHandler.text);
        PlayerPrefs.SetInt("playerId", response.player_id);
        PlayerPrefs.SetString("playerTag", response.player_tag);
    }
}
```

#### Step 3: Login with Remember-Me

```csharp
IEnumerator Login(string displayName, string playerTag, string password)
{
    // ... create request ...
    
    var loginRequest = new LoginRequest
    {
        display_name = displayName,
        player_tag = playerTag,
        password = password,
        remember_me = true
    };
    
    // ... send request ...
    
    var response = JsonUtility.FromJson<LoginResponse>(request.downloadHandler.text);
    
    // Store tokens
    PlayerPrefs.SetString("accessToken", response.token);
    PlayerPrefs.SetString("refreshToken", response.refresh_token);
    PlayerPrefs.SetString("rememberToken", response.remember_token);
    
    // Connect to game server
    ConnectToGameServer(response.server.ip, response.server.port, response.session_code);
}
```

#### Step 4: Send/Receive Invites

```csharp
IEnumerator SendInvite(int receiverId)
{
    var request = new UnityWebRequest("http://localhost:41043/invite/send", "POST");
    
    var body = JsonUtility.ToJson(new InviteRequest
    {
        receiver_id = receiverId,
        session_code = currentSessionCode
    });
    
    request.uploadHandler = new UploadHandlerRaw(System.Text.Encoding.UTF8.GetBytes(body));
    request.downloadHandler = new DownloadHandlerBuffer();
    request.SetRequestHeader("Authorization", $"Bearer {accessToken}");
    request.SetRequestHeader("Content-Type", "application/json");
    
    yield return request.SendWebRequest();
}

IEnumerator CheckInvites(int playerId)
{
    var request = new UnityWebRequest(
        $"http://localhost:41043/invite/check/{playerId}",
        "GET"
    );
    
    request.downloadHandler = new DownloadHandlerBuffer();
    request.SetRequestHeader("Authorization", $"Bearer {accessToken}");
    
    yield return request.SendWebRequest();
    
    var response = JsonUtility.FromJson<InviteCheckResponse>(request.downloadHandler.text);
    
    // Process invites
    foreach (var invite in response.invites)
    {
        ShowInviteUI(invite.sender_name, invite.session_code);
    }
}
```

#### Step 5: Handle Token Refresh

```csharp
IEnumerator RefreshAccessToken()
{
    var request = new UnityWebRequest(
        "http://localhost:41043/player/refresh-token",
        "POST"
    );
    
    var body = JsonUtility.ToJson(new RefreshRequest
    {
        refresh_token = PlayerPrefs.GetString("refreshToken"),
        player_id = PlayerPrefs.GetInt("playerId")
    });
    
    request.uploadHandler = new UploadHandlerRaw(System.Text.Encoding.UTF8.GetBytes(body));
    request.downloadHandler = new DownloadHandlerBuffer();
    request.SetRequestHeader("Content-Type", "application/json");
    
    yield return request.SendWebRequest();
    
    var response = JsonUtility.FromJson<TokenResponse>(request.downloadHandler.text);
    PlayerPrefs.SetString("accessToken", response.token);
}
```

### For Web Applications

```javascript
// Example React integration
import axios from 'axios';

const API_BASE = 'http://localhost:41043';

class GameAPI {
  constructor() {
    this.accessToken = localStorage.getItem('accessToken');
  }

  async createAccount(displayName, email, password) {
    const response = await axios.post(`${API_BASE}/account/create`, {
      display_name: displayName,
      email,
      password
    });
    return response.data;
  }

  async login(displayName, playerTag, password) {
    const response = await axios.post(`${API_BASE}/account/login`, {
      display_name: displayName,
      player_tag: playerTag,
      password,
      remember_me: true
    });
    
    this.accessToken = response.data.token;
    localStorage.setItem('accessToken', this.accessToken);
    localStorage.setItem('refreshToken', response.data.refresh_token);
    
    return response.data;
  }

  async getOnlinePlayers() {
    const response = await axios.get(`${API_BASE}/players`);
    return response.data.players;
  }

  async sendInvite(receiverId, sessionCode) {
    const response = await axios.post(
      `${API_BASE}/invite/send`,
      { receiver_id: receiverId, session_code: sessionCode },
      { headers: { 'Authorization': `Bearer ${this.accessToken}` } }
    );
    return response.data;
  }

  async checkInvites(playerId) {
    const response = await axios.get(
      `${API_BASE}/invite/check/${playerId}`,
      { headers: { 'Authorization': `Bearer ${this.accessToken}` } }
    );
    return response.data.invites;
  }
}

export default new GameAPI();
```

---

## Best Practices

### Security

✅ **DO:**
- Store remember tokens in secure storage (Keychain on iOS, Vault on Android)
- Use HTTPS in production
- Validate inputs client-side before sending
- Implement token refresh before expiration
- Never expose API secrets in client code
- Use strong passwords (12+ characters)

❌ **DON'T:**
- Store sensitive tokens in PlayerPrefs/localStorage
- Hardcode API base URL or credentials
- Make requests from public WiFi without VPN
- Use the same password across multiple services
- Expose admin tokens in client logs

### Performance

✅ **DO:**
- Cache player lists locally
- Batch requests when possible
- Implement exponential backoff for retries
- Check invites every 5-10 seconds (not constantly)
- Use connection pooling on server

❌ **DON'T:**
- Poll `/invite/check` more than every 5 seconds
- Create new HTTP connections per request
- Store entire player database client-side
- Make requests in tight loops

### Error Handling

✅ **DO:**
- Implement retry logic with exponential backoff
- Show user-friendly error messages
- Log errors for debugging
- Handle network timeouts gracefully
- Implement fallback UI states

```javascript
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => 
        setTimeout(resolve, Math.pow(2, i) * 1000)
      );
    }
  }
}
```

### Data Privacy

✅ **DO:**
- Comply with GDPR/CCPA
- Implement account deletion endpoint
- Never share player data with third parties
- Encrypt sensitive data in transit
- Use environment variables for secrets

❌ **DON'T:**
- Store passwords in plain text (already done with bcryptjs)
- Log sensitive player information
- Sell or share player data
- Use weak encryption algorithms

---

## Troubleshooting

### Common Issues & Solutions

#### **Issue: "Invalid credentials" on login**

**Causes:**
1. Typo in display_name or player_tag
2. Wrong password
3. Account doesn't exist

**Solutions:**
```javascript
// Verify account exists
const player = await API.lookupPlayer(displayName, playerTag);

// Double-check spelling
console.log(displayName, playerTag); // Check console output

// Case-sensitive?
// display_name might be case-insensitive but verify
```

#### **Issue: Token keeps expiring**

**Causes:**
1. Access token has 2-hour lifetime
2. Refresh token not stored properly
3. Clock skew between client/server

**Solutions:**
```javascript
// Implement automatic refresh before expiry
const accessTokenExpiry = Date.now() + (2 * 60 * 60 * 1000); // 2 hours
const refreshInterval = setInterval(async () => {
  if (Date.now() > accessTokenExpiry - (5 * 60 * 1000)) { // Refresh 5 min before expiry
    await refreshAccessToken();
  }
}, 60000); // Check every minute
```

#### **Issue: "No game servers available"**

**Causes:**
1. All servers at max capacity
2. All servers offline/crashed
3. No servers registered

**Solutions:**
```javascript
// Option 1: Implement queue
function joinQueue() {
  pollForAvailableServer(5000); // Check every 5 seconds
}

// Option 2: Show user message
showDialog("All servers full. Please try again in 1 minute.");

// Admin: Check server status
// POST /server/register to bring servers online
```

#### **Issue: Invites not received**

**Causes:**
1. Polling interval too long
2. Invite expired (120 second timeout)
3. Receiver offline
4. Network issue

**Solutions:**
```javascript
// Increase polling frequency
const pollInvites = () => {
  checkInvites(playerId);
  setTimeout(pollInvites, 5000); // Every 5 seconds instead of 10
};

// Make sure receiver is online
const receiver = await API.lookupPlayer(receiverName, receiverTag);
if (!receiver.is_online) {
  showError("Player is offline");
}

// Check network connectivity
if (!navigator.onLine) {
  showError("No internet connection");
}
```

#### **Issue: Can't connect to game server**

**Causes:**
1. Wrong IP or port
2. Game server firewall
3. Wrong session_code
4. Session expired

**Solutions:**
```javascript
// Verify IP and port
console.log(`Connecting to ${serverIP}:${serverPort}`);
console.log(`Session code: ${sessionCode}`);

// Check firewall rules
// Ensure port 7777+ are open on game server

// Validate session code
const sessionCodeRegex = /^[A-Z0-9]{6}$/;
if (!sessionCodeRegex.test(sessionCode)) {
  console.error("Invalid session code format");
}

// Re-login if session stale
if (timeSinceLogin > 2 * 60 * 60 * 1000) { // 2 hours
  await login(displayName, playerTag, password);
}
```

#### **Issue: Database connection errors**

**Causes:**
1. MySQL server down
2. Connection pool exhausted
3. Network issue
4. Wrong credentials

**Solutions (for Admin):**
```bash
# Check MySQL status
systemctl status mysql

# Check connection pool
netstat -an | grep 3306

# Verify credentials in .env
cat server/.env | grep DB_

# Restart API server
systemctl restart game-invites-api
```

### Debugging Tools

```javascript
// Enable detailed logging
const DEBUG = true;

function log(message, data) {
  if (DEBUG) {
    console.log(`[${new Date().toISOString()}] ${message}`, data);
  }
}

// Log all API calls
const originalFetch = window.fetch;
window.fetch = function(...args) {
  log('API Call', args[0]);
  return originalFetch.apply(this, args)
    .then(response => {
      log('API Response', { status: response.status });
      return response;
    })
    .catch(error => {
      log('API Error', error);
      throw error;
    });
};
```

---

## API Endpoints Summary

### Authentication
- `POST /account/create` - Create new account
- `POST /account/login` - Login with credentials
- `POST /player/refresh-token` - Refresh access token
- `POST /player/remember-login` - Auto-login with remember token
- `GET /player/validate-token` - Verify token validity

### Players
- `GET /players` - Get online players list
- `GET /player/lookup` - Find specific player
- `POST /player/connect` - Connect existing player
- `POST /player/disconnect` - Disconnect player
- `POST /player/logout` - Logout and cleanup

### Friends
- `POST /friend/request/send` - Send friend request
- `POST /friend/request/respond` - Accept/decline friend request
- `GET /friend/list` - Get friends list
- `POST /friend/block` - Block player
- `POST /friend/unblock` - Unblock player

### Invites
- `POST /invite/send` - Send session invite
- `GET /invite/check/:playerId` - Check pending invites
- `POST /invite/respond` - Accept/decline invite

### Server Management
- `POST /server/register` - Register game server (admin)
- `POST /server/update` - Update server info
- `POST /server/heartbeat` - Server heartbeat
- `POST /server/remove` - Remove game server (admin)

### Admin
- `GET /admin/generate-token` - Generate admin token

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0 | Oct 21, 2025 | Auto-generated 4-digit tags, Master docs |
| 1.5 | Oct 19, 2025 | Friend system, remember tokens |
| 1.0 | Oct 1, 2025 | Initial release |

---

## Support & Resources

- **Documentation:** This master doc + individual endpoint docs
- **Issues:** Contact via support email
- **Rate Limits:** 100 req/min per IP (login: 5/15min, create: 3/hour)
- **SLA:** 99.9% uptime target
- **Status:** ✅ Production Ready

---

**Last Updated:** October 21, 2025  
**Maintained By:** Development Team  
**License:** Proprietary  

🚀 **Ready to build? Start with the Quick Start section above!**
