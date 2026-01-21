-- SQL Migration: Add Friendships Table
-- Run this in your MySQL database: tidal_hunters

CREATE TABLE IF NOT EXISTS friendships (
  id INT AUTO_INCREMENT PRIMARY KEY,
  player_id INT NOT NULL,
  friend_id INT NOT NULL,
  status ENUM('pending', 'accepted', 'blocked') DEFAULT 'pending',
  requested_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY (friend_id) REFERENCES players(id) ON DELETE CASCADE,
  UNIQUE KEY unique_friendship (player_id, friend_id),
  KEY idx_friend_id (friend_id),
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Verify table was created
SHOW TABLES LIKE 'friendships';

-- Check the structure
DESCRIBE friendships;
