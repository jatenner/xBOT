import fs from "fs";
import { chromium } from "playwright";

export async function logPlaywrightProbe() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || "(unset)";
  console.log("PW_BROWSERS_PATH:", root);
  const candidates = [
    "/ms-playwright/chromium-1134/chrome-linux/chrome",
    "/ms-playwright/chromium-1165/chrome-linux/chrome"
  ];
  for (const p of candidates) console.log("PW_PROBE:", p, fs.existsSync(p) ? "exists" : "missing");
  try {
    const b = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
    console.log("PW_SELFTEST: launched OK");
    await b.close();
  } catch (e) {
    console.log("PW_SELFTEST: launch failed ->", (e as Error).message);
  }
}