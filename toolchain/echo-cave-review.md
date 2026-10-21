# Echo Cave v1.1 review

Scope: the shipped Lab game and its integration. The permanent HTML filename,
publication date, thumbnail, game slug, save key and seeded cave layouts are retained.
The game remains in Lab pending physical-phone acceptance.

## Findings and changes

| Area | Finding | Result |
| --- | --- | --- |
| Touch movement | A slightly off-centre approach catches on a narrow entrance | Wall sliding centres near-misses by at most 0.31 tiles; physical wall collision remains |
| Exploration | Scrolling caves have no overview; the exit arrow points to an unseen exit | A paused map shows walked ground and discovered landmarks; no unseen exit direction is supplied |
| Exiting | Crossing the exit automatically ends a crystal hunt | A Leave cave button appears at the doorway and names the number of crystals still inside |
| Creature contact | Waiting creatures return before checking collision | Contact is checked after player and creature movement, with a recovery window after a hit |
| Creature hearing | A moving creature can step past the narrow wave-arrival test | Each wave records which creatures have heard it, applying the sound once on arrival |
| Darkness | Remembered floor also makes live creatures visible at distant visited positions | Creature visibility uses current lamplight/echoes only; fixed discovered landmarks remain remembered |
| Sound feedback | Investigation is difficult to read, and nearby warnings can point through walls | Source markers and a distinct creature alert glyph; footstep warnings follow connected passage distance |
| Resume | Reload forgets recharge, waves and parts of creature behaviour | Optional v1 fields retain cooldown, waves/heard flags, invulnerability, routes, patrol/search/stun and discoveries |
| Returning home | A fresh-run button is more prominent than resuming | The main button resumes the unfinished expedition, otherwise continues to the latest unlocked cave |
| Multiple tabs | An older tab can overwrite newly earned stars and records | Writes merge stars and best records against current storage; there remains one unfinished-expedition slot |
| Daily cave | Retrying after London midnight silently generates a different cave | Retry keeps the attempt's date; choosing a fresh Daily uses the current London date |
| Presentation | Lighting and waves reveal individual square cells; stars depend on device fonts | Cached stone texture and smooth lighting, distinct crystal/relic geometry, SVG stars and map legend |

## Verification

- Game contract checker with the current site tracker: **61 pass, 0 warnings**.
  The execution adapter selects the repo-pinned browser and uses the same
  automation-flag handling as the site's test harness. Network calls are intercepted.
- **17 game-specific browser regressions**, covering production objective collection,
  explicit exit, loss, echo propagation/recharge, sound origins, saved reload, map/pause,
  daily rollover, old-format saves, touch steering, darkness and two-tab progress.
- The shared `GAME echo` launch/finish/repeat-guard/saved-reload contract also passes.
- Connected-objective checks cover six campaign caves and 100 deterministic daily caves.
- A known-route bot using production movement, updates and echoes completes all six
  campaign caves with all crystals. Remaining hearts: **3, 3, 3, 3, 2, 1**.
  Its 12–41 second movement times exclude human exploration/decision time; they are
  not estimates of player round length or proof of player-perceived balance.
- Direct original/revised reproductions show contact costing a heart instead of
  being ignored, recharge round-tripping at 2.4 seconds instead of resetting to zero,
  and a creature hearing a passing echo it previously missed.
- Soft terrain lighting updates at 20 Hz while movement, camera and entities render
  each animation frame. A 60-frame headless probe of the largest cave measured
  approximately 2.5 ms per update/draw after caching, versus 9.2 ms for the initial
  uncached visual revision. These are local diagnostics, not real-phone frame rates.
- Rendered inspection: gameplay, notebook map, home and results at 360 and 680 px;
  additional layout/input checks at 320×568 and 780×360. The existing thumbnail is kept.

## Release and remaining acceptance

Ship through a green pull request and the normal tested Pages deployment. Confirm
its public game page and Lab feed item after deployment. Do not mark the game as
finished solely because the automated suite passes.

Still required: a full physical-phone expedition to assess thumb steering, daylight
readability, sound/mute, Android fullscreen transitions and the feeling of the
exploration/creature balance. Live reporting needs a real player's round; the test
browsers never write to the production analytics database.
