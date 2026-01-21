const db = require('../config/database');
const { generateSessionCode } = require('../utils/generators');

// Find available server
function findAvailableServer(callback) {
  const emptyServerQuery = `
    SELECT id, ip_address, port, max_players, current_player_count
    FROM game_servers 
    WHERE is_available = 1 AND current_player_count = 0
    LIMIT 1
  `;
  
  console.log('🔍 Searching for EMPTY servers...');
  
  db.execute(emptyServerQuery, (emptyErr, emptyResults) => {
    if (emptyErr) {
      console.error('❌ Empty server search error:', emptyErr);
      callback(emptyErr, null);
      return;
    }
    
    console.log('📊 Empty servers found:', emptyResults.length);
    if (emptyResults.length > 0) {
      console.log('✅ Found EMPTY server:', emptyResults[0]);
      callback(null, emptyResults[0]);
      return;
    }
    
    console.log('❌ No EMPTY servers found.');
    
    const debugQuery = `
      SELECT id, ip_address, current_player_count, max_players 
      FROM game_servers 
      WHERE is_available = 1
      ORDER BY current_player_count ASC
    `;
    
    db.execute(debugQuery, (debugErr, debugResults) => {
      if (debugErr) {
        console.error('❌ Debug query error:', debugErr);
        callback(new Error('No available servers'), null);
        return;
      }
      
      console.log('📊 All available servers:', debugResults);
      
      if (debugResults.length === 0) {
        console.log('❌ No servers available at all');
        callback(new Error('No available servers'), null);
        return;
      }
      
      const leastPopulatedServer = debugResults[0];
      console.log('⚠️ Using least populated server as fallback:', leastPopulatedServer);
      callback(null, leastPopulatedServer);
    });
  });
}

// Create game session
function createGameSession(serverId, playerId, callback) {
  const sessionCode = generateSessionCode();
  console.log('🎫 Generated session code:', sessionCode);
  
  const sessionQuery = `
    INSERT INTO game_sessions (server_id, session_code, host_player_id, current_players, status) 
    VALUES (?, ?, ?, 1, 'waiting')
  `;
  
  console.log('🔄 Creating game session...');
  
  db.execute(sessionQuery, [serverId, sessionCode, playerId], (sessionErr, sessionResults) => {
    if (sessionErr) {
      if (sessionErr.code === 'ER_DUP_ENTRY') {
        console.log('🔄 Duplicate session code, generating new one...');
        const newSessionCode = generateSessionCode();
        db.execute(sessionQuery, [serverId, newSessionCode, playerId], (retryErr, retryResults) => {
          if (retryErr) {
            console.error('❌ RETRY ALSO FAILED:', retryErr.message);
            callback(retryErr, null);
          } else {
            console.log('✅ Session created successfully on retry');
            callback(null, { sessionId: retryResults.insertId, sessionCode: newSessionCode });
          }
        });
      } else {
        console.error('❌ Session creation failed:', sessionErr);
        callback(sessionErr, null);
      }
    } else {
      console.log('✅ Session created successfully');
      callback(null, { sessionId: sessionResults.insertId, sessionCode });
    }
  });
}

// Update server player count
function updateServerPlayerCount(serverId, increment = 1, callback) {
  const operator = increment >= 0 ? '+' : '-';
  const updateServer = `
    UPDATE game_servers 
    SET current_player_count = GREATEST(0, current_player_count ${operator} ${Math.abs(increment)})
    WHERE id = ?
  `;
  
  console.log(`🔄 ${increment >= 0 ? 'Incrementing' : 'Decrementing'} server player count...`);
  
  db.execute(updateServer, [serverId], (serverUpdateErr) => {
    if (serverUpdateErr) {
      console.error('⚠️ Failed to update server count:', serverUpdateErr);
      callback(serverUpdateErr);
    } else {
      console.log('✅ Server player count updated');
      callback(null);
    }
  });
}

module.exports = {
  findAvailableServer,
  createGameSession,
  updateServerPlayerCount
};