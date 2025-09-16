"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const playwright_1 = require("playwright");
const out = process.env.PLAYWRIGHT_STORAGE_PATH || "playwright/storage.json";
(async () => {
    const browser = await playwright_1.chromium.launch({ headless: false });
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto("https://x.com/login");
    console.log("Log in, then press Enter here...");
    process.stdin.once("data", async () => {
        await ctx.storageState({ path: out });
        console.log("Saved:", out);
        await browser.close();
        process.exit(0);
    });
})();
//# sourceMappingURL=seed-session.js.map