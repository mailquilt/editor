---
"@mailquilt/renderer": patch
---

The plain text writes a link's URL right after the link's words, before a line break that follows it, instead of after the break and against the next line's words. It follows the desktop version, so a Row or Block shown only on phones is left out, and its desktop twin's words aren't written twice. Check reads a Text Block's or Heading's contrast at its Phone font size too, counts a URL written in text as a link to the unsubscribe Merge Tag, and reads `mergeTags: null` as no list instead of failing at the first Merge Tag. A contrast's colors and ratio now agree, as each channel is rounded to the 8 bits a screen draws. An email whose only use of a web font is a Video's line now loads the font. A List's indent follows the Phone font size, and a Menu's links open in a new tab, as the other links do.
