

export const EMERGENCY_BROWSER_OPTIONS = {
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--single-process',
    '--no-zygote',
    '--memory-pressure-off',
    '--max_old_space_size=128', // Extremely low
    '--disable-gpu',
    '--disable-software-rasterizer',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-extensions',
    '--disable-plugins',
    '--disable-images',
    '--disable-javascript', // Disable JS for minimal memory
    '--disable-default-apps',
    '--disable-background-networking',
    '--window-size=400,300', // Minimal window
    '--disable-features=VizDisplayCompositor,TranslateUI',
    '--disable-ipc-flooding-protection',
    '--user-data-dir=/tmp/minimal-chrome'
  ],
  timeout: 8000, // Shorter timeout
  chromiumSandbox: false
};

export default EMERGENCY_BROWSER_OPTIONS;
