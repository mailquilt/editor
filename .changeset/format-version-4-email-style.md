---
"@mailquilt/core": minor
"@mailquilt/renderer": minor
"@mailquilt/editor": minor
"@mailquilt/react": minor
---

Breaking: the saved format is version 4, with an optional Email style in the email's settings. `settings.style` sets the look every Block uses unless it sets its own: the email's color behind its Rows, the text, link and button colors, a heading font, the sizes of Heading 1 to 3 and body text, and button corners. A Block's own value wins, then Email style, then the built-in look. The new `updateEmailStyle` Command sets and clears its fields, and the `EmailStyle` type describes it. The renderer writes it into the exported HTML. An email saved with version 3 loads unchanged and exports exactly as before. An email saved with version 4 can't be opened by an older package, such as a render worker still on `0.3`.
