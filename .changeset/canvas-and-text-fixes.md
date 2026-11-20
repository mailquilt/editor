---
"@mailquilt/editor": patch
---

Small fixes on the canvas and in the text:

- Setting `value` to a different email while someone types keeps focus in the editor, on the floating toolbar, instead of dropping it to the page.
- After deleting a Block or Row from the keyboard, focus goes straight to its neighbour, without stopping on the floating toolbar.
- Ctrl/⌘+Z and Shift+Ctrl/⌘+Z with nothing to undo or redo reach your page.
- Alt+← and Alt+→ in a Row's toolbar no longer announce that the Row can't move.
- Linking a selection of only a line break puts the URL in its place as linked text, instead of a link no one can see.
- Bold, italic or underline with no text selected, such as all of an empty text, goes on or off what's typed next.
- The drop line shows where a drag will land on a page that scales the editor.
- Typing a failed image URL in again tries to load it again.
- On a touch screen, each Row's tag shows, so a Row can be selected, and swiping up or down on the Side panel's tiles scrolls it.
- On Apple devices, tooltips write Alt as ⌥, like ⇧ and ⌘.
- A Block's description for screen readers names each key it answers to from the editor's key map, such as Alt+ArrowUp.
