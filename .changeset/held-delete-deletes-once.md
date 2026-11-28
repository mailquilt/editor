---
"@mailquilt/editor": patch
---

Holding Delete or Backspace on a Block, or in the Selection bar with a Row selected, deletes that one Block or Row. Before, each of the key's repeats deleted the next one, as focus had moved to it, so holding the key emptied the email one undo step at a time. The repeats still go no further than the editor.
