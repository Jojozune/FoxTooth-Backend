const db = require('../config/database');

// Send invite to join session
function sendInvite(req, res) {
  const { receiver_id, session_code } = req.body;
  const sender_id = req.player.playerId;

  console.log('=== INVITE SEND START ===');
  console.log('📨 Invite request data:', { sender_id, receiver_id, session_code });

  if (!receiver_id || !session_code) {
    console.error('❌ Missing required fields for invite');
    return res.status(400).json({ status: 'error', message: 'Missing receiver_id or session_code' });
  }

  // Verify session exists and sender is in it
  const sessionQuery = `
    SELECT gs.*, gsrv.ip_address, gsrv.port 
    FROM game_sessions gs
    JOIN game_servers gsrv ON gs.server_id = gsrv.id
    WHERE gs.session_code = ? AND (gs.host_player_id = ? OR gs.current_players > 0)
  `;

  console.log('🔍 Verifying session exists...');

  db.execute(sessionQuery, [session_code, sender_id], (sessionErr, sessionResults) => {
    if (sessionErr) {
      console.error('❌ Session verification error:', sessionErr);
      return res.status(500).json({ status: 'error', message: 'Database error verifying session' });
    }

    console.log('📊 Session verification results:', sessionResults);

    if (sessionResults.length === 0) {
      console.error('❌ Session not found or sender not in session');
      return res.status(404).json({ status: 'error', message: 'Session not found or access denied' });
    }

    const session = sessionResults[0];
    console.log('✅ Session verified:', session);

    // Check if receiver exists and is online
    const receiverQuery = `SELECT id, display_name, player_tag FROM players WHERE id = ? AND is_online = 1`;
    console.log('🔍 Checking receiver exists and is online...');

    db.execute(receiverQuery, [receiver_id], (receiverErr, receiverResults) => {
      if (receiverErr) {
        console.error('❌ Receiver check error:', receiverErr);
        return res.status(500).json({ status: 'error', message: 'Database error checking receiver' });
      }

      console.log('📊 Receiver check results:', receiverResults);

      if (receiverResults.length === 0) {
        console.error('❌ Receiver not found or offline');
        return res.status(404).json({ status: 'error', message: 'Receiver not found or offline' });
      }

      const receiver = receiverResults[0];
      console.log('✅ Receiver found:', receiver);

      // Check for existing pending invite
      const existingInviteQuery = `SELECT id FROM invites WHERE sender_id = ? AND receiver_id = ? AND status = 'pending' AND expires_at > NOW()`;
      console.log('🔍 Checking for existing pending invites...');

      db.execute(existingInviteQuery, [sender_id, receiver_id], (existingErr, existingResults) => {
        if (existingErr) {
          console.error('❌ Existing invite check error:', existingErr);
          return res.status(500).json({ status: 'error', message: 'Database error checking existing invites' });
        }

        console.log('📊 Existing invite results:', existingResults);

        if (existingResults.length > 0) {
          console.error('❌ Already have a pending invite to this player');
          return res.status(409).json({ status: 'error', message: 'Already have a pending invite to this player' });
        }

        // Create the invite
        const inviteQuery = `
          INSERT INTO invites (sender_id, receiver_id, session_code, status, created_at, expires_at) 
          VALUES (?, ?, ?, 'pending', NOW(), DATE_ADD(NOW(), INTERVAL 120 SECOND))
        `;

        console.log('🔄 Creating invite...');

        db.execute(inviteQuery, [sender_id, receiver_id, session_code], (inviteErr, inviteResults) => {
          if (inviteErr) {
            console.error('❌ INVITE CREATION FAILED:', inviteErr);
            return res.status(500).json({ status: 'error', message: 'Failed to create invite: ' + inviteErr.message });
          }

          console.log('✅ Invite created successfully');
          console.log('📬 Invite ID:', inviteResults.insertId);
          console.log('=== INVITE SEND SUCCESS ===');

          res.json({
            status: 'success',
            invite_id: inviteResults.insertId,
            session_code: session_code,
            expires_in: 120
          });
        });
      });
    });
  });
}

// Check for pending invites
function checkInvites(req, res) {
  const playerId = req.params.playerId;

  // Security check - player can only check their own invites
  if (parseInt(playerId) !== req.player.playerId) {
    return res.status(403).json({ status: 'error', message: 'Cannot check invites for other players' });
  }

  console.log('=== INVITE CHECK START ===');
  console.log('🔍 Checking invites for player ID:', playerId);

  const query = `
    SELECT i.id as invite_id, i.session_code, i.created_at, i.expires_at,
           p.id as sender_id, p.display_name, p.player_tag
    FROM invites i
    JOIN players p ON i.sender_id = p.id
    WHERE i.receiver_id = ? AND i.status = 'pending' AND i.expires_at > NOW()
  `;

  db.execute(query, [playerId], (err, results) => {
    if (err) {
      console.error('❌ Invite check error:', err);
      return res.status(500).json({ status: 'error', message: 'Database error checking invites' });
    }

    console.log('📊 Found invites:', results.length);
    console.log('=== INVITE CHECK COMPLETE ===');

    res.json({
      invites: results.map(invite => ({
        invite_id: invite.invite_id,
        sender_id: invite.sender_id,
        sender_name: `${invite.display_name}${invite.player_tag}`,
        session_code: invite.session_code,
        created_at: invite.created_at,
        expires_at: invite.expires_at
      }))
    });
  });
}

// Respond to invite (accept/decline)
function respondToInvite(req, res) {
  const { invite_id, response } = req.body;
  const player_id = req.player.playerId;

  console.log('=== INVITE RESPOND START ===');
  console.log('📝 Invite response data:', { invite_id, player_id, response });

  if (!invite_id || !response) {
    console.error('❌ Missing required fields for invite response');
    return res.status(400).json({ status: 'error', message: 'Missing invite_id or response' });
  }

  if (!['accept', 'decline'].includes(response)) {
    console.error('❌ Invalid response type:', response);
    return res.status(400).json({ status: 'error', message: 'Response must be "accept" or "decline"' });
  }

  // Get invite details
  const inviteQuery = `
    SELECT i.*, gs.server_id, gsrv.ip_address, gsrv.port
    FROM invites i
    JOIN game_sessions gs ON i.session_code = gs.session_code
    JOIN game_servers gsrv ON gs.server_id = gsrv.id
    WHERE i.id = ? AND i.receiver_id = ? AND i.status = 'pending' AND i.expires_at > NOW()
  `;

  console.log('🔍 Retrieving invite details...');

  db.execute(inviteQuery, [invite_id, player_id], (inviteErr, inviteResults) => {
    if (inviteErr) {
      console.error('❌ Invite retrieval error:', inviteErr);
      return res.status(500).json({ status: 'error', message: 'Database error retrieving invite' });
    }

    console.log('📊 Invite retrieval results:', inviteResults);

    if (inviteResults.length === 0) {
      console.error('❌ Invite not found, expired, or already responded');
      return res.status(404).json({ status: 'error', message: 'Invite not found, expired, or already responded' });
    }

    const invite = inviteResults[0];
    console.log('✅ Valid invite found:', invite);

    if (response === 'decline') {
      console.log('❌ Invite declined by player');
      // Mark as declined
      const declineQuery = `UPDATE invites SET status = 'declined' WHERE id = ?`;
      db.execute(declineQuery, [invite_id], (declineErr) => {
        if (declineErr) {
          console.error('❌ Decline update error:', declineErr);
          return res.status(500).json({ status: 'error', message: 'Database error declining invite' });
        }

        console.log('✅ Invite marked as declined');
        console.log('=== INVITE RESPOND DECLINED ===');

        res.json({
          status: 'declined',
          message: 'Invite declined'
        });
      });

    } else {
      console.log('✅ Invite accepted by player');
      // Accept the invite
      const acceptQuery = `UPDATE invites SET status = 'accepted' WHERE id = ?`;

      console.log('🔄 Marking invite as accepted...');
      db.execute(acceptQuery, [invite_id], (acceptErr) => {
        if (acceptErr) {
          console.error('❌ Accept update error:', acceptErr);
          return res.status(500).json({ status: 'error', message: 'Database error accepting invite' });
        }

        console.log('✅ Invite marked as accepted');
        handleInviteAcceptance(invite, player_id, res);
      });
    }
  });
}

function handleInviteAcceptance(invite, player_id, res) {
  // Find the player's current session (if any)
  const findCurrentSessionQuery = `
    SELECT gs.id as session_id, gs.server_id, gs.current_players, gs.host_player_id
    FROM game_sessions gs
    WHERE gs.host_player_id = ?
  `;

  console.log('🔍 Finding player current session...');

  db.execute(findCurrentSessionQuery, [player_id], (findSessionErr, currentSessionResults) => {
    if (findSessionErr) {
      console.error('❌ Failed to find current session:', findSessionErr);
      // Continue with joining new session even if this fails
      return joinNewSession();
    }

    const hasCurrentSession = currentSessionResults.length > 0;
    console.log('📊 Current session found:', hasCurrentSession);

    if (hasCurrentSession) {
      const currentSession = currentSessionResults[0];
      console.log('🗑️ Player has current session to clean up:', currentSession);

      // Handle the old session cleanup
      if (currentSession.current_players > 1) {
        // Other players in session - transfer host and decrease count
        console.log('🔄 Transferring host in old session...');
        transferHostInOldSession(currentSession.session_id, currentSession.server_id, player_id, joinNewSession);
      } else {
        // Only player in session - delete it entirely
        console.log('🔄 Deleting empty old session...');
        deleteOldSession(currentSession.session_id, currentSession.server_id, joinNewSession);
      }
    } else {
      // No current session, just join the new one
      console.log('ℹ️ Player has no current session, joining new session directly');
      joinNewSession();
    }

    function joinNewSession() {
      // Add Player to the new session
      const updateSession = `UPDATE game_sessions SET current_players = current_players + 1 WHERE session_code = ?`;
      console.log('🔄 Adding player to new session...');

      db.execute(updateSession, [invite.session_code], (sessionErr) => {
        if (sessionErr) {
          console.error('❌ Failed to update session count:', sessionErr);
        } else {
          console.log('✅ Session player count updated');
        }

        // Update server player count for the NEW server
        const updateServer = `UPDATE game_servers SET current_player_count = current_player_count + 1 WHERE id = ?`;
        console.log('🔄 Increasing new server player count...');

        db.execute(updateServer, [invite.server_id], (serverErr) => {
          if (serverErr) {
            console.error('❌ Failed to update server count:', serverErr);
          } else {
            console.log('✅ New server count updated');
          }

          console.log('🎉 Invite acceptance completed successfully');
          console.log('=== INVITE RESPOND ACCEPTED ===');

          res.json({
            status: 'accepted',
            server_ip: invite.ip_address,
            server_port: invite.port,
            session_code: invite.session_code,
            message: 'Connecting to game session...'
          });
        });
      });
    }
  });
}

// Helper function to transfer host in old session when player leaves
function transferHostInOldSession(session_id, server_id, leaving_player_id, callback) {
  const transferHostQuery = `
    UPDATE game_sessions 
    SET host_player_id = (
      SELECT p.id FROM players p
      WHERE p.id IN (
        SELECT DISTINCT host_player_id FROM game_sessions 
        WHERE id = ? AND host_player_id != ?
      )
      LIMIT 1
    ),
    current_players = current_players - 1
    WHERE id = ?
  `;

  console.log('🔄 Transferring host in old session...');

  db.execute(transferHostQuery, [session_id, leaving_player_id, session_id], (transferErr) => {
    if (transferErr) {
      console.error('❌ Host transfer error in old session:', transferErr);
      // If transfer fails, try to just decrease player count
      const fallbackQuery = `UPDATE game_sessions SET current_players = current_players - 1 WHERE id = ?`;
      db.execute(fallbackQuery, [session_id], (fallbackErr) => {
        if (fallbackErr) {
          console.error('❌ Fallback update error:', fallbackErr);
        }
        // Still update server count and continue
        updateOldServerCount(server_id, callback);
      });
    } else {
      console.log('✅ Host transferred and player count decreased in old session');
      updateOldServerCount(server_id, callback);
    }
  });
}

// Helper function to delete old empty session
function deleteOldSession(session_id, server_id, callback) {
  const deleteSessionQuery = `DELETE FROM game_sessions WHERE id = ?`;

  console.log('🔄 Deleting old empty session...');
  db.execute(deleteSessionQuery, [session_id], (deleteErr) => {
    if (deleteErr) {
      console.error('❌ Old session delete error:', deleteErr);
    } else {
      console.log('✅ Old session deleted');
    }

    updateOldServerCount(server_id, callback);
  });
}

// Helper function to update server count for old server
function updateOldServerCount(server_id, callback) {
  const updateServerQuery = `
    UPDATE game_servers 
    SET current_player_count = GREATEST(0, current_player_count - 1)
    WHERE id = ?
  `;

  console.log('🔄 Decreasing old server player count...');
  db.execute(updateServerQuery, [server_id], (serverErr) => {
    if (serverErr) {
      console.error('⚠️ Old server count update error:', serverErr);
    } else {
      console.log('✅ Old server player count decreased');
    }

    callback();
  });
}

// Cleanup expired invites
function cleanupInvites(req, res) {
  console.log('=== INVITE CLEANUP START ===');

  const query = `DELETE FROM invites WHERE expires_at < NOW() OR status IN ('accepted', 'declined')`;

  db.execute(query, (err, results) => {
    if (err) {
      console.error('❌ Invite cleanup error:', err);
      return res.status(500).json({ status: 'error', message: 'Cleanup failed' });
    }

    console.log('✅ Cleaned up expired invites:', results.affectedRows);
    console.log('=== INVITE CLEANUP COMPLETE ===');

    res.json({
      deleted_count: results.affectedRows,
      message: `Cleaned up ${results.affectedRows} expired invites`
    });
  });
}

module.exports = {
  sendInvite,
  checkInvites,
  respondToInvite,
  cleanupInvites
};