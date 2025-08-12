const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const COOKIE_ID = 'twitter';
(async () => {
  const userDataDir = './.pw-twitter-login';
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: ['--no-sandbox'],
  });
  const page = await context.newPage();
  try { await page.goto('https://x.com/login', { waitUntil: 'domcontentloaded', timeout: 60000 }); }
  catch { await page.goto('https://twitter.com/login', { waitUntil: 'domcontentloaded', timeout: 60000 }); }
  console.log('>> Log in to X/Twitter in the browser window. When you see Home, return here and press ENTER.');
  process.stdin.resume(); await new Promise(r => process.stdin.once('data', r)); process.stdin.pause();
  const cookies = await context.cookies();
  const hasAuth = cookies.some(c => c.name === 'auth_token' && (c.domain.includes('twitter.com') || c.domain.includes('x.com')));
  if (!hasAuth) { console.error('!! auth_token not found. Are you logged in?'); await context.close(); process.exit(2); }
  const filtered = cookies.filter(c => c.domain.includes('x.com') || c.domain.includes('twitter.com'));
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { error } = await supabase.from('browser_cookies').upsert({ id: COOKIE_ID, data: filtered, updated_at: new Date().toISOString() });
  if (error) { console.error('!! Supabase upsert failed:', error); await context.close(); process.exit(3); }
  console.log('✅ Cookies saved to Supabase (id = twitter). You can close the browser.');
  await context.close(); process.exit(0);
})();