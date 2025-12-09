import { db } from './db';
import type { Url } from './types';

export async function pingUrl(urlObj: Url): Promise<{
  status_code: number | null;
  status_text: string | null;
  response_time: number | null;
  is_up: boolean;
  error_message: string | null;
}> {
  const startTime = Date.now();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(urlObj.url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'URL-Monitor/1.0',
      },
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    return {
      status_code: response.status,
      status_text: response.statusText,
      response_time: responseTime,
      is_up: response.ok,
      error_message: null,
    };
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    
    return {
      status_code: null,
      status_text: null,
      response_time: responseTime,
      is_up: false,
      error_message: error.message || 'Unknown error',
    };
  }
}

export async function checkUrl(urlId: number): Promise<void> {
  try {
    const urlResult = await db.execute({
      sql: 'SELECT * FROM urls WHERE id = ?',
      args: [urlId],
    });

    if (urlResult.rows.length === 0) {
      throw new Error(`URL with id ${urlId} not found`);
    }

    const row = urlResult.rows[0];
    const urlObj: Url = {
      id: Number(row.id),
      url: row.url as string,
      name: row.name as string,
      environment: (row.environment as "testing" | "production") || "testing",
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    };

    const result = await pingUrl(urlObj);
    
    await db.execute({
      sql: `
        INSERT INTO url_status (url_id, status_code, status_text, response_time, is_up, error_message)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      args: [
        urlObj.id,
        result.status_code,
        result.status_text,
        result.response_time,
        result.is_up ? 1 : 0,
        result.error_message,
      ],
    });
  } catch (error) {
    console.error(`Error checking URL ${urlId}:`, error);
    throw error;
  }
}

export async function checkAllUrls(): Promise<void> {
  try {
    const urls = await db.execute({
      sql: 'SELECT * FROM urls',
      args: [],
    });
    
    for (const row of urls.rows) {
      const urlObj: Url = {
        id: Number(row.id),
        url: row.url as string,
        name: row.name as string,
        environment: (row.environment as "testing" | "production") || "testing",
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
      };

      const result = await pingUrl(urlObj);
      
      await db.execute({
        sql: `
          INSERT INTO url_status (url_id, status_code, status_text, response_time, is_up, error_message)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        args: [
          urlObj.id,
          result.status_code,
          result.status_text,
          result.response_time,
          result.is_up ? 1 : 0,
          result.error_message,
        ],
      });
    }
  } catch (error) {
    console.error('Error checking URLs:', error);
    throw error;
  }
}

//end