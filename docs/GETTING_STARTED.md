# 🚀 Getting Started with Game Invites Backend

**Quick Start Guide** | Version 2.0 | October 27, 2025

---

## Welcome! 👋

The **Game Invites Backend** is a production-ready Node.js API for multiplayer gaming. This guide will get you up and running in **30 minutes**.

---

## ⚡ 5-Minute Overview

### What It Does
- 🔐 **User Accounts** - Create, login, token management
- 👥 **Friends** - Add, block, manage relationships
- 🎮 **Game Sessions** - Create and join multiplayer games
- 📨 **Invites** - Send session invites to friends (2-minute expiry)
- 🖥️ **Servers** - Support multiple game servers with load balancing
- ⚙️ **Admin** - Server registration and management

### Quick Facts
- **API Base URL:** `http://localhost:41043`
- **Authentication:** JWT Tokens
- **Database:** MySQL
- **Framework:** Express.js (Node.js)
- **Status:** ✅ Production Ready

---

## 🚀 Quick Start (Choose Your Path)

### Path 1: Test with cURL (5 minutes)

**1. Create an account:**
```bash
curl -X POST http://localhost:41043/account/create \
  -H "Content-Type: application/json" \
  -d '{
    "display_name": "TestPlayer",
    "email": "test@example.com",
    "password": "Password123!"
  }'
```

**Response:**
```json
{
  "status": "success",
  "player_id": 1,
  "player_tag": "3847",
  "message": "Account created successfully. Please login."
}
```

**2. Login:**
```bash
curl -X POST http://localhost:41043/account/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Password123!"
  }'
```

**Response (Save the access_token!):**
```json
{
  "status": "success",
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "player_id": 1,
  "remember_token": "optional_30day_token"
}
```

**3. Use the API (with your access_token):**
```bash
curl -X GET http://localhost:41043/players/online \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

✅ **That's it! You're connected to the API.**

---

### Path 2: Unity Integration (30 minutes)

**Step 1: Add using statements:**
```csharp
using UnityEngine;
using UnityEngine.Networking;
using System.Collections;
```

**Step 2: Create account:**
```csharp
IEnumerator CreateAccount()
{
    var jsonData = new 
    { 
        display_name = "PlayerOne",
        email = "player@example.com",
        password = "SecurePass123!"
    };
    
    using (UnityWebRequest request = UnityWebRequest.Post(
        "http://localhost:41043/account/create",
        JsonUtility.ToJson(jsonData),
        "application/json"))
    {
        yield return request.SendWebRequest();
        
        if (request.result == UnityWebRequest.Result.Success)
        {
            Debug.Log("Account created: " + request.downloadHandler.text);
        }
    }
}
```

**Step 3: Login:**
```csharp
IEnumerator Login(string email, string password)
{
    var jsonData = new { email = email, password = password };
    
    using (UnityWebRequest request = UnityWebRequest.Post(
        "http://localhost:41043/account/login",
        JsonUtility.ToJson(jsonData),
        "application/json"))
    {
        yield return request.SendWebRequest();
        
        if (request.result == UnityWebRequest.Result.Success)
        {
            var response = JsonUtility.FromJson<LoginResponse>(
                request.downloadHandler.text);
            PlayerPrefs.SetString("access_token", response.access_token);
            Debug.Log("Login successful!");
        }
    }
}
```

**Step 4: Make API calls with token:**
```csharp
IEnumerator GetOnlinePlayers()
{
    string token = PlayerPrefs.GetString("access_token");
    
    using (UnityWebRequest request = UnityWebRequest.Get(
        "http://localhost:41043/players/online"))
    {
        request.SetRequestHeader("Authorization", $"Bearer {token}");
        yield return request.SendWebRequest();
        
        if (request.result == UnityWebRequest.Result.Success)
        {
            Debug.Log("Online players: " + request.downloadHandler.text);
        }
    }
}
```

✅ **Now you can make API calls from Unity!**

For complete examples, see: `docs/UNITY_INTEGRATION.md`

---

### Path 3: Web/JavaScript (20 minutes)

**Using Fetch API:**

```javascript
// 1. Create account
async function createAccount() {
    const response = await fetch('http://localhost:41043/account/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            display_name: 'PlayerOne',
            email: 'player@example.com',
            password: 'SecurePass123!'
        })
    });
    return response.json();
}

// 2. Login
async function login(email, password) {
    const response = await fetch('http://localhost:41043/account/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const data = response.json();
    localStorage.setItem('access_token', data.access_token);
    return data;
}

// 3. Make API calls
async function getOnlinePlayers() {
    const token = localStorage.getItem('access_token');
    const response = await fetch('http://localhost:41043/players/online', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.json();
}
```

✅ **Web integration ready!**

---

## 📚 Core Concepts (5 minutes)

### Authentication System

Your system uses a **3-token system** for maximum flexibility:

| Token | Purpose | Expiry | Use |
|-------|---------|--------|-----|
| **Access Token** | API calls | 2 hours | Most API requests |
| **Refresh Token** | Get new access token | 7 days | Refresh when access expires |
| **Remember Token** | Auto-login | 30 days | Optional "remember me" |

**Flow:**
```
1. Login with email/password → Get Access + Refresh tokens
2. Use Access token for API calls
3. Access token expires → Use Refresh token to get new one
4. (Optional) Save Remember token for auto-login next session
```

### Entities & Relationships

```
Player (User Account)
├── Can have many Friends
├── Can send/receive Invites
├── Can create Sessions (as Host)
└── Belongs to one or more Sessions

Session (Game Instance)
├── Has one Host (Player)
├── Has many Members (Players)
├── Can receive Invites
└── Assigned to Server

Invite
├── From: Sender (Player)
├── To: Receiver (Player)
├── For: Session
└── Expires: 2 minutes

Friend
├── Initiator (Player)
├── Recipient (Player)
└── Status: pending/accepted/blocked
```

### API Methods

All endpoints use standard REST:

```
GET  /endpoint          → Retrieve data
POST /endpoint          → Create/Send data
PUT  /endpoint          → Update data
DELETE /endpoint        → Delete/Remove data
```

### Response Format

**Success (200):**
```json
{
  "status": "success",
  "data": { /* your data */ },
  "message": "Operation completed"
}
```

**Error (4xx/5xx):**
```json
{
  "status": "error",
  "code": "ERROR_CODE",
  "message": "Human-readable error"
}
```

---

## 🎯 Next Steps

### 1️⃣ Choose Your Integration Path
- **Unity?** → Read `docs/UNITY_INTEGRATION.md`
- **Unreal?** → Check code examples in `docs/MASTER_DOCUMENTATION.md`
- **Web/JavaScript?** → See `docs/API_REFERENCE.md`
- **Custom Engine?** → Use REST API examples in `docs/API_REFERENCE.md`

### 2️⃣ Learn Key Features
- **Friends System** → `docs/FRIENDS_SYSTEM.md`
- **Game Invites** → `docs/MASTER_DOCUMENTATION.md` → Game Invites section
- **Sessions** → `docs/MASTER_DOCUMENTATION.md` → Game Sessions section
- **Servers** → `docs/MASTER_DOCUMENTATION.md` → Server Management section

### 3️⃣ Reference Quick Guides
- **Endpoints** → `docs/ENDPOINTS_CHEATSHEET.md`
- **Friends** → `docs/FRIENDS_CHEATSHEET.md`
- **Error Codes** → `docs/API_REFERENCE.md` → Error Codes section
- **Examples** → `docs/MASTER_DOCUMENTATION.md` → Integration Guide section

### 4️⃣ Deploy When Ready
- **Pre-Launch** → `docs/PRODUCTION_READINESS.md`
- **Deploy Guide** → `docs/DEPLOYMENT_GUIDE.md`
- **Security Review** → `docs/SECURITY_AUDIT.md`

---

## 📖 Full Documentation

| Document | Use For |
|----------|---------|
| `MASTER_DOCUMENTATION.md` | Complete system overview (start here for deep learning) |
| `API_REFERENCE.md` | All endpoints with details |
| `ENDPOINTS_CHEATSHEET.md` | Quick endpoint lookup |
| `UNITY_INTEGRATION.md` | Complete Unity guide |
| `FRIENDS_SYSTEM.md` | Friends feature details |
| `SECURITY_AUDIT.md` | Security information |
| `DEPLOYMENT_GUIDE.md` | How to deploy |
| `PRODUCTION_READINESS.md` | Pre-deployment checklist |

---

## ❓ Common Questions

### Q: How do I store tokens securely?

**For Game Engines (Unity/Unreal):**
- Use engine's encrypted PlayerPrefs/FSettings
- Never log or expose tokens
- Consider secure key storage in production

**For Web:**
- Use httpOnly cookies (not localStorage)
- Or use secure session storage on backend
- Never expose tokens in URLs

### Q: What if my access token expires?

**Solution:**
1. Save the **Refresh Token** from login
2. When access token expires (401 error), use the refresh endpoint:

```bash
POST /account/refresh
{
  "refresh_token": "your_refresh_token"
}
```

3. You'll get a new access token
4. Continue with your API calls

### Q: Can I invite players who aren't friends?

**Yes!** The invite system works independently from friends. You can:
- Invite anyone by their player_id
- Invites expire in 2 minutes
- Friends system is optional

### Q: How do I join a session?

**Method 1: Get invited**
- Receive an invite (real-time notification)
- Accept the invite
- You're automatically added to the session

**Method 2: Direct join**
- If you know the session_id
- Use the join endpoint directly

### Q: What happens if the host disconnects?

- If host has a backup player, they take over
- If no backup, session closes
- All members are notified

---

## 🆘 Troubleshooting

### "Connection refused" error
**Solution:** Make sure the API is running
```bash
# In server folder:
node server.js
# or if using npm scripts:
npm start
```

### "Invalid credentials" on login
**Check:**
- Email is correct (case-sensitive)
- Password matches (case-sensitive)
- Account was created successfully

### "Unauthorized" (401) error
**Means:** Your access token is missing or expired
**Solution:**
- Add `Authorization: Bearer YOUR_TOKEN` header
- If expired, use refresh token to get a new one

### "Token expired" on refresh
**The refresh token expired (7 days)**
**Solution:** User needs to login again to get new tokens

### Can't see friends list
**Check:**
- You sent friend requests that were accepted
- Use endpoint: `GET /friends/list`
- Blocked friends won't appear

---

## 🎓 Learning Resources

- **Full Master Docs:** `docs/MASTER_DOCUMENTATION.md`
- **API Explorer:** Use `docs/ENDPOINTS_CHEATSHEET.md` with cURL/Postman
- **Code Examples:** All in `docs/` files and integration guides
- **Website:** Open `webDoc/index.html` for interactive docs

---

## ✅ Verification Checklist

Before moving to production:

- [ ] Can create accounts
- [ ] Can login and get tokens
- [ ] Can refresh tokens
- [ ] Can make API calls with token
- [ ] Can see online players
- [ ] Can send friend requests
- [ ] Can create game sessions
- [ ] Can invite players to sessions
- [ ] Can join sessions via invite

---

## 🚀 You're Ready!

**You now understand:**
- ✅ What the API does
- ✅ How authentication works
- ✅ How to make your first API calls
- ✅ Where to find detailed docs

**Next:** Choose your integration path above and start building! 🎮

**Questions?** Check `docs/INDEX.md` for a searchable documentation index.

---

**Created:** October 27, 2025  
**Status:** ✅ Current  
**Last Verified:** Production Ready
