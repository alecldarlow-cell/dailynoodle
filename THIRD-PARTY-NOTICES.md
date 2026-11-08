# Third-party notices — The Daily Noodle website

The Daily Noodle's puzzles, clues, word choices, pages, code, pictures and sounds are © The Daily Noodle.
All rights reserved, apart from the third-party material below, which is used under its own licence.
The repository is public to read; that does not grant a licence to copy or reuse it.

## Word lists
Mini, Doku, Tangle, Yarn and Tumbler word lists were built with SCOWL (sizes 10–70, British) and the
en-GB Hunspell dictionary derived from it (npm `dictionary-en-gb`, MIT AND BSD), filtered by
frequency with wordfreq (https://github.com/rspeer/wordfreq; code Apache-2.0, data CC BY-SA 4.0 —
used only to choose words, no frequency data is redistributed). SCOWL's notice:

> Copyright 2000-2018 by Kevin Atkinson
>
> Permission to use, copy, modify, distribute and sell these word lists, the associated scripts,
> the output created from the scripts, and its documentation for any purpose is hereby granted
> without fee, provided that the above copyright notice appears in all copies and that both that
> copyright notice and this permission notice appear in supporting documentation. Kevin Atkinson
> makes no representations about the suitability of this array for any purpose. It is provided
> "as is" without express or implied warranty.

SCOWL's full copyright, sources and credits (Ispell and WordNet notices included):
`licenses/scowl-hunspell-en-GB.txt`.

## Maps
Borders and Borderline country outlines: Natural Earth 1:50m (https://www.naturalearthdata.com), public domain.

## Fonts
Archivo, Inter and Instrument Serif (pages, via Google Fonts), SIL Open Font License 1.1.
Test-only: `tools/tests/fixtures/fonts/test-symbols.woff`, a DejaVu Sans subset (its licence is beside it);
test dependencies in `package.json` (Fontsource fonts, OFL-1.1; axe-core, MPL-2.0; Playwright, Apache-2.0)
are used for testing only and are not published on the site.

## The app
The Daily Noodle app's notices, including every open-source package it is built from:
https://github.com/alecldarlow-cell/Daily-noodle-app/blob/main/THIRD-PARTY-NOTICES.md
