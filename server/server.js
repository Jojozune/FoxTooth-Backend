// Load environment variables FIRST, before anything else
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const os = require('os');

// Import controllers
const authController = require('./controllers/authController');
const playerController = require('./controllers/playerController');
const inviteController = require('./controllers/inviteController');
const sessionController = require('./controllers/sessionController');
const serverController = require('./controllers/serverController');
const friendController = require('./controllers/friendController');
const heartbeatController = require('./controllers/heartbeatController');

// Import middleware
const { authenticateToken } = require('./middleware/auth');
const { authenticateAdmin } = require('./middleware/adminAuth');
const { validateAccountCreation, validateLogin } = require('./middleware/validation');
const { createAccountLimiter, loginLimiter, generalLimiter } = require('./middleware/rateLimit');

// Import services
const tokenService = require('./services/tokenService');
const { cleanupDeadServers, cleanupDeadSessions, handleServerHeartbeat } = require('./services/serverService');
const { cleanupDeadPlayers } = require('./controllers/heartbeatController');
const { initializeWebSocket } = require('./services/websocketService');

// Import database for admin checks (uses env vars; set DB_HOST/DB_USER/DB_PASS/DB_NAME)
const db = require('./config/database_new');

const app = express();

// Local port (what the server actually listens on)
const LOCAL_PORT = Number(process.env.LOCAL_PORT) || 7777;

// Public server info (for external clients through port forwarding)
const SERVER_HOST = process.env.SERVER_HOST || 'localhost';
const PUBLIC_PORT = Number(process.env.SERVER_PORT) || LOCAL_PORT;
const SERVER_URL = process.env.SERVER_URL || `http://${SERVER_HOST}:${PUBLIC_PORT}`;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Attempt to detect EC2 public IPv4 (works when running on AWS EC2 with IMDS available)
let detectedPublicIP = null;
function detectEC2PublicIPv4(timeoutMs = 1500) {
  return new Promise((resolve) => {
    try {
      const req = http.get({ host: '169.254.169.254', path: '/latest/meta-data/public-ipv4', timeout: timeoutMs }, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk.toString());
        res.on('end', () => {
          const ip = body && body.trim();
          if (ip) {
            detectedPublicIP = ip;
            return resolve(ip);
          }
          return resolve(null);
        });
      });

      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
    } catch (e) {
      return resolve(null);
    }
  });
}

// Start detection now (async) so the root page and logs can show it shortly after startup
detectEC2PublicIPv4().then((ip) => {
  if (ip) {
    console.log('🔎 Detected EC2 public IPv4:', ip);
  }
});

// Configure CORS: if CORS_ORIGINS is set (comma-separated), use a restrictive policy.
const rawOrigins = process.env.CORS_ORIGINS;
if (rawOrigins && rawOrigins.trim().length > 0) {
  const allowedOrigins = rawOrigins.split(',').map(s => s.trim()).filter(Boolean);
  app.use(cors({
    origin: function(origin, callback) {
      // Allow non-browser requests (no origin) such as server-to-server or curl
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf('*') !== -1 || allowedOrigins.indexOf(origin) !== -1) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    }
  }));
} else {
  // Default: permissive CORS (useful for local testing). Set CORS_ORIGINS in production.
  app.use(cors());
}
app.use(express.json());
app.use(generalLimiter); // Apply rate limiting to all routes

// ========== PUBLIC ROUTES ========== //
// Friendly root page so visiting the server in a browser shows a clear status
app.get('/', (req, res) => {
  const publicIpNotice = detectedPublicIP ? `<p>Public IPv4 detected: <a href=\"http://${detectedPublicIP}:${LOCAL_PORT}\">http://${detectedPublicIP}:${LOCAL_PORT}</a></p>` : '';
  res.send(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>Game Invite Backend</title>
        <style>
          body { font-family: Arial, Helvetica, sans-serif; text-align:center; padding:40px; }
          .card { display:inline-block; text-align:left; padding:20px 30px; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.08); }
          h1 { margin:0 0 10px 0 }
          p { margin:6px 0 }
          a { color:#0366d6 }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>✅ Game Invite Backend is running</h1>
          <p>Visit the <a href="/health">/health</a> endpoint for JSON status.</p>
          ${publicIpNotice}
          <p>Server time: ${new Date().toISOString()}</p>
        </div>
      </body>
    </html>
  `);
});

// Lightweight health-check endpoint. By default returns server status only.
// Set ENABLE_DB_HEALTH=true to include a quick DB check (will run a simple SELECT 1).
app.get('/health', (req, res) => {
  const status = {
    server: 'ok',
    uptime_seconds: Math.floor(process.uptime()),
    timestamp: Date.now(),
  };

  if (process.env.ENABLE_DB_HEALTH === 'true') {
    // `db` is the mysql2 pool imported above
    db.getConnection((err, conn) => {
      if (err) {
        status.db = {
          status: 'error',
          code: err.code || 'UNKNOWN',
          message: err.message || String(err)
        };
        return res.status(503).json(status);
      }

      conn.query('SELECT 1 AS ok', (qErr) => {
        if (qErr) {
          status.db = { status: 'error', code: qErr.code || 'QUERY_ERROR', message: qErr.message };
          conn.release();
          return res.status(503).json(status);
        }

        status.db = { status: 'ok' };
        conn.release();
        return res.json(status);
      });
    });
  } else {
    // No DB check requested
    return res.json(status);
  }
});

// Account management WITH SECURITY
app.post('/account/create', createAccountLimiter, validateAccountCreation, authController.createAccount);
app.post('/account/login', loginLimiter, validateLogin, authController.login);

// Authentication
app.post('/player/connect', authController.playerConnect);
app.post('/player/refresh-token', authController.refreshToken);
// Remember-me login: exchange remember_token for new access/refresh tokens
app.post('/player/remember-login', authController.rememberLogin);

// Player management
app.get('/players', playerController.getPlayers);
app.get('/player/lookup', playerController.lookupPlayer);

// Player heartbeat (PROTECTED - must be authenticated)
app.post('/player/heartbeat', authenticateToken, heartbeatController.playerHeartbeat);
app.get('/player/check-alive/:playerId', authenticateToken, heartbeatController.checkPlayerAlive);
app.post('/player/check-alive-batch', authenticateToken, heartbeatController.checkPlayersAlive);

// Server management (PUBLIC - for game servers and invite system)
app.post('/server/update', serverController.updateServer);
app.post('/server/update-players', serverController.updatePlayerCount);
app.post('/session/link-server', serverController.linkSessionToServer);
app.post('/server/heartbeat', handleServerHeartbeat); // NEW: Server heartbeat endpoint
// Composite endpoint for servers to register themselves with credentials in one call
app.post('/server/auto-register', serverController.autoRegisterServer);

// ========== ADMIN TOKEN GENERATION ========== //
app.get('/admin/generate-token', authenticateToken, (req, res) => {
  const { generateAdminToken } = require('./middleware/adminAuth');
  
  // Check if user is actually an admin in database
  const checkAdminQuery = `SELECT id, display_name, is_admin FROM players WHERE id = ?`;
  
  db.execute(checkAdminQuery, [req.player.playerId], (err, results) => {
    if (err) {
      console.error('❌ Database error checking admin status:', err);
      return res.status(500).json({
        status: 'error',
        message: 'Server error'
      });
    }
    
    if (results.length === 0 || results[0].is_admin !== 1) {
      console.error('❌ Non-admin attempt to generate admin token:', req.player.playerId);
      return res.status(403).json({
        status: 'error',
        message: 'Insufficient permissions - admin access required'
      });
    }
    
    // User is verified admin - generate token
    const token = generateAdminToken(req.player.playerId, 'server_registration');
    
    console.log('🔑 Generated admin token for admin user:', results[0].display_name);
    
    res.json({
      status: 'success',
      admin_token: token,
      expires_in: '15 minutes',
      purpose: 'server_registration',
      generated_by: results[0].display_name,
      message: 'Use this token in X-Admin-Token header for admin operations'
    });
  });
});

// ========== ADMIN-ONLY ROUTES ========== //
app.post('/server/register', authenticateAdmin, serverController.registerServer);
app.post('/server/remove', authenticateAdmin, serverController.removeServer); // Only register/remove need admin
app.post('/player/:playerId/force-offline', authenticateAdmin, heartbeatController.forcePlayerOffline);

// ========== PROTECTED ROUTES ========== //
app.get('/player/validate-token', authenticateToken, authController.validateToken);
app.post('/player/logout', authenticateToken, authController.logout);
app.post('/player/disconnect', authenticateToken, sessionController.disconnectPlayer);

// Invite system
app.post('/invite/send', authenticateToken, inviteController.sendInvite);
app.get('/invite/check/:playerId', authenticateToken, inviteController.checkInvites);
app.post('/invite/respond', authenticateToken, inviteController.respondToInvite);
app.delete('/invite/cleanup', inviteController.cleanupInvites);

// Friend system
app.post('/friend/request', authenticateToken, friendController.sendFriendRequest);
app.get('/friend/requests', authenticateToken, friendController.getFriendRequests);
app.post('/friend/accept', authenticateToken, friendController.acceptFriendRequest);
app.post('/friend/decline', authenticateToken, friendController.declineFriendRequest);
app.post('/friend/remove', authenticateToken, friendController.removeFriend);
app.get('/friends', authenticateToken, friendController.getFriendsList);
app.post('/friend/block', authenticateToken, friendController.blockPlayer);
app.post('/friend/unblock', authenticateToken, friendController.unblockPlayer);
app.get('/friend/blocked', authenticateToken, friendController.getBlockedList);
app.get('/friend/check/:friend_id', authenticateToken, friendController.isFriend);

// Create HTTP server for both Express and WebSocket
const httpServer = http.createServer(app);

// Initialize WebSocket server
const io = initializeWebSocket(httpServer);

// Start server
httpServer.listen(LOCAL_PORT, '0.0.0.0', () => {
  console.log(`\n🎮 Game Invite Backend running`);
  console.log(`📍 Local address: http://localhost:${LOCAL_PORT}`);
  console.log(`🌐 Public address: ${SERVER_URL}`);
  console.log(`📡 Node Environment: ${NODE_ENV}`);
  console.log(`\n🔐 JWT Security: Enabled`);
  console.log(`🔄 Refresh Tokens: Enabled (7-day expiry)`);
  console.log(`⏰ Access Tokens: 2-hour expiry`);
  console.log(`👤 Account System: Enabled (Create/Login required)`);
  console.log(`🛡️ Admin System: Enabled (Server registration/removal only)`);
  console.log(`⚡ Rate Limiting: Enabled`);
  console.log(`🔒 Input Validation: Enabled`);
  console.log(`❤️ HTTP Heartbeat: Enabled`);
  console.log(`🔌 WebSocket (Real-time Events): Enabled\n`);
  
  // Start cleanup intervals
  setInterval(tokenService.cleanupExpiredRefreshTokens, 60 * 60 * 1000); // 1 hour
  // Cleanup remember-me tokens periodically (1 hour)
  setInterval(tokenService.cleanupExpiredRememberTokens, 60 * 60 * 1000);
  // Configurable server cleanup interval (seconds). Default: 60s for faster detection.
  const SERVER_CLEANUP_INTERVAL_SECONDS = Number(process.env.SERVER_CLEANUP_INTERVAL_SECONDS) || 60;
  const SERVER_HEARTBEAT_TIMEOUT_SECONDS = Number(process.env.SERVER_HEARTBEAT_TIMEOUT_SECONDS) || 120;
  const PLAYER_HEARTBEAT_TIMEOUT_SECONDS = Number(process.env.PLAYER_HEARTBEAT_TIMEOUT_SECONDS) || 120;
  const PLAYER_CLEANUP_INTERVAL_SECONDS = Number(process.env.PLAYER_CLEANUP_INTERVAL_SECONDS) || 30;
  console.log(`🔍 Server Health Check Config:`);
  console.log(`   - Cleanup interval: ${SERVER_CLEANUP_INTERVAL_SECONDS}s`);
  console.log(`   - Heartbeat timeout (dead if no beat): ${SERVER_HEARTBEAT_TIMEOUT_SECONDS}s\n`);
  console.log(`👤 Player Health Check Config:`);
  console.log(`   - Cleanup interval: ${PLAYER_CLEANUP_INTERVAL_SECONDS}s`);
  console.log(`   - Heartbeat timeout (grace period + timeout): ${PLAYER_HEARTBEAT_TIMEOUT_SECONDS}s\n`);
  setInterval(cleanupDeadServers, SERVER_CLEANUP_INTERVAL_SECONDS * 1000); // Clean up dead servers
  // Clean up stale sessions where host disconnected before join (run every 60s)
  setInterval(cleanupDeadSessions, 60 * 1000);
  setInterval(() => cleanupDeadPlayers(PLAYER_HEARTBEAT_TIMEOUT_SECONDS), PLAYER_CLEANUP_INTERVAL_SECONDS * 1000); // Mark players offline if no heartbeat
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('🔄 Shutting down gracefully...');
  process.exit(0);
});