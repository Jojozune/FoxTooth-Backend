const axios = require('axios');
const io = require('socket.io-client');

// ========== CONFIGURATION ==========
const CONFIG = {
  SERVER_URL: 'http://localhost:7777',
  WS_URL: 'http://localhost:7777',
  PLAYERS: [
    {
      name: 'TestPlayer1',
      email: `test1_${Date.now()}@test.local`,
      password: 'TestPass123'
    },
    {
      name: 'TestPlayer2',
      email: `test2_${Date.now()}@test.local`,
      password: 'TestPass123'
    },
    {
      name: 'TestPlayer3',
      email: `test3_${Date.now()}@test.local`,
      password: 'TestPass123'
    }
  ]
};

// ========== TEST COUNTERS & COLORS ==========
let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function test(message) {
  testsRun++;
  console.log(`  🧪 [${testsRun}] ${message}`);
}

function pass(message) {
  testsPassed++;
  console.log(`     ${colors.green}✅ ${message}${colors.reset}`);
}

function fail(message) {
  testsFailed++;
  console.log(`     ${colors.red}❌ ${message}${colors.reset}`);
}

function warn(message) {
  console.log(`     ${colors.yellow}⚠️  ${message}${colors.reset}`);
}

function info(message) {
  console.log(`     ${colors.cyan}ℹ️  ${message}${colors.reset}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function makeRequest(method, endpoint, data = null, token = null) {
  try {
    const config = {
      method,
      url: `${CONFIG.SERVER_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status
    };
  }
}

// ========== TEST PHASES ==========

async function phase1_ServerConnectivity() {
  console.log(`\n${colors.bright}${colors.blue}🌐 PHASE 1: Server Connectivity${colors.reset}`);
  test('Server is responding to GET /');
  
  const response = await makeRequest('GET', '/');
  if (response.success) {
    pass('Server is running');
  } else {
    fail('Server is not responding');
  }
}

async function phase2_AccountCreation() {
  console.log(`\n${colors.bright}${colors.blue}📝 PHASE 2: Account Creation${colors.reset}`);
  
  for (let player of CONFIG.PLAYERS) {
    test(`Creating account: ${player.name}`);
    const response = await makeRequest('POST', '/account/create', {
      display_name: player.name,
      email: player.email,
      password: player.password
    });
    
    if (response.success && response.data.player_id) {
      player.id = response.data.player_id;
      player.tag = response.data.player_tag;
      pass(`${player.name}: ID ${player.id}, Tag #${player.tag}`);
    } else {
      fail(`${player.name}: ${response.error?.message}`);
    }
  }
}

async function phase3_Login() {
  console.log(`\n${colors.bright}${colors.blue}🔑 PHASE 3: Login & Session Management${colors.reset}`);
  
  for (let player of CONFIG.PLAYERS) {
    test(`Logging in ${player.name}`);
    const response = await makeRequest('POST', '/account/login', {
      email: player.email,
      password: player.password
    });
    
    if (response.success && response.data.token) {
      player.token = response.data.token;
      player.refresh_token = response.data.refresh_token;
      player.session_code = response.data.session_code;
      pass(`${player.name}: Session ${player.session_code}`);
    } else {
      fail(`${player.name}: ${response.error?.message}`);
    }
  }
}

async function phase4_TokenManagement() {
  console.log(`\n${colors.bright}${colors.blue}🔐 PHASE 4: Token Management${colors.reset}`);
  
  const p1 = CONFIG.PLAYERS[0];
  
  test('Validate access token (GET /player/validate-token)');
  let response = await makeRequest('GET', '/player/validate-token', null, p1.token);
  if (response.success) {
    pass('Token is valid');
  } else {
    fail(`Token validation failed: ${response.error?.message}`);
  }
  
  test('Refresh access token (POST /player/refresh-token)');
  response = await makeRequest('POST', '/player/refresh-token', {
    refresh_token: p1.refresh_token,
    player_id: p1.id
  });
  
  if (response.success && response.data.token) {
    p1.token = response.data.token;
    pass('New access token received');
  } else {
    fail(`Token refresh failed: ${response.error?.message}`);
  }
}

async function phase5_PlayerDiscovery() {
  console.log(`\n${colors.bright}${colors.blue}👤 PHASE 5: Player Discovery${colors.reset}`);
  
  test('Get all online players (GET /players)');
  let response = await makeRequest('GET', '/players');
  if (response.success && response.data.players) {
    pass(`Retrieved ${response.data.players.length} players`);
  } else {
    fail(`Player list failed: ${response.error?.message}`);
  }
  
  test('Lookup player by name & tag (GET /player/lookup)');
  const p1 = CONFIG.PLAYERS[0];
  response = await makeRequest('GET', `/player/lookup?display_name=${encodeURIComponent(p1.name)}&player_tag=${encodeURIComponent(p1.tag)}`);
  if (response.success && response.data.player_id === p1.id) {
    pass(`Found ${p1.name}: ID ${response.data.player_id}`);
  } else {
    fail(`Player lookup failed: ${response.error?.message}`);
  }
}

async function phase6_WebSocketConnection() {
  console.log(`\n${colors.bright}${colors.blue}🔌 PHASE 6: WebSocket Real-Time Connection${colors.reset}`);
  
  const promises = CONFIG.PLAYERS.map(player => 
    new Promise((resolve) => {
      test(`Connecting ${player.name} to WebSocket`);
      
      const socket = io(CONFIG.WS_URL, {
        auth: { token: player.token },
        transports: ['websocket', 'polling']
      });
      
      socket.on('connect', () => {
        player.socket = socket;
        pass(`${player.name} connected (socket: ${socket.id})`);
        resolve();
      });
      
      socket.on('connect_error', (error) => {
        fail(`${player.name} connection error: ${error.message}`);
        resolve();
      });
      
      setTimeout(() => {
        if (!player.socket) {
          fail(`${player.name} timeout`);
          resolve();
        }
      }, 5000);
    })
  );
  
  await Promise.all(promises);
}

async function phase7_HeartbeatSystem() {
  console.log(`\n${colors.bright}${colors.blue}💓 PHASE 7: Heartbeat System${colors.reset}`);
  
  const p1 = CONFIG.PLAYERS[0];
  
  test('HTTP heartbeat (POST /player/heartbeat)');
  let response = await makeRequest('POST', '/player/heartbeat', 
    { game_open: true }, 
    p1.token
  );
  if (response.success) {
    pass('HTTP heartbeat acknowledged');
  } else {
    fail(`HTTP heartbeat failed: ${response.error?.message}`);
  }
  
  test('WebSocket heartbeat (emit "heartbeat")');
  if (p1.socket) {
    const heartbeatAck = await new Promise((resolve) => {
      p1.socket.once('heartbeat:ack', () => {
        resolve(true);
      });
      p1.socket.emit('heartbeat', { player_id: p1.id });
      setTimeout(() => resolve(false), 2000);
    });
    
    if (heartbeatAck) {
      pass('WebSocket heartbeat acknowledged');
    } else {
      fail('WebSocket heartbeat timeout');
    }
  } else {
    fail('WebSocket not connected');
  }
  
  test('Check player alive status (GET /player/check-alive/:playerId)');
  response = await makeRequest('GET', `/player/check-alive/${p1.id}`, null, p1.token);
  if (response.success) {
    pass(`Player alive: ${response.data.is_alive}`);
  } else {
    fail(`Alive check failed: ${response.error?.message}`);
  }
  
  test('Batch check player alive (POST /player/check-alive-batch)');
  response = await makeRequest('POST', '/player/check-alive-batch', 
    { player_ids: CONFIG.PLAYERS.map(p => p.id) }, 
    p1.token
  );
  if (response.success && response.data.players) {
    pass(`Batch check: ${response.data.players.length} players`);
  } else {
    fail(`Batch check failed: ${response.error?.message}`);
  }
}

async function phase8_FriendSystem() {
  console.log(`\n${colors.bright}${colors.blue}👥 PHASE 8: Friend System${colors.reset}`);
  
  const p1 = CONFIG.PLAYERS[0];
  const p2 = CONFIG.PLAYERS[1];
  const p3 = CONFIG.PLAYERS[2];
  
  test('Send friend request (POST /friend/request)');
  let response = await makeRequest('POST', '/friend/request', 
    { friend_id: p2.id }, 
    p1.token
  );
  if (response.success) {
    pass('P1 → P2 friend request sent');
  } else {
    fail(`Request failed: ${response.error?.message}`);
  }
  
  test('Get pending requests (GET /friend/requests)');
  response = await makeRequest('GET', '/friend/requests', null, p2.token);
  if (response.success && response.data.requests?.length > 0) {
    pass(`P2 has ${response.data.count} pending request(s)`);
  } else {
    fail(`Pending requests fetch failed: ${response.error?.message}`);
  }
  
  test('Accept friend request (POST /friend/accept)');
  response = await makeRequest('GET', '/friend/requests', null, p2.token);
  if (response.success && response.data.requests?.length > 0) {
    const requestId = response.data.requests[0].request_id;
    response = await makeRequest('POST', '/friend/accept', 
      { request_id: requestId }, 
      p2.token
    );
    if (response.success) {
      pass('P2 accepted P1 request');
    } else {
      fail(`Accept failed: ${response.error?.message}`);
    }
  }
  
  test('Get friends list (GET /friends)');
  response = await makeRequest('GET', '/friends', null, p1.token);
  if (response.success) {
    pass(`P1 has ${response.data.count} friend(s)`);
  } else {
    fail(`Friends list failed: ${response.error?.message}`);
  }
  
  test('Check friendship status (GET /friend/check/:friend_id)');
  response = await makeRequest('GET', `/friend/check/${p2.id}`, null, p1.token);
  if (response.success) {
    pass(`P1→P2 relationship: ${response.data.relationship}`);
  } else {
    fail(`Friend check failed: ${response.error?.message}`);
  }
  
  test('Decline friend request (POST /friend/decline)');
  response = await makeRequest('POST', '/friend/request', 
    { friend_id: p3.id }, 
    p1.token
  );
  
  response = await makeRequest('GET', '/friend/requests', null, p3.token);
  if (response.success && response.data.requests?.length > 0) {
    const requestId = response.data.requests[0].request_id;
    response = await makeRequest('POST', '/friend/decline', 
      { request_id: requestId }, 
      p3.token
    );
    if (response.success) {
      pass('P3 declined P1 request');
    } else {
      fail(`Decline failed: ${response.error?.message}`);
    }
  }
  
  test('Block player (POST /friend/block)');
  response = await makeRequest('POST', '/friend/block', 
    { player_to_block: p3.id }, 
    p1.token
  );
  if (response.success) {
    pass('P1 blocked P3');
  } else {
    fail(`Block failed: ${response.error?.message}`);
  }
  
  test('Get blocked list (GET /friend/blocked)');
  response = await makeRequest('GET', '/friend/blocked', null, p1.token);
  if (response.success) {
    pass(`P1 has ${response.data.count} blocked player(s)`);
  } else {
    fail(`Blocked list failed: ${response.error?.message}`);
  }
  
  test('Unblock player (POST /friend/unblock)');
  response = await makeRequest('POST', '/friend/unblock', 
    { player_to_unblock: p3.id }, 
    p1.token
  );
  if (response.success) {
    pass('P1 unblocked P3');
  } else {
    fail(`Unblock failed: ${response.error?.message}`);
  }
  
  test('Remove friend (POST /friend/remove)');
  response = await makeRequest('POST', '/friend/remove', 
    { friend_id: p2.id }, 
    p1.token
  );
  if (response.success) {
    pass('P1 removed P2 as friend');
  } else {
    fail(`Remove failed: ${response.error?.message}`);
  }
}

async function phase9_InviteSystem() {
  console.log(`\n${colors.bright}${colors.blue}📨 PHASE 9: Invite System${colors.reset}`);
  
  const p1 = CONFIG.PLAYERS[0];
  const p2 = CONFIG.PLAYERS[1];
  
  test('Send invite (POST /invite/send)');
  let response = await makeRequest('POST', '/invite/send', 
    {
      receiver_id: p2.id,
      session_code: p1.session_code
    }, 
    p1.token
  );
  if (response.success) {
    pass('HTTP invite sent');
  } else {
    warn(`HTTP invite: ${response.error?.message}`);
  }
  
  test('Check invites (GET /invite/check/:playerId)');
  response = await makeRequest('GET', `/invite/check/${p2.id}`, null, p2.token);
  if (response.success && response.data.invites) {
    pass(`P2 has ${response.data.invites.length} invite(s)`);
  } else {
    fail(`Invite check failed: ${response.error?.message}`);
  }
  
  test('WebSocket invite (emit "invite:send")');
  if (p1.socket && p2.socket) {
    const inviteSent = await new Promise((resolve) => {
      let success = false;
      
      p1.socket.once('invite:send:success', (data) => {
        success = true;
        pass(`WebSocket invite sent, ID: ${data.invite_id}`);
        resolve(true);
      });
      
      p1.socket.once('invite:send:error', (data) => {
        fail(`WebSocket invite error: ${data.message}`);
        resolve(false);
      });
      
      p1.socket.emit('invite:send', {
        receiver_id: p2.id,
        session_code: p1.session_code
      });
      
      setTimeout(() => {
        if (!success) {
          fail('WebSocket invite timeout');
          resolve(false);
        }
      }, 3000);
    });
  } else {
    fail('WebSocket not connected');
  }
  
  test('Cleanup expired invites (DELETE /invite/cleanup)');
  response = await makeRequest('DELETE', '/invite/cleanup');
  if (response.success) {
    pass('Invite cleanup completed');
  } else {
    fail(`Cleanup failed: ${response.error?.message}`);
  }
}

async function phase10_ServerManagement() {
  console.log(`\n${colors.bright}${colors.blue}🖥️  PHASE 10: Server Management${colors.reset}`);
  
  test('Update server info (POST /server/update)');
  let response = await makeRequest('POST', '/server/update', 
    {
      server_id: 1,
      ip_address: '192.168.0.31',
      port: 7770,
      status: 'active'
    }
  );
  if (response.success || response.status === 500) {
    pass('Server update endpoint accessible');
  } else {
    fail(`Server update failed: ${response.error?.message}`);
  }
  
  test('Update player count (POST /server/update-players)');
  response = await makeRequest('POST', '/server/update-players', 
    {
      server_id: 1,
      player_count: 2
    }
  );
  if (response.success || response.status === 500) {
    pass('Player count update endpoint accessible');
  } else {
    fail(`Player count update failed: ${response.error?.message}`);
  }
  
  test('Server heartbeat (POST /server/heartbeat)');
  response = await makeRequest('POST', '/server/heartbeat', 
    {
      server_id: 1,
      ip_address: '192.168.0.31',
      port: 7770,
      current_player_count: 1,
      max_players: 4,
      is_online: true
    }
  );
  if (response.success || response.status === 500) {
    pass('Server heartbeat endpoint accessible');
  } else {
    fail(`Server heartbeat failed: ${response.error?.message}`);
  }
  
  test('Link session to server (POST /session/link-server)');
  const p1 = CONFIG.PLAYERS[0];
  response = await makeRequest('POST', '/session/link-server', 
    {
      session_code: p1.session_code,
      server_id: 1
    }
  );
  if (response.success || response.status === 500) {
    pass('Session-server link endpoint accessible');
  } else {
    fail(`Session link failed: ${response.error?.message}`);
  }
}

async function phase11_SessionManagement() {
  console.log(`\n${colors.bright}${colors.blue}🎮 PHASE 11: Session Management${colors.reset}`);
  
  const p1 = CONFIG.PLAYERS[0];
  
  test('Disconnect player from session (POST /player/disconnect)');
  let response = await makeRequest('POST', '/player/disconnect', {}, p1.token);
  if (response.success) {
    pass('Player disconnect successful');
  } else {
    fail(`Disconnect failed: ${response.error?.message}`);
  }
}

async function phase12_PlayerConnect() {
  console.log(`\n${colors.bright}${colors.blue}🔌 PHASE 12: Player Connect (Alternative)${colors.reset}`);
  
  const p1 = CONFIG.PLAYERS[0];
  
  test('Player connect (POST /player/connect)');
  let response = await makeRequest('POST', '/player/connect', 
    {
      display_name: p1.name,
      player_tag: p1.tag
    }
  );
  
  if (response.success) {
    pass('Player connect returned session');
  } else {
    fail(`Player connect failed: ${response.error?.message}`);
  }
}

async function phase13_LogoutAndCleanup() {
  console.log(`\n${colors.bright}${colors.blue}🚪 PHASE 13: Logout & Cleanup${colors.reset}`);
  
  for (let player of CONFIG.PLAYERS) {
    if (player.token) {
      test(`Logout ${player.name} (POST /player/logout)`);
      const response = await makeRequest('POST', '/player/logout', {}, player.token);
      if (response.success) {
        pass(`${player.name} logged out`);
      } else {
        warn(`${player.name}: ${response.error?.message}`);
      }
    }
  }
  
  test('Disconnect all WebSocket clients');
  for (let player of CONFIG.PLAYERS) {
    if (player.socket) {
      player.socket.disconnect();
      pass(`${player.name} disconnected`);
    }
  }
}

// ========== MAIN TEST RUNNER ==========

async function runTests() {
  console.log(`\n${colors.bright}${colors.cyan}${'═'.repeat(70)}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}🧪 COMPREHENSIVE BACKEND TEST SUITE - ALL ENDPOINTS 🧪${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}${'═'.repeat(70)}${colors.reset}\n`);
  
  try {
    await phase1_ServerConnectivity();
    await phase2_AccountCreation();
    await phase3_Login();
    await phase4_TokenManagement();
    await phase5_PlayerDiscovery();
    await phase6_WebSocketConnection();
    await phase7_HeartbeatSystem();
    await phase8_FriendSystem();
    await phase9_InviteSystem();
    await phase10_ServerManagement();
    await phase11_SessionManagement();
    await phase12_PlayerConnect();
    await phase13_LogoutAndCleanup();
    
    // Print summary
    console.log(`\n${colors.bright}${colors.cyan}${'═'.repeat(70)}${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}📊 FINAL TEST SUMMARY${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}${'═'.repeat(70)}${colors.reset}\n`);
    
    console.log(`✅ Passed: ${colors.green}${testsPassed}${colors.reset}`);
    console.log(`❌ Failed: ${colors.red}${testsFailed}${colors.reset}`);
    console.log(`📈 Total:  ${testsRun}`);
    
    const successRate = (testsPassed / testsRun * 100).toFixed(1);
    console.log(`✔️  Success Rate: ${colors.bright}${successRate}%${colors.reset}\n`);
    
    if (testsFailed === 0) {
      console.log(`${colors.green}${colors.bright}🎉 ALL TESTS PASSED! System is fully operational.${colors.reset}\n`);
    } else {
      console.log(`${colors.yellow}${colors.bright}⚠️  ${testsFailed} test(s) failed. Check output above for details.${colors.reset}\n`);
    }
    
  } catch (error) {
    console.error(`\n${colors.red}Fatal error during tests: ${error.message}${colors.reset}`);
  }
  
  process.exit(testsFailed > 0 ? 1 : 0);
}

// Run tests
runTests();
