---
"@mailquilt/core": minor
"@mailquilt/renderer": minor
"@mailquilt/editor": minor
"@mailquilt/react": minor
---

Breaking: a Text Block can hold bulleted and numbered Lists, one level deep, with one paragraph in each item. In rich text they're `bulletList` and `orderedList` nodes holding `listItem`s, part of format version 3, and `RichTextDocument`'s `content` can now hold a `RichTextList` as well as a `RichTextParagraph`. A Heading can't have Lists, and its text is the new `RichTextHeadingDocument` type. The export writes each List as `<ul>` or `<ol>` with its margins and padding inline, and each item with a paragraph's styles and line height. A numbered List starts at 1. The format bar gets Bulleted list and Numbered list buttons, which show when they're on, and Shift+Ctrl/⌘+8 and Shift+Ctrl/⌘+7 turn them on and off on any keyboard layout. Enter in an empty item leaves the List, Backspace at the start of an item makes it a paragraph, and Backspace at the start of the paragraph after a List joins it to the last item. Delete at the end of a List's last item, or of the paragraph before a List, pulls in the next paragraph or the next List's first item, and that List keeps its type. Two Lists of one type left next to each other by Backspace or Delete become one. A pasted List comes in as a List, with any List inside it flattened to one level. Typing "- " or "1. " stays as typed.
