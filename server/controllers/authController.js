const db = require('../config/database');
const tokenService = require('../services/tokenService');
const sessionService = require('../services/sessionService');
const { generatePlayerTag } = require('../utils/generators');
const bcrypt = require('bcryptjs');

// Create new account with auto-generated numeric tag
async function createAccount(req, res) {
  const { display_name, email, password } = req.body;
  
  console.log('=== ACCOUNT CREATION START ===');
  console.log('Request data:', { display_name, email });
  
  // Validation
  if (!display_name || !email || !password) {
    return res.status(400).json({
      status: 'error',
      message: 'Missing display_name, email, or password'
    });
  }
  
  if (password.length < 6) {
    return res.status(400).json({
      status: 'error',
      message: 'Password must be at least 6 characters long'
    });
  }
  
  try {
    // Check if email is unique first
    const emailCheckQuery = `SELECT id FROM players WHERE email = ?`;
    db.execute(emailCheckQuery, [email], async (emailErr, emailResults) => {
      if (emailErr) {
        console.error('❌ Email check error:', emailErr);
        return res.status(500).json({ status: 'error', message: 'Database error checking email' });
      }
      
      if (emailResults.length > 0) {
        console.error('❌ Email already exists');
        return res.status(409).json({ 
          status: 'error', 
          message: 'Email address already registered' 
        });
      }
      
      // Generate random numeric tag and ensure uniqueness
      async function generateUniqueTag() {
        let attempts = 0;
        const maxAttempts = 10;
        
        while (attempts < maxAttempts) {
          const tag = generatePlayerTag();
          
          // Check if display_name + tag combo exists
          const tagCheckQuery = `
            SELECT id FROM players 
            WHERE display_name = ? AND player_tag = ?
          `;
          
          try {
            const tagCheckResults = await new Promise((resolve, reject) => {
              db.execute(tagCheckQuery, [display_name, tag], (err, results) => {
                if (err) reject(err);
                else resolve(results);
              });
            });
            
            if (tagCheckResults.length === 0) {
              // Tag is unique
              return tag;
            }
          } catch (err) {
            console.error('❌ Tag uniqueness check error:', err);
            throw err;
          }
          
          attempts++;
        }
        
        throw new Error('Failed to generate unique player tag after multiple attempts');
      }
      
      try {
        const player_tag = await generateUniqueTag();
        console.log('✅ Generated unique player tag:', player_tag);
        
        // Hash password and create account
        const saltRounds = 12;
        const password_hash = await bcrypt.hash(password, saltRounds);
        
        const insertQuery = `
          INSERT INTO players (display_name, player_tag, email, password_hash, is_online, last_seen) 
          VALUES (?, ?, ?, ?, 0, NOW())
        `;
        
        db.execute(insertQuery, [display_name, player_tag, email, password_hash], (insertErr, insertResults) => {
          if (insertErr) {
            // Catch unique constraint violation if our checks missed something
            if (insertErr.code === 'ER_DUP_ENTRY') {
              console.error('❌ Duplicate name+tag combination');
              return res.status(409).json({ 
                status: 'error', 
                message: `The combination ${display_name}${player_tag} is already taken` 
              });
            }
            
            console.error('❌ Account creation error:', insertErr);
            return res.status(500).json({ status: 'error', message: 'Failed to create account: ' + insertErr.message });
          }
          
          console.log('✅ Account created successfully, ID:', insertResults.insertId);
          console.log('=== ACCOUNT CREATION SUCCESS ===');
          
          res.json({
            status: 'success',
            player_id: insertResults.insertId,
            player_tag: player_tag,
            message: 'Account created successfully. Please login.'
          });
        });
      } catch (error) {
        console.error('❌ Error generating unique tag:', error);
        return res.status(500).json({ 
          status: 'error', 
          message: 'Failed to generate player tag: ' + error.message 
        });
      }
    });
    
  } catch (error) {
    console.error('❌ Error in createAccount:', error);
    return res.status(500).json({ 
      status: 'error', 
      message: 'Server error during account creation' 
    });
  }
}

// Login with password - supports email OR display_name + player_tag
async function login(req, res) {
  const { email, display_name, player_tag, password, remember_me } = req.body;
  
  console.log('=== LOGIN START ===');
  console.log('Login attempt with:', { email, display_name, player_tag });
  
  // Validate: must have password and either email OR (display_name + player_tag)
  if (!password) {
    return res.status(400).json({
      status: 'error',
      message: 'Missing password'
    });
  }
  
  const hasEmailLogin = email;
  const hasTagLogin = display_name && player_tag;
  
  if (!hasEmailLogin && !hasTagLogin) {
    return res.status(400).json({
      status: 'error',
      message: 'Must provide either email OR (display_name + player_tag)'
    });
  }
  
  try {
    // Build query based on login type
    let findUserQuery;
    let queryParams;
    
    if (hasEmailLogin) {
      // Login by email
      console.log('🔍 Attempting login via email:', email);
      findUserQuery = `
        SELECT id, display_name, player_tag, email, password_hash, is_online 
        FROM players 
        WHERE email = ?
      `;
      queryParams = [email];
    } else {
      // Login by display_name + player_tag
      console.log('🔍 Attempting login via tag:', { display_name, player_tag });
      findUserQuery = `
        SELECT id, display_name, player_tag, email, password_hash, is_online 
        FROM players 
        WHERE display_name = ? AND player_tag = ?
      `;
      queryParams = [display_name, player_tag];
    }
    
    db.execute(findUserQuery, queryParams, async (findErr, findResults) => {
      if (findErr) {
        console.error('❌ Login database error:', findErr);
        return res.status(500).json({ status: 'error', message: 'Database error during login' });
      }
      
      if (findResults.length === 0) {
        console.error('❌ Login failed: Account not found');
        return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
      }
      
      const player = findResults[0];
      console.log('✅ Player found:', player.id, player.display_name + player.player_tag);
      
      // Verify password
      const isPasswordValid = await bcrypt.compare(password, player.password_hash);
      
      if (!isPasswordValid) {
        console.error('❌ Login failed: Invalid password');
        return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
      }
      
      console.log('✅ Login successful for:', player.id);
      
      // Now proceed with normal connection flow (find server, create session, etc.)
      // Pass remember_me flag so we optionally issue a remember token
      await handlePlayerSession(player.id, player.display_name, player.player_tag, res, !!remember_me);
    });
    
  } catch (error) {
    console.error('❌ Error in login:', error);
    return res.status(500).json({ 
      status: 'error', 
      message: 'Server error during login' 
    });
  }
}

// Updated player connect - only sets existing players online, doesn't create accounts
async function playerConnect(req, res) {
  const { display_name, player_tag, remember_me } = req.body;
  
  console.log('=== PLAYER CONNECT START ===');
  console.log('Request data:', { display_name, player_tag });
  
  if (!display_name || !player_tag) {
    return res.status(400).json({
      status: 'error',
      message: 'Missing display_name or player_tag'
    });
  }
  
  // Find existing player
  const findPlayerQuery = `SELECT id FROM players WHERE display_name = ? AND player_tag = ?`;
  
  console.log('🔍 Finding existing player...');
  
  db.execute(findPlayerQuery, [display_name, player_tag], (findErr, findResults) => {
    if (findErr) {
      console.error('❌ Player find error:', findErr);
      return res.status(500).json({ status: 'error', message: 'Database error finding player' });
    }
    
    console.log('📊 Player find results:', findResults);
    
    if (findResults.length === 0) {
      console.error('❌ Player not found - must create account first');
      return res.status(404).json({ 
        status: 'error', 
        message: 'Account not found. Please create an account first.' 
      });
    }
    
    const playerId = findResults[0].id;
    console.log('✅ Found existing player ID:', playerId);

    // Handle the session (set online, find server, etc.)
    handlePlayerSession(playerId, display_name, player_tag, res, !!remember_me);
  });
}

// Shared function to handle player session (used by both login and connect)
// Shared function to handle player session (used by both login and connect)
async function handlePlayerSession(playerId, displayName, playerTag, res, rememberMe = false) {
  // Update player as online and set connected_at timestamp (grace period for new players)
  const updatePlayer = `UPDATE players SET is_online = 1, last_seen = NOW(), connected_at = NOW() WHERE id = ?`;
  
  console.log('🔄 Updating player online status...');
  
  db.execute(updatePlayer, [playerId], async (updateErr) => {
    if (updateErr) {
      console.error('❌ Player update error:', updateErr);
      return res.status(500).json({ status: 'error', message: 'Failed to update player' });
    }
    
    console.log('✅ Player status updated to online');
    
    // FIRST: Check if player already has an active session
    const checkSessionQuery = `
      SELECT id, session_code, server_id 
      FROM game_sessions 
      WHERE host_player_id = ? AND status = 'waiting'
    `;
    
    console.log('🔍 Checking for existing session...');
    
  db.execute(checkSessionQuery, [playerId], async (sessionErr, sessionResults) => {
      if (sessionErr) {
        console.error('❌ Session check error:', sessionErr);
        return res.status(500).json({ status: 'error', message: 'Database error checking session' });
      }
      
      if (sessionResults.length > 0) {
        // Player already has a session - reuse it
        const existingSession = sessionResults[0];
        console.log('✅ Found existing session:', existingSession);
        
        // Get server info for the existing session
        const serverQuery = `SELECT ip_address, port FROM game_servers WHERE id = ?`;
        db.execute(serverQuery, [existingSession.server_id], async (serverErr, serverResults) => {
          if (serverErr || serverResults.length === 0) {
            console.error('❌ Server lookup error, creating new session...');
            return createNewSession();
          }
          
            const server = serverResults[0];
            await completePlayerConnection(existingSession.id, existingSession.session_code, server, playerId, displayName, playerTag, res, rememberMe);
        });
      } else {
        // No existing session - create a new one
        console.log('ℹ️ No existing session found, creating new session...');
        createNewSession();
      }
    });
    
    function createNewSession() {
      // Find available server and create session
      sessionService.findAvailableServer(async (serverErr, server) => {
        if (serverErr) {
          console.error('❌ No available servers:', serverErr.message);
          return res.status(503).json({ status: 'error', message: 'No game servers available' });
        }
        
        console.log('✅ Found available server:', server);
        
        sessionService.createGameSession(server.id, playerId, async (sessionErr, sessionData) => {
          if (sessionErr) {
            return res.status(500).json({ 
              status: 'error', 
              message: 'Failed to create game session: ' + sessionErr.message 
            });
          }

          await completePlayerConnection(sessionData.sessionId, sessionData.sessionCode, server, playerId, displayName, playerTag, res, rememberMe);
        });
      });
    }
  });
}

async function completePlayerConnection(sessionId, sessionCode, server, playerId, displayName, playerTag, res) {
  console.log('🎉 Session ID:', sessionId);
  
  try {
    const accessToken = tokenService.generateAccessToken({
      id: playerId,
      display_name: displayName,
      player_tag: playerTag
    });
    
    const refreshToken = await tokenService.generateRefreshToken(playerId);
    // If remember_me was requested, generate a remember token too
    let rememberToken = null;
    if (arguments.length >= 8 && arguments[7]) {
      try {
        rememberToken = await tokenService.generateRememberToken(playerId);
      } catch (err) {
        console.error('⚠️ Failed to generate remember token:', err);
      }
    }
    
    // Update server player count
    sessionService.updateServerPlayerCount(server.id, 1, (updateErr) => {
      if (updateErr) {
        console.error('⚠️ Failed to update server count:', updateErr);
      }
      
      console.log('=== PLAYER CONNECTION SUCCESS ===');
      const resp = {
        status: 'success',
        player_id: playerId,
        session_code: sessionCode,
        token: accessToken,
        refresh_token: refreshToken,
        token_expires_in: '2 hours',
        refresh_token_expires_in: '7 days',
        server: {
          ip: server.ip_address,
          port: server.port
        },
        message: 'Connected to game server'
      };

      if (rememberToken) resp.remember_token = rememberToken;

      res.json(resp);
    });
  } catch (error) {
    console.error('❌ Error in completePlayerConnection:', error);
    return res.status(500).json({ 
      status: 'error', 
      message: 'Failed to create session: ' + error.message 
    });
  }
}

// Refresh token
async function refreshToken(req, res) {
  const { refresh_token, player_id } = req.body;
  
  console.log('=== TOKEN REFRESH START ===');
  console.log('Refresh request for player:', player_id);
  
  if (!refresh_token || !player_id) {
    return res.status(400).json({ 
      status: 'error', 
      message: 'Missing refresh_token or player_id' 
    });
  }
  
  try {
    const playerData = await tokenService.verifyRefreshToken(refresh_token, player_id);
    
    if (!playerData) {
      return res.status(403).json({ 
        status: 'error', 
        message: 'Invalid or expired refresh token' 
      });
    }
    
    const newAccessToken = tokenService.generateAccessToken(playerData);
    
    console.log('✅ Token refreshed for player:', player_id);
    console.log('=== TOKEN REFRESH SUCCESS ===');
    
    res.json({
      status: 'success',
      token: newAccessToken,
      token_expires_in: '2 hours',
      message: 'Token refreshed successfully'
    });
    
  } catch (error) {
    console.error('❌ Token refresh error:', error);
    return res.status(500).json({ 
      status: 'error', 
      message: 'Failed to refresh token: ' + error.message 
    });
  }
}

// Remember-login: exchange a remember_token for a fresh access token (and optionally refresh token)
async function rememberLogin(req, res) {
  const { remember_token, player_id } = req.body;

  console.log('=== REMEMBER LOGIN START ===');

  if (!remember_token || !player_id) {
    return res.status(400).json({ status: 'error', message: 'Missing remember_token or player_id' });
  }

  try {
    const playerData = await tokenService.verifyRememberToken(remember_token, player_id);

    if (!playerData) {
      return res.status(403).json({ status: 'error', message: 'Invalid or expired remember token' });
    }

    // Issue new access token and refresh token
    const newAccessToken = tokenService.generateAccessToken(playerData);
    const newRefreshToken = await tokenService.generateRefreshToken(player_id);

    console.log('✅ Remember login successful for player:', player_id);

    res.json({
      status: 'success',
      token: newAccessToken,
      refresh_token: newRefreshToken,
      token_expires_in: '2 hours',
      refresh_token_expires_in: '7 days',
      message: 'Remember login successful'
    });
  } catch (error) {
    console.error('❌ Remember login error:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to perform remember login' });
  }
}

// Logout
// Enhanced logout function with per-device sign-out support
async function logout(req, res) {
  const player_id = req.player.playerId;
  const { remember_token } = req.body;
  
  console.log('=== PLAYER LOGOUT START ===');
  console.log('Logging out player:', player_id);
  
  try {
    // 1. Delete refresh tokens
    const deleteTokensQuery = `DELETE FROM refresh_tokens WHERE player_id = ?`;

    db.execute(deleteTokensQuery, [player_id], async (tokenErr, tokenResults) => {
      if (tokenErr) {
        console.error('❌ Logout error (refresh tokens):', tokenErr);
      } else {
        console.log('✅ Refresh tokens invalidated');
      }

      // 1b. Delete remember-me tokens (per-device or global sign-out)
      try {
        if (remember_token) {
          // Per-device sign-out: delete only the presented remember token
          console.log('🔍 Per-device sign-out: revoking specific remember token...');
          const isValid = await tokenService.verifyRememberToken(remember_token, player_id);
          if (isValid) {
            // Token is valid; find and delete the matching token row
            await deleteRememberTokenByToken(remember_token, player_id);
          } else {
            console.warn('⚠️ Remember token invalid or expired, skipping per-device revocation');
          }
        } else {
          // Global sign-out: delete all remember tokens for the player
          console.log('🔍 Global sign-out: revoking all remember tokens...');
          await tokenService.deleteRememberTokensForPlayer(player_id);
        }
      } catch (err) {
        console.error('❌ Error deleting remember tokens during logout:', err);
      }

      // 2. Handle player session and online status
      await handlePlayerLogout(player_id, res);
    });
    
  } catch (error) {
    console.error('❌ Logout error:', error);
    return res.status(500).json({ 
      status: 'error', 
      message: 'Failed to logout' 
    });
  }
}

// Helper: delete a specific remember token by finding the matching hashed token
async function deleteRememberTokenByToken(rememberToken, playerId) {
  return new Promise((resolve, reject) => {
    try {
      // First, fetch all non-expired remember tokens for the player to find the matching one
      const query = `
        SELECT id, token_hash
        FROM remember_tokens
        WHERE player_id = ? AND expires_at > NOW()
      `;

      db.execute(query, [playerId], async (err, results) => {
        if (err) {
          console.error('❌ Error fetching remember tokens for per-device logout:', err);
          return reject(err);
        }

        if (results.length === 0) {
          console.log('ℹ️ No valid remember tokens found for player:', playerId);
          return resolve();
        }

        // Compare the presented token against stored hashes to find the matching row
        const bcrypt = require('bcryptjs');
        for (const row of results) {
          /* eslint-disable no-await-in-loop */
          const isMatch = await bcrypt.compare(rememberToken, row.token_hash);
          if (isMatch) {
            // Found the matching token; delete only this row
            const deleteQuery = `DELETE FROM remember_tokens WHERE id = ?`;
            db.execute(deleteQuery, [row.id], (deleteErr, deleteResults) => {
              if (deleteErr) {
                console.error('❌ Error deleting remember token row:', deleteErr);
                return reject(deleteErr);
              }
              console.log('✅ Per-device remember token revoked, token id:', row.id);
              resolve(deleteResults);
            });
            return;
          }
        }

        // Token did not match any stored hash (shouldn't happen if verifyRememberToken passed, but defensive)
        console.warn('⚠️ Remember token did not match any stored row during per-device logout');
        resolve();
      });
    } catch (error) {
      console.error('❌ Error in deleteRememberTokenByToken:', error);
      reject(error);
    }
  });
}

// Handle player session cleanup during logout
async function handlePlayerLogout(player_id, res) {
  // First, find the player's current session
  const findSessionQuery = `
    SELECT gs.id as session_id, gs.server_id, gs.session_code, gs.current_players
    FROM game_sessions gs
    WHERE gs.host_player_id = ?
  `;
  
  console.log('🔍 Finding player session for cleanup...');
  
  db.execute(findSessionQuery, [player_id], (sessionErr, sessionResults) => {
    if (sessionErr) {
      console.error('❌ Session find error during logout:', sessionErr);
      return completeLogout(player_id, null, null, res);
    }
    
    if (sessionResults.length === 0) {
      console.log('ℹ️ No session found for player, marking offline only');
      return completeLogout(player_id, null, null, res);
    }
    
    const session = sessionResults[0];
    console.log('🗑️ Found session to clean up:', session);
    
    if (session.current_players > 1) {
      // Other players in session - transfer host and decrease count
      console.log('🔄 Transferring host in session...');
      transferHostOnLogout(session.session_id, session.server_id, player_id, res);
    } else {
      // Only player in session - delete it entirely
      console.log('🔄 Deleting empty session...');
      deleteSessionOnLogout(session.session_id, session.server_id, player_id, res);
    }
  });
}

function transferHostOnLogout(session_id, server_id, player_id, res) {
  const transferHostQuery = `
    UPDATE game_sessions 
    SET host_player_id = (
      SELECT p.id FROM players p
      JOIN game_sessions gs ON p.id = gs.host_player_id  
      WHERE gs.id = ? AND p.id != ?
      LIMIT 1
    ),
    current_players = current_players - 1
    WHERE id = ?
  `;
  
  db.execute(transferHostQuery, [session_id, player_id, session_id], (transferErr) => {
    if (transferErr) {
      console.error('❌ Host transfer error during logout:', transferErr);
      // If transfer fails, just decrement player count
      const fallbackQuery = `UPDATE game_sessions SET current_players = current_players - 1 WHERE id = ?`;
      db.execute(fallbackQuery, [session_id], (fallbackErr) => {
        if (fallbackErr) {
          console.error('❌ Fallback update error:', fallbackErr);
        }
        completeLogout(player_id, server_id, session_id, res);
      });
    } else {
      console.log('✅ Host transferred and player count decreased');
      completeLogout(player_id, server_id, session_id, res);
    }
  });
}

function deleteSessionOnLogout(session_id, server_id, player_id, res) {
  const deleteSessionQuery = `DELETE FROM game_sessions WHERE id = ?`;
  
  db.execute(deleteSessionQuery, [session_id], (deleteErr) => {
    if (deleteErr) {
      console.error('❌ Session delete error during logout:', deleteErr);
    } else {
      console.log('✅ Session deleted');
    }
    completeLogout(player_id, server_id, null, res);
  });
}

function completeLogout(player_id, server_id, session_id, res) {
  // Update server player count if we have a server
  if (server_id) {
    const updateServerQuery = `
      UPDATE game_servers 
      SET current_player_count = GREATEST(0, current_player_count - 1)
      WHERE id = ?
    `;
    
    db.execute(updateServerQuery, [server_id], (serverErr) => {
      if (serverErr) {
        console.error('⚠️ Server count update error during logout:', serverErr);
      } else {
        console.log('✅ Server player count decreased');
      }
      markPlayerOffline(player_id, res);
    });
  } else {
    markPlayerOffline(player_id, res);
  }
}

function markPlayerOffline(player_id, res) {
  // Mark player as offline and clear connected_at
  const updatePlayerQuery = `UPDATE players SET is_online = 0, connected_at = NULL WHERE id = ?`;
  
  db.execute(updatePlayerQuery, [player_id], (playerErr) => {
    if (playerErr) {
      console.error('❌ Player offline update error:', playerErr);
      return res.status(500).json({ status: 'error', message: 'Failed to mark player offline' });
    }
    
    console.log('✅ Player marked offline');
    console.log('=== PLAYER LOGOUT COMPLETE ===');
    
    res.json({
      status: 'success',
      message: 'Logged out successfully - session cleaned up'
    });
  });
}
// Validate token
function validateToken(req, res) {
  res.json({
    status: 'valid',
    player: req.player,
    message: 'Token is valid'
  });
}

module.exports = {
  createAccount,
  login,
  playerConnect,
  refreshToken,
  logout,
  rememberLogin,
  validateToken
};