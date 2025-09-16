#!/usr/bin/env ts-node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const playwright_1 = require("playwright");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const SESSION_PATH = path_1.default.join(process.cwd(), 'data', 'twitter_session.json');
async function testSession() {
    if (!fs_1.default.existsSync(SESSION_PATH)) {
        console.log('❌ SESSION_NOT_FOUND: No session file at', SESSION_PATH);
        process.exit(1);
    }
    const browser = await playwright_1.chromium.launch({ headless: true });
    const context = await browser.newContext({
        storageState: SESSION_PATH
    });
    const page = await context.newPage();
    try {
        await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
        // Check for account switcher button to confirm login
        const accountSwitcher = await page.locator('[data-testid="SideNav_AccountSwitcher_Button"]').first();
        const exists = await accountSwitcher.isVisible({ timeout: 5000 }).catch(() => false);
        if (exists) {
            console.log('✅ LOGIN_OK: Successfully logged in to X.com');
        }
        else {
            console.log('❌ LOGIN_FAILED: Account switcher not found - session may be expired');
            process.exit(1);
        }
    }
    catch (error) {
        console.log('❌ SESSION_TEST_ERROR:', error.message);
        process.exit(1);
    }
    finally {
        await browser.close();
    }
}
testSession();
//# sourceMappingURL=testSession.js.map