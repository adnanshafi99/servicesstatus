import { NextRequest, NextResponse } from 'next/server';
import { db, initDatabase } from '@/lib/db';
import { checkUrl } from '@/lib/ping';

export async function GET() {
  try {
    // Get all URLs
    const urlsResult = await db.execute('SELECT * FROM urls ORDER BY created_at DESC');
    
    // Get latest status for each URL and calculate uptime
    const urls = await Promise.all(
      urlsResult.rows.map(async (row: any) => {
        const urlId = Number(row.id);
        
        // Get latest status
        const latestStatusResult = await db.execute({
          sql: `
            SELECT * FROM url_status 
            WHERE url_id = ? 
            ORDER BY checked_at DESC 
            LIMIT 1
          `,
          args: [urlId],
        });
        
        const latest_status = latestStatusResult.rows.length > 0 ? {
          id: Number(latestStatusResult.rows[0].id),
          url_id: Number(latestStatusResult.rows[0].url_id),
          status_code: latestStatusResult.rows[0].status_code ? Number(latestStatusResult.rows[0].status_code) : null,
          status_text: latestStatusResult.rows[0].status_text,
          response_time: latestStatusResult.rows[0].response_time ? Number(latestStatusResult.rows[0].response_time) : null,
          is_up: Boolean(latestStatusResult.rows[0].is_up),
          checked_at: latestStatusResult.rows[0].checked_at,
          error_message: latestStatusResult.rows[0].error_message,
        } : null;
        
        // Calculate uptime percentage for last 7 days
        const uptimeResult = await db.execute({
          sql: `
            SELECT 
              COUNT(*) as total,
              SUM(CASE WHEN is_up = 1 THEN 1 ELSE 0 END) as up_count
            FROM url_status
            WHERE url_id = ? 
            AND checked_at >= datetime('now', '-7 days')
          `,
          args: [urlId],
        });
        
        const total = Number(uptimeResult.rows[0]?.total) || 0;
        const upCount = Number(uptimeResult.rows[0]?.up_count) || 0;
        const uptime_percentage = total > 0 ? (upCount / total) * 100 : 0;

        return {
          id: Number(row.id),
          url: row.url,
          name: row.name,
          created_at: row.created_at,
          updated_at: row.updated_at,
          latest_status,
          uptime_percentage,
        };
      })
    );

    return NextResponse.json(urls);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await initDatabase();
    
    const body = await request.json();
    const { url, name } = body;

    if (!url || !name) {
      return NextResponse.json(
        { error: 'URL and name are required' },
        { status: 400 }
      );
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    const result = await db.execute({
      sql: 'INSERT INTO urls (url, name) VALUES (?, ?)',
      args: [url, name],
    });

    const newUrlId = Number(result.lastInsertRowid);

    // Immediately check the URL status
    try {
      await checkUrl(newUrlId);
    } catch (checkError) {
      // Log error but don't fail the request
      console.error('Error checking new URL:', checkError);
    }

    return NextResponse.json({
      id: newUrlId,
      url,
      name,
      message: 'URL added successfully',
    });
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint')) {
      return NextResponse.json(
        { error: 'URL already exists' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
