import { archiveOldStatusRecords, getArchivedStatusRecords } from './archive';
import { db } from './db';

/**
 * Export archived records to a text file format
 * Returns the file content as a string
 */
export async function exportArchivedRecordsToText(): Promise<string> {
  try {
    // Initialize database to ensure archive table exists
    const { initDatabase } = await import('./db');
    await initDatabase();
    
    // Get all archived records, grouped by URL
    const urlsResult = await db.execute('SELECT id, name, url FROM urls ORDER BY name');
    
    let fileContent = 'URL Status Archive - Generated ' + new Date().toISOString() + '\n';
    fileContent += '='.repeat(80) + '\n\n';

    let totalArchivedRecords = 0;

    for (const urlRow of urlsResult.rows) {
      const urlId = Number(urlRow.id);
      const urlName = urlRow.name as string;
      const url = urlRow.url as string;

      // Get all archived records for this URL
      const archivedRecords = await getArchivedStatusRecords(urlId, 10000); // Get all records

      if (archivedRecords.length > 0) {
        totalArchivedRecords += archivedRecords.length;
        fileContent += `\nURL: ${urlName}\n`;
        fileContent += `Link: ${url}\n`;
        fileContent += `Total Archived Records: ${archivedRecords.length}\n`;
        fileContent += '-'.repeat(80) + '\n';
        fileContent += 'Timestamp (CT)'.padEnd(25) + ' | ' +
                      'Status'.padEnd(8) + ' | ' +
                      'Code'.padEnd(6) + ' | ' +
                      'Response Time'.padEnd(15) + ' | ' +
                      'Error\n';
        fileContent += '-'.repeat(80) + '\n';

        for (const record of archivedRecords) {
          // Parse date correctly (assume UTC if no timezone)
          let dateStr = record.checked_at.trim();
          if (!dateStr.endsWith('Z') && !dateStr.includes('+') && !dateStr.includes('-', 10)) {
            dateStr = dateStr.replace(' ', 'T') + 'Z';
          }
          const date = new Date(dateStr);
          
          const timestamp = date.toLocaleString('en-US', {
            timeZone: 'America/Chicago',
            month: 'numeric',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
          });

          const status = record.is_up ? 'UP' : 'DOWN';
          const statusCode = record.status_code?.toString() || 'N/A';
          const responseTime = record.response_time ? `${record.response_time}ms` : 'N/A';
          const error = record.error_message || '-';

          fileContent += timestamp.padEnd(25) + ' | ' +
                        status.padEnd(8) + ' | ' +
                        statusCode.padEnd(6) + ' | ' +
                        responseTime.padEnd(15) + ' | ' +
                        error + '\n';
        }

        fileContent += '\n';
      }
    }

    fileContent += '\n' + '='.repeat(80) + '\n';
    fileContent += `End of Archive - Total URLs: ${urlsResult.rows.length}\n`;
    fileContent += `Total Archived Records: ${totalArchivedRecords}\n`;

    if (totalArchivedRecords === 0) {
      fileContent += '\nNote: No archived records found. Records are automatically archived after 7 days.\n';
    }

    return fileContent;
  } catch (error) {
    console.error('Error exporting archived records:', error);
    throw error;
  }
}

/**
 * Archive old records and optionally export to file
 */
export async function archiveAndExport(): Promise<{
  archived: number;
  exported: boolean;
  fileContent?: string;
}> {
  // First, archive old records
  const archiveResult = await archiveOldStatusRecords();

  // If there are archived records, export them
  let fileContent: string | undefined;
  if (archiveResult.archived > 0) {
    fileContent = await exportArchivedRecordsToText();
  }

  return {
    archived: archiveResult.archived,
    exported: !!fileContent,
    fileContent,
  };
}

