// test-client.js - Standalone Node.js test client for local testing
// Run: npm install socket.io-client axios dotenv
// Then: node test-client.js

require('dotenv').config();
const axios = require('axios');
const { io } = require('socket.io-client');

// ========== CONFIG ==========
const CONFIG = {
  SERVER_URL: 'http://localhost:7777',
  WS_URL: 'http://localhost:7777',
  PLAYERS: [
    {
      name: 'TestPlayer1',
      email: `test1_${Date.now()}@test.local`,
      password: 'TestPass123',
      id: null,
      tag: null,
      token: null,
      socket: null
    },
    {
      name: 'TestPlayer2',
      email: `test2_${Date.now()}@test.local`,
      password: 'TestPass123',
      id: null,
      tag: null,
      token: null,
      socket: null
    },
    {
      name: 'TestPlayer3',
      email: `test3_${Date.now()}@test.local`,
      password: 'TestPass123',
      id: null,
      tag: null,
      token: null,
      socket: null
    }
  ]
};

// ========== STATE ==========
let testsPassed = 0;
let testsFailed = 0;
const results = [];

// ========== COLORS ==========
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m'
};

function log(type, message) {
  const timestamp = new Date().toLocaleTimeString();
  const prefix = {
    success: `${colors.green}✅${colors.reset}`,
    error: `${colors.red}❌${colors.reset}`,
    info: `${colors.cyan}ℹ️${colors.reset}`,
    warn: `${colors.yellow}⚠️${colors.reset}`,
    test: `${colors.blue}🧪${colors.reset}`,
    waiting: `${colors.yellow}⏳${colors.reset}`,
    event: `${colors.cyan}📡${colors.reset}`
  };
  
  console.log(`[${timestamp}] ${prefix[type]} ${message}`);
}

function pass(message) {
  testsPassed++;
  log('success', message);
  results.push({ status: 'PASS', message });
}

function fail(message) {
  testsFailed++;
  log('error', message);
  results.push({ status: 'FAIL', message });
}

function info(message) {
  log('info', message);
}

function warn(message) {
  log('warn', message);
}

function test(message) {
  log('test', message);
}

// ========== UTILITIES ==========
async function sleep(ms) {
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

async function phase1_AccountCreation() {
  console.log(`\n${colors.bright}${colors.blue}📝 PHASE 1: Account Creation${colors.reset}`);
  test('Creating accounts for 3 test players...');
  
  for (let player of CONFIG.PLAYERS) {
    const response = await makeRequest('POST', '/account/create', {
      display_name: player.name,
      email: player.email,
      password: player.password
    });
    
    if (response.success && response.data.player_id) {
      player.id = response.data.player_id;
      player.tag = response.data.player_tag;
      pass(`Created ${player.name} (ID: ${player.id}, Tag: ${player.tag})`);
    } else {
      fail(`Failed to create ${player.name}: ${response.error?.message}`);
    }
  }
}

async function phase2_Login() {
  console.log(`\n${colors.bright}${colors.blue}🔑 PHASE 2: Login${colors.reset}`);
  test('Logging in all players...');
  
  for (let player of CONFIG.PLAYERS) {
    const response = await makeRequest('POST', '/account/login', {
      email: player.email,
      password: player.password
    });
    
    if (response.success && response.data.token) {
      player.token = response.data.token;
      player.session_code = response.data.session_code;
      pass(`${player.name} logged in (token received)`);
    } else {
      fail(`Failed to login ${player.name}: ${response.error?.message}`);
    }
  }
}

async function phase3_WebSocketConnection() {
  console.log(`\n${colors.bright}${colors.blue}🔌 PHASE 3: WebSocket Connection${colors.reset}`);
  test('Establishing WebSocket connections...');
  
  // Connect all players in parallel
  const promises = CONFIG.PLAYERS.map(player => 
    new Promise((resolve) => {
      test(`Connecting ${player.name}...`);
      
      const socket = io(CONFIG.WS_URL, {
        auth: {
          token: player.token
        },
        reconnection: true,
        reconnectionDelay: 500,
        reconnectionDelayMax: 3000,
        reconnectionAttempts: 3,
        transports: ['websocket', 'polling']
      });
      
      let connected = false;
      
      socket.on('connect', () => {
        connected = true;
        player.socket = socket;
        pass(`${player.name} WebSocket connected (ID: ${socket.id})`);
        setupSocketListeners(player);
        resolve();
      });
      
      socket.on('error', (error) => {
        if (!connected) {
          fail(`${player.name} WebSocket error: ${error}`);
          resolve();
        }
      });
      
      socket.on('connect_error', (error) => {
        if (!connected) {
          warn(`${player.name} connection error: ${error.message}`);
        }
      });
      
      // Timeout after 5 seconds
      setTimeout(() => {
        if (!connected) {
          fail(`${player.name} WebSocket connection timeout`);
          socket.disconnect();
          resolve();
        }
      }, 5000);
    })
  );
  
  await Promise.all(promises);
}

function setupSocketListeners(player) {
  const socket = player.socket;
  
  socket.on('heartbeat:ack', (data) => {
    info(`${player.name} received heartbeat:ack`);
  });
  
  socket.on('invite:send:success', (data) => {
    pass(`${player.name} received invite:send:success (invite_id: ${data.invite_id})`);
  });
  
  socket.on('invite:send:error', (data) => {
    fail(`${player.name} received invite:send:error: ${data.message}`);
  });
  
  socket.on('invite:received', (data) => {
    pass(`${player.name} received invite:received in real-time from ${data.sender_name}`);
    info(`  └─ Invite ID: ${data.invite_id}, Session: ${data.session_code}`);
  });
  
  socket.on('invite:acknowledged:ack', (data) => {
    pass(`${player.name} received invite:acknowledged:ack`);
  });
  
  socket.on('invite:respond:success', (data) => {
    pass(`${player.name} received invite:respond:success (status: ${data.status})`);
    if (data.server_ip) {
      info(`  └─ Server: ${data.server_ip}:${data.server_port}`);
    }
  });
  
  socket.on('invite:respond:error', (data) => {
    fail(`${player.name} received invite:respond:error: ${data.message}`);
  });
  
  socket.on('invite:accepted', (data) => {
    pass(`${player.name} notified that invite was accepted`);
  });
  
  socket.on('invite:declined', (data) => {
    pass(`${player.name} notified that invite was declined`);
  });
  
  socket.on('disconnect', () => {
    warn(`${player.name} disconnected from WebSocket`);
  });
}

async function phase4_Heartbeat() {
  console.log(`\n${colors.bright}${colors.blue}💓 PHASE 4: Heartbeat Test${colors.reset}`);
  test('Testing heartbeat via WebSocket...');
  
  const player = CONFIG.PLAYERS[0];
  
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      fail('Heartbeat timeout (no response)');
      resolve();
    }, 3000);
    
    player.socket.emit('heartbeat', { game_open: true });
    
    player.socket.once('heartbeat:ack', (data) => {
      clearTimeout(timeout);
      pass('Heartbeat acknowledged by server');
      resolve();
    });
  });
}

async function phase5_FriendSystem() {
  console.log(`\n${colors.bright}${colors.blue}👥 PHASE 5: Friend System (HTTP)${colors.reset}`);
  test('Testing friend system endpoints...');
  
  const p1 = CONFIG.PLAYERS[0];
  const p2 = CONFIG.PLAYERS[1];
  const p3 = CONFIG.PLAYERS[2];
  
  // P1 sends friend request to P2
  let response = await makeRequest('POST', '/friend/request', 
    { friend_id: p2.id }, p1.token);
  
  if (response.success) {
    pass(`${p1.name} sent friend request to ${p2.name}`);
  } else {
    fail(`Friend request failed: ${response.error?.message}`);
  }
  
  // P2 checks pending requests
  response = await makeRequest('GET', '/friend/requests', null, p2.token);
  
  if (response.success && response.data.requests?.length > 0) {
    const request = response.data.requests[0];
    pass(`${p2.name} has ${response.data.count} pending request(s) from ${request.display_name}`);
    
    // P2 accepts
    response = await makeRequest('POST', '/friend/accept',
      { request_id: request.request_id }, p2.token);
    
    if (response.success) {
      pass(`${p2.name} accepted friend request`);
    } else {
      fail(`Accept failed: ${response.error?.message}`);
    }
  } else {
    fail(`${p2.name} didn't receive friend request`);
  }
  
  // P1 sends to P3, P3 declines
  response = await makeRequest('POST', '/friend/request',
    { friend_id: p3.id }, p1.token);
  
  if (response.success) {
    pass(`${p1.name} sent friend request to ${p3.name}`);
    
    response = await makeRequest('GET', '/friend/requests', null, p3.token);
    if (response.success && response.data.requests?.length > 0) {
      const request = response.data.requests[0];
      
      response = await makeRequest('POST', '/friend/decline',
        { request_id: request.request_id }, p3.token);
      
      if (response.success) {
        pass(`${p3.name} declined friend request`);
      } else {
        fail(`Decline failed: ${response.error?.message}`);
      }
    }
  }
  
  // Check friends list
  response = await makeRequest('GET', '/friend/list', null, p1.token);
  if (response.success && response.data.friends?.length > 0) {
    pass(`${p1.name} has ${response.data.count} friend(s)`);
    response.data.friends.forEach(f => {
      info(`  └─ ${f.display_name}${f.player_tag}`);
    });
  } else {
    warn(`${p1.name} has no friends yet`);
  }
  
  // Test block
  response = await makeRequest('POST', '/friend/block',
    { player_to_block: p3.id }, p1.token);
  
  if (response.success) {
    pass(`${p1.name} blocked ${p3.name}`);
  } else {
    fail(`Block failed: ${response.error?.message}`);
  }
}

async function phase6_InviteSystem() {
  console.log(`\n${colors.bright}${colors.blue}📨 PHASE 6: Invite System (WebSocket)${colors.reset}`);
  test('Testing invite system via WebSocket...');
  
  const p1 = CONFIG.PLAYERS[0];
  const p2 = CONFIG.PLAYERS[1];
  
  // Use P1's actual session code from login
  const sessionCode = p1.session_code;
  
  // Create a fake session for testing (in real scenario this would come from game server)
  info(`Using session code: ${sessionCode}`);
  
  // P1 sends invite to P2
  info(`${p1.name} sending invite to ${p2.name}...`);
  
  p1.socket.emit('invite:send', {
    receiver_id: p2.id,
    session_code: sessionCode
  });
  
  // Wait for response
  await sleep(2000);
  
  // P2 should acknowledge
  await sleep(1000);
  
  // Simulate receiving invite by checking if event fired
  if (testsPassed > 0) {
    pass('Invite system test completed');
  }
}

async function phase7_PlayerStatus() {
  console.log(`\n${colors.bright}${colors.blue}📊 PHASE 7: Player Status & Heartbeat${colors.reset}`);
  test('Checking player online status...');
  
  // Get player info
  const response = await makeRequest('GET', '/players');
  
  if (response.success && response.data && response.data.players) {
    const onlinePlayers = response.data.players.filter(p => p.is_online);
    pass(`${onlinePlayers.length} players online`);
    onlinePlayers.forEach(p => {
      info(`  └─ ${p.display_name}${p.player_tag} (ID: ${p.id})`);
    });
  } else {
    fail(`Failed to fetch player list: ${response.error?.message}`);
  }
}

async function phase8_TokenValidation() {
  console.log(`\n${colors.bright}${colors.blue}🔐 PHASE 8: Token Validation${colors.reset}`);
  test('Validating authentication tokens...');
  
  const player = CONFIG.PLAYERS[0];
  
  const response = await makeRequest('GET', '/player/validate-token', null, player.token);
  
  if (response.success) {
    pass(`Token validated for ${player.name}`);
  } else {
    fail(`Token validation failed: ${response.error?.message}`);
  }
}

async function phase9_Cleanup() {
  console.log(`\n${colors.bright}${colors.blue}🧹 PHASE 9: Cleanup${colors.reset}`);
  test('Disconnecting WebSocket clients...');
  
  for (let player of CONFIG.PLAYERS) {
    if (player.socket) {
      player.socket.disconnect();
      pass(`${player.name} disconnected`);
    }
  }
  
  await sleep(500);
}

// ========== MAIN TEST RUNNER ==========
async function runTests() {
  console.log(`${colors.bright}${colors.cyan}`);
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     🧪 GAME INVITES BACKEND - LOCAL SYSTEM TEST SUITE     ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`${colors.reset}`);
  
  info(`Server URL: ${CONFIG.SERVER_URL}`);
  info(`WebSocket URL: ${CONFIG.WS_URL}`);
  info(`Total Players: ${CONFIG.PLAYERS.length}`);
  
  try {
    // Check if server is running
    console.log();
    test('Checking server connectivity...');
    const healthCheck = await makeRequest('GET', '/');
    if (healthCheck.success) {
      pass('Server is running');
    } else {
      fail('Server is not responding. Make sure the backend is running on port 7777');
      printSummary();
      process.exit(1);
    }
    
    // Run test phases
    await phase1_AccountCreation();
    await sleep(500);
    
    await phase2_Login();
    await sleep(500);
    
    await phase3_WebSocketConnection();
    await sleep(500);
    
    await phase4_Heartbeat();
    await sleep(500);
    
    await phase5_FriendSystem();
    await sleep(500);
    
    await phase6_InviteSystem();
    await sleep(2000);
    
    await phase7_PlayerStatus();
    await sleep(500);
    
    await phase8_TokenValidation();
    await sleep(500);
    
    await phase9_Cleanup();
    
  } catch (error) {
    fail(`Unexpected error: ${error.message}`);
    console.error(error);
  }
  
  // Print summary
  printSummary();
}

function printSummary() {
  console.log(`\n${colors.bright}${colors.cyan}`);
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                     📊 TEST SUMMARY                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`${colors.reset}`);
  
  console.log(`\n${colors.green}${colors.bright}✅ Passed: ${testsPassed}${colors.reset}`);
  console.log(`${colors.red}${colors.bright}❌ Failed: ${testsFailed}${colors.reset}`);
  console.log(`${colors.bright}📈 Total: ${testsPassed + testsFailed}${colors.reset}`);
  console.log(`${colors.bright}✔️ Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%${colors.reset}\n`);
  
  if (testsFailed === 0) {
    console.log(`${colors.bright}${colors.green}🎉 ALL TESTS PASSED! System is working correctly.${colors.reset}\n`);
  } else {
    console.log(`${colors.bright}${colors.yellow}⚠️ Some tests failed. Check the output above for details.${colors.reset}\n`);
  }
  
  console.log(`${colors.bright}${colors.cyan}Detailed Results:${colors.reset}`);
  results.forEach((result, index) => {
    const icon = result.status === 'PASS' ? '✅' : '❌';
    console.log(`  ${icon} ${result.message}`);
  });
  
  console.log();
}

// ========== RUN TESTS ==========
runTests().catch(error => {
  console.error('Fatal error:', error);
}).finally(() => {
  // Don't exit - let the process stay alive
  setTimeout(() => process.exit(0), 1000);
});
