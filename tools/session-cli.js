#!/usr/bin/env ts-node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const playwright_1 = require("playwright");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const SESSION_FILE = path_1.default.join(process.cwd(), 'data', 'twitter_session.json');
async function seedSession() {
    console.log('🔐 Opening X.com for session seeding...');
    // Ensure data directory exists
    fs_1.default.mkdirSync(path_1.default.dirname(SESSION_FILE), { recursive: true });
    const browser = await playwright_1.chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('https://x.com/login');
    console.log('👆 Please log in to X.com in the browser window');
    console.log('⏳ Waiting for you to complete login...');
    // Wait for login completion (user sees home feed)
    await page.waitForURL('**/home', { timeout: 300000 }); // 5 minutes
    // Save session
    const storageState = await context.storageState();
    fs_1.default.writeFileSync(SESSION_FILE, JSON.stringify(storageState, null, 2));
    await browser.close();
    console.log(`✅ Session saved to ${SESSION_FILE}`);
    console.log(`🍪 Cookies: ${storageState.cookies.length}`);
}
function printBase64Session() {
    if (!fs_1.default.existsSync(SESSION_FILE)) {
        throw new Error(`Session file not found: ${SESSION_FILE}. Run 'npm run seed:x-session' first.`);
    }
    const sessionData = fs_1.default.readFileSync(SESSION_FILE, 'utf8');
    const base64 = Buffer.from(sessionData).toString('base64');
    console.log(base64);
}
const command = process.argv[2];
if (command === 'seed')
    seedSession();
else if (command === 'print-b64')
    printBase64Session();
else
    throw new Error('Usage: ts-node tools/session-cli.ts [seed|print-b64]');
//# sourceMappingURL=session-cli.js.map