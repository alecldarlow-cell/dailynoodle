# Paper Planes: individual flights (20 October 2026)

Canonical source: `reports/2026-10-17-arcade-paper-planes.html` in
`alecldarlow-cell/dailynoodle`. Publish to `main`; Build feed tests and deploys
it. The attached Digi Games project rules predate this repo/domain move;
`SITE.md` is authoritative for publishing.

Home postcards, Fly now and Hangar now all start a three-throw flight at one
selected place. Two stars permanently unlock the next place, without moving
the current flight. Retry this flight stays at that place; Next is an explicit
end-screen action. Choose flight is available from pause (including in the
air), landing, end and Hangar. Switching abandons the active round, retaining
earned clips, stars, upgrades and unlocks. Daily Flight retains its separate
three-throws-per-day rules and sharing.

The existing save key, file path, publication date, thumbnail and game slug
are unchanged. `selectedPlace` is an additive save field. Individual flights
now resume on reload with their remaining throws and best score. A legacy
`run` save becomes a fresh three-throw flight at its reached place, preserving
banked progress; its cross-level best is not reused as that place's score.
Legacy reached places stay accessible. Unvisited new places require two stars
at the preceding place.

Tracking: one round is one three-throw flight; level is the chosen place,
1–8. Starting another flight or switching place abandons an unfinished round
(no synthetic end). Resume/retry arm a new start, emitted on actual play.
A completed place flight wins if its best throw earned at least two stars;
its `stars` event field rates that flight's best throw. Score sharing stays on
the end screen. The old multi-place run code is dormant for compatibility,
with all standard entry points mapped to individual flights.

Regression coverage: `PLANES-FLIGHT-01..05` in
`tools/tests/browser/games.spec.js`, alongside the existing Paper Planes,
Daily and sharing tests. Tests arrange landing distances via a gated
`__dg.landAt` hook into production `launch`/`land`; UI navigation uses real
input. The in-air navigation test pauses the browser clock to prevent the
plane landing during the input sequence.

The supplied `4-dg-check.js` checks the tracker and layout at 360px and 680px.
On the current site it needs the normal-phone UA/automation-flag setup used
by the repo harness: the live tracker intentionally excludes automated
browsers. Its two first-tap warnings come from coordinate taps that don't
launch a plane on this menu layout. Dedicated tests verify start/end counts,
retry/resume and abandoned flights. Phone hardware checks (thumb reach,
Android fullscreen and a whole flight) and private admin verification remain
manual.
