-- Migration: Add player heartbeat tracking columns
-- Run this SQL on your database to enable heartbeat functionality

-- Add heartbeat columns to players table
ALTER TABLE players ADD COLUMN last_heartbeat TIMESTAMP NULL DEFAULT NULL;
ALTER TABLE players ADD COLUMN game_open TINYINT(1) DEFAULT 0;

-- Create an index for faster cleanup queries
CREATE INDEX idx_last_heartbeat ON players(last_heartbeat);
CREATE INDEX idx_game_open ON players(game_open);

-- Optional: Add indices for querying online players with heartbeat
CREATE INDEX idx_is_online_heartbeat ON players(is_online, last_heartbeat);
