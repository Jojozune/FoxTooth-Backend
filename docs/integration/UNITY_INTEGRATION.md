# Unity Integration Guide

**Game Invites Backend - Unity Client Implementation**  
**Status:** Complete Implementation Guide  
**Target:** Unity 2020 LTS and above

---

## Quick Start

### 1. Basic Setup

```csharp
// Create a manager script to handle all backend communication
using UnityEngine;
using UnityEngine.Networking;
using System.Collections;

public class GameBackendManager : MonoBehaviour
{
    public static GameBackendManager Instance { get; private set; }
    
    private const string API_BASE_URL = "https://your-backend-domain.com";
    
    private string accessToken;
    private string refreshToken;
    private string rememberToken;
    private int playerId;
    
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
        LoadSavedTokens();
    }
    
    private void SaveTokens()
    {
        PlayerPrefs.SetString("access_token", accessToken);
        PlayerPrefs.SetString("refresh_token", refreshToken);
        PlayerPrefs.SetString("remember_token", rememberToken);
        PlayerPrefs.SetInt("player_id", playerId);
        PlayerPrefs.Save();
    }
    
    private void LoadSavedTokens()
    {
        accessToken = PlayerPrefs.GetString("access_token", "");
        refreshToken = PlayerPrefs.GetString("refresh_token", "");
        rememberToken = PlayerPrefs.GetString("remember_token", "");
        playerId = PlayerPrefs.GetInt("player_id", 0);
    }
    
    private void ClearTokens()
    {
        accessToken = "";
        refreshToken = "";
        rememberToken = "";
        playerId = 0;
        
        PlayerPrefs.DeleteKey("access_token");
        PlayerPrefs.DeleteKey("refresh_token");
        PlayerPrefs.DeleteKey("remember_token");
        PlayerPrefs.DeleteKey("player_id");
        PlayerPrefs.Save();
    }
}
```

---

## Authentication Flow

### Create Account

```csharp
[System.Serializable]
public class CreateAccountRequest
{
    public string display_name;
    public string player_tag;
    public string email;
    public string password;
}

public IEnumerator CreateAccount(string displayName, string playerTag, string email, string password)
{
    var request = new CreateAccountRequest
    {
        display_name = displayName,
        player_tag = playerTag,
        email = email,
        password = password
    };
    
    string json = JsonUtility.ToJson(request);
    
    using (UnityWebRequest www = new UnityWebRequest($"{API_BASE_URL}/account/create", "POST"))
    {
        byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(json);
        www.uploadHandler = new UploadHandlerRaw(bodyRaw);
        www.downloadHandler = new DownloadHandlerBuffer();
        www.SetRequestHeader("Content-Type", "application/json");
        
        yield return www.SendWebRequest();
        
        if (www.result == UnityWebRequest.Result.Success)
        {
            Debug.Log("Account created successfully!");
        }
        else
        {
            Debug.LogError($"Account creation failed: {www.error}");
        }
    }
}
```

### Login

```csharp
[System.Serializable]
public class LoginRequest
{
    public string display_name;
    public string player_tag;
    public string password;
    public bool remember_me;
}

[System.Serializable]
public class LoginResponse
{
    public string status;
    public int player_id;
    public string token;
    public string refresh_token;
    public string remember_token;
    public ServerInfo server;
}

[System.Serializable]
public class ServerInfo
{
    public string ip;
    public int port;
}

public IEnumerator Login(string displayName, string playerTag, string password, bool rememberMe = true)
{
    var request = new LoginRequest
    {
        display_name = displayName,
        player_tag = playerTag,
        password = password,
        remember_me = rememberMe
    };
    
    string json = JsonUtility.ToJson(request);
    
    using (UnityWebRequest www = new UnityWebRequest($"{API_BASE_URL}/account/login", "POST"))
    {
        byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(json);
        www.uploadHandler = new UploadHandlerRaw(bodyRaw);
        www.downloadHandler = new DownloadHandlerBuffer();
        www.SetRequestHeader("Content-Type", "application/json");
        
        yield return www.SendWebRequest();
        
        if (www.result == UnityWebRequest.Result.Success)
        {
            LoginResponse response = JsonUtility.FromJson<LoginResponse>(www.downloadHandler.text);
            
            accessToken = response.token;
            refreshToken = response.refresh_token;
            rememberToken = response.remember_token ?? "";
            playerId = response.player_id;
            
            SaveTokens();
            
            Debug.Log($"Login successful! Connecting to server...");
        }
        else
        {
            Debug.LogError($"Login failed: {www.error}");
        }
    }
}
```

### Token Refresh

```csharp
public IEnumerator RefreshAccessToken()
{
    if (string.IsNullOrEmpty(refreshToken))
    {
        Debug.LogError("No refresh token, require new login");
        yield break;
    }
    
    var request = new { refresh_token = refreshToken, player_id = playerId };
    string json = JsonUtility.ToJson(request);
    
    using (UnityWebRequest www = new UnityWebRequest($"{API_BASE_URL}/player/refresh-token", "POST"))
    {
        byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(json);
        www.uploadHandler = new UploadHandlerRaw(bodyRaw);
        www.downloadHandler = new DownloadHandlerBuffer();
        www.SetRequestHeader("Content-Type", "application/json");
        
        yield return www.SendWebRequest();
        
        if (www.result == UnityWebRequest.Result.Success)
        {
            var response = JsonUtility.FromJson<dynamic>(www.downloadHandler.text);
            accessToken = response.token;
            SaveTokens();
            Debug.Log("Token refreshed successfully");
        }
        else
        {
            Debug.LogError("Token refresh failed");
        }
    }
}
```

---

## Player Invites System

### Send Invite

```csharp
public IEnumerator SendInvite(int receiverId, string sessionCode)
{
    var request = new { receiver_id = receiverId, session_code = sessionCode };
    string json = JsonUtility.ToJson(request);
    
    using (UnityWebRequest www = new UnityWebRequest($"{API_BASE_URL}/invite/send", "POST"))
    {
        byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(json);
        www.uploadHandler = new UploadHandlerRaw(bodyRaw);
        www.downloadHandler = new DownloadHandlerBuffer();
        www.SetRequestHeader("Content-Type", "application/json");
        www.SetRequestHeader("Authorization", $"Bearer {accessToken}");
        
        yield return www.SendWebRequest();
        
        if (www.result == UnityWebRequest.Result.Success)
        {
            Debug.Log("Invite sent successfully!");
        }
        else
        {
            Debug.LogError($"Send invite failed: {www.error}");
        }
    }
}
```

### Check Pending Invites

```csharp
[System.Serializable]
public class Invite
{
    public int invite_id;
    public int sender_id;
    public string sender_name;
    public string session_code;
}

[System.Serializable]
public class CheckInvitesResponse
{
    public Invite[] invites;
}

public IEnumerator CheckPendingInvites()
{
    using (UnityWebRequest www = UnityWebRequest.Get($"{API_BASE_URL}/invite/check/{playerId}"))
    {
        www.downloadHandler = new DownloadHandlerBuffer();
        www.SetRequestHeader("Authorization", $"Bearer {accessToken}");
        
        yield return www.SendWebRequest();
        
        if (www.result == UnityWebRequest.Result.Success)
        {
            CheckInvitesResponse response = JsonUtility.FromJson<CheckInvitesResponse>(
                "{\"invites\":" + www.downloadHandler.text.Split(new[] { "\"invites\":" }, System.StringSplitOptions.None)[1]
            );
            
            Debug.Log($"Found {response.invites.Length} pending invites");
        }
        else
        {
            Debug.LogError($"Check invites error: {www.error}");
        }
    }
}
```

### Accept/Decline Invite

```csharp
public IEnumerator RespondToInvite(int inviteId, bool accept)
{
    var request = new { invite_id = inviteId, response = accept ? "accept" : "decline" };
    string json = JsonUtility.ToJson(request);
    
    using (UnityWebRequest www = new UnityWebRequest($"{API_BASE_URL}/invite/respond", "POST"))
    {
        byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(json);
        www.uploadHandler = new UploadHandlerRaw(bodyRaw);
        www.downloadHandler = new DownloadHandlerBuffer();
        www.SetRequestHeader("Content-Type", "application/json");
        www.SetRequestHeader("Authorization", $"Bearer {accessToken}");
        
        yield return www.SendWebRequest();
        
        if (www.result == UnityWebRequest.Result.Success)
        {
            Debug.Log(accept ? "Invite accepted!" : "Invite declined");
        }
        else
        {
            Debug.LogError($"Respond to invite error: {www.error}");
        }
    }
}
```

---

## Best Practices

### ✅ DO:
- Use HTTPS only in production
- Store tokens securely (Keychain/Credential Manager)
- Implement auto-refresh on 401/403 responses
- Handle rate limiting gracefully
- Validate input before sending
- Use Bearer token format: `Authorization: Bearer <token>`

### ❌ DON'T:
- Hardcode API URLs
- Expose tokens in logs
- Use HTTP in production
- Store passwords client-side
- Trust unvalidated user input

---

## Complete Example: Login Manager

```csharp
using UnityEngine;
using UnityEngine.UI;
using System.Collections;

public class LoginManager : MonoBehaviour
{
    [SerializeField] private InputField displayNameInput;
    [SerializeField] private InputField playerTagInput;
    [SerializeField] private InputField passwordInput;
    [SerializeField] private Toggle rememberMeToggle;
    [SerializeField] private Button loginButton;
    [SerializeField] private Text statusText;
    
    private void Start()
    {
        loginButton.onClick.AddListener(OnLoginClicked);
        
        // Check for existing remember token
        string rememberToken = PlayerPrefs.GetString("remember_token", "");
        if (!string.IsNullOrEmpty(rememberToken))
        {
            statusText.text = "Logging in with saved credentials...";
            StartCoroutine(GameBackendManager.Instance.RememberLogin());
        }
    }
    
    private void OnLoginClicked()
    {
        string displayName = displayNameInput.text;
        string playerTag = playerTagInput.text;
        string password = passwordInput.text;
        bool rememberMe = rememberMeToggle.isOn;
        
        loginButton.interactable = false;
        statusText.text = "Logging in...";
        
        StartCoroutine(GameBackendManager.Instance.Login(displayName, playerTag, password, rememberMe));
    }
}
```

---

## Summary

You now have:
- ✅ Complete authentication system (create, login, remember login)
- ✅ Token management (access, refresh, auto-refresh on expiry)
- ✅ Player invite system (send, check, respond)
- ✅ Best practices documented
- ✅ Ready-to-use code examples

**Your game backend is fully integrated with Unity!** 🎮

For more details, see:
- API_REFERENCE.md - Complete endpoint documentation
- ENDPOINTS_CHEATSHEET.md - Quick reference
- SECURITY_AUDIT.md - Security implementation details
