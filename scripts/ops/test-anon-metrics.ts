/**
 * Test what metrics are visible on a tweet page WITHOUT auth.
 * Usage: npx tsx scripts/ops/test-anon-metrics.ts
 */

import { chromium } from 'playwright';

async function main() {
  console.log('Launching anonymous browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  // Test with a known viral tweet (naval's "How to Get Rich")
  const testUrls = [
    'https://x.com/naval/status/1002103360646823936',
    'https://x.com/elonmusk/status/1585841080431321088',
  ];

  for (const url of testUrls) {
    console.log(`\n--- Testing: ${url} ---`);

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(2000);

      // Accept consent wall if present
      try {
        const btn = page.getByRole('button', { name: /accept|agree|allow|continue|ok/i }).first();
        if (await btn.isVisible({ timeout: 3000 })) {
          await btn.click();
          await page.waitForTimeout(2000);
          console.log('  Consent wall accepted');
        }
      } catch {}

      // Check if we hit login wall
      if (page.url().includes('/i/flow/login')) {
        console.log('  ❌ LOGIN WALL — cannot view tweet without auth');
        continue;
      }

      // Wait for tweet
      try {
        await page.waitForSelector('article[data-testid="tweet"]', { timeout: 10000 });
      } catch {
        console.log('  ❌ No tweet article found');
        continue;
      }

      // Extract everything visible
      const metrics = await page.evaluate(() => {
        const result: Record<string, any> = {};

        // Check all data-testid elements
        const testIds = ['like', 'unlike', 'reply', 'retweet', 'bookmark', 'share'];
        for (const id of testIds) {
          const el = document.querySelector(`[data-testid="${id}"]`);
          result[`testid_${id}`] = el ? (el.textContent || '').trim() : 'NOT FOUND';
        }

        // Check for view count (various selectors)
        const viewSelectors = [
          '[data-testid="app-text-transition-container"]',
          'a[href*="/analytics"]',
          '[aria-label*="view"]',
          '[aria-label*="View"]',
          '[aria-label*="impression"]',
        ];
        for (const sel of viewSelectors) {
          const els = document.querySelectorAll(sel);
          if (els.length > 0) {
            result[`selector_${sel}`] = Array.from(els).map(e => (e.textContent || '').trim()).join(' | ');
          }
        }

        // Get ALL aria-labels on the page that contain numbers
        const allLabels: string[] = [];
        document.querySelectorAll('[aria-label]').forEach(el => {
          const label = el.getAttribute('aria-label') || '';
          if (/\d/.test(label) && (label.includes('like') || label.includes('repl') || label.includes('repost') || label.includes('view') || label.includes('bookmark') || label.includes('quote'))) {
            allLabels.push(label);
          }
        });
        result['aria_labels_with_numbers'] = allLabels;

        // Check for "views" text anywhere
        const bodyText = document.body?.innerText || '';
        const viewMatches = bodyText.match(/[\d,.]+[KMB]?\s*[Vv]iews?/g);
        result['views_text_matches'] = viewMatches || [];

        // Check page title
        result['page_title'] = document.title;
        result['current_url'] = window.location.href;

        return result;
      });

      console.log('  Metrics found:');
      for (const [key, value] of Object.entries(metrics)) {
        if (value && value !== 'NOT FOUND' && (!Array.isArray(value) || value.length > 0)) {
          console.log(`    ${key}: ${JSON.stringify(value)}`);
        }
      }

      // Screenshot for visual inspection
      const screenshotPath = `/tmp/anon-tweet-test-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.log(`  📸 Screenshot: ${screenshotPath}`);

    } catch (err: any) {
      console.log(`  ❌ Error: ${err.message}`);
    }
  }

  await browser.close();
  console.log('\nDone.');
}

main().catch(e => { console.error(e); process.exit(1); });
