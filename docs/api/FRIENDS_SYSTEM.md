# Friends System - Complete Documentation

**Status:** ✅ Implemented & Ready to Use  
**Database Tables:** 1 (`friendships`)  
**API Endpoints:** 10 (all protected - require auth)  
**Controller:** `friendController.js`

---

## Table of Contents
1. [Database Schema](#database-schema)
2. [API Endpoints](#api-endpoints)
3. [Unity Implementation](#unity-implementation)
4. [Flow Diagrams](#flow-diagrams)
5. [Error Handling](#error-handling)
6. [Best Practices](#best-practices)

---

## Database Schema

### Friendships Table
```sql
CREATE TABLE friendships (
	id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
	player_id INT NOT NULL,
	friend_id INT NOT NULL,
	status ENUM('pending', 'accepted', 'blocked') DEFAULT 'pending',
	requested_by INT NOT NULL,
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
	UNIQUE KEY unique_friendship (player_id, friend_id),
	INDEX idx_player_id (player_id),
	INDEX idx_friend_id (friend_id),
	INDEX idx_status (status),
  
	CONSTRAINT fk_friendship_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
	CONSTRAINT fk_friendship_friend FOREIGN KEY (friend_id) REFERENCES players(id) ON DELETE CASCADE,
  
	CONSTRAINT check_not_self CHECK (player_id != friend_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

... (full content mirrors root file)

