import { db } from './db';

/**
 * Archive URL status records older than 7 days
 * Moves them to an archive table and deletes from main table
 */
export async function archiveOldStatusRecords(): Promise<{
  archived: number;
  deleted: number;
}> {
  try {
    // Ensure database is initialized (includes archive table creation)
    const { initDatabase } = await import('./db');
    await initDatabase();

    // Create index for faster queries
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_archived_url_status_url_id 
      ON archived_url_status(url_id)
    `);

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_archived_url_status_checked_at 
      ON archived_url_status(checked_at)
    `);

    // Get records older than 7 days
    const oldRecords = await db.execute({
      sql: `
        SELECT * FROM url_status 
        WHERE checked_at < datetime('now', '-7 days')
        ORDER BY checked_at ASC
      `,
    });

    let archivedCount = 0;
    let deletedCount = 0;

    // Archive each record
    for (const row of oldRecords.rows) {
      // Insert into archive table
      await db.execute({
        sql: `
          INSERT INTO archived_url_status 
          (url_id, status_code, status_text, response_time, is_up, checked_at, error_message)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          row.url_id,
          row.status_code,
          row.status_text,
          row.response_time,
          row.is_up,
          row.checked_at,
          row.error_message,
        ],
      });

      // Delete from main table
      await db.execute({
        sql: 'DELETE FROM url_status WHERE id = ?',
        args: [row.id],
      });

      archivedCount++;
      deletedCount++;
    }

    return { archived: archivedCount, deleted: deletedCount };
  } catch (error) {
    console.error('Error archiving status records:', error);
    throw error;
  }
}

/**
 * Get archived records for a specific URL
 */
export async function getArchivedStatusRecords(
  urlId: number,
  limit: number = 100
): Promise<any[]> {
  try {
    // Ensure database is initialized (includes archive table creation)
    const { initDatabase } = await import('./db');
    await initDatabase();

    const result = await db.execute({
      sql: `
        SELECT * FROM archived_url_status 
        WHERE url_id = ?
        ORDER BY checked_at DESC
        LIMIT ?
      `,
      args: [urlId, limit],
    });

    return result.rows.map((row: any) => ({
      id: Number(row.id),
      url_id: Number(row.url_id),
      status_code: row.status_code ? Number(row.status_code) : null,
      status_text: row.status_text,
      response_time: row.response_time ? Number(row.response_time) : null,
      is_up: Boolean(row.is_up),
      checked_at: row.checked_at,
      error_message: row.error_message,
      archived_at: row.archived_at,
    }));
  } catch (error) {
    console.error('Error fetching archived records:', error);
    throw error;
  }
}

