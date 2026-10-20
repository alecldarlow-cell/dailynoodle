# Puzzle mobile usability pass — 20 October 2026

Reviewed the seven current shared players in local Chromium phone emulation with the pinned production fonts. Existing portrait layouts and the shared start/result design are retained. Puzzle rules, ids and save formats are unchanged.

## Confirmed issues and changes

| Player | Finding | Change |
| --- | --- | --- |
| Mini | At 780×360 the board shrank to 51×51 pixels; enlarged action labels overflowed. | Board beside controls, clue and keys in short landscape; labels can wrap. The same board now measures 268×268. |
| Doku | The bank below the board left a 140×140 landscape grid. | Bank beside a 290×290 grid. |
| Path | Landscape board extended below the screen, with Undo and Hint further down. | Board beside instructions and actions; the whole 270×270 board and both actions fit. |
| Sweep | Landscape left a 157×157 grid. | Mode, hint and messages beside a 288×288 grid. |
| Link | General mobile button padding also applied to word tiles; long words shrank to nine pixels. On a 568×320 screen tiles could overlap actions. | Separate tile/action padding; shared minimum 12px type, with balanced wrapping when a whole word cannot fit. Refit after fonts load. Actions beside the board in short landscape and able to wrap with larger text. |
| Tangle | Landscape hid the bottom half of the board. Small-phone start instructions/settings were below an unscrollable page. | Word list beside a full board, scrollable home, and wrapping score/banner text. Large-text play can scroll if needed. |
| Shared results | A generic engine hover rule could make the Share background pale while leaving its text white after a tap. | Keep the contrasting primary colour when hovered or tapped. |
| Borders | Landscape reduced the country map to 74 pixels tall. | Answers beside the map, which now has 278 pixels of height. |

Measurements above use 780×360, except the explicitly noted Link case. Landscape layouts reserve the available safe-area insets. They apply only to short screens; the five grid/tile players additionally require a coarse touch pointer.

## Verification

`node tools/tests/browser-run.js --project=chromium puzzle-mobile.spec.js` runs eight required regressions. Seven open at 320×568, rotate through 780×360 and 568×320, and return to portrait. Checks cover visible/hittable controls, no horizontal page overflow, board size, retained letters/selections/question choices and input after rotation. Mini and Link action labels are additionally enlarged by 50%. Link checks complete tile text and the minimum font size.

The eighth regression reopens a saved Mini result and checks that Share retains its contrasting background on hover; it fails before the shared CSS fix.

The old versions of Mini, Doku, Path, Sweep and Link fail these new checks. Tangle and Borders use their real Full screen setting switched off for window-resize emulation; OS fullscreen cannot be resized through Playwright's window API. Existing player tests still exercise their ordinary play/finish paths.

The one-off audit also inspected 360×640 and enlarged all interface text by 50% at 320×568. Large text may require vertical scrolling; it must not become hidden. All seven players were also played to completion at 320×568 using their real controls; result sharing and opening the next puzzle succeeded. Share sheets were captured through the test browser, without sending messages. The release suite retains existing start/finish screenshots and all seven play-to-finish regressions.

This is browser emulation. Real Android/iPhone checks of browser bars, notches, keyboard behaviour, fullscreen and native sharing remain the device checklist in [testing.md](testing.md).
