---
"@mailquilt/editor": minor
---

Breaking: a Block is added where the person is working, and the side panel is gone. Resting the mouse on the edge between two Blocks shows a line with a +, which opens a picker there, with a search, that adds below the Block above. An empty Column has one button, "Add a Block, or drop one here", that opens the picker in the Column. The Add panel, opened by Add at the end of the Selection bar with nothing selected, or by `/` from a Block or the bar, has every Block type and the empty Rows' layouts, with a search, to add after what's selected or to drag onto the email. It docks before the email where there's room, and otherwise opens over the workspace's edge. A new Block is selected and announced with its type and where it is.

What changes for a host:

- The side panel and its Content and Rows tabs are gone, and with them the editor's 320px on the right. More docks beside the email from 1000px wide for the usual 600px email, where it needed 1320px, or 1288px with the Add panel docked too. The Add panel docks from 968px.
- `/` is the editor's on a Block, in the Selection bar outside its fields, on an empty Column's button and in the toolbar below the email, so it no longer reaches your page from there. In text and fields it's still typed.
- A test of your own that clicked the Content or Rows tab, a tile named "Add Text Block" in the side panel, or an empty Column's "Add Text Block here", now opens the Add panel with Add or `/`, or presses the empty Column's button, named "Add a Block, or drop one here, in Row 1, Column 2", and picks "Add Text Block" in the picker.
- The editor's `strings` gain the Add panel's and the picker's words under `add.`, and `said.blockAdded`, lose `canvas.addHere` and the side panel's words, `side.panel`, `side.content`, `side.rows`, `side.blocks`, `side.blocksHelp`, `side.addContent`, `side.addBlock`, `side.layouts`, `side.layoutsHelp`, `side.addRow` and `side.addLayout`, and `canvas.dropHere` and `canvas.addToColumn` say "Add a Block, or drop one here".
- No theme token is added or changed. The Add panel and the picker use the side panel's tokens.
