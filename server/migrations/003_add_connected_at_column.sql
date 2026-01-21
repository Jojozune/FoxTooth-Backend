-- Migration: Add connected_at timestamp for tracking player connection time
-- This allows us to give new players a grace period before marking them offline due to missing heartbeats

-- Add connected_at column to players table
ALTER TABLE players ADD COLUMN connected_at TIMESTAMP NULL DEFAULT NULL;

-- Create an index for faster queries
CREATE INDEX idx_connected_at ON players(connected_at);
