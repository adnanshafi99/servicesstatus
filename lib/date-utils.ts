// Utility functions for handling dates in Beaumont, Texas timezone (America/Chicago)
const BEAUMONT_TIMEZONE = 'America/Chicago';

/**
 * Parse a date string from database (assumes UTC if no timezone info)
 */
function parseDate(date: Date | string): Date {
  if (typeof date === 'string') {
    // If the string doesn't have timezone info, assume it's UTC
    // SQLite stores dates in format: "YYYY-MM-DD HH:MM:SS" (UTC)
    let dateStr = date.trim();
    
    // If it doesn't end with Z or have timezone offset, treat as UTC
    if (!dateStr.endsWith('Z') && !dateStr.includes('+') && !dateStr.includes('-', 10)) {
      // Add Z to indicate UTC
      dateStr = dateStr.replace(' ', 'T') + 'Z';
    }
    
    return new Date(dateStr);
  }
  return date;
}

/**
 * Format a date to Beaumont, Texas timezone
 */
export function formatBeaumontDate(date: Date | string): string {
  const d = parseDate(date);
  
  return d.toLocaleString('en-US', {
    timeZone: BEAUMONT_TIMEZONE,
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

/**
 * Format a date to Beaumont timezone for display (short format)
 */
export function formatBeaumontDateShort(date: Date | string): string {
  const d = parseDate(date);
  
  return d.toLocaleString('en-US', {
    timeZone: BEAUMONT_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

/**
 * Format a date to Beaumont timezone for display (compact format)
 * Format: M/D/YYYY, HH:MM:SS AM/PM
 */
export function formatBeaumontDateCompact(date: Date | string): string {
  const d = parseDate(date);
  
  // Format as M/D/YYYY, HH:MM:SS AM/PM (matches the user's expected format)
  const formatted = d.toLocaleString('en-US', {
    timeZone: BEAUMONT_TIMEZONE,
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
  
  return formatted;
}

/**
 * Get current time in Beaumont timezone
 */
export function getBeaumontTime(): Date {
  const now = new Date();
  // Convert current UTC time to Central Time representation
  const centralTimeStr = now.toLocaleString('en-US', { 
    timeZone: BEAUMONT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  // Parse as Central Time
  const [datePart, timePart] = centralTimeStr.split(', ');
  const [month, day, year] = datePart.split('/');
  const [hour, minute, second] = timePart.split(':');
  
  // Create date in Central Time (this is just for representation)
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 
                  parseInt(hour), parseInt(minute), parseInt(second));
}

