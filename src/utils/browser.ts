import { chromium, Browser, Page } from 'playwright';

let browserPromise: Promise<Browser> | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true,
      args: ['--no-sandbox','--disable-dev-shm-usage']
    });
  }
  return browserPromise;
}

export async function getFreshPage(): Promise<Page> {
  const browser = await getBrowser();
  // Retry once if newPage() fails due to a transient close
  try {
    return await browser.newPage();
  } catch {
    // recreate browser once
    await browser.close().catch(() => {});
    browserPromise = chromium.launch({
      headless: true,
      args: ['--no-sandbox','--disable-dev-shm-usage']
    });
    return (await browserPromise).newPage();
  }
}