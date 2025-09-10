/**
 * 🧪 DATABASE URL RESOLVER TESTS
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Database URL Resolver', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Clear relevant env vars
    delete process.env.DATABASE_URL;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_DB_PASSWORD;
    delete process.env.APP_ENV;
    delete process.env.STAGING_PROJECT_REF;
    delete process.env.PRODUCTION_PROJECT_REF;
    delete process.env.PROJECT_REF;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  test('uses existing DATABASE_URL when provided', () => {
    process.env.DATABASE_URL = 'postgresql://test:pass@host:5432/db';
    
    const { MigrationRunner } = require('../src/db/migrations');
    const runner = new MigrationRunner();
    
    // Should not attempt to build URL when DATABASE_URL is present
    expect(process.env.DATABASE_URL).toBe('postgresql://test:pass@host:5432/db');
  });

  test('builds URL from SUPABASE_URL and password', () => {
    process.env.SUPABASE_URL = 'https://abc123.supabase.co';
    process.env.SUPABASE_DB_PASSWORD = 'test_password';
    
    const { MigrationRunner } = require('../src/db/migrations');
    const runner = new MigrationRunner();
    
    const result = runner.buildDatabaseUrl();
    expect(result).toBe('postgresql://postgres:test_password@db.abc123.supabase.co:5432/postgres');
  });

  test('uses staging project ref when APP_ENV=staging', () => {
    process.env.APP_ENV = 'staging';
    process.env.SUPABASE_DB_PASSWORD = 'test_password';
    process.env.STAGING_PROJECT_REF = 'staging123';
    
    const { MigrationRunner } = require('../src/db/migrations');
    const runner = new MigrationRunner();
    
    const result = runner.buildDatabaseUrl();
    expect(result).toBe('postgresql://postgres:test_password@db.staging123.supabase.co:5432/postgres');
  });

  test('uses production project ref when APP_ENV=production', () => {
    process.env.APP_ENV = 'production';
    process.env.SUPABASE_DB_PASSWORD = 'test_password';
    process.env.PRODUCTION_PROJECT_REF = 'prod123';
    
    const { MigrationRunner } = require('../src/db/migrations');
    const runner = new MigrationRunner();
    
    const result = runner.buildDatabaseUrl();
    expect(result).toBe('postgresql://postgres:test_password@db.prod123.supabase.co:5432/postgres');
  });

  test('falls back to PROJECT_REF when env-specific ref not found', () => {
    process.env.APP_ENV = 'development';
    process.env.SUPABASE_DB_PASSWORD = 'test_password';
    process.env.PROJECT_REF = 'fallback123';
    
    const { MigrationRunner } = require('../src/db/migrations');
    const runner = new MigrationRunner();
    
    const result = runner.buildDatabaseUrl();
    expect(result).toBe('postgresql://postgres:test_password@db.fallback123.supabase.co:5432/postgres');
  });

  test('returns null when no password provided', () => {
    process.env.APP_ENV = 'production';
    process.env.PRODUCTION_PROJECT_REF = 'prod123';
    // No password
    
    const { MigrationRunner } = require('../src/db/migrations');
    const runner = new MigrationRunner();
    
    const result = runner.buildDatabaseUrl();
    expect(result).toBeNull();
  });

  test('returns null when no project ref found', () => {
    process.env.SUPABASE_DB_PASSWORD = 'test_password';
    // No project refs
    
    const { MigrationRunner } = require('../src/db/migrations');
    const runner = new MigrationRunner();
    
    const result = runner.buildDatabaseUrl();
    expect(result).toBeNull();
  });

  test('prefers SUPABASE_URL over project refs', () => {
    process.env.SUPABASE_URL = 'https://direct123.supabase.co';
    process.env.SUPABASE_DB_PASSWORD = 'test_password';
    process.env.PRODUCTION_PROJECT_REF = 'prod123'; // Should be ignored
    
    const { MigrationRunner } = require('../src/db/migrations');
    const runner = new MigrationRunner();
    
    const result = runner.buildDatabaseUrl();
    expect(result).toBe('postgresql://postgres:test_password@db.direct123.supabase.co:5432/postgres');
  });

  test('defaults APP_ENV to production', () => {
    // No APP_ENV set
    process.env.SUPABASE_DB_PASSWORD = 'test_password';
    process.env.PRODUCTION_PROJECT_REF = 'prod123';
    
    const { MigrationRunner } = require('../src/db/migrations');
    const runner = new MigrationRunner();
    
    const result = runner.buildDatabaseUrl();
    expect(result).toBe('postgresql://postgres:test_password@db.prod123.supabase.co:5432/postgres');
  });
});
