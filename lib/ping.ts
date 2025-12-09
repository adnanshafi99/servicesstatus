import { db } from './db';
import type { Url } from './types';

export async function pingUrl(urlObj: Url): Promise<{
  status_code: number | null;
  status_text: string | null;
  response_time_ms: number;
  is_up: boolean;
  is_redirect: boolean;
  location: string | null;
  checked_at: string;
  error_message: string | null;
  needs_browser_fallback?: boolean; // True if network error suggests campus restriction
}> {
  const startTime = Date.now();
  const checkedAt = new Date().toISOString();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    // Try HEAD first, fallback to GET if HEAD fails
    let response: Response;
    try {
      response = await fetch(urlObj.url, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'manual', // Don't follow redirects automatically
        headers: {
          'User-Agent': 'URL-Monitor/1.0',
        },
      });
    } catch (headError) {
      // Fallback to GET if HEAD fails or is unsupported
      response = await fetch(urlObj.url, {
        method: 'GET',
        signal: controller.signal,
        redirect: 'manual',
        headers: {
          'User-Agent': 'URL-Monitor/1.0',
        },
      });
    }

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    const status = response.status;
    const isRedirect = [301, 302, 303, 307, 308].includes(status);
    // Treat 2xx and 3xx (including 301/302) as "up"
    const isUp = status >= 200 && status < 400;
    const location = response.headers.get('location');

    return {
      status_code: status,
      status_text: response.statusText,
      response_time_ms: responseTime,
      is_up: isUp,
      is_redirect: isRedirect,
      location: location,
      checked_at: checkedAt,
      error_message: null,
    };
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error.message || 'Timeout or network error';
    
    // Detect network connectivity issues that might indicate campus restrictions
    // These errors suggest the server can't reach the URL, but browser might be able to
    const networkErrors = [
      'fetch failed',
      'networkerror',
      'timeout',
      'aborted',
      'econnrefused',
      'enotfound',
      'etimedout',
      'socket hang up',
      'connection refused',
      'dns',
    ];
    
    const needsBrowserFallback = networkErrors.some(err => 
      errorMessage.toLowerCase().includes(err.toLowerCase())
    ) || error.name === 'AbortError' || error.name === 'TypeError';
    
    return {
      status_code: null,
      status_text: null,
      response_time_ms: responseTime,
      is_up: false,
      is_redirect: false,
      location: null,
      checked_at: checkedAt,
      error_message: errorMessage,
      needs_browser_fallback: needsBrowserFallback,
    };
  }
}

export async function checkUrl(urlId: number): Promise<{
  status_code: number | null;
  status_text: string | null;
  response_time_ms: number;
  is_up: boolean;
  is_redirect: boolean;
  location: string | null;
  checked_at: string;
  error_message: string | null;
  needs_browser_fallback?: boolean;
}> {
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
    
    // Only save to database if server-side check succeeded
    // If it needs browser fallback, don't save yet - let browser check save it
    if (!result.needs_browser_fallback) {
      await db.execute({
        sql: `
          INSERT INTO url_status (url_id, status_code, status_text, response_time, is_up, error_message, location, checked_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          urlObj.id,
          result.status_code,
          result.status_text,
          result.response_time_ms,
          result.is_up ? 1 : 0,
          result.error_message,
          result.location,
          result.checked_at,
        ],
      });
    }

    return result;
  } catch (error) {
    console.error(`Error checking URL ${urlId}:`, error);
    throw error;
  }
}

export async function checkAllUrls(): Promise<Array<{
  urlId: number;
  status_code: number | null;
  status_text: string | null;
  response_time_ms: number;
  is_up: boolean;
  is_redirect: boolean;
  location: string | null;
  checked_at: string;
  error_message: string | null;
}>> {
  const results = [];
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
      
      // Only save to database if server-side check succeeded
      // If it needs browser fallback, don't save yet - let browser check save it
      if (!result.needs_browser_fallback) {
        await db.execute({
          sql: `
            INSERT INTO url_status (url_id, status_code, status_text, response_time, is_up, error_message, location, checked_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
          args: [
            urlObj.id,
            result.status_code,
            result.status_text,
            result.response_time_ms,
            result.is_up ? 1 : 0,
            result.error_message,
            result.location,
            result.checked_at,
          ],
        });
      }

      results.push({
        urlId: urlObj.id,
        ...result,
      });
    }
    return results;
  } catch (error) {
    console.error('Error checking URLs:', error);
    throw error;
  }
}

//end