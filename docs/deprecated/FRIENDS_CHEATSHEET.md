# Friends System - Quick Cheat Sheet

**10 API Endpoints | All Protected (require auth) | Complete with Examples**

---

## Endpoint Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/friend/request` | POST | Send friend request |
| `/friend/requests` | GET | Get pending requests YOU received |
| `/friend/accept` | POST | Accept pending request |
| `/friend/decline` | POST | Decline pending request |
| `/friends` | GET | Get your accepted friends |
| `/friend/remove` | POST | Remove a friend |
| `/friend/block` | POST | Block a player |
| `/friend/unblock` | POST | Unblock a player |
| `/friend/blocked` | GET | Get list of blocked players |
| `/friend/check/:friend_id` | GET | Check relationship status |

---

## Quick API Reference

### 1. Send Friend Request
```bash
curl -X POST https://your-backend.com/friend/request \
	-H "Authorization: Bearer YOUR_TOKEN" \
	-H "Content-Type: application/json" \
	-d '{"friend_id": 456}'

# Response 201:
# { "status": "success", "message": "Friend request sent" }
```

### 2. Get Pending Friend Requests
```bash
curl https://your-backend.com/friend/requests \
	-H "Authorization: Bearer YOUR_TOKEN"

# Response 200:
# {
#   "status": "success",
#   "count": 3,
#   "requests": [
#     {"request_id": 101, "player_id": 123, "display_name": "Player1", ...},
#     {"request_id": 102, "player_id": 456, "display_name": "Player2", ...}
#   ]
# }
```

### 3. Accept Friend Request
```bash
curl -X POST https://your-backend.com/friend/accept \
	-H "Authorization: Bearer YOUR_TOKEN" \
	-H "Content-Type: application/json" \
	-d '{"request_id": 101}'

# Response 200:
# { "status": "success", "message": "Friend request accepted" }
```

### 4. Decline Friend Request
```bash
curl -X POST https://your-backend.com/friend/decline \
	-H "Authorization: Bearer YOUR_TOKEN" \
	-H "Content-Type: application/json" \
	-d '{"request_id": 101}'

# Response 200:
# { "status": "success", "message": "Friend request declined" }
```

### 5. Get Friends List
```bash
curl https://your-backend.com/friends \
	-H "Authorization: Bearer YOUR_TOKEN"

# Response 200:
# {
#   "status": "success",
#   "count": 5,
#   "friends": [
#     {
#       "friendship_id": 201,
#       "player_id": 123,
#       "display_name": "BestFriend",
#       "player_tag": "#1234",
#       "is_online": true,
#       "friends_since": "2024-12-01T08:00:00Z"
#     }
#   ]
# }
```

### 6. Remove Friend
```bash
curl -X POST https://your-backend.com/friend/remove \
	-H "Authorization: Bearer YOUR_TOKEN" \
	-H "Content-Type: application/json" \
	-d '{"friend_id": 456}'

# Response 200:
# { "status": "success", "message": "Friend removed" }
```

### 7. Block Player
```bash
curl -X POST https://your-backend.com/friend/block \
	-H "Authorization: Bearer YOUR_TOKEN" \
	-H "Content-Type: application/json" \
	-d '{"player_to_block": 789}'

# Response 200:
# { "status": "success", "message": "Player blocked" }
```

### 8. Unblock Player
```bash
curl -X POST https://your-backend.com/friend/unblock \
	-H "Authorization: Bearer YOUR_TOKEN" \
	-H "Content-Type: application/json" \
	-d '{"player_to_unblock": 789}'

# Response 200:
# { "status": "success", "message": "Player unblocked" }
```

### 9. Get Blocked List
```bash
curl https://your-backend.com/friend/blocked \
	-H "Authorization: Bearer YOUR_TOKEN"

# Response 200:
# {
#   "status": "success",
#   "count": 2,
#   "blocked": [
#     {
#       "block_id": 301,
#       "player_id": 789,
#       "display_name": "ToxicPlayer",
#       "player_tag": "#XXXX",
#       "blocked_at": "2025-01-10T14:30:00Z"
#     }
#   ]
# }
```

### 10. Check Relationship Status
```bash
curl https://your-backend.com/friend/check/456 \
	-H "Authorization: Bearer YOUR_TOKEN"

# Response 200:
# { "status": "success", "is_friend": true, "relationship": "accepted" }
#
# OR
#
# { "status": "success", "is_friend": false, "relationship": "none" }
#
# Possible relationships: "none", "pending", "accepted", "blocked"
```

---

## Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| 201 | Created (friend request sent) | Success |
| 200 | OK | Success |
| 400 | Bad input | Check parameters |
| 401 | Invalid token | Re-authenticate |
| 403 | Blocked/blocking | Check block status |
| 404 | Not found | Verify player_id |
| 409 | Conflict (already friends/pending) | Check status first |

---

## Flow Examples

### Making Friends (Happy Path)
```
1. Player A: POST /friend/request {"friend_id": 456}
	 ✅ Response: Friend request sent

2. Player B: GET /friend/requests
	 ✅ Response: Shows request from A with request_id=101

3. Player B: POST /friend/accept {"request_id": 101}
	 ✅ Response: Friend request accepted

4. Player A: GET /friends
	 ✅ Response: Shows B in friends list
   
5. Player B: GET /friends
	 ✅ Response: Shows A in friends list
```

### Blocking a Player
```
1. Player A: POST /friend/block {"player_to_block": 789}
	 ✅ Response: Player blocked

2. Player A: GET /friend/blocked
	 ✅ Response: Shows player 789 in blocked list

3. Player 789: POST /friend/request {"friend_id": A_ID}
	 ❌ Response 403: "This player has blocked you"

4. Player A: POST /friend/unblock {"player_to_unblock": 789}
	 ✅ Response: Player unblocked

5. Player 789: POST /friend/request {"friend_id": A_ID}
	 ✅ Response: Friend request sent (now can add)
```

---

## Unity Code Snippets

### Minimal: Send Friend Request
```csharp
public IEnumerator SendFriendRequest(int friendId)
{
		var request = new { friend_id = friendId };
		string json = JsonUtility.ToJson(request);
    
		using (UnityWebRequest www = new UnityWebRequest($"{API_BASE_URL}/friend/request", "POST"))
		{
				byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(json);
				www.uploadHandler = new UploadHandlerRaw(bodyRaw);
				www.downloadHandler = new DownloadHandlerBuffer();
				www.SetRequestHeader("Content-Type", "application/json");
				www.SetRequestHeader("Authorization", $"Bearer {accessToken}");
        
				yield return www.SendWebRequest();
        
				if (www.result == UnityWebRequest.Result.Success)
				{
						Debug.Log("Friend request sent!");
				}
				else if (www.responseCode == 409)
				{
						Debug.LogWarning("Already friends or request pending");
				}
				else
				{
						Debug.LogError($"Error: {www.error}");
				}
		}
}
```

---

This file provides quick examples and is now the actual content copied from the root documentation.

