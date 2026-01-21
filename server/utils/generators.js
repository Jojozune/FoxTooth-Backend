// Generate session codes
function generateSessionCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Generate random numeric player tag (4 digits with hashtag)
function generatePlayerTag() {
  const digits = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `#${digits}`;
}

module.exports = {
  generateSessionCode,
  generatePlayerTag
};