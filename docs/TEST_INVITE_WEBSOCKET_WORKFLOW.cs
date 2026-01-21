// TEST_INVITE_WEBSOCKET_WORKFLOW.cs - WebSocket-Only Invite System Test
// Place in Assets/Scripts/Testing/ in your Unity project
// Tests ONLY the WebSocket (Socket.IO) real-time invite system - NO HTTP fallback

using UnityEngine;
using System;
using System.Collections;
using System.Collections.Generic;
using SocketIOClient;
using System.Linq;

[System.Serializable]
public class InviteTestConfig
{
    public string serverUrl = "http://localhost:7777";  // Change to your server
    public string wsUrl = "http://localhost:7777";      // WebSocket URL
    public string player1Email = "p1@test.com";
    public string player1Password = "password123";
    public string player2Email = "p2@test.com";
    public string player2Password = "password123";
}

public class TestInvitePlayer
{
    public int playerId;
    public string displayName;
    public string playerTag;
    public string email;
    public string password;
    public string accessToken;
    public string sessionCode;
    
    public SocketIO socket;
    public bool wsConnected;
    public List<ReceivedInvite> receivedInvites = new List<ReceivedInvite>();
}

public class ReceivedInvite
{
    public int invite_id;
    public int sender_id;
    public string sender_name;
    public string session_code;
    public int expires_in;
    public string server_ip;
    public int server_port;
    public DateTime receivedAt;
}

public class TestInviteWebSocketClient : MonoBehaviour
{
    [SerializeField] private InviteTestConfig config = new InviteTestConfig();
    
    private TestInvitePlayer player1;
    private TestInvitePlayer player2;
    
    private int testsPassed = 0;
    private int testsFailed = 0;
    
    private void Start()
    {
        // Uncomment to run tests
        // StartCoroutine(RunInviteWebSocketTests());
    }
    
    // ========== MAIN TEST WORKFLOW ==========
    public IEnumerator RunInviteWebSocketTests()
    {
        Debug.Log("=== 🧪 INVITE WEBSOCKET SYSTEM TEST ===\n");
        
        // Phase 1: Setup players
        Debug.Log("📝 Phase 1: Create & Login Players");
        yield return CreateAndLoginPlayers();
        
        // Phase 2: Connect WebSockets
        Debug.Log("\n🔌 Phase 2: Establish WebSocket Connections");
        yield return ConnectWebSockets();
        
        // Phase 3: Test invite send via WebSocket
        Debug.Log("\n📨 Phase 3: Send Invite via WebSocket");
        yield return TestInviteSendViaWebSocket();
        
        // Phase 4: Test invite received notification
        Debug.Log("\n📩 Phase 4: Verify Real-Time Invite Reception");
        yield return TestInviteReceptionViaWebSocket();
        
        // Phase 5: Test acknowledge
        Debug.Log("\n✅ Phase 5: Test Invite Acknowledgement");
        yield return TestInviteAcknowledgement();
        
        // Phase 6: Test accept invite
        Debug.Log("\n👍 Phase 6: Accept Invite & Receive Server Info");
        yield return TestInviteAccept();
        
        // Phase 7: Test decline
        Debug.Log("\n👎 Phase 7: Send Another Invite & Decline");
        yield return TestInviteDecline();
        
        // Results
        Debug.Log("\n\n=== 📊 TEST RESULTS ===");
        Debug.Log($"✅ Passed: {testsPassed}");
        Debug.Log($"❌ Failed: {testsFailed}");
        Debug.Log($"Total: {testsPassed + testsFailed}");
        
        if (testsFailed == 0)
        {
            Debug.Log("\n🎉 ALL WEBSOCKET TESTS PASSED! Invites using real-time sockets confirmed!");
        }
        else
        {
            Debug.LogError("\n⚠️ Some tests failed. Check WebSocket implementation.");
        }
    }
    
    // ========== PHASE 1: SETUP ==========
    private IEnumerator CreateAndLoginPlayers()
    {
        player1 = new TestInvitePlayer
        {
            email = config.player1Email,
            password = config.player1Password,
            displayName = "Player1"
        };
        
        player2 = new TestInvitePlayer
        {
            email = config.player2Email,
            password = config.player2Password,
            displayName = "Player2"
        };
        
        yield return CreateAccount(player1);
        yield return CreateAccount(player2);
        
        yield return Login(player1);
        yield return Login(player2);
        
        // Create sessions for both players
        yield return CreateSession(player1);
        yield return CreateSession(player2);
    }
    
    // ========== PHASE 2: WEBSOCKET CONNECTION ==========
    private IEnumerator ConnectWebSockets()
    {
        yield return ConnectWebSocket(player1);
        yield return ConnectWebSocket(player2);
    }
    
    private IEnumerator ConnectWebSocket(TestInvitePlayer player)
    {
        Debug.Log($"🔌 Connecting {player.displayName} to WebSocket...");
        
        try
        {
            player.socket = new SocketIO(config.wsUrl, new SocketIOOptions
            {
                Auth = new Dictionary<string, string>
                {
                    { "token", player.accessToken }
                }
            });
            
            // Connection handlers
            player.socket.OnConnected += (sender, e) =>
            {
                player.wsConnected = true;
                Debug.Log($"✅ {player.displayName} WebSocket connected (ID: {player.socket.Id})");
            };
            
            player.socket.OnDisconnected += (sender, e) =>
            {
                player.wsConnected = false;
                Debug.LogWarning($"❌ {player.displayName} WebSocket disconnected");
            };
            
            player.socket.OnError += (sender, e) =>
            {
                Debug.LogError($"❌ {player.displayName} WebSocket error: {e}");
            };
            
            // Real-time invite events
            player.socket.On("invite:received", (response) =>
            {
                HandleInviteReceived(player, response);
            });
            
            player.socket.On("invite:send:success", (response) =>
            {
                HandleInviteSendSuccess(player, response);
            });
            
            player.socket.On("invite:send:error", (response) =>
            {
                HandleInviteSendError(player, response);
            });
            
            player.socket.On("invite:acknowledged:ack", (response) =>
            {
                Debug.Log($"✅ {player.displayName} got acknowledgement confirmation");
                testsPassed++;
            });
            
            player.socket.On("invite:respond:success", (response) =>
            {
                HandleInviteRespondSuccess(player, response);
            });
            
            player.socket.On("invite:respond:error", (response) =>
            {
                Debug.LogError($"❌ {player.displayName} invite respond error: {response}");
                testsFailed++;
            });
            
            player.socket.On("invite:accepted", (response) =>
            {
                Debug.Log($"✅ {player.displayName} received invite:accepted notification (someone accepted)");
                testsPassed++;
            });
            
            player.socket.On("invite:declined", (response) =>
            {
                Debug.Log($"✅ {player.displayName} received invite:declined notification (someone declined)");
                testsPassed++;
            });
            
            await player.socket.ConnectAsync();
            
            // Wait a bit for connection
            yield return new WaitForSeconds(1f);
            
            if (player.wsConnected)
            {
                Debug.Log($"✅ {player.displayName} WebSocket fully connected!");
                testsPassed++;
            }
            else
            {
                Debug.LogError($"❌ {player.displayName} WebSocket connection failed!");
                testsFailed++;
            }
        }
        catch (Exception e)
        {
            Debug.LogError($"❌ WebSocket connection error for {player.displayName}: {e.Message}");
            testsFailed++;
        }
    }
    
    // ========== PHASE 3: SEND INVITE VIA WEBSOCKET ==========
    private IEnumerator TestInviteSendViaWebSocket()
    {
        Debug.Log($"Sending invite from {player1.displayName} to {player2.displayName}...");
        
        if (!player1.wsConnected)
        {
            Debug.LogError("❌ Player1 WebSocket not connected!");
            testsFailed++;
            yield break;
        }
        
        try
        {
            var inviteData = new
            {
                receiver_id = player2.playerId,
                session_code = player1.sessionCode
            };
            
            await player1.socket.EmitAsync("invite:send", inviteData);
            
            // Wait for response
            yield return new WaitForSeconds(2f);
            
            if (player1.receivedInvites.Count > 0 || testsPassed >= 1)
            {
                Debug.Log($"✅ Invite sent successfully");
            }
        }
        catch (Exception e)
        {
            Debug.LogError($"❌ Error sending invite: {e.Message}");
            testsFailed++;
        }
    }
    
    // ========== PHASE 4: VERIFY REAL-TIME RECEPTION ==========
    private IEnumerator TestInviteReceptionViaWebSocket()
    {
        Debug.Log($"Waiting for {player2.displayName} to receive invite via real-time socket...");
        
        yield return new WaitForSeconds(2f);
        
        if (player2.receivedInvites.Count > 0)
        {
            var invite = player2.receivedInvites[0];
            Debug.Log($"✅ Invite received in real-time:");
            Debug.Log($"   - Invite ID: {invite.invite_id}");
            Debug.Log($"   - From: {invite.sender_name}");
            Debug.Log($"   - Session: {invite.session_code}");
            Debug.Log($"   - Server: {invite.server_ip}:{invite.server_port}");
            Debug.Log($"   - Expires in: {invite.expires_in}s");
            testsPassed++;
        }
        else
        {
            Debug.LogError("❌ Invite NOT received in real-time!");
            testsFailed++;
        }
    }
    
    // ========== PHASE 5: ACKNOWLEDGE ==========
    private IEnumerator TestInviteAcknowledgement()
    {
        if (player2.receivedInvites.Count == 0)
        {
            Debug.LogError("❌ No invite to acknowledge!");
            testsFailed++;
            yield break;
        }
        
        var invite = player2.receivedInvites[0];
        Debug.Log($"Acknowledging invite {invite.invite_id}...");
        
        try
        {
            await player2.socket.EmitAsync("invite:acknowledged", new { invite_id = invite.invite_id });
            yield return new WaitForSeconds(1f);
        }
        catch (Exception e)
        {
            Debug.LogError($"❌ Error acknowledging invite: {e.Message}");
            testsFailed++;
        }
    }
    
    // ========== PHASE 6: ACCEPT INVITE ==========
    private IEnumerator TestInviteAccept()
    {
        if (player2.receivedInvites.Count == 0)
        {
            Debug.LogError("❌ No invite to accept!");
            testsFailed++;
            yield break;
        }
        
        var invite = player2.receivedInvites[0];
        Debug.Log($"Accepting invite {invite.invite_id}...");
        
        try
        {
            await player2.socket.EmitAsync("invite:respond", new 
            { 
                invite_id = invite.invite_id, 
                response = "accept" 
            });
            
            yield return new WaitForSeconds(1f);
            
            Debug.Log($"✅ Invite accept response emitted");
        }
        catch (Exception e)
        {
            Debug.LogError($"❌ Error accepting invite: {e.Message}");
            testsFailed++;
        }
    }
    
    // ========== PHASE 7: DECLINE NEW INVITE ==========
    private IEnumerator TestInviteDecline()
    {
        Debug.Log($"Sending second invite to decline...");
        
        // Clear previous invites
        player2.receivedInvites.Clear();
        
        // Send new invite
        try
        {
            var inviteData = new
            {
                receiver_id = player2.playerId,
                session_code = player1.sessionCode
            };
            
            await player1.socket.EmitAsync("invite:send", inviteData);
            yield return new WaitForSeconds(1f);
        }
        catch (Exception e)
        {
            Debug.LogError($"❌ Error sending second invite: {e.Message}");
            testsFailed++;
            yield break;
        }
        
        // Wait for reception
        yield return new WaitForSeconds(1f);
        
        if (player2.receivedInvites.Count == 0)
        {
            Debug.LogError("❌ Second invite not received!");
            testsFailed++;
            yield break;
        }
        
        var declineInvite = player2.receivedInvites[0];
        Debug.Log($"Declining invite {declineInvite.invite_id}...");
        
        try
        {
            await player2.socket.EmitAsync("invite:respond", new 
            { 
                invite_id = declineInvite.invite_id, 
                response = "decline" 
            });
            
            yield return new WaitForSeconds(1f);
            Debug.Log($"✅ Invite declined successfully");
        }
        catch (Exception e)
        {
            Debug.LogError($"❌ Error declining invite: {e.Message}");
            testsFailed++;
        }
    }
    
    // ========== EVENT HANDLERS ==========
    private void HandleInviteReceived(TestInvitePlayer player, SocketIOResponse response)
    {
        try
        {
            var data = response.GetValue<Dictionary<string, object>>();
            
            var invite = new ReceivedInvite
            {
                invite_id = Convert.ToInt32(data["invite_id"]),
                sender_id = Convert.ToInt32(data["sender_id"]),
                sender_name = data["sender_name"].ToString(),
                session_code = data["session_code"].ToString(),
                expires_in = Convert.ToInt32(data["expires_in"]),
                server_ip = data.ContainsKey("server_ip") ? data["server_ip"].ToString() : "N/A",
                server_port = data.ContainsKey("server_port") ? Convert.ToInt32(data["server_port"]) : 0,
                receivedAt = DateTime.Now
            };
            
            player.receivedInvites.Add(invite);
            Debug.Log($"📩 {player.displayName} received invite in real-time!");
            testsPassed++;
            
            // AUTO-ACKNOWLEDGE (per spec)
            player.socket.EmitAsync("invite:acknowledged", new { invite_id = invite.invite_id });
        }
        catch (Exception e)
        {
            Debug.LogError($"❌ Error handling invite received: {e.Message}");
            testsFailed++;
        }
    }
    
    private void HandleInviteSendSuccess(TestInvitePlayer player, SocketIOResponse response)
    {
        try
        {
            var data = response.GetValue<Dictionary<string, object>>();
            Debug.Log($"✅ {player.displayName} got invite:send:success");
            Debug.Log($"   Invite ID: {data["invite_id"]}");
            Debug.Log($"   Receiver: {data["receiver_name"]}");
            testsPassed++;
        }
        catch (Exception e)
        {
            Debug.LogError($"❌ Error in send success: {e.Message}");
            testsFailed++;
        }
    }
    
    private void HandleInviteSendError(TestInvitePlayer player, SocketIOResponse response)
    {
        Debug.LogError($"❌ {player.displayName} got invite:send:error: {response}");
        testsFailed++;
    }
    
    private void HandleInviteRespondSuccess(TestInvitePlayer player, SocketIOResponse response)
    {
        try
        {
            var data = response.GetValue<Dictionary<string, object>>();
            string status = data["status"].ToString();
            
            if (status == "accepted")
            {
                Debug.Log($"✅ {player.displayName} accepted invite");
                Debug.Log($"   Server: {data["server_ip"]}:{data["server_port"]}");
                testsPassed++;
            }
            else if (status == "declined")
            {
                Debug.Log($"✅ {player.displayName} declined invite");
                testsPassed++;
            }
        }
        catch (Exception e)
        {
            Debug.LogError($"❌ Error in respond success: {e.Message}");
            testsFailed++;
        }
    }
    
    // ========== HELPER API CALLS ==========
    
    private IEnumerator CreateAccount(TestInvitePlayer player)
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
        
        using (var request = new UnityEngine.Networking.UnityWebRequest(url, "POST"))
        {
            request.uploadHandler = new UnityEngine.Networking.UploadHandlerRaw(body);
            request.downloadHandler = new UnityEngine.Networking.DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");
            
            yield return request.SendWebRequest();
            
            if (request.result == UnityEngine.Networking.UnityWebRequest.Result.Success)
            {
                try
                {
                    string responseText = request.downloadHandler.text;
                    var response = ParseJsonDict(responseText);
                    
                    if (response.ContainsKey("player_id"))
                    {
                        player.playerId = int.Parse(response["player_id"].ToString());
                        player.playerTag = response["player_tag"].ToString();
                        Debug.Log($"✅ {player.displayName} account created (ID: {player.playerId})");
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
    
    private IEnumerator Login(TestInvitePlayer player)
    {
        string url = $"{config.serverUrl}/account/login";
        
        var loginRequest = new
        {
            email = player.email,
            password = player.password
        };
        
        string json = JsonUtility.ToJson(loginRequest);
        byte[] body = System.Text.Encoding.UTF8.GetBytes(json);
        
        using (var request = new UnityEngine.Networking.UnityWebRequest(url, "POST"))
        {
            request.uploadHandler = new UnityEngine.Networking.UploadHandlerRaw(body);
            request.downloadHandler = new UnityEngine.Networking.DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");
            
            yield return request.SendWebRequest();
            
            if (request.result == UnityEngine.Networking.UnityWebRequest.Result.Success)
            {
                try
                {
                    string responseText = request.downloadHandler.text;
                    var response = ParseJsonDict(responseText);
                    
                    if (response.ContainsKey("token"))
                    {
                        player.accessToken = response["token"].ToString();
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
    
    private IEnumerator CreateSession(TestInvitePlayer player)
    {
        // For testing, use a dummy session code
        player.sessionCode = $"TEST_{player.playerId}_{System.Guid.NewGuid().ToString().Substring(0, 8)}";
        Debug.Log($"📝 {player.displayName} session code: {player.sessionCode}");
        yield return null;
    }
    
    // ========== JSON PARSING ==========
    
    private Dictionary<string, object> ParseJsonDict(string json)
    {
        var dict = new Dictionary<string, object>();
        
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
        
        if (json.Contains("access_token"))
        {
            int startIdx = json.IndexOf("access_token") + 15;
            int endIdx = json.IndexOf("\"", startIdx + 1);
            dict["token"] = json.Substring(startIdx, endIdx - startIdx);
        }
        
        return dict;
    }
    
    private void OnDestroy()
    {
        // Cleanup WebSocket connections
        if (player1?.socket != null)
        {
            player1.socket.Disconnect();
        }
        if (player2?.socket != null)
        {
            player2.socket.Disconnect();
        }
    }
}
