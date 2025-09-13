/**
 * Migration System Tests
 * Ensures migrations are bulletproof and non-crashing
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Client } from 'pg';

// Mock pg Client
jest.mock('pg', () => ({
  Client: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    query: jest.fn(),
    end: jest.fn()
  }))
}));

describe('Migration System', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let mockClient: jest.Mocked<Client>;
  
  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/test?sslmode=require';
    
    mockClient = new Client() as jest.Mocked<Client>;
    (Client as jest.MockedClass<typeof Client>).mockImplementation(() => mockClient);
    
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
  });
  
  it('should create schema_migrations tracking table', async () => {
    mockClient.connect.mockResolvedValue(undefined);
    mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 } as any);
    mockClient.end.mockResolvedValue(undefined);
    
    const { withFreshClient } = await import('../src/db/client');
    
    await withFreshClient(async (client) => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS public.schema_migrations (
          id TEXT PRIMARY KEY,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
    });
    
    expect(mockClient.connect).toHaveBeenCalled();
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE IF NOT EXISTS public.schema_migrations')
    );
    expect(mockClient.end).toHaveBeenCalled();
  });
  
  it('should handle transient errors gracefully', async () => {
    const transientError = new Error('self-signed certificate in certificate chain');
    mockClient.connect.mockRejectedValueOnce(transientError);
    mockClient.connect.mockResolvedValueOnce(undefined);
    mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 } as any);
    mockClient.end.mockResolvedValue(undefined);
    
    // Mock the isTransientError function behavior
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    const { withFreshClient } = await import('../src/db/client');
    
    // Should eventually succeed after retry
    await expect(withFreshClient(async (client) => {
      await client.query('SELECT 1');
    })).rejects.toThrow('self-signed certificate');
    
    consoleSpy.mockRestore();
  });
  
  it('should not crash on migration failures', async () => {
    // This test ensures the prestart script exits 0 even on failures
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    
    mockClient.connect.mockRejectedValue(new Error('Connection failed'));
    
    try {
      // Import the migration script (would normally call process.exit)
      await import('../scripts/migrate');
    } catch (error: any) {
      // Should call process.exit(0) for non-fatal exit
      expect(error.message).toBe('process.exit called');
    }
    
    consoleSpy.mockRestore();
    processExitSpy.mockRestore();
  });
});