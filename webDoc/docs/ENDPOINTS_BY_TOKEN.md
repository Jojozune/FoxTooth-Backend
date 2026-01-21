# API Endpoints by Required Token / Middleware

This file lists every Express endpoint defined in `server/server.js`, grouped by the middleware or token required to access it. For each endpoint you get: HTTP method, path, middleware applied, the controller handler, and a short note about parameters and behavior.

> Note: `authenticateToken` is the project's JWT middleware (from `middleware/auth.js`). `authenticateAdmin` requires a valid admin token header (from `middleware/adminAuth.js`). Rate limiters are applied where noted.

## Public Routes (no JWT required)

- GET /
  - Middleware: none (global rate limits still apply)
  - Handler: inline (responds with a running message)
  - Notes: Health-check / root endpoint

### Account management

- POST /account/create
  - Middleware: `createAccountLimiter`, `validateAccountCreation`
  - Handler: `authController.createAccount`
  - Notes: body { display_name, player_tag, email, password }

- POST /account/login
  - Middleware: `loginLimiter`, `validateLogin`
  - Handler: `authController.login`
  - Notes: body { display_name, player_tag, password, remember_me? }

### Authentication helpers

- POST /player/connect
  - Middleware: none
  - Handler: `authController.playerConnect`
  - Notes: Lightweight connect for existing accounts, body { display_name, player_tag, remember_me? }

- POST /player/refresh-token
  - Middleware: none
  - Handler: `authController.refreshToken`
  - Notes: body { refresh_token, player_id }

- POST /player/remember-login
  - Middleware: none
  - Handler: `authController.rememberLogin`
  - Notes: body { remember_token, player_id }

### Player listing / lookup

- GET /players
  - Middleware: none
  - Handler: `playerController.getPlayers`
  - Notes: query { exclude_player_id? }

- GET /player/lookup
  - Middleware: none
  - Handler: `playerController.lookupPlayer`
  - Notes: query { display_name, player_tag }

### Server / Session (public for game servers)

- POST /server/update
  - Middleware: none
  - Handler: `serverController.updateServer`
  - Notes: update session/server metadata

- POST /server/update-players
  - Middleware: none
  - Handler: `serverController.updatePlayerCount`
  - Notes: update player count for a session

- POST /session/link-server
  - Middleware: none
  - Handler: `serverController.linkSessionToServer`
  - Notes: links a session_code to a server_id

- POST /server/heartbeat
  - Middleware: none
  - Handler: `handleServerHeartbeat` (from services/serverService)
  - Notes: server heartbeat (keeps server alive in registry)

## Admin-only Routes (require admin token)

- GET /admin/generate-token
  - Middleware: `authenticateToken` (then checks DB is_admin flag) 
  - Handler: inline admin-token generator (requires the user to be admin in DB)
  - Notes: returns an admin token (used for server registration/removal)

- POST /server/register
  - Middleware: `authenticateAdmin`
  - Handler: `serverController.registerServer`
  - Notes: body { ip_address, port, max_players?, region? }

- POST /server/remove
  - Middleware: `authenticateAdmin`
  - Handler: `serverController.removeServer`
  - Notes: body { session_code }

## Protected Routes (require `authenticateToken` JWT)

These endpoints require a valid JWT access token; the middleware populates `req.player`.

### Token & Session

- GET /player/validate-token
  - Middleware: `authenticateToken`
  - Handler: `authController.validateToken`
  - Notes: returns token validity and `req.player`

- POST /player/logout
  - Middleware: `authenticateToken`
  - Handler: `authController.logout`
  - Notes: supports per-device (presented `remember_token`) or global logout

- POST /player/disconnect
  - Middleware: `authenticateToken`
  - Handler: `sessionController.disconnectPlayer`
  - Notes: gracefully disconnects player and handles session cleanup

### Invite System

- POST /invite/send
  - Middleware: `authenticateToken`
  - Handler: `inviteController.sendInvite`
  - Notes: body { receiver_id, session_code }

- GET /invite/check/:playerId
  - Middleware: `authenticateToken`
  - Handler: `inviteController.checkInvites`
  - Notes: path param { playerId } (player may only check their own invites)

- POST /invite/respond
  - Middleware: `authenticateToken`
  - Handler: `inviteController.respondToInvite`
  - Notes: body { invite_id, response: 'accept'|'decline' }

- DELETE /invite/cleanup
  - Middleware: none
  - Handler: `inviteController.cleanupInvites`
  - Notes: clears expired invites

### Friend System (all protected)

- POST /friend/request
  - Middleware: `authenticateToken`
  - Handler: `friendController.sendFriendRequest`
  - Notes: body { friend_id }

- GET /friend/requests
  - Middleware: `authenticateToken`
  - Handler: `friendController.getFriendRequests`
  - Notes: returns pending requests directed at `req.player`

- POST /friend/accept
  - Middleware: `authenticateToken`
  - Handler: `friendController.acceptFriendRequest`
  - Notes: body { request_id }

- POST /friend/decline
  - Middleware: `authenticateToken`
  - Handler: `friendController.declineFriendRequest`
  - Notes: body { request_id }

- POST /friend/remove
  - Middleware: `authenticateToken`
  - Handler: `friendController.removeFriend`
  - Notes: body { friend_id } (deletes both directions)

- GET /friends
  - Middleware: `authenticateToken`
  - Handler: `friendController.getFriendsList`
  - Notes: returns accepted friends for `req.player`

- POST /friend/block
  - Middleware: `authenticateToken`
  - Handler: `friendController.blockPlayer`
  - Notes: body { player_to_block }

- POST /friend/unblock
  - Middleware: `authenticateToken`
  - Handler: `friendController.unblockPlayer`
  - Notes: body { player_to_unblock }

- GET /friend/blocked
  - Middleware: `authenticateToken`
  - Handler: `friendController.getBlockedList`
  - Notes: returns players this user has blocked

- GET /friend/check/:friend_id
  - Middleware: `authenticateToken`
  - Handler: `friendController.isFriend`
  - Notes: path param { friend_id } returns relationship status

## Notes & Observations

- Rate limiting: `generalLimiter` is applied globally; specific endpoints have stronger limits (`createAccountLimiter`, `loginLimiter`).
- Some public endpoints are intentionally unauthenticated for ease of server-to-server communication (server heartbeats, server updates).
- `authenticateAdmin` uses admin tokens generated via `/admin/generate-token` which itself requires a valid `authenticateToken` + DB check for `is_admin`.

If you'd like, I can:
- Add a machine-readable OpenAPI/Swagger spec for these endpoints.
- Generate a Postman collection JSON using the exact endpoint shapes.
- Run quick smoke tests (curl) against a running server if you want live verification.
