// Set correct Playwright browsers path before any Playwright imports
if (!process.env.PLAYWRIGHT_BROWSERS_PATH || process.env.PLAYWRIGHT_BROWSERS_PATH === "0") {
  process.env.PLAYWRIGHT_BROWSERS_PATH = "/ms-playwright";
}