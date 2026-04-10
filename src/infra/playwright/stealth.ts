/**
 * 🥷 STEALTH MODE — Make Playwright undetectable on X/Twitter
 *
 * Covers: webdriver, chrome runtime, canvas, WebGL, audio, permissions,
 * screen, battery, network, media devices, hardware, touch points.
 *
 * IMPORTANT: Human behavior functions (humanType, humanScroll, humanWait)
 * are exported and MUST be used by posting code — don't use fill() or
 * keyboard.type() directly.
 */

import { BrowserContext, Page } from 'playwright';
import { generateSessionFingerprint, type SessionFingerprint } from './stealthConfig';

// Cache fingerprint per session so it stays consistent
let sessionFingerprint: SessionFingerprint | null = null;

function getFingerprint(): SessionFingerprint {
  if (!sessionFingerprint) {
    sessionFingerprint = generateSessionFingerprint();
    console.log(`[STEALTH] Generated fingerprint: Chrome/${sessionFingerprint.chromeVersion} macOS ${sessionFingerprint.macosVersion} viewport=${sessionFingerprint.viewport.width}x${sessionFingerprint.viewport.height}`);
  }
  return sessionFingerprint;
}

/**
 * Apply comprehensive stealth to a browser context
 */
export async function applyStealth(context: BrowserContext) {
  const fp = getFingerprint();

  await context.addInitScript((fingerprint: SessionFingerprint) => {
    // === CORE: Remove webdriver flag ===
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

    // === CORE: Remove ALL automation traces ===
    const autoProps = [
      '__webdriver_evaluate', '__selenium_evaluate', '__webdriver_script_function',
      '__webdriver_script_func', '__webdriver_script_fn', '__fxdriver_evaluate',
      '__driver_unwrapped', '__webdriver_unwrapped', '__driver_evaluate',
      '__selenium_unwrapped', '__fxdriver_unwrapped', '_Selenium_IDE_Recorder',
      '_selenium', 'calledSelenium', '__nightmare', '__phantomas',
    ];
    for (const prop of autoProps) {
      try { delete (window as any)[prop]; } catch {}
    }

    // === HARDWARE: Realistic device properties ===
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => fingerprint.hardwareConcurrency });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => fingerprint.deviceMemory });
    Object.defineProperty(navigator, 'maxTouchPoints', { get: () => fingerprint.maxTouchPoints });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel' });
    Object.defineProperty(navigator, 'vendor', { get: () => 'Google Inc.' });

    // === SCREEN: Match viewport ===
    Object.defineProperty(screen, 'width', { get: () => fingerprint.screen.width });
    Object.defineProperty(screen, 'height', { get: () => fingerprint.screen.height });
    Object.defineProperty(screen, 'availWidth', { get: () => fingerprint.screen.width });
    Object.defineProperty(screen, 'availHeight', { get: () => fingerprint.screen.height - 25 }); // Menu bar
    Object.defineProperty(screen, 'availTop', { get: () => 25 }); // macOS menu bar
    Object.defineProperty(screen, 'availLeft', { get: () => 0 });
    Object.defineProperty(screen, 'colorDepth', { get: () => 30 }); // macOS Retina
    Object.defineProperty(screen, 'pixelDepth', { get: () => 30 });
    Object.defineProperty(window, 'devicePixelRatio', { get: () => 2 }); // Retina

    // === PLUGINS: Realistic Chrome plugins ===
    Object.defineProperty(navigator, 'plugins', {
      get: () => {
        const plugins = [
          { name: 'PDF Viewer', description: 'Portable Document Format', filename: 'internal-pdf-viewer', length: 1 },
          { name: 'Chrome PDF Viewer', description: 'Portable Document Format', filename: 'internal-pdf-viewer', length: 1 },
          { name: 'Chromium PDF Viewer', description: 'Portable Document Format', filename: 'internal-pdf-viewer', length: 1 },
          { name: 'Microsoft Edge PDF Viewer', description: 'Portable Document Format', filename: 'internal-pdf-viewer', length: 1 },
          { name: 'WebKit built-in PDF', description: 'Portable Document Format', filename: 'internal-pdf-viewer', length: 1 },
        ];
        (plugins as any).length = plugins.length;
        (plugins as any).item = (i: number) => plugins[i];
        (plugins as any).namedItem = (name: string) => plugins.find(p => p.name === name);
        (plugins as any).refresh = () => {};
        return plugins;
      }
    });

    // === CHROME OBJECT ===
    (window as any).chrome = {
      runtime: {
        onConnect: undefined, onMessage: undefined, onStartup: undefined,
        connect: function() {}, sendMessage: function() {},
        getURL: function(path: string) { return `chrome-extension://internal/${path}`; },
        getManifest: function() { return {}; },
        id: undefined,
      },
      loadTimes: function() {
        return {
          requestTime: performance.now() / 1000,
          startLoadTime: performance.now() / 1000 - Math.random() * 2,
          commitLoadTime: performance.now() / 1000 - Math.random(),
          finishDocumentLoadTime: performance.now() / 1000,
          finishLoadTime: performance.now() / 1000,
          firstPaintTime: performance.now() / 1000 - Math.random() * 0.5,
          firstPaintAfterLoadTime: 0,
          navigationType: 'Other',
        };
      },
      csi: function() {
        return { startE: Date.now(), onloadT: Date.now(), pageT: performance.now(), tran: 15 };
      },
      app: { isInstalled: false, InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' }, RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' } },
    };

    // === PERMISSIONS ===
    const origQuery = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = (desc: any) => {
      if (desc.name === 'notifications') return Promise.resolve({ state: 'denied' } as PermissionStatus);
      return origQuery(desc);
    };

    // === BATTERY ===
    (navigator as any).getBattery = () => Promise.resolve({
      charging: Math.random() > 0.4, chargingTime: 0,
      dischargingTime: 10800 + Math.random() * 18000,
      level: 0.65 + Math.random() * 0.35,
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => true,
    });

    // === NETWORK ===
    Object.defineProperty(navigator, 'connection', {
      get: () => ({
        effectiveType: '4g', rtt: 25 + Math.random() * 75,
        downlink: 5 + Math.random() * 15, saveData: false,
        addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => true,
      })
    });

    // === MEDIA DEVICES ===
    if (navigator.mediaDevices) {
      navigator.mediaDevices.enumerateDevices = () => Promise.resolve([
        { deviceId: 'default', groupId: 'g1', kind: 'audioinput' as MediaDeviceKind, label: 'MacBook Pro Microphone', toJSON: () => ({}) },
        { deviceId: 'default', groupId: 'g2', kind: 'audiooutput' as MediaDeviceKind, label: 'MacBook Pro Speakers', toJSON: () => ({}) },
        { deviceId: 'facetime', groupId: 'g3', kind: 'videoinput' as MediaDeviceKind, label: 'FaceTime HD Camera', toJSON: () => ({}) },
      ] as MediaDeviceInfo[]);
    }

    // === CANVAS FINGERPRINT PROTECTION ===
    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: any[]) {
      const ctx = origGetContext.call(this, type, ...args);
      if (ctx && type === '2d') {
        const origGetImageData = (ctx as CanvasRenderingContext2D).getImageData;
        (ctx as CanvasRenderingContext2D).getImageData = function(sx, sy, sw, sh) {
          const imageData = origGetImageData.call(this, sx, sy, sw, sh);
          // Add consistent per-session noise
          for (let i = 0; i < imageData.data.length; i += 4) {
            imageData.data[i] = Math.max(0, Math.min(255, imageData.data[i] + ((i * 7 + fingerprint.hardwareConcurrency) % 3 - 1)));
          }
          return imageData;
        };
      }
      return ctx;
    } as any;

    // === WEBGL FINGERPRINT PROTECTION ===
    const getParam = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(pname: number) {
      if (pname === 37445) return 'Apple'; // UNMASKED_VENDOR
      if (pname === 37446) return 'Apple M1 Pro'; // UNMASKED_RENDERER
      if (pname === 7938) return 'WebGL 1.0 (OpenGL ES 2.0 Chromium)'; // VERSION
      if (pname === 35724) return 'WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)'; // SHADING_LANGUAGE_VERSION
      return getParam.call(this, pname);
    };

    // === AUDIO FINGERPRINT PROTECTION ===
    const origCreateOscillator = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function() {
      const osc = origCreateOscillator.call(this);
      const origConnect = osc.connect.bind(osc);
      osc.connect = function(dest: any) {
        // Add subtle noise to audio output for fingerprint variation
        if (dest instanceof AudioDestinationNode) {
          const gainNode = (osc as any).context.createGain();
          gainNode.gain.value = 0.99 + Math.random() * 0.02; // Tiny variation
          origConnect(gainNode);
          gainNode.connect(dest);
          return dest;
        }
        return origConnect(dest);
      };
      return osc;
    };

    // === FUNCTION.TOSTRING PROTECTION ===
    const nativeToString = Function.prototype.toString;
    const customFunctions = new Set<Function>();
    Function.prototype.toString = function() {
      if (customFunctions.has(this) || this === Function.prototype.toString) {
        return 'function toString() { [native code] }';
      }
      return nativeToString.call(this);
    };
    customFunctions.add(Function.prototype.toString);

  }, getFingerprint());

  console.log('[STEALTH] ✅ Applied comprehensive stealth (webdriver, canvas, WebGL, audio, hardware, screen)');
}

// ===========================
// HUMAN BEHAVIOR FUNCTIONS
// These MUST be used by posting code
// ===========================

/**
 * Add background human behaviors to a page (mouse movements, scrolls)
 */
export async function addHumanBehaviors(page: Page) {
  await page.evaluate(() => {
    const randomMove = () => {
      const x = Math.random() * window.innerWidth;
      const y = Math.random() * window.innerHeight;
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y, bubbles: true }));
    };
    setInterval(randomMove, 3000 + Math.random() * 7000);
  });
  console.log('[STEALTH] ✅ Human behaviors active (mouse movement)');
}

/**
 * Type text like a human — variable delays, occasional pauses
 */
export async function humanType(page: Page, selector: string, text: string) {
  const element = page.locator(selector).first();
  await element.click();
  await page.waitForTimeout(300 + Math.random() * 500); // Pause after clicking

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    // Variable typing speed: 40-180ms per character
    const delay = 40 + Math.random() * 140;
    await page.keyboard.type(char, { delay: 0 });
    await page.waitForTimeout(delay);

    // Occasional longer pause (thinking) every 15-30 characters
    if (i > 0 && i % (15 + Math.floor(Math.random() * 15)) === 0) {
      await page.waitForTimeout(500 + Math.random() * 1500);
    }
  }

  // Pause after typing (reading over)
  await page.waitForTimeout(500 + Math.random() * 1000);
}

/**
 * Type text into an already-focused element with human-like variable delays.
 * Use this instead of fill() or keyboard.type() with fixed delay.
 * The element must already be focused/clicked before calling this.
 */
export async function humanTypeIntoFocused(page: Page, text: string) {
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    // Variable typing speed: 35-160ms per character
    const delay = 35 + Math.random() * 125;
    await page.keyboard.type(char, { delay: 0 });
    await page.waitForTimeout(delay);

    // Occasional longer pause (thinking) every 15-30 characters
    if (i > 0 && i % (15 + Math.floor(Math.random() * 15)) === 0) {
      await page.waitForTimeout(400 + Math.random() * 1200);
    }
  }

  // Brief pause after typing (reading over what was typed)
  await page.waitForTimeout(300 + Math.random() * 700);
}

/**
 * Scroll the page like a human
 */
export async function humanScroll(page: Page) {
  const scrollAmount = 100 + Math.random() * 300;
  await page.evaluate((amount) => {
    window.scrollBy({ top: amount, behavior: 'smooth' });
  }, scrollAmount);
  await page.waitForTimeout(800 + Math.random() * 1500);
}

/**
 * Wait like a human thinking/reading
 */
export function humanWait(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 3000));
}

/**
 * Warm up the session — browse like a human before doing anything automated
 * MUST be called after login, before any posting/replying
 */
export async function warmUpSession(page: Page) {
  console.log('[STEALTH] 🔥 Starting warm-up session (30-60s of human-like browsing)...');

  // 1. Scroll the timeline a few times
  for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) {
    await humanScroll(page);
    await page.waitForTimeout(2000 + Math.random() * 3000);
  }

  // 2. Maybe click on a tweet (just to view, not interact)
  try {
    const tweets = await page.$$('article[data-testid="tweet"]');
    if (tweets.length > 3) {
      const randomTweet = tweets[2 + Math.floor(Math.random() * Math.min(5, tweets.length - 2))];
      await randomTweet.click();
      await page.waitForTimeout(3000 + Math.random() * 4000);
      await page.goBack();
      await page.waitForTimeout(2000 + Math.random() * 2000);
    }
  } catch {
    // Non-critical — tweet click failed, continue warm-up
  }

  // 3. Scroll back up
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForTimeout(2000 + Math.random() * 2000);

  console.log('[STEALTH] ✅ Warm-up complete');
}
