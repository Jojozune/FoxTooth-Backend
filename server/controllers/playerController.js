const db = require('../config/database');

// Get all online players
function getPlayers(req, res) {
  const { exclude_player_id } = req.query;
  
  let query = `SELECT id, display_name, player_tag FROM players WHERE is_online = 1`;
  let params = [];
  
  if (exclude_player_id) {
    query += ` AND id != ?`;
    params.push(exclude_player_id);
  }
  
  db.execute(query, params, (err, results) => {
    if (err) {
      return res.status(500).json({ status: 'error', message: 'Database error' });
    }
    
    res.json({ players: results });
  });
}

// Lookup player by name and tag
function lookupPlayer(req, res) {
  const { display_name, player_tag } = req.query;
  
  if (!display_name || !player_tag) {
    return res.status(400).json({ status: 'error', message: 'Missing display_name or player_tag' });
  }
  
  const query = `SELECT id, display_name, player_tag, is_online FROM players WHERE display_name = ? AND player_tag = ?`;
  
  db.execute(query, [display_name, player_tag], (err, results) => {
    if (err) {
      return res.status(500).json({ status: 'error', message: 'Database error' });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Player not found' });
    }
    
    res.json({
      player_id: results[0].id,
      display_name: results[0].display_name,
      player_tag: results[0].player_tag,
      is_online: results[0].is_online === 1
    });
  });
}

module.exports = {
  getPlayers,
  lookupPlayer
};