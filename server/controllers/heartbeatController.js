const db = require('../config/database');

/**
 * Player heartbeat endpoint
 * Called periodically by game client to indicate it's alive and the game is open
 * 
 * Expected request body:
 * {
 *   game_open: boolean (true if game window is focused/open)
 * }
 */
function playerHeartbeat(req, res) {
  const playerId = req.player.playerId;
  const { game_open } = req.body;

  // Validate game_open flag
  if (game_open === undefined || typeof game_open !== 'boolean') {
    return res.status(400).json({
      status: 'error',
      message: 'Missing or invalid game_open flag (must be boolean)'
    });
  }

  console.log(`💓 Player ${playerId} heartbeat - game_open: ${game_open}`);

  // Update last heartbeat timestamp and mark online if they were marked offline
  // This ensures players who had a heartbeat gap are immediately restored
  const query = `
    UPDATE players 
    SET last_heartbeat = NOW(), 
        game_open = ?,
        is_online = 1
    WHERE id = ?
  `;

  db.execute(query, [game_open ? 1 : 0, playerId], (err, results) => {
    if (err) {
      console.error('❌ Heartbeat update error:', err);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to process heartbeat'
      });
    }

    res.json({
      status: 'success',
      message: 'Heartbeat received',
      timestamp: new Date().toISOString()
    });
  });
}

/**
 * Check if a player is actively heartbeating (alive)
 * A player is considered "actively alive" if:
 * 1. They are marked as online
 * 2. Their heartbeat is newer than the timeout threshold
 * 3. Their game_open flag is true
 * 
 * Query params:
 * - timeout_seconds: How many seconds without a heartbeat = dead (default: 30)
 */
function checkPlayerAlive(req, res) {
  const { playerId } = req.params;
  const timeoutSeconds = parseInt(req.query.timeout_seconds) || 30;

  // Security check - only admins or the player themselves can check
  if (parseInt(playerId) !== req.player.playerId && req.admin !== true) {
    return res.status(403).json({
      status: 'error',
      message: 'Cannot check other players unless admin'
    });
  }

  const query = `
    SELECT id, display_name, is_online, game_open,
           last_heartbeat,
           TIMESTAMPDIFF(SECOND, last_heartbeat, NOW()) as seconds_since_heartbeat
    FROM players
    WHERE id = ?
  `;

  db.execute(query, [playerId], (err, results) => {
    if (err) {
      console.error('❌ Player check error:', err);
      return res.status(500).json({
        status: 'error',
        message: 'Database error'
      });
    }

    if (results.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Player not found'
      });
    }

    const player = results[0];
    const isAlive = player.game_open === 1 && 
                    player.seconds_since_heartbeat <= timeoutSeconds;

    res.json({
      player_id: player.id,
      display_name: player.display_name,
      is_online: player.is_online === 1,
      game_open: player.game_open === 1,
      last_heartbeat: player.last_heartbeat,
      seconds_since_heartbeat: player.seconds_since_heartbeat,
      is_alive: isAlive,
      timeout_seconds: timeoutSeconds
    });
  });
}

/**
 * Check multiple players' alive status
 * Useful for checking if friends/party members are active
 * 
 * Expected request body:
 * {
 *   player_ids: [1, 2, 3],
 *   timeout_seconds: 30 (optional, default 30)
 * }
 */
function checkPlayersAlive(req, res) {
  const { player_ids, timeout_seconds = 30 } = req.body;

  if (!Array.isArray(player_ids) || player_ids.length === 0) {
    return res.status(400).json({
      status: 'error',
      message: 'player_ids must be a non-empty array'
    });
  }

  if (player_ids.length > 100) {
    return res.status(400).json({
      status: 'error',
      message: 'Maximum 100 players per request'
    });
  }

  // Create placeholders for SQL query
  const placeholders = player_ids.map(() => '?').join(',');
  
  const query = `
    SELECT id, display_name, is_online, game_open,
           last_heartbeat,
           TIMESTAMPDIFF(SECOND, last_heartbeat, NOW()) as seconds_since_heartbeat
    FROM players
    WHERE id IN (${placeholders})
  `;

  db.execute(query, player_ids, (err, results) => {
    if (err) {
      console.error('❌ Batch player check error:', err);
      return res.status(500).json({
        status: 'error',
        message: 'Database error'
      });
    }

    const playerStatuses = results.map(player => ({
      player_id: player.id,
      display_name: player.display_name,
      is_online: player.is_online === 1,
      game_open: player.game_open === 1,
      last_heartbeat: player.last_heartbeat,
      seconds_since_heartbeat: player.seconds_since_heartbeat,
      is_alive: player.game_open === 1 && 
                player.seconds_since_heartbeat <= timeout_seconds
    }));

    res.json({
      status: 'success',
      timeout_seconds,
      players: playerStatuses,
      alive_count: playerStatuses.filter(p => p.is_alive).length,
      total_checked: playerStatuses.length
    });
  });
}

/**
 * Admin endpoint to manually mark a player as dead
 * Useful if server detects a crash but client hasn't disconnected yet
 */
function forcePlayerOffline(req, res) {
  const { playerId } = req.params;

  console.log(`⚠️ Force offline triggered for player ${playerId}`);

  const query = `
    UPDATE players 
    SET is_online = 0, 
        game_open = 0,
        last_seen = NOW()
    WHERE id = ?
  `;

  db.execute(query, [playerId], (err, results) => {
    if (err) {
      console.error('❌ Force offline error:', err);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to mark player offline'
      });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Player not found'
      });
    }

    res.json({
      status: 'success',
      message: `Player ${playerId} marked as offline`,
      affected_rows: results.affectedRows
    });
  });
}

/**
 * Server-side cleanup: Mark players as offline if heartbeat is too old
 * Run this periodically via setInterval to detect crashed clients
 */
function cleanupDeadPlayers(timeoutSeconds = 30) {
  // Give new players a grace period (default 30s) before marking offline if no heartbeat
  // A player is considered dead if:
  // 1. They are online AND
  // 2. Either:
  //    a. They were connected more than timeoutSeconds ago AND have no heartbeat, OR
  //    b. They were connected more than timeoutSeconds ago AND their last heartbeat is older than timeoutSeconds
  const query = `
    UPDATE players 
    SET is_online = 0, 
        game_open = 0
    WHERE is_online = 1 
      AND (
        -- Grace period: if connected_at is still recent (within timeout), skip cleanup
        (TIMESTAMPDIFF(SECOND, connected_at, NOW()) > ? AND last_heartbeat IS NULL)
        OR
        -- Normal timeout: if they have a heartbeat but it's too old
        (TIMESTAMPDIFF(SECOND, last_heartbeat, NOW()) > ?)
      )
  `;

  db.execute(query, [timeoutSeconds, timeoutSeconds], (err, results) => {
    if (err) {
      console.error('❌ Cleanup dead players error:', err);
      return;
    }

    if (results.affectedRows > 0) {
      console.log(`⚠️ Marked ${results.affectedRows} players offline due to no heartbeat (timeout: ${timeoutSeconds}s)`);
    }
  });
}

module.exports = {
  playerHeartbeat,
  checkPlayerAlive,
  checkPlayersAlive,
  forcePlayerOffline,
  cleanupDeadPlayers
};
