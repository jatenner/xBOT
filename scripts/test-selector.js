#!/usr/bin/env tsx
"use strict";
/**
 * QUICK TEST: Check if Twitter composer selectors work
 */
Object.defineProperty(exports, "__esModule", { value: true });
const playwright_1 = require("playwright");
async function testSelectors() {
    console.log('🧪 TEST: Twitter composer selectors...');
    const browser = await playwright_1.chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
        console.log('🌐 Loading x.com...');
        await page.goto('https://x.com/home');
        await page.waitForTimeout(3000); // Wait for page to settle
        console.log('🔍 Testing selectors:');
        const selectors = [
            '[data-testid="tweetTextarea_0"]',
            '[contenteditable="true"]',
            '[data-testid="tweetButton"]',
            'div[contenteditable="true"]'
        ];
        for (const selector of selectors) {
            const count = await page.locator(selector).count();
            console.log(`📝 ${selector}: ${count > 0 ? '✅' : '❌'} (${count} found)`);
        }
        console.log('\n💡 Page title:', await page.title());
        console.log('💡 Page URL:', page.url());
        console.log('\n⏸️  Check browser window, then press Enter...');
    }
    catch (error) {
        console.error('❌ Error:', error);
    }
    finally {
        await browser.close();
    }
}
testSelectors();
//# sourceMappingURL=test-selector.js.map