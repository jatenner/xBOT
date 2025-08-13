import fs from "fs";

export function logPlaywrightProbe() {
  const candidates = [
    "/ms-playwright/chromium-1134/chrome-linux/chrome",
    "/ms-playwright/chromium-1134/chrome-linux/headless_shell"
  ];
  for (const p of candidates) console.log("PW_PROBE:", p, fs.existsSync(p) ? "exists" : "missing");
  console.log("PW_BROWSERS_PATH:", process.env.PLAYWRIGHT_BROWSERS_PATH || "(unset)");
}