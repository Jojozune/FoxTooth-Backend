// TEST_FRIEND_CLIENT.cs - Fast Friend System Test Client
// Place in Assets/Scripts/Testing/ in your Unity project
// Quick workflow for testing friend system without full game setup

using UnityEngine;
using UnityEngine.Networking;
using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;

[System.Serializable]
public class FriendTestConfig
{
    public string serverUrl = "http://localhost:3000";  // Change to your server
    public string player1Email = "player1@test.com";
    public string player1Password = "password123";
    public string player2Email = "player2@test.com";
    public string player2Password = "password123";
    public string player3Email = "player3@test.com";
    public string player3Password = "password123";
}

[System.Serializable]
public class TestPlayer
{
    public int playerId;
    public string displayName;
    public string playerTag;
    public string email;
    public string password;
    public string accessToken;
    public string refreshToken;
    public List<FriendData> friends = new List<FriendData>();
    public List<FriendRequest> pendingRequests = new List<FriendRequest>();
    public List<FriendData> blocked = new List<FriendData>();
}

[System.Serializable]
public class FriendData
{
    public int player_id;
    public string display_name;
    public string player_tag;
    public bool is_online;
    public string friends_since;

    public string DisplayInfo() => $"{display_name}#{player_tag} (ID: {player_id})";
}

[System.Serializable]
public class FriendRequest
{
    public int request_id;
    public int player_id;
    public string display_name;
    public string player_tag;
    public bool is_online;
    public string created_at;

    public string DisplayInfo() => $"{display_name}#{player_tag} (ID: {player_id})";
}

public class TestFriendClient : MonoBehaviour
{
    [SerializeField] private FriendTestConfig config = new FriendTestConfig();
    
    private TestPlayer player1;
    private TestPlayer player2;
    private TestPlayer player3;
    
    private bool testsPassed = 0;
    private bool testsFailed = 0;
    
    private void Start()
    {
        // Initialize test players
        player1 = new TestPlayer 
        { 
            email = config.player1Email, 
            password = config.player1Password,
            displayName = "TestPlayer1"
        };
        player2 = new TestPlayer 
        { 
            email = config.player2Email, 
            password = config.player2Password,
            displayName = "TestPlayer2"
        };
        player3 = new TestPlayer 
        { 
            email = config.player3Email, 
            password = config.player3Password,
            displayName = "TestPlayer3"
        };
        
        // Uncomment to run tests
        // StartCoroutine(RunAllFriendTests());
    }
    
    // ========== TEST WORKFLOW ==========
    public IEnumerator RunAllFriendTests()
    {
        Debug.Log("=== 🧪 FRIEND SYSTEM TEST WORKFLOW STARTING ===");
        
        // Phase 1: Account Creation & Login
        Debug.Log("\n📝 Phase 1: Account Creation & Login");
        yield return CreateAndLoginPlayers();
        
        // Phase 2: Send Friend Requests
        Debug.Log("\n📤 Phase 2: Send Friend Requests");
        yield return SendFriendRequests();
        
        // Phase 3: Check Pending Requests
        Debug.Log("\n📬 Phase 3: Check Pending Requests");
        yield return CheckPendingRequests();
        
        // Phase 4: Accept & Decline Requests
        Debug.Log("\n✅ Phase 4: Accept & Decline Friend Requests");
        yield return RespondToRequests();
        
        // Phase 5: Check Friends Lists
        Debug.Log("\n👥 Phase 5: Check Friends Lists");
        yield return CheckFriendsLists();
        
        // Phase 6: Block & Unblock
        Debug.Log("\n🚫 Phase 6: Block & Unblock Players");
        yield return BlockUnblockPlayers();
        
        // Phase 7: Remove Friend
        Debug.Log("\n🗑️ Phase 7: Remove Friend");
        yield return RemoveFriend();
        
        // Print results
        Debug.Log("\n=== 📊 TEST RESULTS ===");
        Debug.Log($"✅ Passed: {testsPassed}");
        Debug.Log($"❌ Failed: {testsFailed}");
        Debug.Log($"Total: {testsPassed + testsFailed}");
    }
    
    // ========== PHASE 1: CREATE ACCOUNTS & LOGIN ==========
    private IEnumerator CreateAndLoginPlayers()
    {
        Debug.Log("1️⃣ Creating accounts...");
        yield return CreateAccount(player1);
        yield return CreateAccount(player2);
        yield return CreateAccount(player3);
        
        Debug.Log("2️⃣ Logging in...");
        yield return Login(player1);
        yield return Login(player2);
        yield return Login(player3);
        
        Debug.Log("✅ All players created and logged in");
    }
    
    // ========== PHASE 2: SEND FRIEND REQUESTS ==========
    private IEnumerator SendFriendRequests()
    {
        Debug.Log("Player1 → Player2");
        yield return SendFriendRequest(player1, player2.playerId);
        
        Debug.Log("Player1 → Player3");
        yield return SendFriendRequest(player1, player3.playerId);
        
        Debug.Log("Player2 → Player3");
        yield return SendFriendRequest(player2, player3.playerId);
        
        Debug.Log("✅ Friend requests sent");
    }
    
    // ========== PHASE 3: CHECK PENDING REQUESTS ==========
    private IEnumerator CheckPendingRequests()
    {
        Debug.Log("Checking Player2's pending requests...");
        yield return GetFriendRequests(player2);
        
        Debug.Log("Checking Player3's pending requests...");
        yield return GetFriendRequests(player3);
    }
    
    // ========== PHASE 4: ACCEPT & DECLINE ==========
    private IEnumerator RespondToRequests()
    {
        // Player2 accepts Player1's request
        if (player2.pendingRequests.Count > 0)
        {
            var request = player2.pendingRequests.First(r => r.player_id == player1.playerId);
            Debug.Log($"Player2 accepting request from {request.DisplayInfo()}");
            yield return AcceptFriendRequest(player2, request.request_id);
            player2.pendingRequests.Remove(request);
        }
        
        // Player3 declines Player1's request
        if (player3.pendingRequests.Count > 0)
        {
            var request = player3.pendingRequests.First(r => r.player_id == player1.playerId);
            Debug.Log($"Player3 declining request from {request.DisplayInfo()}");
            yield return DeclineFriendRequest(player3, request.request_id);
            player3.pendingRequests.Remove(request);
        }
        
        // Player3 accepts Player2's request
        if (player3.pendingRequests.Count > 0)
        {
            var request = player3.pendingRequests.First(r => r.player_id == player2.playerId);
            Debug.Log($"Player3 accepting request from {request.DisplayInfo()}");
            yield return AcceptFriendRequest(player3, request.request_id);
            player3.pendingRequests.Remove(request);
        }
    }
    
    // ========== PHASE 5: CHECK FRIENDS LISTS ==========
    private IEnumerator CheckFriendsLists()
    {
        Debug.Log("Player1's friends:");
        yield return GetFriendsList(player1);
        if (player1.friends.Count > 0)
        {
            foreach (var friend in player1.friends)
                Debug.Log($"  - {friend.DisplayInfo()}");
        }
        
        Debug.Log("Player2's friends:");
        yield return GetFriendsList(player2);
        if (player2.friends.Count > 0)
        {
            foreach (var friend in player2.friends)
                Debug.Log($"  - {friend.DisplayInfo()}");
        }
        
        Debug.Log("Player3's friends:");
        yield return GetFriendsList(player3);
        if (player3.friends.Count > 0)
        {
            foreach (var friend in player3.friends)
                Debug.Log($"  - {friend.DisplayInfo()}");
        }
    }
    
    // ========== PHASE 6: BLOCK & UNBLOCK ==========
    private IEnumerator BlockUnblockPlayers()
    {
        Debug.Log("Player1 blocking Player3...");
        yield return BlockPlayer(player1, player3.playerId);
        
        Debug.Log("Checking Player1's blocked list...");
        yield return GetBlockedList(player1);
        
        Debug.Log("Player1 unblocking Player3...");
        yield return UnblockPlayer(player1, player3.playerId);
        
        Debug.Log("Checking Player1's blocked list after unblock...");
        yield return GetBlockedList(player1);
    }
    
    // ========== PHASE 7: REMOVE FRIEND ==========
    private IEnumerator RemoveFriend()
    {
        Debug.Log("Player1 removing Player2 from friends...");
        yield return RemoveFriendRequest(player1, player2.playerId);
        
        Debug.Log("Checking Player1's friends after removal...");
        yield return GetFriendsList(player1);
    }
    
    // ========== API CALLS ==========
    
    private IEnumerator CreateAccount(TestPlayer player)
    {
        string url = $"{config.serverUrl}/account/create";
        
        var createRequest = new
        {
            display_name = player.displayName,
            email = player.email,
            password = player.password
        };
        
        string json = JsonUtility.ToJson(createRequest);
        byte[] body = System.Text.Encoding.UTF8.GetBytes(json);
        
        using (var request = new UnityWebRequest(url, "POST"))
        {
            request.uploadHandler = new UploadHandlerRaw(body);
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");
            
            yield return request.SendWebRequest();
            
            if (request.result == UnityWebRequest.Result.Success)
            {
                try
                {
                    string responseText = request.downloadHandler.text;
                    var response = ParseCreateResponse(responseText);
                    
                    if (response.ContainsKey("player_id"))
                    {
                        player.playerId = int.Parse(response["player_id"].ToString());
                        player.playerTag = response["player_tag"].ToString();
                        Debug.Log($"✅ {player.displayName} account created (ID: {player.playerId}, Tag: {player.playerTag})");
                        testsPassed++;
                    }
                }
                catch (Exception e)
                {
                    Debug.LogError($"❌ Error parsing account creation: {e.Message}");
                    testsFailed++;
                }
            }
            else
            {
                Debug.LogError($"❌ Account creation failed: {request.error}");
                testsFailed++;
            }
        }
    }
    
    private IEnumerator Login(TestPlayer player)
    {
        string url = $"{config.serverUrl}/account/login";
        
        var loginRequest = new
        {
            email = player.email,
            password = player.password
        };
        
        string json = JsonUtility.ToJson(loginRequest);
        byte[] body = System.Text.Encoding.UTF8.GetBytes(json);
        
        using (var request = new UnityWebRequest(url, "POST"))
        {
            request.uploadHandler = new UploadHandlerRaw(body);
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");
            
            yield return request.SendWebRequest();
            
            if (request.result == UnityWebRequest.Result.Success)
            {
                try
                {
                    string responseText = request.downloadHandler.text;
                    var response = ParseLoginResponse(responseText);
                    
                    if (response.ContainsKey("token"))
                    {
                        player.accessToken = response["token"].ToString();
                        player.refreshToken = response["refresh_token"].ToString();
                        Debug.Log($"✅ {player.displayName} logged in");
                        testsPassed++;
                    }
                }
                catch (Exception e)
                {
                    Debug.LogError($"❌ Error parsing login: {e.Message}");
                    testsFailed++;
                }
            }
            else
            {
                Debug.LogError($"❌ Login failed: {request.error}");
                testsFailed++;
            }
        }
    }
    
    private IEnumerator SendFriendRequest(TestPlayer sender, int recipientId)
    {
        string url = $"{config.serverUrl}/friend/request/send";
        
        var friendRequest = new
        {
            friend_id = recipientId
        };
        
        string json = JsonUtility.ToJson(friendRequest);
        byte[] body = System.Text.Encoding.UTF8.GetBytes(json);
        
        using (var request = new UnityWebRequest(url, "POST"))
        {
            request.uploadHandler = new UploadHandlerRaw(body);
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");
            request.SetRequestHeader("Authorization", $"Bearer {sender.accessToken}");
            
            yield return request.SendWebRequest();
            
            if (request.result == UnityWebRequest.Result.Success)
            {
                Debug.Log($"✅ {sender.displayName} sent friend request to ID {recipientId}");
                testsPassed++;
            }
            else
            {
                Debug.LogError($"❌ Send friend request failed: {request.error}");
                testsFailed++;
            }
        }
    }
    
    private IEnumerator GetFriendRequests(TestPlayer player)
    {
        string url = $"{config.serverUrl}/friend/requests";
        
        using (var request = UnityWebRequest.Get(url))
        {
            request.SetRequestHeader("Authorization", $"Bearer {player.accessToken}");
            
            yield return request.SendWebRequest();
            
            if (request.result == UnityWebRequest.Result.Success)
            {
                try
                {
                    string responseText = request.downloadHandler.text;
                    player.pendingRequests = ParseFriendRequests(responseText);
                    Debug.Log($"✅ {player.displayName} has {player.pendingRequests.Count} pending requests");
                    testsPassed++;
                }
                catch (Exception e)
                {
                    Debug.LogError($"❌ Error parsing friend requests: {e.Message}");
                    testsFailed++;
                }
            }
            else
            {
                Debug.LogError($"❌ Get friend requests failed: {request.error}");
                testsFailed++;
            }
        }
    }
    
    private IEnumerator AcceptFriendRequest(TestPlayer player, int requestId)
    {
        string url = $"{config.serverUrl}/friend/request/accept";
        
        var acceptRequest = new
        {
            request_id = requestId
        };
        
        string json = JsonUtility.ToJson(acceptRequest);
        byte[] body = System.Text.Encoding.UTF8.GetBytes(json);
        
        using (var request = new UnityWebRequest(url, "POST"))
        {
            request.uploadHandler = new UploadHandlerRaw(body);
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");
            request.SetRequestHeader("Authorization", $"Bearer {player.accessToken}");
            
            yield return request.SendWebRequest();
            
            if (request.result == UnityWebRequest.Result.Success)
            {
                Debug.Log($"✅ {player.displayName} accepted friend request {requestId}");
                testsPassed++;
            }
            else
            {
                Debug.LogError($"❌ Accept friend request failed: {request.error}");
                testsFailed++;
            }
        }
    }
    
    private IEnumerator DeclineFriendRequest(TestPlayer player, int requestId)
    {
        string url = $"{config.serverUrl}/friend/request/decline";
        
        var declineRequest = new
        {
            request_id = requestId
        };
        
        string json = JsonUtility.ToJson(declineRequest);
        byte[] body = System.Text.Encoding.UTF8.GetBytes(json);
        
        using (var request = new UnityWebRequest(url, "POST"))
        {
            request.uploadHandler = new UploadHandlerRaw(body);
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");
            request.SetRequestHeader("Authorization", $"Bearer {player.accessToken}");
            
            yield return request.SendWebRequest();
            
            if (request.result == UnityWebRequest.Result.Success)
            {
                Debug.Log($"✅ {player.displayName} declined friend request {requestId}");
                testsPassed++;
            }
            else
            {
                Debug.LogError($"❌ Decline friend request failed: {request.error}");
                testsFailed++;
            }
        }
    }
    
    private IEnumerator GetFriendsList(TestPlayer player)
    {
        string url = $"{config.serverUrl}/friend/list";
        
        using (var request = UnityWebRequest.Get(url))
        {
            request.SetRequestHeader("Authorization", $"Bearer {player.accessToken}");
            
            yield return request.SendWebRequest();
            
            if (request.result == UnityWebRequest.Result.Success)
            {
                try
                {
                    string responseText = request.downloadHandler.text;
                    player.friends = ParseFriendsList(responseText);
                    Debug.Log($"✅ {player.displayName} has {player.friends.Count} friends");
                    testsPassed++;
                }
                catch (Exception e)
                {
                    Debug.LogError($"❌ Error parsing friends list: {e.Message}");
                    testsFailed++;
                }
            }
            else
            {
                Debug.LogError($"❌ Get friends list failed: {request.error}");
                testsFailed++;
            }
        }
    }
    
    private IEnumerator RemoveFriendRequest(TestPlayer player, int friendId)
    {
        string url = $"{config.serverUrl}/friend/remove";
        
        var removeRequest = new
        {
            friend_id = friendId
        };
        
        string json = JsonUtility.ToJson(removeRequest);
        byte[] body = System.Text.Encoding.UTF8.GetBytes(json);
        
        using (var request = new UnityWebRequest(url, "POST"))
        {
            request.uploadHandler = new UploadHandlerRaw(body);
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");
            request.SetRequestHeader("Authorization", $"Bearer {player.accessToken}");
            
            yield return request.SendWebRequest();
            
            if (request.result == UnityWebRequest.Result.Success)
            {
                Debug.Log($"✅ {player.displayName} removed friend {friendId}");
                testsPassed++;
            }
            else
            {
                Debug.LogError($"❌ Remove friend failed: {request.error}");
                testsFailed++;
            }
        }
    }
    
    private IEnumerator BlockPlayer(TestPlayer player, int playerToBlock)
    {
        string url = $"{config.serverUrl}/friend/block";
        
        var blockRequest = new
        {
            player_to_block = playerToBlock
        };
        
        string json = JsonUtility.ToJson(blockRequest);
        byte[] body = System.Text.Encoding.UTF8.GetBytes(json);
        
        using (var request = new UnityWebRequest(url, "POST"))
        {
            request.uploadHandler = new UploadHandlerRaw(body);
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");
            request.SetRequestHeader("Authorization", $"Bearer {player.accessToken}");
            
            yield return request.SendWebRequest();
            
            if (request.result == UnityWebRequest.Result.Success)
            {
                Debug.Log($"✅ {player.displayName} blocked player {playerToBlock}");
                testsPassed++;
            }
            else
            {
                Debug.LogError($"❌ Block player failed: {request.error}");
                testsFailed++;
            }
        }
    }
    
    private IEnumerator UnblockPlayer(TestPlayer player, int playerToUnblock)
    {
        string url = $"{config.serverUrl}/friend/unblock";
        
        var unblockRequest = new
        {
            player_to_unblock = playerToUnblock
        };
        
        string json = JsonUtility.ToJson(unblockRequest);
        byte[] body = System.Text.Encoding.UTF8.GetBytes(json);
        
        using (var request = new UnityWebRequest(url, "POST"))
        {
            request.uploadHandler = new UploadHandlerRaw(body);
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");
            request.SetRequestHeader("Authorization", $"Bearer {player.accessToken}");
            
            yield return request.SendWebRequest();
            
            if (request.result == UnityWebRequest.Result.Success)
            {
                Debug.Log($"✅ {player.displayName} unblocked player {playerToUnblock}");
                testsPassed++;
            }
            else
            {
                Debug.LogError($"❌ Unblock player failed: {request.error}");
                testsFailed++;
            }
        }
    }
    
    private IEnumerator GetBlockedList(TestPlayer player)
    {
        string url = $"{config.serverUrl}/friend/blocked";
        
        using (var request = UnityWebRequest.Get(url))
        {
            request.SetRequestHeader("Authorization", $"Bearer {player.accessToken}");
            
            yield return request.SendWebRequest();
            
            if (request.result == UnityWebRequest.Result.Success)
            {
                try
                {
                    string responseText = request.downloadHandler.text;
                    player.blocked = ParseBlockedList(responseText);
                    Debug.Log($"✅ {player.displayName} has {player.blocked.Count} blocked players");
                    testsPassed++;
                }
                catch (Exception e)
                {
                    Debug.LogError($"❌ Error parsing blocked list: {e.Message}");
                    testsFailed++;
                }
            }
            else
            {
                Debug.LogError($"❌ Get blocked list failed: {request.error}");
                testsFailed++;
            }
        }
    }
    
    // ========== JSON PARSING HELPERS ==========
    
    private Dictionary<string, object> ParseCreateResponse(string json)
    {
        var dict = new Dictionary<string, object>();
        
        // Quick regex parsing (Unity's JsonUtility is limited)
        if (json.Contains("player_id"))
        {
            int startIdx = json.IndexOf("player_id") + 10;
            int endIdx = json.IndexOf(",", startIdx);
            if (endIdx == -1) endIdx = json.IndexOf("}", startIdx);
            dict["player_id"] = json.Substring(startIdx, endIdx - startIdx).Trim();
        }
        
        if (json.Contains("player_tag"))
        {
            int startIdx = json.IndexOf("player_tag") + 13;
            int endIdx = json.IndexOf("\"", startIdx + 1);
            dict["player_tag"] = json.Substring(startIdx, endIdx - startIdx);
        }
        
        return dict;
    }
    
    private Dictionary<string, object> ParseLoginResponse(string json)
    {
        var dict = new Dictionary<string, object>();
        
        if (json.Contains("access_token"))
        {
            int startIdx = json.IndexOf("access_token") + 15;
            int endIdx = json.IndexOf("\"", startIdx + 1);
            dict["token"] = json.Substring(startIdx, endIdx - startIdx);
        }
        
        if (json.Contains("refresh_token"))
        {
            int startIdx = json.IndexOf("refresh_token") + 16;
            int endIdx = json.IndexOf("\"", startIdx + 1);
            dict["refresh_token"] = json.Substring(startIdx, endIdx - startIdx);
        }
        
        return dict;
    }
    
    private List<FriendRequest> ParseFriendRequests(string json)
    {
        var requests = new List<FriendRequest>();
        
        try
        {
            int requestsStart = json.IndexOf("\"requests\"");
            if (requestsStart != -1)
            {
                int arrayStart = json.IndexOf("[", requestsStart);
                int arrayEnd = json.LastIndexOf("]");
                string arrayJson = json.Substring(arrayStart, arrayEnd - arrayStart + 1);
                
                // Parse each request
                int pos = 0;
                while (true)
                {
                    int objStart = arrayJson.IndexOf("{", pos);
                    if (objStart == -1) break;
                    
                    int objEnd = arrayJson.IndexOf("}", objStart);
                    string objJson = arrayJson.Substring(objStart, objEnd - objStart + 1);
                    
                    var req = new FriendRequest();
                    
                    if (ExtractInt(objJson, "request_id", out int rid)) req.request_id = rid;
                    if (ExtractInt(objJson, "player_id", out int pid)) req.player_id = pid;
                    if (ExtractString(objJson, "display_name", out string dn)) req.display_name = dn;
                    if (ExtractString(objJson, "player_tag", out string pt)) req.player_tag = pt;
                    
                    if (req.player_id > 0) requests.Add(req);
                    
                    pos = objEnd + 1;
                }
            }
        }
        catch (Exception e)
        {
            Debug.LogWarning($"Error parsing requests: {e.Message}");
        }
        
        return requests;
    }
    
    private List<FriendData> ParseFriendsList(string json)
    {
        var friends = new List<FriendData>();
        
        try
        {
            int friendsStart = json.IndexOf("\"friends\"");
            if (friendsStart != -1)
            {
                int arrayStart = json.IndexOf("[", friendsStart);
                int arrayEnd = json.LastIndexOf("]");
                string arrayJson = json.Substring(arrayStart, arrayEnd - arrayStart + 1);
                
                int pos = 0;
                while (true)
                {
                    int objStart = arrayJson.IndexOf("{", pos);
                    if (objStart == -1) break;
                    
                    int objEnd = arrayJson.IndexOf("}", objStart);
                    string objJson = arrayJson.Substring(objStart, objEnd - objStart + 1);
                    
                    var friend = new FriendData();
                    
                    if (ExtractInt(objJson, "player_id", out int pid)) friend.player_id = pid;
                    if (ExtractString(objJson, "display_name", out string dn)) friend.display_name = dn;
                    if (ExtractString(objJson, "player_tag", out string pt)) friend.player_tag = pt;
                    
                    if (friend.player_id > 0) friends.Add(friend);
                    
                    pos = objEnd + 1;
                }
            }
        }
        catch (Exception e)
        {
            Debug.LogWarning($"Error parsing friends: {e.Message}");
        }
        
        return friends;
    }
    
    private List<FriendData> ParseBlockedList(string json)
    {
        var blocked = new List<FriendData>();
        
        try
        {
            int blockedStart = json.IndexOf("\"blocked\"");
            if (blockedStart != -1)
            {
                int arrayStart = json.IndexOf("[", blockedStart);
                int arrayEnd = json.LastIndexOf("]");
                string arrayJson = json.Substring(arrayStart, arrayEnd - arrayStart + 1);
                
                int pos = 0;
                while (true)
                {
                    int objStart = arrayJson.IndexOf("{", pos);
                    if (objStart == -1) break;
                    
                    int objEnd = arrayJson.IndexOf("}", objStart);
                    string objJson = arrayJson.Substring(objStart, objEnd - objStart + 1);
                    
                    var data = new FriendData();
                    
                    if (ExtractInt(objJson, "player_id", out int pid)) data.player_id = pid;
                    if (ExtractString(objJson, "display_name", out string dn)) data.display_name = dn;
                    if (ExtractString(objJson, "player_tag", out string pt)) data.player_tag = pt;
                    
                    if (data.player_id > 0) blocked.Add(data);
                    
                    pos = objEnd + 1;
                }
            }
        }
        catch (Exception e)
        {
            Debug.LogWarning($"Error parsing blocked: {e.Message}");
        }
        
        return blocked;
    }
    
    private bool ExtractInt(string json, string key, out int value)
    {
        value = 0;
        string pattern = $"\"{key}\":";
        int idx = json.IndexOf(pattern);
        if (idx == -1) return false;
        
        int startIdx = idx + pattern.Length;
        while (startIdx < json.Length && (json[startIdx] == ' ' || json[startIdx] == ':')) startIdx++;
        
        int endIdx = startIdx;
        while (endIdx < json.Length && char.IsDigit(json[endIdx])) endIdx++;
        
        if (endIdx > startIdx && int.TryParse(json.Substring(startIdx, endIdx - startIdx), out int result))
        {
            value = result;
            return true;
        }
        return false;
    }
    
    private bool ExtractString(string json, string key, out string value)
    {
        value = "";
        string pattern = $"\"{key}\":\"";
        int idx = json.IndexOf(pattern);
        if (idx == -1) return false;
        
        int startIdx = idx + pattern.Length;
        int endIdx = json.IndexOf("\"", startIdx);
        
        if (endIdx > startIdx)
        {
            value = json.Substring(startIdx, endIdx - startIdx);
            return true;
        }
        return false;
    }
}
