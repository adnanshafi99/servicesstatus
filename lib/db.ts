import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  throw new Error('Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN environment variables');
}

export const db = createClient({
  url,
  authToken,
});

// Initialize database schema
export async function initDatabase() {
  // URLs table - stores the URLs to monitor
  await db.execute(`
    CREATE TABLE IF NOT EXISTS urls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      environment TEXT NOT NULL DEFAULT 'testing',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add environment column if it doesn't exist (migration for existing databases)
  // SQLite doesn't support adding NOT NULL columns with default values directly
  // So we check if column exists first by querying table info, and if not, add it
  try {
    // Try to get table info to check if environment column exists
    // For Turso (remote SQLite), PRAGMA might not work, so we'll use a try-catch approach
    try {
      const tableInfo = await db.execute("PRAGMA table_info(urls)");
      const hasEnvironmentColumn = tableInfo.rows.some((row: any) => row.name === 'environment');
      
      if (!hasEnvironmentColumn) {
        // Add column as nullable first
        await db.execute(`ALTER TABLE urls ADD COLUMN environment TEXT`);
        // Update all existing rows to 'testing'
        await db.execute(`UPDATE urls SET environment = 'testing' WHERE environment IS NULL`);
      }
    } catch (pragmaError: any) {
      // PRAGMA might not work with remote databases, try to add column directly
      try {
        await db.execute(`ALTER TABLE urls ADD COLUMN environment TEXT`);
        await db.execute(`UPDATE urls SET environment = 'testing' WHERE environment IS NULL`);
      } catch (addError: any) {
        // Column might already exist, which is fine
        if (!addError.message?.includes('duplicate column') && 
            !addError.message?.includes('no such column') &&
            !addError.message?.includes('no such table')) {
          console.error('Error adding environment column:', addError.message);
        }
      }
    }
  } catch (error: any) {
    // Ignore migration errors - column might already exist
    // This is safe because the CREATE TABLE IF NOT EXISTS already includes the column
  }

  // URL status table - stores check results for each URL
  await db.execute(`
    CREATE TABLE IF NOT EXISTS url_status (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url_id INTEGER NOT NULL,
      status_code INTEGER,
      status_text TEXT,
      response_time INTEGER,
      is_up BOOLEAN NOT NULL,
      checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      error_message TEXT,
      location TEXT,
      FOREIGN KEY (url_id) REFERENCES urls(id) ON DELETE CASCADE
    )
  `);

  // Add location column if it doesn't exist (migration for existing databases)
  try {
    try {
      const tableInfo = await db.execute("PRAGMA table_info(url_status)");
      const hasLocationColumn = tableInfo.rows.some((row: any) => row.name === 'location');
      
      if (!hasLocationColumn) {
        await db.execute(`ALTER TABLE url_status ADD COLUMN location TEXT`);
      }
    } catch (pragmaError: any) {
      // PRAGMA might not work with remote databases, try to add column directly
      try {
        await db.execute(`ALTER TABLE url_status ADD COLUMN location TEXT`);
      } catch (addError: any) {
        // Column might already exist, which is fine
        if (!addError.message?.includes('duplicate column') && 
            !addError.message?.includes('no such column') &&
            !addError.message?.includes('no such table')) {
          console.error('Error adding location column:', addError.message);
        }
      }
    }
  } catch (error: any) {
    // Ignore migration errors - column might already exist
  }

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_url_status_url_id ON url_status(url_id);
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_url_status_checked_at ON url_status(checked_at);
  `);

  // Archive table for old status records (older than 7 days)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS archived_url_status (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url_id INTEGER NOT NULL,
      status_code INTEGER,
      status_text TEXT,
      response_time INTEGER,
      is_up BOOLEAN NOT NULL,
      checked_at DATETIME NOT NULL,
      error_message TEXT,
      archived_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_archived_url_status_url_id 
    ON archived_url_status(url_id);
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_archived_url_status_checked_at 
    ON archived_url_status(checked_at);
  `);

  // Admin users table - stores admin credentials
  await db.execute(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create default admin user if it doesn't exist
  // Password: admin123 (you should change this in production!)
  // Using a simple hash for demo - in production use bcrypt or similar
  const adminCheck = await db.execute({
    sql: 'SELECT id FROM admin_users WHERE username = ?',
    args: ['admin']
  });

  if (adminCheck.rows.length === 0) {
    // Simple password hash - in production, use proper hashing like bcrypt
    // This is just a placeholder - password: admin123
    const defaultPasswordHash = 'admin123'; // In production, hash this properly
    await db.execute({
      sql: 'INSERT INTO admin_users (username, password_hash) VALUES (?, ?)',
      args: ['admin', defaultPasswordHash]
    });
  }
}
