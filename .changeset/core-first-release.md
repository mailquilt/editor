---
"@mailquilt/core": minor
---

First release of the document model every Mail Quilt package is built on.

- **Document format:** a versioned JSON email of Rows, Columns and Blocks (Text, Heading, Image, Button, Divider and Spacer), with email settings for width, background color, font, preheader and language. `createEmail()` makes an empty one.
- **Loading:** `loadDocument()` checks any input, such as JSON read back from a database, and gives a reason instead of throwing. Unsafe values are refused, such as a `javascript:` link or CSS hidden in a color or font.
- **Commands:** 12 serializable Commands add, move and remove Blocks and Rows, set a Row's layout (1 to 4 Columns), and update Block props, Row props and email settings. `createEditor()` applies them and reports each change as Operations.
- **Undo and redo:** typing merges into one step, and a change that ends where it started leaves no step.
- **Rich text:** bold, italic, underline, links and line breaks, stored as limited JSON. Merge Tags such as `{{first_name}}` stay intact.
