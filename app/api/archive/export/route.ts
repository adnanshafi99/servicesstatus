import { NextRequest, NextResponse } from 'next/server';
import { exportArchivedRecordsToText } from '@/lib/file-archive';
import { getAuthSession } from '@/lib/auth';

/**
 * Export archived records as a text file
 * Requires authentication
 */
export async function GET(request: NextRequest) {
  try {
    // Require authentication for file export
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Initialize database to ensure archive table exists
    const { initDatabase } = await import('@/lib/db');
    await initDatabase();

    const fileContent = await exportArchivedRecordsToText();

    // Check if there's actually any content (more than just headers)
    if (fileContent.split('\n').length < 5) {
      return NextResponse.json(
        {
          error: 'No archived records found',
          message: 'No records have been archived yet. Records are automatically archived after 7 days.',
        },
        { status: 404 }
      );
    }

    // Return as downloadable text file
    return new NextResponse(fileContent, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="url-status-archive-${new Date().toISOString().split('T')[0]}.txt"`,
      },
    });
  } catch (error: any) {
    console.error('Export error:', error);
    return NextResponse.json(
      {
        error: 'Failed to export archived records',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

