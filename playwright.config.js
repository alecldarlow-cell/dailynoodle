'use strict';
const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tools/tests/browser',
  outputDir: './test-results/browser',
  snapshotPathTemplate: '{testDir}/baselines/{projectName}/{arg}{ext}',
  timeout: 60000,
  expect: { timeout: 5000, toHaveScreenshot: { maxDiffPixelRatio: 0.002, animations: 'disabled' } },
  fullyParallel: false,
  workers: process.env.CI ? 2 : 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'test-results/playwright.json' }]],
  use: { headless: true, locale: 'en-GB', timezoneId: 'Europe/London', trace: 'retain-on-failure', screenshot: 'only-on-failure', launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {} },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } },
    ...(process.env.DN_CROSS_BROWSER ? [
      { name: 'firefox', testIgnore: /visual/, use: { browserName: 'firefox', launchOptions: {} } },
      { name: 'webkit', testIgnore: /visual/, use: { browserName: 'webkit', launchOptions: {} } },
    ] : [])],
});
