---
"@mailquilt/editor": patch
---

The editor installs `prosemirror-view` 1.42, and not 1.43. With 1.43.0, a click back into a text you had left put the cursor at the start of the text in Safari, not where you clicked, and typing straight after a click did the same in Chrome and Firefox.
