import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    await db.execute({
      sql: 'DELETE FROM urls WHERE id = ?',
      args: [id],
    });

    return NextResponse.json({ message: 'URL deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const urlResult = await db.execute({
      sql: 'SELECT * FROM urls WHERE id = ?',
      args: [id],
    });

    if (urlResult.rows.length === 0) {
      return NextResponse.json({ error: 'URL not found' }, { status: 404 });
    }

    // Get status history for last 7 days
    const statusResult = await db.execute({
      sql: `
        SELECT * FROM url_status 
        WHERE url_id = ? 
        AND checked_at >= datetime('now', '-7 days')
        ORDER BY checked_at DESC
      `,
      args: [id],
    });

    const url = urlResult.rows[0];
    const statuses = statusResult.rows.map((row: any) => ({
      id: Number(row.id),
      url_id: Number(row.url_id),
      status_code: row.status_code ? Number(row.status_code) : null,
      status_text: row.status_text,
      response_time: row.response_time ? Number(row.response_time) : null,
      is_up: Boolean(row.is_up),
      checked_at: row.checked_at,
      error_message: row.error_message,
      location: row.location || null,
      is_redirect: row.status_code ? [301, 302, 303, 307, 308].includes(Number(row.status_code)) : false,
    }));

    return NextResponse.json({
      url: {
        id: Number(url.id),
        url: url.url,
        name: url.name,
        environment: url.environment || 'testing',
        created_at: url.created_at,
        updated_at: url.updated_at,
      },
      statuses,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

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

    // Check if URL exists
    const urlResult = await db.execute({
      sql: 'SELECT * FROM urls WHERE id = ?',
      args: [id],
    });

    if (urlResult.rows.length === 0) {
      return NextResponse.json({ error: 'URL not found' }, { status: 404 });
    }

    // Update the URL
    await db.execute({
      sql: 'UPDATE urls SET url = ?, name = ?, environment = ?, updated_at = datetime("now") WHERE id = ?',
      args: [url, name, validEnvironment, id],
    });

    return NextResponse.json({
      id,
      url,
      name,
      environment: validEnvironment,
      message: 'URL updated successfully',
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
