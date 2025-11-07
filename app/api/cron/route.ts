import { NextRequest, NextResponse } from 'next/server';
import { checkAllUrls } from '@/lib/ping';

// Beaumont, Texas timezone (America/Chicago - Central Time)
const BEAUMONT_TIMEZONE = 'America/Chicago';

// Scheduled check times in Central Time
const SCHEDULED_TIMES = [
  { hour: 7, minute: 50 },  // 7:50 AM CT
  { hour: 13, minute: 0 },  // 1:00 PM CT
  { hour: 22, minute: 0 },  // 10:00 PM CT
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
      scheduledTimes: SCHEDULED_TIMES.map(t => `${t.hour}:${t.minute.toString().padStart(2, '0')} AM/PM CT`)
    }, { status: 200 });
  }

  try {
    await checkAllUrls();
    
    // Run archive job once per day at 1:00 PM CT (19:00 UTC)
    // This consolidates cron jobs to stay within Vercel's free plan limit (2 jobs max)
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
    
    // Run archive at 1:00 PM CT (13:00) - middle check of the day
    if (currentHour === 13 && currentMinute >= 0 && currentMinute < 5) {
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
      message: 'URLs checked successfully',
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