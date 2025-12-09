import { NextRequest, NextResponse } from 'next/server';
import { db, initDatabase } from '@/lib/db';
import { checkUrl } from '@/lib/ping';

export async function GET(request: NextRequest) {
  try {
    // Ensure database is initialized
    await initDatabase();
    
    // Get environment filter from query params
    const { searchParams } = new URL(request.url);
    const environment = searchParams.get('environment');
    
    // Build query with optional environment filter
    let query = 'SELECT * FROM urls';
    const args: any[] = [];
    
    if (environment && (environment === 'testing' || environment === 'production')) {
      query += ' WHERE environment = ?';
      args.push(environment);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const urlsResult = await db.execute({
      sql: query,
      args,
    });
    
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
          location: latestStatusResult.rows[0].location || null,
          is_redirect: latestStatusResult.rows[0].status_code ? [301, 302, 303, 307, 308].includes(Number(latestStatusResult.rows[0].status_code)) : false,
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
          environment: row.environment || 'testing',
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
    const { url, name, environment } = body;

    if (!url || !name) {
      return NextResponse.json(
        { error: 'URL and name are required' },
        { status: 400 }
      );
    }

    // Validate environment
    const validEnvironment = environment === 'production' ? 'production' : 'testing';

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
      sql: 'INSERT INTO urls (url, name, environment) VALUES (?, ?, ?)',
      args: [url, name, validEnvironment],
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
      environment: validEnvironment,
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
