---
"@mailquilt/editor": patch
---

- A drag near the edge of the window no longer jumps a long way when the tab comes back from the background, or after the page was busy. Each frame scrolls at most a tenth of a second's worth.
- In forced colors, such as Windows High Contrast, a dropdown in the settings shows its arrow.
- Scrolling with the wheel over a focused number field in the settings still leaves its value as it was. Focus now moves to the floating toolbar, rather than leaving the editor, so keyboard undo keeps working.
