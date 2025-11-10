import { withFreshClient } from './client';

export async function executeSql(sql: string, label?: string): Promise<void> {
  await withFreshClient(async (client) => {
    try {
      await client.query(sql);
    } catch (error) {
      if (label) {
        console.error(`❌ SQL_EXECUTION_FAILED (${label}):`, error instanceof Error ? error.message : error);
      }
      throw error;
    }
  });
}

export async function executeStatements(statements: string[], label?: string): Promise<void> {
  for (const statement of statements) {
    const trimmed = statement.trim();
    if (!trimmed) continue;
    await executeSql(trimmed, label);
  }
}

