const db = require('../config/database');
const bcrypt = require('bcryptjs');
const { generateAdminToken, authenticateAdmin } = require('../middleware/adminAuth');

// Register a new game server
function registerServer(req, res) {
  const { ip_address, port, max_players, region } = req.body;

  const query = `
    INSERT INTO game_servers (ip_address, port, max_players, region, is_available, current_player_count) 
    VALUES (?, ?, ?, ?, 1, 0)
  `;

  db.execute(query, [ip_address, port, max_players || 4, region || 'default'], (err, results) => {
    if (err) {
      console.error('Server registration error:', err);
      return res.status(500).json({ status: 'error', message: 'Failed to register server' });
    }

    res.json({
      status: 'success',
      server_id: results.insertId,
      message: 'Game server registered'
    });
  });
}

// Update server information
function updateServer(req, res) {
  const { session_code, server_ip, server_port, current_players } = req.body;

  const query = `
    UPDATE game_sessions 
    SET server_ip = ?, server_port = ?, max_players = ?, current_players = ?
    WHERE session_code = ?
  `;

  db.execute(query, [server_ip, server_port, current_players, session_code], (err, results) => {
    if (err) {
      return res.status(500).json({ status: 'error', message: 'Database error' });
    }

    res.json({ status: 'success', message: 'Server updated' });
  });
}

// Update player count
function updatePlayerCount(req, res) {
  const { session_code, current_players } = req.body;

  const query = `UPDATE game_sessions SET current_players = ? WHERE session_code = ?`;

  db.execute(query, [current_players, session_code], (err, results) => {
    if (err) {
      return res.status(500).json({ status: 'error', message: 'Database error' });
    }

    res.json({ status: 'success', message: 'Player count updated' });
  });
}

// Remove server
function removeServer(req, res) {
  const { session_code } = req.body;

  const query = `DELETE FROM game_sessions WHERE session_code = ?`;

  db.execute(query, [session_code], (err, results) => {
    if (err) {
      return res.status(500).json({ status: 'error', message: 'Database error' });
    }

    res.json({ status: 'success', message: 'Server removed' });
  });
}

// Link a session to a server
function linkSessionToServer(req, res) {
  const { session_code, server_id } = req.body;

  const query = `UPDATE game_sessions SET server_id = ? WHERE session_code = ?`;

  db.execute(query, [server_id, session_code], (err, results) => {
    if (err) {
      return res.status(500).json({ status: 'error', message: 'Database error' });
    }

    res.json({ status: 'success', message: 'Session linked to server' });
  });
}

// Composite endpoint: login -> generate admin token -> register server
// Expects credentials + server info in body. Example body:
// { email, password, ip_address, port, max_players, region }
function autoRegisterServer(req, res) {
  const { email, display_name, player_tag, password } = req.body;

  // Basic validation: need password and either email OR display_name+player_tag
  if (!password || (!email && !(display_name && player_tag))) {
    return res.status(400).json({ status: 'error', message: 'Missing credentials (password and email or display_name+player_tag)' });
  }

  // Build query based on provided login type
  let findUserQuery;
  let queryParams;

  if (email) {
    findUserQuery = `SELECT id, display_name, player_tag, email, password_hash, is_admin FROM players WHERE email = ?`;
    queryParams = [email];
  } else {
    findUserQuery = `SELECT id, display_name, player_tag, email, password_hash, is_admin FROM players WHERE display_name = ? AND player_tag = ?`;
    queryParams = [display_name, player_tag];
  }

  db.execute(findUserQuery, queryParams, async (findErr, findResults) => {
    if (findErr) {
      console.error('❌ Auto-register user lookup error:', findErr);
      return res.status(500).json({ status: 'error', message: 'Database error during credential check' });
    }

    if (findResults.length === 0) {
      return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
    }

    const player = findResults[0];

    try {
      const isPasswordValid = await bcrypt.compare(password, player.password_hash);
      if (!isPasswordValid) {
        return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
      }
    } catch (err) {
      console.error('❌ Error verifying password for auto-register:', err);
      return res.status(500).json({ status: 'error', message: 'Server error verifying credentials' });
    }

    // Require admin flag
    if (player.is_admin !== 1) {
      return res.status(403).json({ status: 'error', message: 'Admin privileges required' });
    }

    // Generate short-lived admin token and call existing register flow via authenticateAdmin
    const adminToken = generateAdminToken(player.id, 'server_registration');

    // Attach admin token to headers so authenticateAdmin picks it up
    req.headers = req.headers || {};
    req.headers['x-admin-token'] = adminToken;

    // Delegate to authenticateAdmin, which will call registerServer on success
    authenticateAdmin(req, res, () => {
      // registerServer expects server fields to be in req.body (ip_address, port, etc.)
      registerServer(req, res);
    });
  });
}

module.exports = {
  registerServer,
  autoRegisterServer,
  updateServer,
  updatePlayerCount,
  removeServer,
  linkSessionToServer
};