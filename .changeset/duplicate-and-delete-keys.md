---
"@mailquilt/core": minor
"@mailquilt/editor": minor
---

Duplicate, and Delete or Backspace, for a selected Block or Row. The Block's and Row's toolbars get a Duplicate button, and Ctrl/⌘+D on a Block, in its toolbar or in a Row's toolbar duplicates it there instead of bookmarking the page. The copy goes right after the original, is selected, and the editor says where it went, such as "Block duplicated, Row 1, Column 1, position 2 of 3". A Row whose Column widths aren't one of the layouts is copied with even Columns, as many as it has. Delete and Backspace on a Block, or in a Row's toolbar, delete it as the Delete buttons do. In text and fields these keys are unchanged. Underneath, `insertBlock` and `insertBlockInNewRow` take optional `props`, checked against the Block type's schema, and `insertRow` takes optional `props` for the Row and `columns`, one for each of the layout's Columns, with their Blocks as `{ type, props }`. Core makes every new ID, and each is one undo step. The new `NewBlock` and `NewColumn` types describe `columns`.
