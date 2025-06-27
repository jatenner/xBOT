describe('LIVE_MODE configuration', () => {
  const originalEnv = process.env.LIVE_POSTING_ENABLED;
  
  afterEach(() => {
    // Clean up modules cache to test fresh imports
    jest.resetModules();
    // Restore original environment
    if (originalEnv !== undefined) {
      process.env.LIVE_POSTING_ENABLED = originalEnv;
    } else {
      delete process.env.LIVE_POSTING_ENABLED;
    }
  });

  it('should return true when LIVE_POSTING_ENABLED is "true"', () => {
    process.env.LIVE_POSTING_ENABLED = 'true';
    
    const { LIVE_MODE } = require('../src/config/liveMode');
    
    expect(LIVE_MODE).toBe(true);
  });

  it('should return false when LIVE_POSTING_ENABLED is "false"', () => {
    process.env.LIVE_POSTING_ENABLED = 'false';
    
    const { LIVE_MODE } = require('../src/config/liveMode');
    
    expect(LIVE_MODE).toBe(false);
  });

  it('should return false when LIVE_POSTING_ENABLED is undefined', () => {
    delete process.env.LIVE_POSTING_ENABLED;
    
    const { LIVE_MODE } = require('../src/config/liveMode');
    
    expect(LIVE_MODE).toBe(false);
  });

  it('should trim whitespace and handle " true "', () => {
    process.env.LIVE_POSTING_ENABLED = ' true ';
    
    const { LIVE_MODE } = require('../src/config/liveMode');
    
    expect(LIVE_MODE).toBe(true);
  });

  it('should trim whitespace and handle " false "', () => {
    process.env.LIVE_POSTING_ENABLED = ' false ';
    
    const { LIVE_MODE } = require('../src/config/liveMode');
    
    expect(LIVE_MODE).toBe(false);
  });

  it('should be case insensitive for "TRUE"', () => {
    process.env.LIVE_POSTING_ENABLED = 'TRUE';
    
    const { LIVE_MODE } = require('../src/config/liveMode');
    
    expect(LIVE_MODE).toBe(true);
  });

  it('should be case insensitive for "False"', () => {
    process.env.LIVE_POSTING_ENABLED = 'False';
    
    const { LIVE_MODE } = require('../src/config/liveMode');
    
    expect(LIVE_MODE).toBe(false);
  });

  it('should return false for "1"', () => {
    process.env.LIVE_POSTING_ENABLED = '1';
    
    const { LIVE_MODE } = require('../src/config/liveMode');
    
    expect(LIVE_MODE).toBe(false);
  });

  it('should return false for "yes"', () => {
    process.env.LIVE_POSTING_ENABLED = 'yes';
    
    const { LIVE_MODE } = require('../src/config/liveMode');
    
    expect(LIVE_MODE).toBe(false);
  });

  it('should return false for empty string', () => {
    process.env.LIVE_POSTING_ENABLED = '';
    
    const { LIVE_MODE } = require('../src/config/liveMode');
    
    expect(LIVE_MODE).toBe(false);
  });
});
