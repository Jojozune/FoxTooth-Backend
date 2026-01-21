const db = require('../config/database');

// Send friend request
exports.sendFriendRequest = (req, res) => {
  const { friend_id } = req.body;
  const player_id = req.player.playerId;

  // Validation
  if (!friend_id || friend_id === player_id) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid friend_id'
    });
  }

  // Check if friend exists
  db.query(
    'SELECT id FROM players WHERE id = ?',
    [friend_id],
    (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ status: 'error', message: 'Database error' });
      }

      if (results.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Player not found'
        });
      }

      // Check if request already pending or friendship exists
      db.query(
        'SELECT id, status FROM friendships WHERE player_id = ? AND friend_id = ?',
        [player_id, friend_id],
        (err, existing) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ status: 'error', message: 'Database error' });
          }

          if (existing.length > 0) {
            if (existing[0].status === 'pending') {
              return res.status(409).json({
                status: 'error',
                message: 'Friend request already pending'
              });
            }
            if (existing[0].status === 'accepted') {
              return res.status(409).json({
                status: 'error',
                message: 'Already friends'
              });
            }
            if (existing[0].status === 'blocked') {
              return res.status(403).json({
                status: 'error',
                message: 'Cannot send request to blocked player'
              });
            }
          }

          // Check if they've blocked us
          db.query(
            'SELECT id FROM friendships WHERE player_id = ? AND friend_id = ? AND status = "blocked"',
            [friend_id, player_id],
            (err, blockedCheck) => {
              if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ status: 'error', message: 'Database error' });
              }

              if (blockedCheck.length > 0) {
                return res.status(403).json({
                  status: 'error',
                  message: 'This player has blocked you'
                });
              }

              // Create friend request (from player_id → friend_id)
              db.query(
                'INSERT INTO friendships (player_id, friend_id, status, requested_by) VALUES (?, ?, "pending", ?)',
                [player_id, friend_id, player_id],
                (err) => {
                  if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ status: 'error', message: 'Database error' });
                  }

                  res.status(201).json({
                    status: 'success',
                    message: 'Friend request sent'
                  });
                }
              );
            }
          );
        }
      );
    }
  );
};

// Get pending friend requests for a player
exports.getFriendRequests = (req, res) => {
  const player_id = req.player.playerId;

  db.query(
    `SELECT
      f.id as request_id,
      p.id as player_id,
      p.display_name,
      p.player_tag,
      p.is_online,
      f.created_at
    FROM friendships f
    JOIN players p ON f.player_id = p.id
    WHERE f.friend_id = ? AND f.status = 'pending'
    ORDER BY f.created_at DESC`,
    [player_id],
    (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ status: 'error', message: 'Database error' });
      }

      res.json({
        status: 'success',
        count: results.length,
        requests: results
      });
    }
  );
};

// Accept friend request
exports.acceptFriendRequest = (req, res) => {
  const { request_id } = req.body;
  const player_id = req.player.playerId;

  // Verify request exists and belongs to this player
  db.query(
    'SELECT player_id FROM friendships WHERE id = ? AND friend_id = ? AND status = "pending"',
    [request_id, player_id],
    (err, request) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ status: 'error', message: 'Database error' });
      }

      if (request.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Request not found'
        });
      }

      const sender_id = request[0].player_id;

      // Update existing friendship record
      db.query(
        'UPDATE friendships SET status = "accepted" WHERE id = ? AND friend_id = ?',
        [request_id, player_id],
        (err, result) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ status: 'error', message: 'Database error' });
          }

          // Create reverse friendship (friend_id → player_id)
          db.query(
            'INSERT INTO friendships (player_id, friend_id, status, requested_by) VALUES (?, ?, "accepted", ?) ON DUPLICATE KEY UPDATE status = "accepted"',
            [player_id, sender_id, sender_id],
            (err) => {
              if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ status: 'error', message: 'Database error' });
              }

              res.json({
                status: 'success',
                message: 'Friend request accepted'
              });
            }
          );
        }
      );
    }
  );
};

// Decline friend request
exports.declineFriendRequest = (req, res) => {
  const { request_id } = req.body;
  const player_id = req.player.playerId;

  db.query(
    'DELETE FROM friendships WHERE id = ? AND friend_id = ? AND status = "pending"',
    [request_id, player_id],
    (err, result) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ status: 'error', message: 'Database error' });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Request not found'
        });
      }

      res.json({
        status: 'success',
        message: 'Friend request declined'
      });
    }
  );
};

// Get friends list
exports.getFriendsList = (req, res) => {
  const player_id = req.player.playerId;

  db.query(
    `SELECT
      f.id as friendship_id,
      p.id as player_id,
      p.display_name,
      p.player_tag,
      p.is_online,
      f.created_at as friends_since
    FROM friendships f
    JOIN players p ON f.friend_id = p.id
    WHERE f.player_id = ? AND f.status = 'accepted'
    ORDER BY p.display_name ASC`,
    [player_id],
    (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ status: 'error', message: 'Database error' });
      }

      res.json({
        status: 'success',
        count: results.length,
        friends: results
      });
    }
  );
};

// Remove friend
exports.removeFriend = (req, res) => {
  const { friend_id } = req.body;
  const player_id = req.player.playerId;

  if (!friend_id || friend_id === player_id) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid friend_id'
    });
  }

  // Delete both directions
  db.query(
    'DELETE FROM friendships WHERE (player_id = ? AND friend_id = ?) OR (player_id = ? AND friend_id = ?) AND status = "accepted"',
    [player_id, friend_id, friend_id, player_id],
    (err, result) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ status: 'error', message: 'Database error' });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Friendship not found'
        });
      }

      res.json({
        status: 'success',
        message: 'Friend removed'
      });
    }
  );
};

// Block player
exports.blockPlayer = (req, res) => {
  const { player_to_block } = req.body;
  const player_id = req.player.playerId;

  if (player_to_block === player_id) {
    return res.status(400).json({
      status: 'error',
      message: 'Cannot block yourself'
    });
  }

  // Check if player exists
  db.query(
    'SELECT id FROM players WHERE id = ?',
    [player_to_block],
    (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ status: 'error', message: 'Database error' });
      }

      if (results.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Player not found'
        });
      }

      // Insert or update block record
      db.query(
        'INSERT INTO friendships (player_id, friend_id, status, requested_by) VALUES (?, ?, "blocked", ?) ON DUPLICATE KEY UPDATE status = "blocked"',
        [player_id, player_to_block, player_id],
        (err) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ status: 'error', message: 'Database error' });
          }

          // Remove if they were friends
          db.query(
            'DELETE FROM friendships WHERE player_id = ? AND friend_id = ? AND status = "accepted"',
            [player_id, player_to_block],
            () => {
              res.json({
                status: 'success',
                message: 'Player blocked'
              });
            }
          );
        }
      );
    }
  );
};

// Get blocked list
exports.getBlockedList = (req, res) => {
  const player_id = req.player.playerId;

  db.query(
    `SELECT
      f.id as block_id,
      p.id as player_id,
      p.display_name,
      p.player_tag,
      f.created_at as blocked_at
    FROM friendships f
    JOIN players p ON f.friend_id = p.id
    WHERE f.player_id = ? AND f.status = 'blocked'
    ORDER BY f.created_at DESC`,
    [player_id],
    (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ status: 'error', message: 'Database error' });
      }

      res.json({
        status: 'success',
        count: results.length,
        blocked: results
      });
    }
  );
};

// Unblock player
exports.unblockPlayer = (req, res) => {
  const { player_to_unblock } = req.body;
  const player_id = req.player.playerId;

  db.query(
    'DELETE FROM friendships WHERE player_id = ? AND friend_id = ? AND status = "blocked"',
    [player_id, player_to_unblock],
    (err, result) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ status: 'error', message: 'Database error' });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Block record not found'
        });
      }

      res.json({
        status: 'success',
        message: 'Player unblocked'
      });
    }
  );
};

// Check if player is a friend
exports.isFriend = (req, res) => {
  const { friend_id } = req.params;
  const player_id = req.player.playerId;

  db.query(
    'SELECT status FROM friendships WHERE player_id = ? AND friend_id = ?',
    [player_id, friend_id],
    (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ status: 'error', message: 'Database error' });
      }

      if (results.length === 0) {
        return res.json({
          status: 'success',
          is_friend: false,
          relationship: 'none'
        });
      }

      res.json({
        status: 'success',
        is_friend: results[0].status === 'accepted',
        relationship: results[0].status
      });
    }
  );
};
