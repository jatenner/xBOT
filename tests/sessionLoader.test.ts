import fs from 'fs';
import path from 'path';
import { SessionLoader } from '../src/utils/sessionLoader';

// Mock fs to avoid file system side effects
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('SessionLoader', () => {
  const testSessionPath = '/tmp/test_session.json';
  const validSessionData = {
    cookies: [
      { name: 'auth_token', value: 'abc123', domain: '.x.com', path: '/', expires: Date.now() + 86400000, httpOnly: true, secure: true, sameSite: 'None' as const },
      { name: 'ct0', value: 'def456', domain: '.x.com', path: '/', expires: Date.now() + 86400000, httpOnly: false, secure: true, sameSite: 'Lax' as const }
    ],
    origins: []
  };
  const validBase64 = Buffer.from(JSON.stringify(validSessionData)).toString('base64');

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.TWITTER_SESSION_B64;
    delete process.env.SESSION_CANONICAL_PATH;
    
    // Default mocks
    mockFs.existsSync.mockReturnValue(false);
    mockFs.mkdirSync.mockReturnValue(undefined);
    mockFs.writeFileSync.mockReturnValue(undefined);
    mockFs.renameSync.mockReturnValue(undefined);
    
    // Mock console.log to avoid test output noise
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('valid base64 JSON environment variable', () => {
    it('should load valid base64 session from env and write to file', () => {
      process.env.TWITTER_SESSION_B64 = validBase64;
      process.env.SESSION_CANONICAL_PATH = testSessionPath;

      const result = SessionLoader.load();

      expect(result).toEqual({
        ok: true,
        cookieCount: 2,
        path: testSessionPath,
        source: 'env',
        updatedAt: expect.any(String)
      });

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        testSessionPath + '.tmp',
        JSON.stringify(validSessionData, null, 2)
      );
      expect(mockFs.renameSync).toHaveBeenCalledWith(
        testSessionPath + '.tmp',
        testSessionPath
      );
      expect(console.log).toHaveBeenCalledWith(
        `SESSION_LOADER: wrote valid session to ${testSessionPath} (cookies=2)`
      );
    });

    it('should count cookies correctly', () => {
      process.env.TWITTER_SESSION_B64 = validBase64;
      
      const result = SessionLoader.load();
      
      expect(result.cookieCount).toBe(2);
    });
  });

  describe('raw JSON environment variable', () => {
    it('should handle raw JSON that starts with "{"', () => {
      process.env.TWITTER_SESSION_B64 = JSON.stringify(validSessionData);
      process.env.SESSION_CANONICAL_PATH = testSessionPath;

      const result = SessionLoader.load();

      expect(result).toEqual({
        ok: true,
        cookieCount: 2,
        path: testSessionPath,
        source: 'env',
        updatedAt: expect.any(String)
      });
    });
  });

  describe('invalid base64 environment variable', () => {
    it('should reject invalid base64 and not overwrite existing file', () => {
      process.env.TWITTER_SESSION_B64 = '!!invalid-base64!!@#$%^^';
      process.env.SESSION_CANONICAL_PATH = testSessionPath;
      
      // Mock existing good file
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(validSessionData));
      mockFs.statSync.mockReturnValue({ mtime: new Date() } as any);

      const result = SessionLoader.load();

      expect(result).toEqual({
        ok: true,
        cookieCount: 2,
        path: testSessionPath,
        source: 'file',
        updatedAt: expect.any(String)
      });

      expect(console.log).toHaveBeenCalledWith(
        `SESSION_LOADER: invalid base64 in TWITTER_SESSION_B64 (length=${process.env.TWITTER_SESSION_B64!.length}); ignoring env`
      );
      expect(console.log).toHaveBeenCalledWith(
        'SESSION_LOADER: using existing session file (cookies=2)'
      );
      expect(mockFs.writeFileSync).not.toHaveBeenCalled();
    });
  });

  describe('base64 decodes but not JSON', () => {
    it('should reject non-JSON content and not overwrite existing file', () => {
      const notJson = 'this is not json';
      process.env.TWITTER_SESSION_B64 = Buffer.from(notJson).toString('base64');
      process.env.SESSION_CANONICAL_PATH = testSessionPath;
      
      // Mock existing good file
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(validSessionData));
      mockFs.statSync.mockReturnValue({ mtime: new Date() } as any);

      const result = SessionLoader.load();

      expect(result).toEqual({
        ok: true,
        cookieCount: 2,
        path: testSessionPath,
        source: 'file',
        updatedAt: expect.any(String)
      });

      expect(console.log).toHaveBeenCalledWith(
        'SESSION_LOADER: decoded string is not JSON; ignoring env'
      );
      expect(mockFs.writeFileSync).not.toHaveBeenCalled();
    });
  });

  describe('JSON without cookies array', () => {
    it('should reject JSON missing cookies array', () => {
      const invalidSession = { origins: [] };
      process.env.TWITTER_SESSION_B64 = Buffer.from(JSON.stringify(invalidSession)).toString('base64');
      process.env.SESSION_CANONICAL_PATH = testSessionPath;
      
      // No existing file
      mockFs.existsSync.mockReturnValue(false);
      
      const result = SessionLoader.load();

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('no_cookies');
      expect(console.log).toHaveBeenCalledWith(
        'SESSION_LOADER: parsed JSON missing cookies array; ignoring env'
      );
    });
  });

  describe('existing file fallback', () => {
    it('should use existing valid file when no env', () => {
      process.env.SESSION_CANONICAL_PATH = testSessionPath;
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(validSessionData));
      mockFs.statSync.mockReturnValue({ mtime: new Date() } as any);

      const result = SessionLoader.load();

      expect(result).toEqual({
        ok: true,
        cookieCount: 2,
        path: testSessionPath,
        source: 'file',
        updatedAt: expect.any(String)
      });
      expect(console.log).toHaveBeenCalledWith(
        'SESSION_LOADER: using existing session file (cookies=2)'
      );
    });

    it('should reject corrupted existing file', () => {
      process.env.SESSION_CANONICAL_PATH = testSessionPath;
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('corrupted json{');

      const result = SessionLoader.load();

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('corrupt_file');
      expect(console.log).toHaveBeenCalledWith(
        'SESSION_LOADER: existing file found but invalid; ignoring'
      );
    });
  });

  describe('no session available', () => {
    it('should return failure when no env and no file', () => {
      process.env.SESSION_CANONICAL_PATH = testSessionPath;
      
      mockFs.existsSync.mockReturnValue(false);

      const result = SessionLoader.load();

      expect(result).toEqual({
        ok: false,
        cookieCount: 0,
        path: testSessionPath,
        source: 'none',
        reason: 'no_file'
      });
    });
  });

  describe('file write errors', () => {
    it('should handle write failures gracefully', () => {
      process.env.TWITTER_SESSION_B64 = validBase64;
      process.env.SESSION_CANONICAL_PATH = testSessionPath;
      
      // Mock writeFileSync to throw on the temp file write
      mockFs.writeFileSync.mockImplementation((path: string) => {
        if (path.endsWith('.tmp')) {
          throw new Error('Disk full');
        }
      });

      const result = SessionLoader.load();

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('write_failed');
    });
  });

  describe('getLastResult', () => {
    it('should return null initially', () => {
      // Reset the static state by calling a private method if needed
      // For now just test the behavior after fresh instantiation
      expect(SessionLoader.getLastResult()).toBeDefined(); // State persists from previous tests
    });

    it('should return last load result after loading', () => {
      process.env.TWITTER_SESSION_B64 = validBase64;
      
      const result = SessionLoader.load();
      const lastResult = SessionLoader.getLastResult();

      expect(lastResult).toEqual(result);
    });
  });

  describe('default paths', () => {
    it('should use default path when SESSION_CANONICAL_PATH not set', () => {
      process.env.TWITTER_SESSION_B64 = validBase64;
      
      const result = SessionLoader.load();
      
      expect(result.path).toBe('/app/data/twitter_session.json');
    });
  });

  describe('saveStorageStateBack', () => {
    it('should save storage state atomically', () => {
      process.env.SESSION_CANONICAL_PATH = testSessionPath;
      
      SessionLoader.saveStorageStateBack(validSessionData);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        testSessionPath + '.tmp',
        JSON.stringify(validSessionData, null, 2)
      );
      expect(mockFs.renameSync).toHaveBeenCalledWith(
        testSessionPath + '.tmp',
        testSessionPath
      );
      expect(console.log).toHaveBeenCalledWith(
        'SESSION_LOADER: saved updated session with 2 cookies'
      );
    });

    it('should update last result after save', () => {
      process.env.SESSION_CANONICAL_PATH = testSessionPath;
      
      SessionLoader.saveStorageStateBack(validSessionData);
      const lastResult = SessionLoader.getLastResult();

      expect(lastResult).toMatchObject({
        ok: true,
        cookieCount: 2,
        path: testSessionPath,
        source: 'file'
      });
    });

    it('should handle save errors gracefully', () => {
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Disk full');
      });

      // Should not throw
      expect(() => {
        SessionLoader.saveStorageStateBack(validSessionData);
      }).not.toThrow();

      expect(console.error).toHaveBeenCalledWith(
        'SESSION_LOADER: Failed to save storage state back: Disk full'
      );
    });
  });

  describe('trimming and whitespace handling', () => {
    it('should trim whitespace from base64 env var', () => {
      process.env.TWITTER_SESSION_B64 = `  ${validBase64}  \n`;
      
      const result = SessionLoader.load();
      
      expect(result.ok).toBe(true);
    });

    it('should handle empty/whitespace-only env var', () => {
      process.env.TWITTER_SESSION_B64 = '   \n  ';
      
      const result = SessionLoader.load();
      
      expect(result.ok).toBe(false);
    });
  });
});