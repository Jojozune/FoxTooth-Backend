#!/usr/bin/env node
/**
 * test-runner.js
 * Runs both the backend server and test client
 * Usage: node test-runner.js
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Kill on Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down test suite...');
  process.exit(0);
});

// Start server
console.log('🚀 Starting backend server...');
const serverProcess = spawn('node', ['server.js'], {
  cwd: path.join(__dirname),
  stdio: 'inherit'
});

// Wait 3 seconds for server to start, then run tests
setTimeout(() => {
  console.log('\n✅ Server started. Running tests...\n');
  
  const testProcess = spawn('node', ['test-client.js'], {
    cwd: path.join(__dirname),
    stdio: 'inherit'
  });
  
  testProcess.on('exit', (code) => {
    console.log('\n✅ Tests completed. Shutting down...');
    serverProcess.kill();
    process.exit(code);
  });
}, 3000);

serverProcess.on('error', (err) => {
  console.error('❌ Server error:', err);
  process.exit(1);
});
