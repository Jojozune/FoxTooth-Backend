Frontend Invite System Spec (Unity)

Purpose
- Short, actionable spec for implementing the invite UX in your Unity client.
- Supported flows: send invite (host -> receiver), receive invite (receiver UI), acknowledge, accept/decline, and fallback REST polling.
- Real-time via WebSocket (Socket.IO). HTTP endpoints are available as fallback.

Key constraints & behaviors (from backend)
- Invites are created with 120s expiry. (expires_in = 120)
- Only host of a session may send invites for that session.
- Duplicate pending invites (same sender->receiver) are rejected.
- Receiver must be online to receive invite in real-time; server will reject if offline.
- Invite lifecycle: pending -> accepted OR declined OR expired.

API & Events (what frontend needs)

1) WebSocket (preferred)
- Connect: send auth token in handshake (socket.io auth: { token })
- Events the client emits:
  - invite:send
    - payload: { receiver_id: number, session_code: string }
    - server responses (emitted back to sender):
      - invite:send:success { status, invite_id, session_code, receiver_id, receiver_name, expires_in }
      - invite:send:error { status, message }
  - invite:acknowledged
    - payload: { invite_id: number }
    - server replies: invite:acknowledged:ack { status, invite_id }
  - invite:respond
    - payload: { invite_id: number, response: 'accept' | 'decline' }
    - server replies: invite:respond:success or invite:respond:error

- Events the client listens for:
  - invite:received
    - payload: { invite_id, sender_id, sender_name, session_code, server_ip, server_port, created_at, expires_in }
    - UX: show incoming invite popup with Accept / Decline; auto-acknowledge when popup shown (emit invite:acknowledged)
  - invite:accepted (sender receives)
    - payload: { invite_id, receiver_id, message }
  - invite:declined (sender receives)
    - payload: { invite_id, receiver_id, message }
  - invite:send:success / invite:send:error (sender receives immediate result)
  - invite:respond:success / invite:respond:error (responder receives result, server info on accept)

2) HTTP Fallback endpoints (if WS not available)
- POST /invite/send (protected)
  - Body: { receiver_id, session_code }
  - Response: { status:'success', invite_id, session_code, expires_in }
  - Errors: 400/404/409/500
- GET /invite/check/:playerId (protected)
  - Returns pending invites for player
- POST /invite/respond (protected)
  - Body: { invite_id, response }
  - Same success/error semantics as WS respond

Client responsibilities & UX
- Maintain a small invite UI component (popup + queue) per player session.
- Show incoming invite popup with: sender name+tag, session name/code (if shown), time remaining (countdown from expires_in).
- Immediately emit invite:acknowledged when popup is presented (so server/sender knows it was received).
- Provide Accept and Decline buttons; disable after action or expiry.
- When user Accepts: emit invite:respond { invite_id, response:'accept' } and wait for invite:respond:success which includes server_ip and server_port -> connect to game server.
- When user Declines: emit invite:respond with 'decline' and close popup.

Timing / Retries / Edge Cases
- Expiry: Show client countdown; if timer reaches zero, remove popup and optionally call GET /invite/check to confirm state.
- Network drops: If websocket disconnects, fall back to polling GET /invite/check/:playerId every 5-10s until WS reconnects. Use HTTP /invite/respond for decisions while WS down.
- Duplicate invites: Backend rejects duplicate pending invites (409). Show message "Invite already pending" to sender.
- Receiver offline: backend returns 404 when sending invite if receiver offline; show "Player is offline".
- Race: If two players accept same spot simultaneously, backend will process and return result for each; handle server errors gracefully.

Minimal Unity code snippets

1) Send invite (Socket.IO client)

```csharp
// using SocketIOClient (C# Socket.IO client)
var data = new { receiver_id = receiverId, session_code = sessionCode };
socket.EmitAsync("invite:send", data);

socket.On("invite:send:success", (response) => {
  // parse response - show UI feedback: "Invite sent"
});
socket.On("invite:send:error", (response) => {
  // show error message
});
```

2) Handle incoming invite

```csharp
socket.On("invite:received", response => {
  var invite = response.GetValue<Dictionary<string, object>>();
  int inviteId = Convert.ToInt32(invite["invite_id"]);
  string senderName = invite["sender_name"].ToString();
  string sessionCode = invite["session_code"].ToString();
  int expiresIn = Convert.ToInt32(invite["expires_in"]);

  // Show popup UI
  ShowInvitePopup(inviteId, senderName, sessionCode, expiresIn);

  // Acknowledge receipt
  socket.EmitAsync("invite:acknowledged", new { invite_id = inviteId });
});
```

3) Respond to invite

```csharp
// Accept
socket.EmitAsync("invite:respond", new { invite_id = inviteId, response = "accept" });
// Decline
socket.EmitAsync("invite:respond", new { invite_id = inviteId, response = "decline" });

socket.On("invite:respond:success", response => {
  var data = response.GetValue<Dictionary<string, object>>();
  if (data["status"].ToString() == "accepted") {
    // Connect to provided server
    string ip = data["server_ip"].ToString();
    int port = Convert.ToInt32(data["server_port"]);
    ConnectToGameServer(ip, port);
  } else {
    // Show declined message
  }
});

socket.On("invite:respond:error", response => {
  // show error
});
```

Testing checklist for frontend
- [ ] Send invite from host -> receiver receives popup
- [ ] Accept invite -> receiver connects to provided server
- [ ] Decline invite -> sender notified of decline
- [ ] Sender cannot send duplicate invites to same receiver
- [ ] Sending invite to offline user fails with clear error
- [ ] WS disconnect -> HTTP polling returns pending invites
- [ ] Invite expiry removed from UI at 120s

Notes for ChatGPT implementer for Unity
- Use Socket.IO client and pass access token in handshake: socket = new SocketIO(SERVER_URL, new SocketIOOptions { Auth = new { token = accessToken } });
- Implement invite UI as a queue so multiple invites stack and user can choose
- Keep invite popups non-blocking (do not stop the game loop)
- Use client-side countdown but also validate expiry with GET /invite/check if uncertainty

Delivery
- This document covers everything the frontend needs to implement invite send/receive/response via WebSocket with HTTP fallback. Give this doc to ChatGPT or a Unity dev and they can implement the UI and client handlers.
