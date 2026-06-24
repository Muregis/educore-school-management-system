/**
 * Missing database object detection utility
 * Use this to gracefully handle cases where tables or columns haven't been created yet.
 */

export function isMissingTableError(error) {
  const message = String(error?.message || '').toLowerCase();
  return (
    error?.code === '42P01' ||            // PostgreSQL: table does not exist
    error?.code === '42703' ||            // PostgreSQL: column does not exist
    error?.code === 'PGRST205' ||         // PostgREST: relation/table not found
    message.includes('does not exist') ||
    message.includes('could not find the table') ||
    message.includes('could not find the column')
  );
}

export function handleMissingTable(error, fallbackValue = null) {
  if (isMissingTableError(error)) {
    return fallbackValue;
  }
  throw error;
}
