---
"@mailquilt/editor": minor
---

Breaking: one Selection bar above the email holds what's selected, in place of the selected Block's toolbar, each Row's toolbar and the side panel's Settings tab. It shows a Block's or a Row's main settings and its Move, Duplicate and Delete buttons, or with nothing selected the email's preheader, language and width. Its chip says what's selected and where, such as "Row 3 / Button", and its menu selects the Block's Row, or the email. A setting of several fields, such as a Row's padding or a color, opens a popover from its button, and More opens the rest: the settings the bar doesn't show, then Copy, Cut, Paste below, the moves into another Column and Select Row. More docks beside the email where there's room, and otherwise opens over it. The format bar stays beside the text being edited.

The bar is one stop for Tab, reached from the selected Block after its text, and the arrow keys go along its controls. The keys for moving, duplicating, deleting, copying, cutting and pasting are the same as before, and do the same. With a Row selected, they work in the bar, where a Row's toolbar had them, and a Row is selected by its tag, or from the keyboard by the chip's menu, or for a Row of empty Columns, by focus on one of its Columns.

What changes for a host:

- A test of your own that clicked a Block's or a Row's toolbar, or the Settings tab, now selects the Block or Row and uses the Selection bar, named "Button settings", "Row 2 settings" or "Email settings". The bar's More button is "More settings and actions", apart from the Shell's own More.
- No theme token is added or changed. The bar and More use the side panel's tokens.
