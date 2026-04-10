/**
 * 🛡️ SHADOW MODE - Read-Only Safety Layer
 *
 * When SHADOW_MODE=true (default ON for new accounts):
 * - NO posting, replying, liking, following, retweeting, bookmarking, DMs
 * - Allowed: goto, scroll, read DOM, screenshots, parse tweets, open tweet detail
 * - guardedClick() throws if selector matches blocked action patterns
 */

// Read at call time so env changes (e.g. in tests) are respected

/** Blocked action patterns (aria-label, title, text, data-testid) */
const BLOCKED_PATTERNS = [
  /like/i,
  /follow/i,
  /unfollow/i,
  /reply/i,
  /repost/i,
  /retweet/i,
  /post/i,
  /send/i,
  /bookmark/i,
  /quote/i,
  /dm/i,
  /message/i,
];

const BLOCKED_SELECTORS = [
  '[data-testid="like"]',
  '[data-testid="unlike"]',
  '[data-testid="retweet"]',
  '[data-testid="unretweet"]',
  '[data-testid="reply"]',
  '[data-testid="tweetButton"]',
  '[data-testid="tweetButtonInline"]',
  '[data-testid="replyButton"]',
  '[data-testid="replyButtonInline"]',
  '[data-testid="SideNav_NewTweet_Button"]',
  '[data-testid="bookmark"]',
];

/**
 * Whether Shadow Mode is active (read-only when true).
 * Explicit off: SHADOW_MODE=false, SHADOW_MODE= (blank), or SHADOW_MODE=0 so controlled-live
 * runs respect shell/env over dotenv. When unset, defaults to true (read-only) for safety.
 */
export function isShadowMode(): boolean {
  const raw = process.env.SHADOW_MODE;
  if (raw === undefined) return true; // unset = read-only default
  const v = String(raw).trim().toLowerCase();
  if (v === '' || v === 'false' || v === '0') return false; // explicit off
  return true; // 'true', '1', or any other value = read-only
}

/**
 * Check if a selector or element attributes match blocked write actions.
 * Used by guardedClick to prevent accidental writes.
 */
export function isBlockedWriteAction(
  selector: string,
  ariaLabel?: string | null,
  title?: string | null,
  text?: string | null
): boolean {
  if (!isShadowMode()) return false;

  const combined = [selector, ariaLabel, title, text].filter(Boolean).join(' ').toLowerCase();

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(combined)) return true;
  }

  for (const blocked of BLOCKED_SELECTORS) {
    if (selector.includes(blocked) || selector.includes(blocked.replace(/"/g, "'"))) {
      return true;
    }
  }

  return false;
}

/**
 * Assert that a planned click is allowed. Throws if SHADOW_MODE=true and selector
 * matches write actions. Call before performing a click in write-prone code paths.
 */
export function assertNotShadowModeWrite(selector: string, reason: string): void {
  if (!isShadowMode()) return;
  if (isBlockedWriteAction(selector, null, null, null)) {
    const err = new Error(
      `[SHADOW_MODE] Blocked write action: ${reason} (selector=${selector})`
    );
    (err as any).code = 'SHADOW_MODE_BLOCKED';
    throw err;
  }
}

/**
 * Safe click wrapper. Throws if SHADOW_MODE=true and selector matches write actions.
 * Use for any click that could change state on X.
 */
export async function guardedClick(
  page: { locator: (sel: string) => { first: () => { click: () => Promise<void> } } },
  selector: string,
  reason: string
): Promise<void> {
  assertNotShadowModeWrite(selector, reason); // uses isShadowMode internally
  const loc = page.locator(selector).first();
  await loc.click();
}
