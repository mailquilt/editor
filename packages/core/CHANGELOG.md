# @mailquilt/core

## 0.2.0

### Minor Changes

- 7c1e04c: A link or image URL that starts with `httpſ:` in place of `https:`, or a color with anything but a plain space after a comma, such as `rgb(0,\n0,0)` or a no-break space, is refused when set. Neither is a link or a color the docs describe. The same goes for a new language code with `ſ` or the Kelvin sign `K` in place of s or k. A saved language still loads whatever it is.
  
  An email saved with 0.1.0 that holds one of these still opens. **Breaking:** emails are now saved as version 2 of the format, and a version 1 email is upgraded as it loads: such a color gets a plain space after each comma, and such a URL starts with `https:`. Mail Quilt 0.1.0 refuses a version 2 email as newer, so update every package that reads your emails, such as a renderer on your server, at the same time.
- 290cedb: **Breaking:** the helpers Mail Quilt's own packages share have moved from `@mailquilt/core` to `@mailquilt/core/internal`, so the main entry exports only what the docs describe. If you imported any of them from `@mailquilt/core`, import them from `@mailquilt/core/internal` instead. They're undocumented, and can still change in any release.
  
  The helpers that moved are `blockLabel`, `blockSettingsFields`, `blockStyles`, `EMAIL_LOOK`, `EMAIL_SETTINGS_FIELDS`, `findBlockPosition`, `hexColor`, `INVALID_LINK`, `isAllowedLinkHref`, `MERGE_TAG`, `ROW_SETTINGS_FIELDS`, `rowLayoutOf`, `rowStyles` and the `SettingsField` type.
- 2f78ecf: **Breaking:** a Command that would change nothing no longer has `unchanged: true` in its result. It's refused with `code: "unchanged"`, as before, and that's now the only way it says so. If your code checks `result.unchanged`, check `result.code === "unchanged"` instead.
  
  - A listener that applies a Command with the same `mergeKey` no longer changes what later listeners hear of the change before it. Each listener hears exactly the Operations of each change.
  - Property changes under one `mergeKey` that end where they started leave no undo step, even when changes to several Blocks or Rows take turns. Before, changing a Block, then a Row, then putting both back left a step that changed nothing, and `canUndo()` was true.
  - A saved email with props that are a Date, a Map or another object JSON can't hold is refused. Before, they loaded as `{}`.
  - A language code with a one-letter subtag, such as `en-x-pirate`, is accepted.
  - `isSameDocument()` tells apart an object with a key named `__proto__` from one without.
  - A refused color's reason shows how to write one, such as `rgba(255, 0, 0, 0.5)` rather than `.5`. A saved Block with props it can't have is refused with the path to them, such as `rows.0.columns.0.blocks.0.props.colour`, as other parts of the email are.
  - The docs now say that an error from hearing of a Command a listener applies is thrown from the call that made the first change, which is what has always happened.
- 808da79: `BlockType` is exported: one of the Block types, as in `BLOCK_TYPES`, whose `type` is now a `BlockType`. A `Block` is typed by its type, so its `props` are that type's, and an email written in TypeScript as a `BlocksDocument` is checked against them. **Breaking:** a Block written without that type, whose `type` is then a `string`, no longer type-checks as a `Block`. Nothing changes when the code runs.
- abea3ec: Core's editor has `canUndo()` and `canRedo()`, and the editor's Undo and Redo buttons are disabled when there's nothing to undo or redo. A refused Command's result has a `code`, such as `noSuchBlock` or `invalidProps`, beside its `reason`, so code can tell one refusal from another. The docs list the codes.
  
  A listener that throws no longer stops later listeners hearing of a change, and its error is still thrown once they all have. The function that ends a subscription returns nothing, and the docs say that subscribing a function that's already subscribed adds nothing.

## 0.1.0

### Minor Changes

- 72b0977: First release of the document model every Mail Quilt package is built on.
  
  - **Document format:** a versioned JSON email of Rows, Columns and Blocks (Text, Heading, Image, Button, Divider and Spacer), with email settings for width, background color, font, preheader and language. `createEmail()` makes a new one, with one empty Text Block.
  - **Loading:** `loadDocument()` checks any input, such as JSON read back from a database, and gives a reason instead of throwing. Unsafe values are refused, such as a `javascript:` link or CSS hidden in a color or font.
  - **Commands:** 12 serializable Commands add, move and remove Blocks and Rows, set a Row's layout (1 to 4 Columns), and update Block props, Row props and email settings. `createEditor()` applies them and reports each change as Operations.
  - **Undo and redo:** typing merges into one step, and a change that ends where it started leaves no step.
  - **Rich text:** bold, italic, underline, links and line breaks, stored as limited JSON. Merge Tags such as `{{first_name}}` stay intact.
