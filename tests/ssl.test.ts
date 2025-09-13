/**
 * SSL Configuration Tests
 * Ensures production SSL is always verified
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('SSL Configuration', () => {
  let originalEnv: NodeJS.ProcessEnv;
  
  beforeEach(() => {
    originalEnv = { ...process.env };
  });
  
  afterEach(() => {
    process.env = originalEnv;
    // Clear module cache to reset imports
    jest.resetModules();
  });
  
  it('should use verified SSL in production', async () => {
    process.env.APP_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://user:pass@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require';
    
    // Mock console.log to capture SSL config logs
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    
    // Import after setting env vars
    const { pool } = await import('../src/db/client');
    
    // Should log verified SSL configuration
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[DB_SSL] mode=require, nodeTLS.rejectUnauthorized=true, CA=system')
    );
    
    consoleSpy.mockRestore();
  });
  
  it('should ignore insecure environment variables in production', async () => {
    process.env.APP_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/test?sslmode=require';
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    process.env.SSL_CERT_FILE = '/some/cert/path';
    process.env.PGSSLROOTCERT = '/some/root/cert';
    
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    
    // Import after setting env vars
    await import('../src/db/client');
    
    // Should log security errors for insecure vars
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('NODE_TLS_REJECT_UNAUTHORIZED is set in production - ignoring for security')
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('SSL_CERT_FILE is set in production - ignoring for security')
    );
    
    consoleErrorSpy.mockRestore();
  });
  
  it('should allow flexible SSL in development', async () => {
    process.env.APP_ENV = 'development';
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/test';
    
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    
    // Import after setting env vars
    await import('../src/db/client');
    
    // Should log development mode
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Development mode, SSL config: flexible')
    );
    
    consoleSpy.mockRestore();
  });
});
