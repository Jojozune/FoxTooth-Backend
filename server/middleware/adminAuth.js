const jwt = require('jsonwebtoken');
const db = require('../config/database');
const ADMIN_SECRET = process.env.ADMIN_SECRET;

function authenticateAdmin(req, res, next) {
  const adminToken = req.headers['x-admin-token'];
  
  if (!adminToken) {
    console.error('❌ Admin token missing from request');
    return res.status(401).json({
      status: 'error',
      message: 'Admin token required'
    });
  }
  
  try {
    // Verify JWT token
    const decoded = jwt.verify(adminToken, ADMIN_SECRET);
    
    // EXTRA SECURITY: Verify the user is actually an admin in database
    const checkAdminQuery = `SELECT id, display_name FROM players WHERE id = ? AND is_admin = 1`;
    
    db.execute(checkAdminQuery, [decoded.playerId], (err, results) => {
      if (err) {
        console.error('❌ Database error checking admin status:', err);
        return res.status(500).json({
          status: 'error',
          message: 'Server error verifying admin privileges'
        });
      }
      
      if (results.length === 0) {
        console.error('❌ Admin token valid but user is not an admin:', decoded.playerId);
        return res.status(403).json({
          status: 'error',
          message: 'User does not have admin privileges'
        });
      }
      
      console.log('✅ Admin request authenticated for:', results[0].display_name);
      req.admin = results[0];
      next();
    });
    
  } catch (error) {
    console.error('❌ Invalid admin token:', error.message);
    return res.status(403).json({
      status: 'error',
      message: 'Invalid or expired admin token'
    });
  }
}

// Generate short-lived admin tokens (REQUIRES player to be admin)
function generateAdminToken(playerId, purpose = 'server_registration') {
  return jwt.sign(
    { 
      playerId: playerId,
      purpose: purpose,
      type: 'admin',
      generatedAt: new Date().toISOString()
    },
    ADMIN_SECRET,
    { expiresIn: process.env.ADMIN_TOKEN_EXPIRES_IN || '15m' }
  );
}

module.exports = { 
  authenticateAdmin, 
  generateAdminToken  // ← MAKE SURE THIS IS EXPORTED
};