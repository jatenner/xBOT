/**
 * 🔑 Automatic X/Twitter Login
 * Handles username/password and 2FA (TOTP)
 */

import { Page } from 'playwright';
import { generateTOTP } from '../session/totp';

export async function performLogin(page: Page): Promise<boolean> {
  const username = process.env.X_USERNAME;
  const password = process.env.X_PASSWORD;
  const twoFASecret = process.env.X_2FA_SECRET;

  if (!username || !password) {
    console.error('[X_LOGIN] ❌ X_USERNAME or X_PASSWORD not set');
    return false;
  }

  try {
    console.log('[X_LOGIN] Starting login flow...');

    // Navigate to login page
    await page.goto('https://twitter.com/i/flow/login', { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForTimeout(2000);

    // Enter username
    console.log('[X_LOGIN] Entering username...');
    const usernameInput = page.locator('input[autocomplete="username"]').first();
    await usernameInput.waitFor({ state: 'visible', timeout: 10000 });
    await usernameInput.fill(username);
    await page.waitForTimeout(1000);

    // Click Next
    const nextButton = page.locator('button:has-text("Next"), div[role="button"]:has-text("Next")').first();
    await nextButton.click();
    await page.waitForTimeout(2000);

    // Check for unusual activity verification (phone/email)
    const verificationInput = page.locator('input[data-testid="ocfEnterTextTextInput"]');
    if (await verificationInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('[X_LOGIN] ⚠️ Unusual activity detected - verification required');
      // If email is provided, try to enter it
      if (process.env.X_EMAIL) {
        await verificationInput.fill(process.env.X_EMAIL);
        await page.waitForTimeout(1000);
        const verifyNext = page.locator('button:has-text("Next")').first();
        await verifyNext.click();
        await page.waitForTimeout(2000);
      } else {
        console.error('[X_LOGIN] ❌ X_EMAIL not set for verification');
        return false;
      }
    }

    // Enter password
    console.log('[X_LOGIN] Entering password...');
    const passwordInput = page.locator('input[autocomplete="current-password"], input[name="password"], input[type="password"]').first();
    await passwordInput.waitFor({ state: 'visible', timeout: 10000 });
    await passwordInput.fill(password);
    await page.waitForTimeout(1000);

    // Click Log in
    const loginButton = page.locator('button:has-text("Log in"), div[role="button"]:has-text("Log in")').first();
    await loginButton.click();
    await page.waitForTimeout(3000);

    // Check for 2FA
    const twoFAInput = page.locator('input[data-testid="ocfEnterTextTextInput"], input[autocomplete="one-time-code"]');
    if (await twoFAInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      if (!twoFASecret) {
        console.error('[X_LOGIN] ❌ 2FA required but X_2FA_SECRET not set');
        return false;
      }

      console.log('[X_LOGIN] Entering 2FA code...');
      const code = generateTOTP(twoFASecret);
      await twoFAInput.fill(code);
      await page.waitForTimeout(1000);

      const verifyButton = page.locator('button:has-text("Next"), button:has-text("Verify")').first();
      await verifyButton.click();
      await page.waitForTimeout(3000);
    }

    // Wait for home page or timeline
    await page.waitForURL(/\/(home|$)/, { timeout: 15000 });
    
    console.log('[X_LOGIN] ✅ Login successful');
    return true;

  } catch (error: any) {
    console.error('[X_LOGIN] ❌ Login failed:', error.message);
    return false;
  }
}

