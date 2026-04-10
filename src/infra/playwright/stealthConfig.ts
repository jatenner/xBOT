/**
 * 🥷 STEALTH CONFIG — Randomized browser fingerprint per session
 *
 * Generates realistic, varied browser configurations that change
 * each session so the bot doesn't have an identical fingerprint.
 */

// Current Chrome versions (as of March 2026)
const CHROME_VERSIONS = ['132.0.6834.83', '131.0.6778.139', '130.0.6723.116', '133.0.6876.57', '132.0.6834.110'];

// Current macOS versions
const MACOS_VERSIONS = ['10_15_7', '12_7_4', '13_6_4', '14_3_1', '14_4', '14_5', '15_0'];

// Realistic viewports (common monitor sizes)
const VIEWPORTS = [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1536, height: 864 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
  { width: 1680, height: 1050 },
  { width: 1280, height: 800 },
  { width: 1600, height: 900 },
];

// Screen resolutions that match viewports
const SCREEN_SIZES = [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1536, height: 864 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
  { width: 1680, height: 1050 },
  { width: 1280, height: 800 },
  { width: 1600, height: 900 },
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export interface SessionFingerprint {
  userAgent: string;
  viewport: { width: number; height: number };
  screen: { width: number; height: number };
  chromeVersion: string;
  macosVersion: string;
  hardwareConcurrency: number;
  deviceMemory: number;
  maxTouchPoints: number;
}

/**
 * Generate a randomized but realistic browser fingerprint for this session
 */
export function generateSessionFingerprint(): SessionFingerprint {
  const chromeVersion = pick(CHROME_VERSIONS);
  const macosVersion = pick(MACOS_VERSIONS);
  const viewportIndex = Math.floor(Math.random() * VIEWPORTS.length);
  const viewport = VIEWPORTS[viewportIndex];
  const screen = SCREEN_SIZES[viewportIndex]; // Match viewport to screen

  const userAgent = `Mozilla/5.0 (Macintosh; Intel Mac OS X ${macosVersion}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;

  return {
    userAgent,
    viewport,
    screen,
    chromeVersion,
    macosVersion,
    hardwareConcurrency: pick([4, 8, 10, 12, 16]),
    deviceMemory: pick([4, 8, 16]),
    maxTouchPoints: 0, // Desktop Mac = 0
  };
}

/**
 * Safe browser launch args — NO suspicious flags
 */
export function getSafeLaunchArgs(): string[] {
  return [
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-blink-features=AutomationControlled',
    '--disable-dev-shm-usage',
  ];
  // REMOVED: --disable-web-security, --enable-automation=false, --disable-gpu
  // These flags are detected by Twitter's bot detection
}
