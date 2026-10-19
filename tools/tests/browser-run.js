'use strict';
const { spawn } = require('node:child_process');
const path = require('node:path');
(async () => {
  // npm ships the same Linux Chromium binary to local runs and CI. Other OSes
  // use Playwright's install; approve canonical visual baselines on Linux.
  if (!process.env.PW_CHROMIUM && process.platform === 'linux') process.env.PW_CHROMIUM = await require('./chromium').executable();
  const cli = path.join(path.dirname(require.resolve('playwright/package.json')), 'cli.js');
  const p = spawn(process.execPath, [cli, 'test', ...process.argv.slice(2)], { stdio: 'inherit', env: process.env });
  p.on('error', e => { console.error(e); process.exitCode = 1; });
  p.on('exit', code => { process.exitCode = code ?? 1; });
})().catch(e => { console.error(e); process.exitCode = 1; });
