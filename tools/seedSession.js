#!/usr/bin/env ts-node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const playwright_1 = require("playwright");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const readline_1 = __importDefault(require("readline"));
const SESSION_PATH = '/app/data/twitter_session.json';
async function seedSession() {
    // Ensure Playwright is installed
    try {
        await Promise.resolve().then(() => __importStar(require('playwright')));
    }
    catch {
        console.log('Installing Playwright...');
        const { execSync } = require('child_process');
        execSync('npx playwright install', { stdio: 'inherit' });
    }
    console.log('🔐 Opening X.com for manual login...');
    const browser = await playwright_1.chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('https://x.com/login');
    const rl = readline_1.default.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    await new Promise((resolve) => {
        rl.question('👆 Please log in to X.com, then press ENTER here: ', () => {
            rl.close();
            resolve();
        });
    });
    const storageState = await context.storageState();
    fs_1.default.mkdirSync(path_1.default.dirname(SESSION_PATH), { recursive: true });
    fs_1.default.writeFileSync(SESSION_PATH, JSON.stringify(storageState, null, 2));
    await browser.close();
    console.log(`SESSION_SAVED: ${SESSION_PATH}`);
    console.log(`🍪 Cookies: ${storageState.cookies.length}`);
}
seedSession().catch(console.error);
//# sourceMappingURL=seedSession.js.map