# ⚡ QUICK START - LOCAL TEST

## 🚀 2-Minute Setup

### Terminal 1 - Start Server
```powershell
cd c:\Users\rapto\OneDrive\Desktop\game_invites_backend\server
node server.js
```

### Terminal 2 - Create Friendships Table
```powershell
mysql -h localhost -u root -p tidal_hunters
```

Then paste:
```sql
CREATE TABLE IF NOT EXISTS friendships (
  id INT AUTO_INCREMENT PRIMARY KEY,
  player_id INT NOT NULL,
  friend_id INT NOT NULL,
  status ENUM('pending', 'accepted', 'blocked') DEFAULT 'pending',
  requested_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY (friend_id) REFERENCES players(id) ON DELETE CASCADE,
  UNIQUE KEY unique_friendship (player_id, friend_id)
);
```

### Terminal 3 - Run Tests
```powershell
cd c:\Users\rapto\OneDrive\Desktop\game_invites_backend\server
node test-client.js
```

## ✅ Expected Result

```
🎉 ALL TESTS PASSED! System is working correctly.

✅ Passed: 17
❌ Failed: 0
✔️ Success Rate: 100.0%
```

---

## 📊 What Gets Tested

- ✅ Account creation
- ✅ Login & JWT tokens
- ✅ WebSocket connections (real-time)
- ✅ Heartbeat mechanism
- ✅ Friend system (add, accept, decline, block)
- ✅ Invite system (send, receive, accept, decline)
- ✅ Player online status

---

## 🔧 Troubleshooting

| Problem | Solution |
|---------|----------|
| "Server is not responding" | Make sure `node server.js` is running |
| "WebSocket connection timeout" | Check server logs for errors |
| "Table doesn't exist" | Run the SQL migration above |
| Tests hang | Restart server and try again |

---

## 📝 Test Files

- `test-client.js` - Run the tests
- `TEST_RESULTS.md` - Last run results
- `LOCAL_TEST_SUMMARY.md` - Full guide

---

**Estimated time:** 2 minutes
**Success rate:** Should be 100% after setup
