---
"@mailquilt/core": patch
"@mailquilt/renderer": patch
"@mailquilt/editor": patch
---

Two details of the export, found by the 0.3.0 Email on Acid run. Each paragraph and List item has the email's font on its own tag, as a heading does, because Libero gave paragraphs a font of its own while List items kept the email's. And a Social Block's icons that wrap onto a second line now line up the same on every line: right-aligned, each line ends at the Block's edge, where before the last line ended further right. Half the gap between icons is on every side of each icon, and the Block's padding is that much less, so a single line sits where it did, on the canvas and in the email.
