const { DatabaseUrlResolver } = require('../src/db/databaseUrlResolver');
const fs = require('fs');

// Mock fs module
jest.mock('fs');

describe('DatabaseUrlResolver', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    // Clear environment
    delete process.env.DATABASE_URL;
    delete process.env.DB_SSL_MODE;
    delete process.env.DB_SSL_ROOT_CERT_PATH;
    delete process.env.SUPABASE_DB_PASSWORD;
    delete process.env.SUPABASE_URL;
    
    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('SSL Mode Configuration', () => {
    it('should add sslmode=require when missing from DATABASE_URL', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/db';
      
      const config = DatabaseUrlResolver.buildDatabaseConfig();
      
      expect(config.connectionString).toBe('postgresql://user:pass@host:5432/db?sslmode=require');
      expect(config.sslMode).toBe('require');
      expect(config.ssl.rejectUnauthorized).toBe(true);
    });

    it('should not modify DATABASE_URL when sslmode already present', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/db?sslmode=disable';
      
      const config = DatabaseUrlResolver.buildDatabaseConfig();
      
      expect(config.connectionString).toBe('postgresql://user:pass@host:5432/db?sslmode=disable');
    });

    it('should honor DB_SSL_MODE=no-verify', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/db';
      process.env.DB_SSL_MODE = 'no-verify';
      
      const config = DatabaseUrlResolver.buildDatabaseConfig();
      
      expect(config.connectionString).toBe('postgresql://user:pass@host:5432/db?sslmode=no-verify');
      expect(config.sslMode).toBe('no-verify');
      expect(config.ssl.rejectUnauthorized).toBe(false);
    });
  });

  describe('Root CA Certificate Handling', () => {
    it('should use root CA when DB_SSL_ROOT_CERT_PATH exists', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/db';
      process.env.DB_SSL_ROOT_CERT_PATH = '/path/to/ca.crt';
      
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('-----BEGIN CERTIFICATE-----\ntest-cert\n-----END CERTIFICATE-----');
      
      const config = DatabaseUrlResolver.buildDatabaseConfig();
      
      expect(config.ssl.ca).toBe('-----BEGIN CERTIFICATE-----\ntest-cert\n-----END CERTIFICATE-----');
      expect(config.ssl.rejectUnauthorized).toBe(true);
      expect(config.usingRootCA).toBe(true);
    });

    it('should fallback when root CA file does not exist', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/db';
      process.env.DB_SSL_ROOT_CERT_PATH = '/nonexistent/ca.crt';
      
      fs.existsSync.mockReturnValue(false);
      
      const config = DatabaseUrlResolver.buildDatabaseConfig();
      
      expect(config.ssl.ca).toBeUndefined();
      expect(config.ssl.rejectUnauthorized).toBe(true);
      expect(config.usingRootCA).toBe(false);
    });

    it('should fallback when root CA file read fails', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/db';
      process.env.DB_SSL_ROOT_CERT_PATH = '/path/to/ca.crt';
      
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });
      
      const config = DatabaseUrlResolver.buildDatabaseConfig();
      
      expect(config.ssl.ca).toBeUndefined();
      expect(config.ssl.rejectUnauthorized).toBe(true);
      expect(config.usingRootCA).toBe(false);
    });
  });

  describe('Pooler Detection', () => {
    it('should detect Supabase Session Pooler', () => {
      process.env.DATABASE_URL = 'postgresql://postgres:pass@aws-0-us-east-1.pooler.supabase.com:5432/postgres';
      
      const config = DatabaseUrlResolver.buildDatabaseConfig();
      
      expect(config.usingPoolerHost).toBe(true);
    });

    it('should detect transaction pooler', () => {
      process.env.DATABASE_URL = 'postgresql://postgres:pass@host.db.pooler.supabase.com:5432/postgres';
      
      const config = DatabaseUrlResolver.buildDatabaseConfig();
      
      expect(config.usingPoolerHost).toBe(true);
    });

    it('should not detect pooler for direct connection', () => {
      process.env.DATABASE_URL = 'postgresql://postgres:pass@db.project.supabase.co:5432/postgres';
      
      const config = DatabaseUrlResolver.buildDatabaseConfig();
      
      expect(config.usingPoolerHost).toBe(false);
    });
  });

  describe('Error Guidance', () => {
    it('should provide TLS certificate guidance', () => {
      const error = new Error('self-signed certificate in certificate chain');
      
      const guidance = DatabaseUrlResolver.getConnectionErrorGuidance(error);
      
      expect(guidance).toContain('TLS Certificate Error');
      expect(guidance).toContain('DB_SSL_ROOT_CERT_PATH');
      expect(guidance).toContain('DB_SSL_MODE=no-verify');
    });

    it('should provide network guidance for IPv6 errors', () => {
      const error = new Error('ENETUNREACH');
      
      const guidance = DatabaseUrlResolver.getConnectionErrorGuidance(error);
      
      expect(guidance).toContain('Network Error');
      expect(guidance).toContain('Session Pooler');
      expect(guidance).toContain('pooler.supabase.com');
    });

    it('should provide auth guidance for password errors', () => {
      const error = new Error('password authentication failed');
      
      const guidance = DatabaseUrlResolver.getConnectionErrorGuidance(error);
      
      expect(guidance).toContain('Auth Error');
      expect(guidance).toContain('SUPABASE_DB_PASSWORD');
    });

    it('should provide timeout guidance for connection timeouts', () => {
      const error = new Error('connection timeout');
      
      const guidance = DatabaseUrlResolver.getConnectionErrorGuidance(error);
      
      expect(guidance).toContain('Connection Timeout');
      expect(guidance).toContain('Session Pooler');
    });
  });

  describe('Legacy URL Building', () => {
    it('should build URL from SUPABASE_URL and password', () => {
      process.env.SUPABASE_URL = 'https://abc123.supabase.co';
      process.env.SUPABASE_DB_PASSWORD = 'secret123';
      
      const config = DatabaseUrlResolver.buildDatabaseConfig();
      
      expect(config.connectionString).toContain('postgresql://postgres:secret123@aws-0-us-east-1.pooler.supabase.com:5432/postgres');
      expect(config.usingPoolerHost).toBe(true);
    });

    it('should build URL from APP_ENV specific project ref', () => {
      process.env.APP_ENV = 'staging';
      process.env.STAGING_PROJECT_REF = 'staging-ref-123';
      process.env.SUPABASE_DB_PASSWORD = 'secret123';
      
      const config = DatabaseUrlResolver.buildDatabaseConfig();
      
      expect(config.connectionString).toContain('postgresql://postgres:secret123@aws-0-us-east-1.pooler.supabase.com:5432/postgres');
      expect(config.usingPoolerHost).toBe(true);
    });

    it('should fallback to generic PROJECT_REF', () => {
      process.env.PROJECT_REF = 'generic-ref-123';
      process.env.SUPABASE_DB_PASSWORD = 'secret123';
      
      const config = DatabaseUrlResolver.buildDatabaseConfig();
      
      expect(config.connectionString).toContain('postgresql://postgres:secret123@aws-0-us-east-1.pooler.supabase.com:5432/postgres');
      expect(config.usingPoolerHost).toBe(true);
    });

    it('should throw when no DATABASE_URL and missing password', () => {
      delete process.env.SUPABASE_DB_PASSWORD;
      
      expect(() => DatabaseUrlResolver.buildDatabaseConfig()).toThrow('DATABASE_URL required');
    });
  });
});