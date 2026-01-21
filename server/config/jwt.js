require('dotenv').config();

const JWT_CONFIG = {
  secret: process.env.JWT_SECRET || 'fallback_secret_change_in_production',
  accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '2h',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
};

module.exports = JWT_CONFIG;