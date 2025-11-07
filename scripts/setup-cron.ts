import 'dotenv/config';
import cron from 'node-cron';
import { checkAllUrls } from '../lib/ping';
import { initDatabase } from '../lib/db';

// Initialize database on startup
initDatabase().catch(console.error);

// Run checks 3 times per day: 8 AM, 2 PM, and 8 PM
// Cron format: minute hour day month weekday
cron.schedule('0 8,14,20 * * *', async () => {
  console.log(`[${new Date().toISOString()}] Running scheduled URL checks...`);
  try {
    await checkAllUrls();
    console.log(`[${new Date().toISOString()}] URL checks completed successfully`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error checking URLs:`, error);
  }
});

console.log('Cron scheduler started. URL checks will run at 8 AM, 2 PM, and 8 PM daily.');
