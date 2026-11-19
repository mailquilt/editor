---
"@mailquilt/editor": patch
---

Fixes from the WCAG 2.2 AA audit:

- A pressed format button, such as Bold, and an active Link or Select Row button now have an edge, so you can tell they're on without relying on color.
- Settings fields have a darker edge, at 3:1 against the panel, so an empty one still reads as a field.
- Escape closes the Preview from inside its email too, as the docs say. In Safari, Shift+Tab still goes back to Close.
- In forced colors, such as Windows High Contrast, the drop line during a drag and the tiles in the Content and Rows tabs are drawn in the system's colors instead of disappearing.
