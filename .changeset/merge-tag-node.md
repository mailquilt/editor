---
"@mailquilt/core": minor
"@mailquilt/renderer": minor
"@mailquilt/editor": minor
"@mailquilt/react": minor
---

Breaking: the saved format is version 3, and a Merge Tag in a Text or Heading Block is one unit. In rich text it's a `mergeTag` node, `{ "type": "mergeTag", "attrs": { "name": "first_name" } }`, whose name is what goes between the braces, exactly as written. Backspace and Delete remove a tag whole, the cursor can't go inside it, and formatting goes on all of it. A tag becomes a node when its `}}` is typed, and each tag in pasted text does too. On the canvas a tag shows its name, and a screen reader, its tooltip and a plain-text copy give `{{name}}`. An email saved with version 2 is upgraded as it loads, and exports exactly as before. An email saved with version 3 can't be opened by an older package, such as a render worker still on `0.2`. The new `RichTextMergeTag` type describes the node.
