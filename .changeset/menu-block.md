---
"@mailquilt/core": minor
"@mailquilt/renderer": minor
"@mailquilt/editor": minor
---

The Menu Block, part of format version 4: a row of links, each a `label` and a `url` checked as any link is, with `align`, `color`, `fontSize` and `gap`, the space between links. Its font size can have a Phone value. A link without a label or a URL is kept, faded on the canvas, and left out of the export, plain text and copies, and a Menu with no link that has both is left out, as an Image without a `src` is.

The renderer writes the links in one line that wraps, with half the gap on either side of each, so every line ends at the same place whatever the alignment, and in Outlook on Windows as a table's cells, as MJML's navbar does. `renderText` writes each link as its label and URL. `checkEmail` reports a Menu's links whose color has too little contrast as `low-link-contrast`, a link that says only something like "Learn more" as `vague-link-text` on `links`, and counts a Menu's link to the unsubscribe Merge Tag. A link the email leaves out, without a label or a URL, counts for neither, and its Merge Tags aren't checked against `mergeTags`. A long label with no spaces breaks onto the next line, as on the canvas.

In the editor, a Menu's Selection bar has its Links, alignment, text color, font size and the space between links. Its links are a list in the Links popover, each a line of its label, its URL, and Move up, Move down and Remove, with Add link after them. A new Menu shows "Add the links this menu shows" on the Canvas, and the bar's Add link adds the first link with focus in its label. In Style, the text color, body size and body font reach Menus, and a Menu's own color or size is one it keeps. Check's fix for a Menu link that says too little puts focus in that link's label.

Breaking: `BlockType` and `BlockProps` gain `menu`, so a `switch` that handles every type no longer compiles until it handles it. `STRINGS`, `StringId` and `MailQuiltStrings` gain `block.menu`, `menu.noLinks`, `field.menuGap`, `field.menuLabel`, `field.menuLinks`, `field.menuLinks.add`, `field.menuLinks.description`, `field.menuLinks.item`, `invalid.menuLabel` and `invalid.menuLinks`. Measured with `tsc`:

- Still compiles: a partial translation typed `MailQuiltStrings`, and a full one spread from `STRINGS`.
- Stops compiling: a full translation typed `Record<StringId, string>` and written out ID by ID. Add the new IDs to it.
