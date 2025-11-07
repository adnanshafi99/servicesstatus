import { NextRequest, NextResponse } from 'next/server';
import { archiveOldStatusRecords } from '@/lib/archive';
import { getAuthSession } from '@/lib/auth';

/**
 * Archive endpoint - can be called manually or via cron
 * Moves status records older than 7 days to archive table
 */
export async function POST(request: NextRequest) {
  try {
    // Optional: Add authentication check for manual triggers
    // For cron jobs, use CRON_SECRET in header
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const session = await getAuthSession();

    // Allow if authenticated OR if cron secret matches
    if (!session && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await archiveOldStatusRecords();

    return NextResponse.json({
      success: true,
      message: `Archived ${result.archived} records`,
      archived: result.archived,
      deleted: result.deleted,
    });
  } catch (error: any) {
    console.error('Archive error:', error);
    return NextResponse.json(
      {
        error: 'Failed to archive records',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check archive status
export async function GET() {
  try {
    const { db } = await import('@/lib/db');
    
    // Count records that should be archived
    const oldRecordsResult = await db.execute({
      sql: `
        SELECT COUNT(*) as count 
        FROM url_status 
        WHERE checked_at < datetime('now', '-7 days')
      `,
      args: [],
    });

    // Count archived records
    const archivedResult = await db.execute({
      sql: 'SELECT COUNT(*) as count FROM archived_url_status',
      args: [],
    });

    const oldCount = Number(oldRecordsResult.rows[0]?.count) || 0;
    const archivedCount = Number(archivedResult.rows[0]?.count) || 0;

    return NextResponse.json({
      recordsToArchive: oldCount,
      totalArchived: archivedCount,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Failed to get archive status',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

