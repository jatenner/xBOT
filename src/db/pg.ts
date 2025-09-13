/**
 * Legacy compatibility - use src/db/client.ts for new code
 * @deprecated Use pool from src/db/client.ts instead
 */

import { pool } from './client';

// Re-export for backward compatibility
export const pgPool = pool;