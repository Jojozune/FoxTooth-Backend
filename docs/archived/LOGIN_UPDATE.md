# Login Update - Email or Tag Support

## What Changed

Updated the `/account/login` endpoint to accept either:
1. **Email + Password** (new)
2. **Display Name + Tag + Password** (existing)

---

## Login Methods

### Method 1: Login with Email (NEW)

```bash
curl -X POST http://localhost:7777/account/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "player@example.com",
    "password": "password123"
  }'
```

**Response:**
```json
{
  "status": "success",
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI...",
  "player_id": 1,
  "display_name": "Player One",
  "player_tag": "#5576"
}
```

### Method 2: Login with Tag (EXISTING)

```bash
curl -X POST http://localhost:7777/account/login \
  -H "Content-Type: application/json" \
  -d '{
    "display_name": "Player One",
    "player_tag": "#5576",
    "password": "password123"
  }'
```

**Response:**
```json
{
  "status": "success",
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI...",
  "player_id": 1,
  "display_name": "Player One",
  "player_tag": "#5576"
}
```

---

## Requirements

| Field | Method 1 | Method 2 | Required |
|-------|----------|----------|----------|
| email | ✅ | ❌ | For Method 1 |
| display_name | ❌ | ✅ | For Method 2 |
| player_tag | ❌ | ✅ | For Method 2 |
| password | ✅ | ✅ | Always |

**Important:** 
- Player tag must include hashtag: `#5576` (not `5576`)
- Must provide EITHER email OR (display_name + player_tag)
- Password is always required

---

## Error Responses

### Missing Password
```json
{
  "status": "error",
  "message": "Missing password"
}
```

### Missing Login Method
```json
{
  "status": "error",
  "message": "Must provide either email OR (display_name + player_tag)"
}
```

### Invalid Credentials
```json
{
  "status": "error",
  "message": "Invalid credentials"
}
```

---

## Use Cases

### Scenario 1: Player Knows Their Email
```csharp
// C# Example
var loginData = new {
    email = "player@example.com",
    password = "mypassword"
};

// Send to /account/login
// Get back tokens and player info
```

### Scenario 2: Player Knows Their Tag
```csharp
// C# Example
var loginData = new {
    display_name = "Player One",
    player_tag = "#5576",
    password = "mypassword"
};

// Send to /account/login
// Get back tokens and player info
```

### Scenario 3: Remember-Me Feature
```csharp
// Store email for easy re-login
string savedEmail = "player@example.com";

// Later, quick login
var quickLogin = new {
    email = savedEmail,
    password = "mypassword"
};

// OR use remember token for 0-password login
// See API_COMPLETE_REFERENCE.md for remember-me details
```

---

## Unity Integration Example

```csharp
public class LoginManager : MonoBehaviour
{
    private const string SERVER_URL = "http://192.168.0.31:7777";
    
    // Login with Email
    public IEnumerator LoginWithEmail(string email, string password)
    {
        var loginData = new {
            email = email,
            password = password
        };
        
        string jsonBody = JsonUtility.ToJson(loginData);
        byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(jsonBody);
        
        using (UnityWebRequest request = new UnityWebRequest(
            $"{SERVER_URL}/account/login", "POST"))
        {
            request.uploadHandler = new UploadHandlerRaw(bodyRaw);
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");
            
            yield return request.SendWebRequest();
            
            if (request.result == UnityWebRequest.Result.Success)
            {
                // Parse response and save tokens
                LoginResponse response = JsonUtility.FromJson<LoginResponse>(
                    request.downloadHandler.text);
                
                // Save tokens
                PlayerPrefs.SetString("access_token", response.access_token);
                PlayerPrefs.SetString("refresh_token", response.refresh_token);
                
                Debug.Log($"✅ Logged in as {response.display_name}");
            }
            else
            {
                Debug.LogError($"❌ Login failed: {request.error}");
            }
        }
    }
    
    // Login with Tag
    public IEnumerator LoginWithTag(string displayName, string playerTag, string password)
    {
        var loginData = new {
            display_name = displayName,
            player_tag = playerTag,
            password = password
        };
        
        string jsonBody = JsonUtility.ToJson(loginData);
        byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(jsonBody);
        
        using (UnityWebRequest request = new UnityWebRequest(
            $"{SERVER_URL}/account/login", "POST"))
        {
            request.uploadHandler = new UploadHandlerRaw(bodyRaw);
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");
            
            yield return request.SendWebRequest();
            
            if (request.result == UnityWebRequest.Result.Success)
            {
                LoginResponse response = JsonUtility.FromJson<LoginResponse>(
                    request.downloadHandler.text);
                
                PlayerPrefs.SetString("access_token", response.access_token);
                PlayerPrefs.SetString("refresh_token", response.refresh_token);
                
                Debug.Log($"✅ Logged in as {response.display_name}");
            }
            else
            {
                Debug.LogError($"❌ Login failed: {request.error}");
            }
        }
    }
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
```

---

## Files Modified

- `controllers/authController.js` - Updated `login()` function
- `API_COMPLETE_REFERENCE.md` - Updated login endpoint documentation

---

## Testing

### Test 1: Login with Email
```bash
curl -X POST http://192.168.0.31:7777/account/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}'
```

### Test 2: Login with Tag
```bash
curl -X POST http://192.168.0.31:7777/account/login \
  -H "Content-Type: application/json" \
  -d '{"display_name": "TestPlayer", "player_tag": "#5576", "password": "password123"}'
```

Both should work and return same format response! ✅

---

**Status:** ✅ Complete - Login now supports both email and tag methods
