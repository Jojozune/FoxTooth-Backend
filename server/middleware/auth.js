const jwt = require('jsonwebtoken');
const JWT_CONFIG = require('../config/jwt');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ status: 'error', message: 'Access token required' });
  }

  jwt.verify(token, JWT_CONFIG.secret, (err, player) => {
    if (err) {
      console.error('❌ JWT verification failed:', err.message);
      return res.status(403).json({ status: 'error', message: 'Invalid or expired token' });
    }
    req.player = player;
    console.log('✅ JWT verified for player:', player.playerId);
    next();
  });
}

module.exports = { authenticateToken };