# Inkline level design

Inkline's levels are made by hand, one idea each, and checked by bot. This folder holds the level source and the tools. The physics always comes from the game file itself (`reports/2026-11-05-arcade-inkline.html`), so there is one source of truth.

Alec's standard (6 Nov 2026): every level must be solvable with a sensible drawing, and should have a clever or intuitive solution. The marble starts high.

## Files

| File | What it is |
| --- | --- |
| `levels.js` | The levels: each has `n` (name), `h` (hint), `idea` (what the player should realise), the scenery, and `sol` (the line a person would draw). `show` holds other lines worth checking, such as the wrong peg pairs. `LV.CH` lists the chapters. |
| `parts.js` | Helpers: `plank` (rounded scenery from point to point), `block` (crisp box), `on` (marble resting on a plank). |
| `gems.json` | Two gems per level, and the best three-star line found. |
| `rig.js` | Runs the game's physics with strokes sampled like a finger, plus a wobbly-hand model. |
| `check.js` | The bar every level must clear (below). |
| `gems.js` | Places gems for the listed levels. |
| `endtest.js` | How smoothly a rolling marble gets on to a line's end: speed kept and hop height, in four everyday cases. |
| `viz.js` | Draws levels with the marble's paths (needs Playwright, already in the repo's dev tools). |
| `assemble.js` | Writes the levels, gems, hints, chapters, Daily and home-screen demo line into the game file. |

## Workflow

1. Write or change a level in `levels.js`.
2. `node toolchain/inkline/viz.js levels.js /tmp/v.png 0,1` and look at it.
3. `node toolchain/inkline/check.js 0,1` until it passes the bar.
4. `node toolchain/inkline/gems.js 0,1`.
5. `node toolchain/inkline/assemble.js`, then play the game file, then run the site tests.

## The bar

- **The level never finishes by itself:** tiny harmless lines, and the marble nudged by fractions of a pixel.
- **The intended line wins,** and still wins at least 85% of the time when drawn by the wobbly hand: shifted up to 6 px, turned up to 3°, stretched up to 4%, with jitter.
- **Wrong choices lose,** for example the decoy peg pairs.
- **A random sweep finds no cheap exploits:** about 1,500 human-style strokes, with a look at what wins.
- **Three stars:** a variation of the same idea can take both gems, not a lucky dropped line.

## Physics facts that shape levels (learned 6 Nov 2026)

- **Energy budget:** a marble from the top reaches the bottom of a long chute at about 11 units. It slides more than it rolls on steep chutes, and spins up on curves, so some speed goes into spin.
- **Ramps need a flat run-up:** a ramp whose foot sits on a curve costs about half the speed. A 35° ramp on flat ground keeps about two-thirds. Leave a margin: walls only 40–60 px above the run-up.
- **Line ends are wedges,** flat underneath, tapering on top over 56 px (a third of a short line), and they follow the line's bends. A short line's wedge is steeper, so a stick lying in the marble's path is a small kicker: check that levels with a jump cannot be won by dropping a stick (Ski Jump's wall had to rise for this).
- **Ends seat themselves:** a free line heading into a surface just beyond its end is extended to touch it (`reachEnds`); a pegged line's end within 14 px bends onto the surface (`settleEnds`). Lines laid along a surface rest on it exactly (`clearOf`). `endtest.js` measures how smoothly a rolling marble gets on to a line.
- **A pinned line resting on scenery holds its angle** until knocked; without that it crept off its support (Hinge).
- **Lines are heavy** (density 0.008, about four times the marble), so a resting ramp is not shoved aside.
- **Lines grip scenery** (friction 0.9). The marble's grip is 0.02, and a pair uses the lower, so the marble is not slowed.
- **Pegs are pins in the paper:** the marble rolls over them, and they catch a line within 15 px (`PEGR`).
- **One peg makes a pivot,** using `pin()`, not Matter's constraint, which drifts with multi-part bodies. Two pegs lock the line.
- **Planks are rounded** (`plank`, 6th value 1), so curves made of short planks are smooth. Blocks keep 2 px corners, so a marble can sit near an edge.
- **Drop zones need room:** the marble bounces off walls, so leave a shaft at least 30 px wide over a cup, use a low cup (`c[3]=1`) against a wall, or add a funnel plank.
- **Don't let the marble jump a gap on its own:** use a wide gap (about 80–100 px) with level ledges, or drop the marble onto the gap from above.
