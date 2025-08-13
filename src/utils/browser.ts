import { chromium, BrowserContext } from 'playwright';

export async function getPersistentContext(): Promise<BrowserContext> {
  const userDataDir = '/tmp/xbot-profile'; // writable in Railway
  const ctx = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  return ctx;
}