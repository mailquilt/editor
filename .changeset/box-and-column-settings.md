---
"@mailquilt/core": minor
"@mailquilt/renderer": minor
"@mailquilt/editor": minor
---

Breaking: every Block has a Box: optional `paddingTop`, `paddingRight`, `paddingBottom` and `paddingLeft`, `boxBackgroundColor`, `borderWidth`, `borderStyle` and `borderColor`, and `borderRadius`, which on a Button shapes the Button itself, over Email style's button corners. A Column's `props` take `backgroundColor`, the four paddings, `verticalAlign` and a border, set by the new `updateColumnProps` Command, which records a `setProps` Operation with the Column's `columnId`. `insertRow` takes each new Column's `props`. All are part of format version 4.

The renderer writes each of them into the exported HTML, and `checkEmail` reads a Block's and a Column's background for text contrast. Outlook on Windows draws corners square.

In the editor, More has a Block's Box, and a Column is selected from the Selection bar chip's menu, which now names it between the Row and the email, or by a press on the Column's own space. Its bar has its background, padding, alignment and border.
