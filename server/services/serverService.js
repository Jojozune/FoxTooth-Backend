const db = require('../config/database');

// Configurable heartbeat timeout (seconds) and defaults
const SERVER_HEARTBEAT_TIMEOUT_SECONDS = Number(process.env.SERVER_HEARTBEAT_TIMEOUT_SECONDS) || 120; // default 2 minutes

// Server heartbeat - mark server as active
function updateServerHeartbeat(serverId) {
  const query = `
    UPDATE game_servers 
    SET last_heartbeat = NOW(), is_available = 1 
    WHERE id = ?
  `;
  
  db.execute(query, [serverId], (err) => {
    if (err) {
      console.error('❌ Heartbeat update error for server:', serverId, err);
    } else {
      console.log('💓 Server heartbeat:', serverId, new Date().toISOString());
    }
  });
}

// Clean up dead servers (run every 5 minutes)
// Marks servers as unavailable if: last_heartbeat is NULL (never heartbeated) OR older than timeout
function cleanupDeadServers() {
  const query = `
    UPDATE game_servers 
    SET is_available = 0, current_player_count = 0
    WHERE (last_heartbeat IS NULL OR last_heartbeat < DATE_SUB(NOW(), INTERVAL ${SERVER_HEARTBEAT_TIMEOUT_SECONDS} SECOND))
    AND is_available = 1
  `;
  
  // Debug: count servers that will be affected
  const countQuery = `
    SELECT COUNT(*) as count 
    FROM game_servers 
    WHERE (last_heartbeat IS NULL OR last_heartbeat < DATE_SUB(NOW(), INTERVAL ${SERVER_HEARTBEAT_TIMEOUT_SECONDS} SECOND))
    AND is_available = 1
  `;
  
  db.execute(countQuery, (countErr, countResults) => {
    if (!countErr && countResults && countResults[0]) {
      const willUpdate = countResults[0].count;
      if (willUpdate > 0) {
        console.log(`📊 Server cleanup: found ${willUpdate} dead server(s) to mark unavailable`);
      }
    }
  });
  
  db.execute(query, (err, results) => {
    if (err) {
      console.error('❌ Dead server cleanup error:', err);
    } else {
      console.log(`🧹 Server cleanup ran (timeout: ${SERVER_HEARTBEAT_TIMEOUT_SECONDS}s), affected: ${results.affectedRows}`);
      if (results.affectedRows > 0) {
        console.log('🧹 Cleaned up dead servers:', results.affectedRows);
      }
    }
  });
}

// Clean up stale game sessions where the host/player disconnected before actually joining
// Criteria: session.status = 'waiting' AND (host player is offline OR last_heartbeat is NULL OR older than threshold)
// For each stale session, delete the session and decrement the associated game_server current_player_count
function cleanupDeadSessions() {
  // Find sessions waiting where host is offline or hasn't heartbeated recently (or never)
  const findQuery = `
    SELECT gs.id AS session_id, gs.server_id, gs.current_players
    FROM game_sessions gs
    LEFT JOIN players p ON p.id = gs.host_player_id
    WHERE gs.status = 'waiting'
      AND (p.is_online = 0 OR p.last_heartbeat IS NULL OR p.last_heartbeat < DATE_SUB(NOW(), INTERVAL ${SERVER_HEARTBEAT_TIMEOUT_SECONDS} SECOND))
  `;

  db.execute(findQuery, (err, results) => {
    if (err) {
      console.error('❌ Failed to query stale sessions for cleanup:', err);
      return;
    }

    if (!results || results.length === 0) {
      return; // nothing to clean
    }

    console.log(`🧹 Found ${results.length} stale session(s) to clean up`);

    results.forEach((row) => {
      const { session_id, server_id, current_players } = row;

      // Delete the stale session
      const delQuery = `DELETE FROM game_sessions WHERE id = ?`;
      db.execute(delQuery, [session_id], (delErr) => {
        if (delErr) {
          console.error(`❌ Failed to delete stale session ${session_id}:`, delErr);
          return;
        }

        // Recompute server current_player_count from remaining sessions to ensure accuracy
        const recomputeQuery = `
          UPDATE game_servers gs
          SET gs.current_player_count = (
            SELECT COALESCE(SUM(gsess.current_players), 0)
            FROM game_sessions gsess
            WHERE gsess.server_id = gs.id
              AND gsess.status != 'finished'
          )
          WHERE gs.id = ?
        `;

        db.execute(recomputeQuery, [server_id], (recErr) => {
          if (recErr) {
            console.error(`❌ Failed to recompute server count for server ${server_id}:`, recErr);
          } else {
            console.log(`✅ Cleaned stale session ${session_id} and recomputed server ${server_id} player count`);
          }
        });
      });
    });
  });
}

// Game servers should call this endpoint periodically
function handleServerHeartbeat(req, res) {
  const { server_id } = req.body;
  
  if (!server_id) {
    return res.status(400).json({
      status: 'error',
      message: 'Server ID required'
    });
  }
  
  updateServerHeartbeat(server_id);
  
  res.json({
    status: 'success',
    message: 'Heartbeat received'
  });
}

module.exports = {
  updateServerHeartbeat,
  cleanupDeadServers,
  cleanupDeadSessions,
  handleServerHeartbeat
};