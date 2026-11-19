---
"@mailquilt/editor": patch
---

- A tab pasted or dropped into a Block's text becomes a space, as the export shows it. Before, the canvas showed it as a wide gap that no email client can draw.
- A Text Block or Heading has the export's line height on the canvas: 1.5 times its font size, rounded up to a whole pixel. Only a font size with a half pixel in its line height, such as 15px, changes.
