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
    }));

    return NextResponse.json({
      url: {
        id: Number(url.id),
        url: url.url,
        name: url.name,
        created_at: url.created_at,
        updated_at: url.updated_at,
      },
      statuses,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
