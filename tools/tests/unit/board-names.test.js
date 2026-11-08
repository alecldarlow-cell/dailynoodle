/* BOARD-NAMES (8 Nov 2026): nicknames and league names are shown to other players, so Google
   Play counts them as user-generated content. board.clean() refuses blocked words when a name
   is set; toolchain/sql/2026-11-08-board-name-rules.sql widens the list. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { boardDb } = require('../board-db.js');

const clean = (d, t) => d.query(`select board.clean($1, 2, 16, 'bad_nick') v`, [t]);

test('BOARD-NAMES: rude words and slurs are refused as names; everyday names, and words that merely contain one, are fine', async () => {
  // GIVEN the board database with every migration applied
  const d = await boardDb();
  try {
    // WHEN a name is or holds a blocked word as a whole word THEN it is refused
    for (const bad of ['tosser', 'Big Knob', 'nonce', 'Sexy Sam', 'paedo', 'shitty', 'cocaine', 'Fanny'])
      await assert.rejects(clean(d, bad), /bad_nick/, bad);
    // AND the older lists still apply (a substring anywhere, or a whole word)
    await assert.rejects(clean(d, 'xxfuckxx'), /bad_nick/);
    await assert.rejects(clean(d, 'wanker'), /bad_nick/);
    // WHEN a name only contains a blocked word inside another word THEN it is kept
    for (const ok of ['Sussex Sam', 'Dickens', 'Cockburn', 'Essex', 'Noodlers', 'Mum', 'Grandad 2'])
      assert.equal((await clean(d, ok)).rows[0].v, ok, ok);
  } finally { await d.close(); }
});

test('BOARD-NAMES: the rule applies when joining with a nickname', async () => {
  // GIVEN a league
  const d = await boardDb();
  try {
    const owner = '00000000-0000-4000-8000-000000000001', p2 = '00000000-0000-4000-8000-000000000002';
    const code = (await d.query(`select (public.board_create($1, 'Family', 'Ann') ->> 'code') c`, [owner])).rows[0].c;
    // WHEN someone joins with a blocked nickname THEN it is refused, and a friendly one is accepted
    await assert.rejects(d.query(`select public.board_join($1, $2, 'tosser')`, [p2, code]), /bad_nick/);
    await d.query(`select public.board_join($1, $2, 'Bob')`, [p2, code]);
    // WHEN a league is created with a blocked name THEN it is refused
    await assert.rejects(d.query(`select public.board_create($1, 'Nonce Club', 'Cy')`, ['00000000-0000-4000-8000-000000000003']), /bad_name/);
  } finally { await d.close(); }
});
