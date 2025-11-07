import { NextRequest, NextResponse } from 'next/server';
import { checkAllUrls } from '@/lib/ping';

// Beaumont, Texas timezone (America/Chicago - Central Time)
const BEAUMONT_TIMEZONE = 'America/Chicago';

// Scheduled check times in Central Time
// We have 2 cron jobs: 7:50 AM CT and 1:00 PM CT
// Archive runs at 1:00 PM CT (second cron job)
const SCHEDULED_TIMES = [
  { hour: 7, minute: 50 },  // 7:50 AM CT
  { hour: 13, minute: 0 },  // 1:00 PM CT (also runs archive)
];

function isScheduledTime(): boolean {
  const now = new Date();
  // Get Central Time components
  const centralTimeString = now.toLocaleString('en-US', { 
    timeZone: BEAUMONT_TIMEZONE,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  });
  
  const [hourStr, minuteStr] = centralTimeString.split(':');
  const currentHour = parseInt(hourStr, 10);
  const currentMinute = parseInt(minuteStr, 10);

  // Check if current time matches any scheduled time (within 5 minute window)
  return SCHEDULED_TIMES.some(({ hour, minute }) => {
    const timeDiff = Math.abs((currentHour * 60 + currentMinute) - (hour * 60 + minute));
    return timeDiff <= 5; // Allow 5 minute window for cron execution
  });
}

export async function GET(request: NextRequest) {
  // Simple auth check - in production, use proper authentication
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify it's a scheduled time in Central Time
  // For manual testing, you can comment out this check
  if (!isScheduledTime()) {
    const centralTime = new Date(new Date().toLocaleString('en-US', { timeZone: BEAUMONT_TIMEZONE }));
    return NextResponse.json({ 
      success: false, 
      message: `Not a scheduled check time. Current Central Time: ${centralTime.toLocaleString()}`,
      scheduledTimes: SCHEDULED_TIMES.map(t => `${t.hour}:${t.minute.toString().padStart(2, '0')} ${t.hour >= 12 ? 'PM' : 'AM'} CT`)
    }, { status: 200 });
  }

  try {
    // Check all URLs
    await checkAllUrls();
    
    // Get current Central Time to determine if we should run archive
    const now = new Date();
    const centralTimeString = now.toLocaleString('en-US', {
      timeZone: BEAUMONT_TIMEZONE,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });
    const [hourStr, minuteStr] = centralTimeString.split(':');
    const currentHour = parseInt(hourStr, 10);
    const currentMinute = parseInt(minuteStr, 10);
    
    // Run archive job at 1:00 PM CT (13:00) - second cron job of the day
    // Archive processes records older than 7 days (runs daily but only moves old records)
    const shouldRunArchive = currentHour === 13 && currentMinute >= 0 && currentMinute < 5;
    
    if (shouldRunArchive) {
      try {
        const { archiveOldStatusRecords } = await import('@/lib/archive');
        const archiveResult = await archiveOldStatusRecords();
        console.log(`Archive completed: ${archiveResult.archived} records archived`);
      } catch (archiveError) {
        console.error('Archive error during cron:', archiveError);
        // Don't fail the entire cron job if archive fails
      }
    }
    
    const centralTime = new Date(new Date().toLocaleString('en-US', { timeZone: BEAUMONT_TIMEZONE }));
    return NextResponse.json({ 
      success: true, 
      message: shouldRunArchive 
        ? 'URLs checked and archive completed successfully'
        : 'URLs checked successfully',
      timestamp: new Date().toISOString(),
      centralTime: centralTime.toLocaleString('en-US', { timeZone: BEAUMONT_TIMEZONE })
    });
  } catch (error: any) {
    return NextResponse.json({ 
      error: 'Failed to check URLs',
      message: error.message 
    }, { status: 500 });
  }
}

// Allow POST for cron services
export async function POST(request: NextRequest) {
  return GET(request);
}