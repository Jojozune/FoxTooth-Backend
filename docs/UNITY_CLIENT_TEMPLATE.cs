// GameServerManager.cs - Unity C# Integration Template
// Place this in Assets/Scripts/Server/ folder in your Unity project

using UnityEngine;
using UnityEngine.Networking;
using System.Collections;
using System.Collections.Generic;
using SocketIOClient;
using System;

[System.Serializable]
public class LoginRequest
{
    public string username;
    public string password;
}

[System.Serializable]
public class LoginResponse
{
    public string status;
    public string access_token;
    public string refresh_token;
    public int player_id;
    public string display_name;
    public string player_tag;
}

[System.Serializable]
public class HeartbeatRequest
{
    public bool game_open;
}

public class GameServerManager : MonoBehaviour
{
    // ========== Configuration ==========
    // UPDATE THIS FOR YOUR SERVER
    private const string SERVER_URL = "http://159.26.103.121:7777";
    private const string WEBSOCKET_URL = "ws://159.26.103.121:7777";
    
    // Heartbeat settings
    private const float HEARTBEAT_INTERVAL = 5.0f;
    
    // ========== State ==========
    private string accessToken;
    private string refreshToken;
    private int playerId;
    private string displayName;
    private string playerTag;
    
    private SocketIO socket;
    private float heartbeatTimer = 0f;
    private bool isConnected = false;
    
    // ========== Events ==========
    public delegate void ServerConnectionEvent(bool connected);
    public delegate void LoginEvent(bool success, string message);
    public delegate void InviteReceivedEvent(int inviteId, string senderName, string sessionCode);
    
    public event ServerConnectionEvent OnServerConnectionChanged;
    public event LoginEvent OnLoginComplete;
    public event InviteReceivedEvent OnInviteReceived;
    
    public static GameServerManager Instance { get; private set; }
    
    private void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }
        Instance = this;
        DontDestroyOnLoad(gameObject);
    }
    
    private void Start()
    {
        // Initialize WebSocket connection
        ConnectWebSocket();
    }
    
    private void Update()
    {
        // Send heartbeat periodically
        if (isConnected && !string.IsNullOrEmpty(accessToken))
        {
            heartbeatTimer -= Time.deltaTime;
            if (heartbeatTimer <= 0)
            {
                SendHeartbeat();
                heartbeatTimer = HEARTBEAT_INTERVAL;
            }
        }
    }
    
    // ========== WebSocket Methods ==========
    private async void ConnectWebSocket()
    {
        try
        {
            socket = new SocketIO(WEBSOCKET_URL);
            
            // Connection events
            socket.OnConnected += (sender, e) =>
            {
                Debug.Log("✅ Connected to WebSocket server");
                isConnected = true;
                OnServerConnectionChanged?.Invoke(true);
            };
            
            socket.OnDisconnected += (sender, e) =>
            {
                Debug.LogWarning("❌ Disconnected from WebSocket server");
                isConnected = false;
                OnServerConnectionChanged?.Invoke(false);
            };
            
            socket.OnError += (sender, e) =>
            {
                Debug.LogError($"❌ WebSocket error: {e}");
            };
            
            // Real-time events
            socket.On("invite:received", OnInviteReceivedHandler);
            socket.On("invite:send:success", OnInviteSendSuccess);
            socket.On("invite:send:error", OnInviteSendError);
            socket.On("heartbeat:ack", OnHeartbeatAck);
            
            await socket.ConnectAsync();
        }
        catch (Exception e)
        {
            Debug.LogError($"❌ Failed to connect WebSocket: {e.Message}");
        }
    }
    
    // ========== Authentication Methods ==========
    public void Login(string username, string password)
    {
        StartCoroutine(LoginCoroutine(username, password));
    }
    
    private IEnumerator LoginCoroutine(string username, string password)
    {
        string url = $"{SERVER_URL}/account/login";
        
        var loginRequest = new LoginRequest
        {
            username = username,
            password = password
        };
        
        string jsonBody = JsonUtility.ToJson(loginRequest);
        byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(jsonBody);
        
        using (UnityWebRequest request = new UnityWebRequest(url, "POST"))
        {
            request.uploadHandler = new UploadHandlerRaw(bodyRaw);
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");
            
            yield return request.SendWebRequest();
            
            if (request.result == UnityWebRequest.Result.Success)
            {
                try
                {
                    string responseText = request.downloadHandler.text;
                    LoginResponse response = JsonUtility.FromJson<LoginResponse>(responseText);
                    
                    if (response.status == "success")
                    {
                        accessToken = response.access_token;
                        refreshToken = response.refresh_token;
                        playerId = response.player_id;
                        displayName = response.display_name;
                        playerTag = response.player_tag;
                        
                        Debug.Log($"✅ Login successful! Welcome {displayName}");
                        OnLoginComplete?.Invoke(true, "Login successful");
                        
                        // Start heartbeat
                        heartbeatTimer = 0;
                    }
                    else
                    {
                        Debug.LogError("❌ Login failed: " + responseText);
                        OnLoginComplete?.Invoke(false, "Login failed");
                    }
                }
                catch (Exception e)
                {
                    Debug.LogError($"❌ Error parsing login response: {e.Message}");
                    OnLoginComplete?.Invoke(false, "Error parsing response");
                }
            }
            else
            {
                Debug.LogError($"❌ Login request failed: {request.error}");
                OnLoginComplete?.Invoke(false, request.error);
            }
        }
    }
    
    // ========== Heartbeat Methods ==========
    private void SendHeartbeat()
    {
        if (!isConnected || string.IsNullOrEmpty(accessToken))
            return;
        
        // Option 1: WebSocket (Recommended - real-time)
        if (socket != null && socket.Connected)
        {
            var heartbeatData = new HeartbeatRequest
            {
                game_open = true  // Set to false if alt-tabbed
            };
            
            try
            {
                socket.Emit("heartbeat", heartbeatData);
            }
            catch (Exception e)
            {
                Debug.LogWarning($"WebSocket heartbeat failed, using HTTP: {e.Message}");
                SendHeartbeatHTTP();
            }
        }
        else
        {
            // Fallback to HTTP
            SendHeartbeatHTTP();
        }
    }
    
    private void SendHeartbeatHTTP()
    {
        StartCoroutine(HeartbeatHTTPCoroutine());
    }
    
    private IEnumerator HeartbeatHTTPCoroutine()
    {
        string url = $"{SERVER_URL}/player/heartbeat";
        
        var heartbeatRequest = new HeartbeatRequest
        {
            game_open = true
        };
        
        string jsonBody = JsonUtility.ToJson(heartbeatRequest);
        byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(jsonBody);
        
        using (UnityWebRequest request = new UnityWebRequest(url, "POST"))
        {
            request.uploadHandler = new UploadHandlerRaw(bodyRaw);
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");
            request.SetRequestHeader("Authorization", $"Bearer {accessToken}");
            
            yield return request.SendWebRequest();
            
            if (request.result != UnityWebRequest.Result.Success)
            {
                Debug.LogWarning($"⚠️ Heartbeat failed: {request.error}");
            }
        }
    }
    
    private void OnHeartbeatAck(SocketIOResponse data)
    {
        Debug.Log("💓 Heartbeat acknowledged by server");
    }
    
    // ========== Invite Methods ==========
    public void SendInvite(int receiverId, string sessionCode)
    {
        if (!isConnected || socket == null || !socket.Connected)
        {
            Debug.LogError("❌ WebSocket not connected, cannot send invite");
            return;
        }
        
        var inviteData = new
        {
            receiver_id = receiverId,
            session_code = sessionCode
        };
        
        Debug.Log($"📨 Sending invite to player {receiverId}");
        socket.Emit("invite:send", inviteData);
    }
    
    private void OnInviteReceivedHandler(SocketIOResponse data)
    {
        try
        {
            Debug.Log($"📩 Invite received: {data.GetValue()}");
            
            // Parse the invite data
            var inviteData = data.GetValue<Dictionary<string, object>>();
            
            int inviteId = Convert.ToInt32(inviteData["invite_id"]);
            string senderName = inviteData["sender_name"].ToString();
            string sessionCode = inviteData["session_code"].ToString();
            
            // Trigger event - show popup in your UI
            OnInviteReceived?.Invoke(inviteId, senderName, sessionCode);
            
            // Auto-acknowledge receipt
            socket.Emit("invite:acknowledged", new { invite_id = inviteId });
        }
        catch (Exception e)
        {
            Debug.LogError($"❌ Error handling invite: {e.Message}");
        }
    }
    
    private void OnInviteSendSuccess(SocketIOResponse data)
    {
        Debug.Log($"✅ Invite sent successfully");
    }
    
    private void OnInviteSendError(SocketIOResponse data)
    {
        Debug.LogError($"❌ Invite send failed: {data.GetValue()}");
    }
    
    public void RespondToInvite(int inviteId, bool accept)
    {
        if (!isConnected || socket == null || !socket.Connected)
        {
            Debug.LogError("❌ WebSocket not connected");
            return;
        }
        
        var response = new
        {
            invite_id = inviteId,
            response = accept ? "accept" : "decline"
        };
        
        Debug.Log($"{(accept ? "✅ Accepting" : "❌ Declining")} invite {inviteId}");
        socket.Emit("invite:respond", response);
    }
    
    // ========== Utility Methods ==========
    public bool IsConnected => isConnected;
    public bool IsAuthenticated => !string.IsNullOrEmpty(accessToken);
    public int GetPlayerId => playerId;
    public string GetDisplayName => displayName;
    public string GetPlayerTag => playerTag;
    
    public void Logout()
    {
        accessToken = null;
        refreshToken = null;
        playerId = 0;
        Debug.Log("🚪 Logged out");
    }
    
    private void OnDestroy()
    {
        if (socket != null)
        {
            socket.Disconnect();
        }
    }
}
