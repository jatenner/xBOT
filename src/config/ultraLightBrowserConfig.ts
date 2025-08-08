/**
 * 🚨 ULTRA-LIGHTWEIGHT BROWSER CONFIG FOR RAILWAY
 * Extreme memory optimization for 512MB Railway containers
 */

// Detect if we're on Railway/Alpine Linux
const isRailway = process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production';
const alpineExecutablePath = isRailway ? '/usr/bin/chromium-browser' : undefined;

export const ULTRA_LIGHT_BROWSER_OPTIONS = {
    headless: true,
    executablePath: alpineExecutablePath,
    args: [
        // Memory optimization (CRITICAL for Railway)
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--memory-pressure-off',
        '--max_old_space_size=256',
        
        // Disable unnecessary features
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images',
        '--disable-javascript',
        '--disable-default-apps',
        '--disable-background-networking',
        '--disable-sync',
        '--disable-translate',
        '--hide-scrollbars',
        '--mute-audio',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-gpu',
        '--disable-software-rasterizer',
        
        // Railway-specific optimizations
        '--single-process',
        '--no-zygote',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--user-data-dir=/tmp/chrome-user-data',
        
        // Ultra minimal window
        '--window-size=800,600',
        '--disable-blink-features=AutomationControlled'
    ],
    
    // Minimal timeouts
    timeout: 15000,
    
    // Railway memory limits
    chromiumSandbox: false,
    ignoreDefaultArgs: ['--disable-extensions']
};

export const EMERGENCY_BROWSER_OPTIONS = {
    headless: true,
    executablePath: alpineExecutablePath,
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox', 
        '--disable-dev-shm-usage',
        '--single-process',
        '--no-zygote',
        '--memory-pressure-off',
        '--max_old_space_size=128',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images',
        '--disable-default-apps',
        '--window-size=400,300'
    ],
    timeout: 10000,
    chromiumSandbox: false
};