/**
 * 🧪 MIGRATION RUNNER TESTS
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import MigrationRunner from '../src/db/migrations';

describe('Migration Runner', () => {
  test('migration runner initializes correctly', () => {
    const runner = new MigrationRunner();
    expect(runner).toBeInstanceOf(MigrationRunner);
  });

  test('migration tracking table creation is idempotent', async () => {
    // Mock PG client
    const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
    const runner = new MigrationRunner();
    (runner as any).pgClient = { query: mockQuery };

    await (runner as any).ensureMigrationsTable();
    await (runner as any).ensureMigrationsTable();

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE IF NOT EXISTS')
    );
  });

  test('calculates checksums consistently', () => {
    const runner = new MigrationRunner();
    const content = 'CREATE TABLE test (id int);';
    
    const checksum1 = (runner as any).calculateChecksum(content);
    const checksum2 = (runner as any).calculateChecksum(content);
    
    expect(checksum1).toBe(checksum2);
    expect(checksum1).toHaveLength(16);
  });

  test('migration files are sorted correctly', async () => {
    const runner = new MigrationRunner();
    
    // Mock fs.readdirSync
    const mockFiles = ['0003_test.sql', '0001_init.sql', '0002_update.sql'];
    vi.spyOn(require('fs'), 'readdirSync').mockReturnValue(mockFiles);
    vi.spyOn(require('fs'), 'existsSync').mockReturnValue(true);
    
    const sortedFiles = await (runner as any).getMigrationFiles();
    
    expect(sortedFiles).toEqual(['0001_init.sql', '0002_update.sql', '0003_test.sql']);
  });
});
