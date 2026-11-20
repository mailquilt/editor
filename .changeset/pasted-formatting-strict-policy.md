---
"@mailquilt/editor": patch
---

Text pasted from Google Docs or Word keeps its bold, italic and underline on a page whose Content Security Policy has no `'unsafe-inline'` in `style-src`. Before, in Chrome, Edge and Safari, it came in all bold and lost its italic and underline. The dropdowns' arrows show under a policy whose `img-src` doesn't allow `data:`. The API page says what `img-src` the canvas and Preview need.
