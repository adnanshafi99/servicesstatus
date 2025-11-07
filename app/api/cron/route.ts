import { NextRequest, NextResponse } from 'next/server';
import { checkAllUrls } from '@/lib/ping';

// Beaumont, Texas timezone (America/Chicago - Central Time)
const BEAUMONT_TIMEZONE = 'America/Chicago';

// Scheduled check time: 7:50 AM CT (runs once per day)
// This cron job also runs the archive task
const SCHEDULED_HOUR = 7;
const SCHEDULED_MINUTE = 50;

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

  // Check if current time matches scheduled time (within 5 minute window)
  const timeDiff = Math.abs((currentHour * 60 + currentMinute) - (SCHEDULED_HOUR * 60 + SCHEDULED_MINUTE));
  return timeDiff <= 5; // Allow 5 minute window for cron execution
}

export async function GET(request: NextRequest) {
  // Simple auth check - in production, use proper authentication
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify it's a scheduled time in Central Time (7:50 AM CT)
  // For manual testing, you can comment out this check
  if (!isScheduledTime()) {
    const centralTime = new Date(new Date().toLocaleString('en-US', { timeZone: BEAUMONT_TIMEZONE }));
    return NextResponse.json({ 
      success: false, 
      message: `Not a scheduled check time. Current Central Time: ${centralTime.toLocaleString()}`,
      scheduledTime: `${SCHEDULED_HOUR}:${SCHEDULED_MINUTE.toString().padStart(2, '0')} AM CT`
    }, { status: 200 });
  }

  try {
    // Check all URLs
    await checkAllUrls();
    
    // Run archive job (runs once per day at 7:50 AM CT along with URL checks)
    try {
      const { archiveOldStatusRecords } = await import('@/lib/archive');
      const archiveResult = await archiveOldStatusRecords();
      console.log(`Archive completed: ${archiveResult.archived} records archived`);
    } catch (archiveError) {
      console.error('Archive error during cron:', archiveError);
      // Don't fail the entire cron job if archive fails
    }
    
    const centralTime = new Date(new Date().toLocaleString('en-US', { timeZone: BEAUMONT_TIMEZONE }));
    return NextResponse.json({ 
      success: true, 
      message: 'URLs checked and archive completed successfully',
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