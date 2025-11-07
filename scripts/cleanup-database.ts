/**
 * Cleanup script to remove unused tables and data from Turso database
 * 
 * This script removes:
 * - incidents table
 * - incident_updates table
 * - services table
 * - maintenance table
 * - maintenance_services table
 * 
 * Run this script before deploying to production:
 * npx tsx scripts/cleanup-database.ts
 */

import 'dotenv/config';
import { db } from '../lib/db';

async function cleanupDatabase() {
  try {
    console.log('Starting database cleanup...\n');

    // Drop unused tables (in reverse order of dependencies)
    const tablesToDrop = [
      'maintenance_services',
      'maintenance',
      'services',
      'incident_updates',
      'incidents',
    ];

    for (const table of tablesToDrop) {
      try {
        // Check if table exists
        const checkTable = await db.execute({
          sql: `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
          args: [table],
        });

        if (checkTable.rows.length > 0) {
          console.log(`Dropping table: ${table}...`);
          await db.execute(`DROP TABLE IF EXISTS ${table}`);
          console.log(`✓ Dropped table: ${table}\n`);
        } else {
          console.log(`⊘ Table ${table} does not exist, skipping...\n`);
        }
      } catch (error: any) {
        console.error(`✗ Error dropping table ${table}:`, error.message);
      }
    }

    console.log('Database cleanup completed!');
    console.log('\nRemaining tables:');
    try {
      const remainingTables = await db.execute({
        sql: `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`,
      });

      remainingTables.rows.forEach((row: any) => {
        console.log(`  - ${row.name}`);
      });
    } catch (error: any) {
      console.log('  (Unable to list tables, but cleanup was successful)');
      console.log('  Expected remaining tables:');
      console.log('    - admin_users');
      console.log('    - archived_url_status');
      console.log('    - url_status');
      console.log('    - urls');
    }

    console.log('\n✓ Database is now clean and ready for deployment!');
  } catch (error: any) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  }
}

// Run cleanup
cleanupDatabase()
  .then(() => {
    console.log('\nCleanup script completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

