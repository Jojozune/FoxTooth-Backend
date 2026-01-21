const jwt = require('jsonwebtoken');
const db = require('../config/database');

// Enable verbose websocket debug logs with WS_DEBUG=1 or WS_DEBUG=true
const DEBUG_WS = process.env.WS_DEBUG === '1' || process.env.WS_DEBUG === 'true';

// Track active connections: playerId -> socket
const activeConnections = new Map();

/**
 * Initialize WebSocket server
 * @param {Server} httpServer - Express HTTP server instance
 * @returns {Object} Socket.IO server instance
 */
function initializeWebSocket(httpServer) {
  const socketIO = require('socket.io')(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Global middleware for authentication (applies to default namespace)
  socketIO.use(authenticateSocket);

  // Default/root namespace connection handler
  socketIO.on('connection', (socket) => {
    handlePlayerConnection(socket);
  });

  // Also support an explicit namespace for legacy or client-side routing
  // If your Unity client connects to "http://host:port/ws/invites", this
  // namespace will accept the connection and reuse the same handlers.
  const invitesNamespace = socketIO.of('/ws/invites');
  invitesNamespace.use(authenticateSocket);
  invitesNamespace.on('connection', (socket) => {
    // Keep the same behavior for players connecting on the /ws/invites namespace
    handlePlayerConnection(socket);
  });

  return socketIO;
}

/**
 * Middleware to authenticate WebSocket connections
 */
function authenticateSocket(socket, next) {
  // Prefer modern socket.io auth (handshake.auth.token). Fall back to query param `token` for clients
  // that can't set the socket.io auth object (some Unity clients / older libs).
  let token = socket.handshake.auth && socket.handshake.auth.token;
  if (!token && socket.handshake.query) {
    token = socket.handshake.query.token || socket.handshake.query.authToken || null;
  }

  if (!token) {
    if (DEBUG_WS) {
      console.warn(`⚠️ WebSocket auth failed: no token provided from ${socket.handshake.address || 'unknown'}`);
    }
    return next(new Error('Authentication error: No token provided'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    socket.playerId = decoded.playerId;
    socket.playerTag = decoded.playerTag;
    if (DEBUG_WS) {
      console.log(`🔐 Authenticated socket from ${socket.handshake.address || 'unknown'} as player ${socket.playerId} (${socket.playerTag})`);
    }
    next();
  } catch (err) {
    if (DEBUG_WS) {
      console.warn(`⚠️ WebSocket auth invalid token from ${socket.handshake.address || 'unknown'}`);
    }
    next(new Error('Authentication error: Invalid token'));
  }
}

/**
 * Handle a new player connection
 */
function handlePlayerConnection(socket) {
  const playerId = socket.playerId;

  const remote = socket.handshake.address || (socket.conn && socket.conn.remoteAddress) || 'unknown';

  console.log(`🔌 Player ${playerId} connected via WebSocket (${socket.id}) from ${remote} ${socket.playerTag ? `tag=${socket.playerTag}` : ''}`);

  // Store connection
  activeConnections.set(playerId, socket);

  // Mark player online
  updatePlayerOnline(playerId, true);

  // Emit a connection acknowledgement to the client
  try {
    socket.emit('connected', {
      status: 'connected',
      player_id: playerId,
      socket_id: socket.id,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    if (DEBUG_WS) console.warn(`Failed to emit connected ack to ${playerId}:`, e);
  }

  // Event: Player sends heartbeat
  socket.on('heartbeat', (data) => {
    handleHeartbeat(socket, data);
  });

  // Event: Player acknowledges invite received
  socket.on('invite:acknowledged', (data) => {
    handleInviteAcknowledged(socket, data);
  });

  // Event: Player sends invite
  socket.on('invite:send', (data) => {
    handleInviteSend(socket, data);
  });

  // Event: Player responds to invite
  socket.on('invite:respond', (data) => {
    handleInviteRespond(socket, data);
  });

  // Event: Disconnect (reason passed by socket.io)
  socket.on('disconnect', (reason) => {
    handlePlayerDisconnection(socket, reason);
  });

  // Error handling
  socket.on('error', (error) => {
    console.error(`❌ Socket error for player ${playerId}:`, error);
  });
}

/**
 * Handle player disconnection
 */
function handlePlayerDisconnection(socket) {
  // NOTE: this function may be called with a reason in socket.io v3+
  const playerId = socket.playerId;
  const reason = arguments[1] || 'unknown';
  const remote = socket.handshake.address || (socket.conn && socket.conn.remoteAddress) || 'unknown';

  console.log(`🔌 Player ${playerId} disconnected from WebSocket (${socket.id}) from ${remote}. Reason: ${reason}`);

  // Remove connection
  activeConnections.delete(playerId);

  // Mark offline (with slight delay in case they reconnect)
  setTimeout(() => {
    // Only mark offline if they don't reconnect
    if (!activeConnections.has(playerId)) {
      updatePlayerOnline(playerId, false);
    }
  }, 2000);
}

/**
 * Handle player heartbeat
 */
function handleHeartbeat(socket, data) {
  const playerId = socket.playerId;
  const { game_open } = data;

  // Update heartbeat in database
  const query = `
    UPDATE players 
    SET last_heartbeat = NOW(), 
        game_open = ?,
        is_online = 1
    WHERE id = ?
  `;

  db.execute(query, [game_open ? 1 : 0, playerId], (err) => {
    if (err) {
      console.error(`❌ Heartbeat update error for player ${playerId}:`, err);
      return;
    }

    // Emit heartbeat confirmation
    socket.emit('heartbeat:ack', {
      status: 'success',
      timestamp: new Date().toISOString(),
      game_open
    });
  });
}

/**
 * Handle invite sent from one player to another
 */
function handleInviteSend(socket, data) {
  const senderId = socket.playerId;
  const { receiver_id, session_code } = data;

  console.log(`📨 Invite send from ${senderId} to ${receiver_id} for session ${session_code}`);

  if (!receiver_id || !session_code) {
    return socket.emit('invite:send:error', {
      status: 'error',
      message: 'Missing receiver_id or session_code'
    });
  }

  // Verify session exists
  const sessionQuery = `
    SELECT gs.*, gsrv.ip_address, gsrv.port 
    FROM game_sessions gs
    JOIN game_servers gsrv ON gs.server_id = gsrv.id
    WHERE gs.session_code = ? AND gs.host_player_id = ?
  `;

  db.execute(sessionQuery, [session_code, senderId], (sessionErr, sessionResults) => {
    if (sessionErr || sessionResults.length === 0) {
      console.error('❌ Session verification failed');
      return socket.emit('invite:send:error', {
        status: 'error',
        message: 'Session not found or you are not the host'
      });
    }

    const session = sessionResults[0];

    // Verify receiver exists and is online
    const receiverQuery = `SELECT id, display_name, player_tag FROM players WHERE id = ? AND is_online = 1`;

    db.execute(receiverQuery, [receiver_id], (receiverErr, receiverResults) => {
      if (receiverErr || receiverResults.length === 0) {
        console.error('❌ Receiver verification failed');
        return socket.emit('invite:send:error', {
          status: 'error',
          message: 'Receiver not found or offline'
        });
      }

      const receiver = receiverResults[0];

      // Check for existing pending invite
      const existingQuery = `SELECT id FROM invites WHERE sender_id = ? AND receiver_id = ? AND status = 'pending' AND expires_at > NOW()`;

      db.execute(existingQuery, [senderId, receiver_id], (existingErr, existingResults) => {
        if (existingErr || existingResults.length > 0) {
          return socket.emit('invite:send:error', {
            status: 'error',
            message: 'Pending invite already exists'
          });
        }

        // Create the invite
        const inviteQuery = `
          INSERT INTO invites (sender_id, receiver_id, session_code, status, created_at, expires_at) 
          VALUES (?, ?, ?, 'pending', NOW(), DATE_ADD(NOW(), INTERVAL 120 SECOND))
        `;

        db.execute(inviteQuery, [senderId, receiver_id, session_code], (inviteErr, inviteResults) => {
          if (inviteErr) {
            console.error('❌ Invite creation failed:', inviteErr);
            return socket.emit('invite:send:error', {
              status: 'error',
              message: 'Failed to create invite'
            });
          }

          const inviteId = inviteResults.insertId;

          console.log(`✅ Invite created (ID: ${inviteId})`);

          // Confirm to sender
          socket.emit('invite:send:success', {
            status: 'success',
            invite_id: inviteId,
            session_code: session_code,
            receiver_id: receiver_id,
            receiver_name: `${receiver.display_name}${receiver.player_tag}`,
            expires_in: 120
          });

          // Notify receiver in real-time
          const receiverSocket = activeConnections.get(receiver_id);
          if (receiverSocket) {
            receiverSocket.emit('invite:received', {
              invite_id: inviteId,
              sender_id: senderId,
              sender_name: `${socket.playerTag}`,
              session_code: session_code,
              server_ip: session.ip_address,
              server_port: session.port,
              created_at: new Date().toISOString(),
              expires_in: 120
            });
          }
        });
      });
    });
  });
}

/**
 * Handle invite acknowledgment (player confirms they received it)
 */
function handleInviteAcknowledged(socket, data) {
  const playerId = socket.playerId;
  const { invite_id } = data;

  console.log(`✅ Player ${playerId} acknowledged invite ${invite_id}`);

  socket.emit('invite:acknowledged:ack', {
    status: 'success',
    invite_id
  });
}

/**
 * Handle player responding to invite (accept/decline)
 */
function handleInviteRespond(socket, data) {
  const playerId = socket.playerId;
  const { invite_id, response } = data;

  console.log(`📝 Player ${playerId} responding to invite ${invite_id}: ${response}`);

  if (!['accept', 'decline'].includes(response)) {
    return socket.emit('invite:respond:error', {
      status: 'error',
      message: 'Response must be "accept" or "decline"'
    });
  }

  // Get invite details
  const inviteQuery = `
    SELECT i.*, gs.server_id, gsrv.ip_address, gsrv.port
    FROM invites i
    JOIN game_sessions gs ON i.session_code = gs.session_code
    JOIN game_servers gsrv ON gs.server_id = gsrv.id
    WHERE i.id = ? AND i.receiver_id = ? AND i.status = 'pending' AND i.expires_at > NOW()
  `;

  db.execute(inviteQuery, [invite_id, playerId], (inviteErr, inviteResults) => {
    if (inviteErr || inviteResults.length === 0) {
      return socket.emit('invite:respond:error', {
        status: 'error',
        message: 'Invite not found, expired, or already responded'
      });
    }

    const invite = inviteResults[0];

    if (response === 'decline') {
      // Mark as declined
      const declineQuery = `UPDATE invites SET status = 'declined' WHERE id = ?`;

      db.execute(declineQuery, [invite_id], (declineErr) => {
        if (declineErr) {
          return socket.emit('invite:respond:error', {
            status: 'error',
            message: 'Failed to decline invite'
          });
        }

        socket.emit('invite:respond:success', {
          status: 'declined',
          invite_id,
          message: 'Invite declined'
        });

        // Notify sender
        const senderSocket = activeConnections.get(invite.sender_id);
        if (senderSocket) {
          senderSocket.emit('invite:declined', {
            invite_id,
            receiver_id: playerId,
            message: 'Invite was declined'
          });
        }
      });
    } else {
      // Accept the invite
      const acceptQuery = `UPDATE invites SET status = 'accepted' WHERE id = ?`;

      db.execute(acceptQuery, [invite_id], (acceptErr) => {
        if (acceptErr) {
          return socket.emit('invite:respond:error', {
            status: 'error',
            message: 'Failed to accept invite'
          });
        }

        socket.emit('invite:respond:success', {
          status: 'accepted',
          invite_id,
          server_ip: invite.ip_address,
          server_port: invite.port,
          session_code: invite.session_code,
          message: 'Connecting to game session...'
        });

        // Notify sender
        const senderSocket = activeConnections.get(invite.sender_id);
        if (senderSocket) {
          senderSocket.emit('invite:accepted', {
            invite_id,
            receiver_id: playerId,
            message: 'Invite was accepted'
          });
        }

        // Add player to session and update counts
        const updateSessionQuery = `UPDATE game_sessions SET current_players = current_players + 1 WHERE session_code = ?`;
        db.execute(updateSessionQuery, [invite.session_code], () => {
          const updateServerQuery = `UPDATE game_servers SET current_player_count = current_player_count + 1 WHERE id = ?`;
          db.execute(updateServerQuery, [invite.server_id], () => {
            console.log(`✅ Player ${playerId} joined session ${invite.session_code}`);
          });
        });
      });
    }
  });
}

/**
 * Update player online status in database
 */
function updatePlayerOnline(playerId, isOnline) {
  if (isOnline) {
    const query = `UPDATE players SET is_online = 1, last_heartbeat = NOW() WHERE id = ?`;
    db.execute(query, [playerId], (err) => {
      if (err) {
        console.error(`❌ Failed to mark player ${playerId} online:`, err);
      } else {
        console.log(`✅ Player ${playerId} marked online`);
      }
    });
  } else {
    const query = `UPDATE players SET is_online = 0, last_seen = NOW() WHERE id = ?`;
    db.execute(query, [playerId], (err) => {
      if (err) {
        console.error(`❌ Failed to mark player ${playerId} offline:`, err);
      } else {
        console.log(`✅ Player ${playerId} marked offline`);
      }
    });
  }
}

/**
 * Get active player socket by player ID
 */
function getPlayerSocket(playerId) {
  return activeConnections.get(playerId);
}

/**
 * Send message to specific player
 */
function sendToPlayer(playerId, eventName, data) {
  const socket = activeConnections.get(playerId);
  if (socket) {
    socket.emit(eventName, data);
  }
}

/**
 * Broadcast to all connected players
 */
function broadcast(eventName, data) {
  activeConnections.forEach((socket) => {
    socket.emit(eventName, data);
  });
}

/**
 * Get count of active connections
 */
function getActiveConnectionCount() {
  return activeConnections.size;
}

/**
 * Get list of online player IDs
 */
function getOnlinePlayerIds() {
  return Array.from(activeConnections.keys());
}

module.exports = {
  initializeWebSocket,
  getPlayerSocket,
  sendToPlayer,
  broadcast,
  getActiveConnectionCount,
  getOnlinePlayerIds,
  activeConnections
};
