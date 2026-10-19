#!/usr/bin/env node
/* tools/link-existing.js — list every live Link group, one per line, for drafters' freshness checks.
   Usage: node tools/link-existing.js [--except 135-249] > existing.txt
   Line: "<serial> r<rank> <name> | <members>". --except leaves out the serials being replaced. */
'use strict';
const fs = require('fs'), path = require('path');
const { parse, live } = require('./build-link-batch.js');
const args = process.argv.slice(2), i = args.indexOf('--except');
const [lo, hi] = i >= 0 ? args[i + 1].split('-').map(Number) : [Infinity, -Infinity];
const out = [];
for (const f of live()) {
  const s = parseInt(f.slice(-9, -5), 10); if (s >= lo && s <= hi) continue;
  const P = parse(fs.readFileSync(path.join(__dirname, '..', 'reports', f), 'utf8'));
  P.groups.forEach(g => out.push(String(s).padStart(4, '0') + ' r' + g.rank + ' ' + g.name + ' | ' + g.members.join(', ')));
}
process.stdout.write(out.join('\n') + '\n');
