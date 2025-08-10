// 🚨 EMERGENCY: Ultra-minimal browser for Railway memory limits
export const emergencyBrowserConfig = {
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--disable-web-security',
    '--disable-features=TranslateUI',
    '--disable-extensions',
    '--disable-plugins',
    '--disable-images',
    '--disable-javascript',
    '--disable-web-fonts',
    '--disable-default-apps',
    '--memory-pressure-off',
    '--max_old_space_size=120', // ULTRA-LOW memory for browser
    '--no-zygote',
    '--single-process'
  ],
  defaultViewport: { width: 800, height: 600 }, // Minimal viewport
  timeout: 30000 // Fast timeout
};

export const EMERGENCY_MEMORY_LIMIT = 120; // MB for browser
