import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { urlId, isUp, responseTime, statusCode, errorMessage } = body;

    if (urlId === undefined || isUp === undefined) {
      return NextResponse.json(
        { error: 'urlId and isUp are required' },
        { status: 400 }
      );
    }

    // Verify URL exists
    const urlResult = await db.execute({
      sql: 'SELECT * FROM urls WHERE id = ?',
      args: [urlId],
    });

    if (urlResult.rows.length === 0) {
      return NextResponse.json({ error: 'URL not found' }, { status: 404 });
    }

    // Save browser check result to database
    const checkedAt = new Date().toISOString();
    await db.execute({
      sql: `
        INSERT INTO url_status (url_id, status_code, status_text, response_time, is_up, error_message, location, checked_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        urlId,
        statusCode || null,
        statusCode ? `HTTP ${statusCode}` : null,
        responseTime || null,
        isUp ? 1 : 0,
        errorMessage || null,
        null, // Browser checks don't detect redirects, so location is null
        checkedAt,
      ],
    });

    return NextResponse.json({
      success: true,
      message: 'Browser check result saved successfully',
    });
  } catch (error: any) {
    console.error('Error saving browser check result:', error);
    return NextResponse.json(
      { error: 'Failed to save browser check result', message: error.message },
      { status: 500 }
    );
  }
}

