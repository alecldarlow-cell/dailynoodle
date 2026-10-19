// Pinned npm font packages keep browser tests independent of Google Fonts.
'use strict';
const fs = require('fs'), path = require('path');
function css() {
  let s = '';
  for (const [pkg, family, weights, styles] of [
    ['archivo', 'Archivo', [400,500,600,700], ['normal']],
    ['instrument-serif', 'Instrument Serif', [400], ['normal','italic']],
    ['lora','Lora',[500],['normal','italic']],
    ['nunito','Nunito',[600,800],['normal']],
  ]) for (const weight of weights) for (const style of styles) {
    s += `@font-face{font-family:'${family}';font-style:${style};font-weight:${weight};font-display:block;src:url('/__fonts/${pkg}/${pkg}-latin-${weight}-${style}.woff2') format('woff2')}\n`;
  }
  // Keep emoji deterministic as well; the stripped browser fallback font
  // otherwise draws a missing-glyph box in result/share lines.
  for (const family of ['Archivo','Instrument Serif','Nunito','Lora','Open Sans','Arial','Georgia'])
    s += `@font-face{font-family:'${family}';font-style:normal;font-weight:100 900;font-display:block;src:url('/__fonts/noto-emoji/noto-emoji-emoji-400-normal.woff2') format('woff2');unicode-range:U+1F000-1FAFF,U+2600-27BF,U+200D,U+FE0F}\n`;
  for (const family of ['Archivo','Instrument Serif','Nunito','Lora','Open Sans','Arial','Georgia'])
    s += `@font-face{font-family:'${family}';font-style:normal;font-weight:100 900;font-display:block;src:url('/__fonts/test-symbols.woff') format('woff');unicode-range:U+2190-21FF,U+2300-23FF,U+2B00-2BFF}\n`;
  return s;
}
function file(rel) {
  if (rel === 'test-symbols.woff') return fs.readFileSync(path.join(__dirname,'fixtures/fonts/test-symbols.woff'));
  const [pkg, name] = rel.split('/');
  if (!['archivo','instrument-serif','lora','nunito','noto-emoji'].includes(pkg) || !/^[\w.-]+\.woff2$/.test(name || '')) throw new Error('Unknown font '+rel);
  return fs.readFileSync(path.join(path.dirname(require.resolve('@fontsource/'+pkg+'/package.json')), 'files', name));
}
module.exports = { css, file };
