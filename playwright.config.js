'use strict';
const { defineConfig } = require('@playwright/test');
const group=process.env.DN_TEST_GROUP;
const output=group?'./test-results/'+group:'./test-results';
module.exports = defineConfig({
  testDir: './tools/tests/browser',
  outputDir: output+'/browser',
  snapshotPathTemplate: '{testDir}/baselines/{projectName}/{arg}{ext}',
  timeout: 60000,
  expect: { timeout: 5000, toHaveScreenshot: { maxDiffPixelRatio: 0.002, animations: 'disabled' } },
  fullyParallel: false,
  workers: process.env.DN_TEST_WORKERS ? Number(process.env.DN_TEST_WORKERS) : (process.env.CI ? 2 : 1),
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { open: 'never',outputFolder:group?'playwright-report/'+group:'playwright-report' }], ['json', { outputFile: output+'/playwright.json' }]],
  use: { headless: true, locale: 'en-GB', timezoneId: 'Europe/London', trace: 'retain-on-failure', screenshot: 'only-on-failure', // Chromium can't resolve the live database (see NO_LIVE_DB in tools/tests/harness.js); Firefox/WebKit rely on newPhone()'s rewrite.
    launchOptions: { args: ['--host-resolver-rules=MAP *.supabase.co ~NOTFOUND'], ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}) } },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } },
    ...(process.env.DN_CROSS_BROWSER ? [
      { name: 'firefox', testIgnore: /visual/, use: { browserName: 'firefox', launchOptions: {} } },
      { name: 'webkit', testIgnore: /visual/, use: { browserName: 'webkit', launchOptions: {} } },
    ] : [])],
});
