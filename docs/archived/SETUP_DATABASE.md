# Run Database Migrations

This script will set up all necessary database tables.

## Manual Setup (Recommended)

### Connect to your MySQL database:
```bash
mysql -h localhost -u root -p tidal_hunters
```

### Run the SQL files:
```sql
-- Copy and paste the contents of:
-- migrations/001_add_heartbeat_columns.sql
-- migrations/002_create_friendships_table.sql

-- Or source the files:
SOURCE migrations/002_create_friendships_table.sql;
```

## Verify Tables
```sql
SHOW TABLES;
DESCRIBE friendships;
```

## If Using a MySQL Client (e.g., MySQL Workbench)

1. Open MySQL Workbench
2. Connect to your database
3. Open migrations/002_create_friendships_table.sql
4. Execute (Ctrl+Shift+Enter)

---

**After running migration, test again:**
```bash
node test-client.js
```

Expected result: **17/17 tests passing (100%)**
