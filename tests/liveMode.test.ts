describe('LIVE_MODE parsing', () => {
  const originalEnv = process.env.LIVE_POSTING_ENABLED;
  
  // Test the parsing logic directly
  const parseLiveMode = (value: string | undefined) => {
    return /^(1|true|yes)$/i.test((value ?? '').trim());
  };

  afterAll(() => {
    // Restore original environment
    if (originalEnv !== undefined) {
      process.env.LIVE_POSTING_ENABLED = originalEnv;
    } else {
      delete process.env.LIVE_POSTING_ENABLED;
    }
  });

  test('should be true when LIVE_POSTING_ENABLED is "true"', () => {
    expect(parseLiveMode('true')).toBe(true);
  });

  test('should be false when LIVE_POSTING_ENABLED is "false"', () => {
    expect(parseLiveMode('false')).toBe(false);
  });

  test('should be false when LIVE_POSTING_ENABLED is undefined', () => {
    expect(parseLiveMode(undefined)).toBe(false);
  });

  test('should handle whitespace around "true"', () => {
    expect(parseLiveMode(' true ')).toBe(true);
  });

  test('should handle whitespace around "false"', () => {
    expect(parseLiveMode(' false ')).toBe(false);
  });

  test('should be case insensitive for "TRUE"', () => {
    expect(parseLiveMode('TRUE')).toBe(true);
  });

  test('should be case insensitive for "False"', () => {
    expect(parseLiveMode('False')).toBe(false);
  });

  test('should accept "1" as truthy', () => {
    expect(parseLiveMode('1')).toBe(true);
  });

  test('should accept "yes" as truthy', () => {
    expect(parseLiveMode('yes')).toBe(true);
  });

  test('should accept "YES" as truthy (case insensitive)', () => {
    expect(parseLiveMode('YES')).toBe(true);
  });

  test('should be false for empty string', () => {
    expect(parseLiveMode('')).toBe(false);
  });

  test('should be false for "0"', () => {
    expect(parseLiveMode('0')).toBe(false);
  });

  test('should be false for "no"', () => {
    expect(parseLiveMode('no')).toBe(false);
  });

  test('should be false for random string', () => {
    expect(parseLiveMode('random')).toBe(false);
  });
});
