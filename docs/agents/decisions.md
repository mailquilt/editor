# Decisions

Choices that are settled. A review doesn't raise these again unless something has changed since, such as a bug report or a new feature that depends on them. Bigger design decisions, with their reasons, are in `docs/adr/`.

A PR that changes one of these says so, gives the reason and updates this page.

## Keys and focus

- Escape closes one thing and stops there: the focused control's tooltip, the link field, what was typed in a settings field, or the Preview. In a Block's text it goes back to the Block and stops. A hovered tooltip closes and the Escape goes on. An Escape that does none of these reaches the host page, so a host's dialog can close. (#66, #78, #79)
- Escape, Ctrl/⌘+Z and Ctrl/⌘+K that an input method handled do nothing. (#66, #78)
- Ctrl/⌘+Z and Ctrl/⌘+K that the editor acts on don't reach the host page. (#79)
- Alt+← and Alt+→ never go back a page: on a Block, in its toolbar, in its text or in the Row toolbar. On a Mac, in text, they still move by word. (#54, #79)
- Shift+Ctrl/⌘+B, I and U format text too, or the browser would format it outside the editor on Windows and Linux. (#78)
- The Block and Row toolbars are one Tab stop each, with arrow keys between their buttons. Shift+Tab leaves the toolbar. (#60, #78)
- Each empty Column has one Tab stop per Block type, and `keyboard.mdx` says so. (#36)
- After Delete Block or Delete Row from the keyboard, focus goes to the neighbour and the deletion is announced. (#54)
- The Link button keeps `aria-pressed`, so screen readers say whether the cursor is on a link. (#36)

## Editing

- Links accept any `https:`, `http:`, `mailto:` or `tel:` URL, or a Merge Tag. (#36)
- A new Row from the Rows tab is selected, as a dragged one is. (#54)
- A drag scrolls a container only within 60px of its edge, and passes on to the next container once one can't go further. (#78)
- A file dropped on the editor is refused, as there's no image upload yet. (#79)
- Import JSON has no confirm, and reads a file of any size. (#36)
- `value` and each keystroke copy the whole email. That's fine at email sizes. (#36 E15)

## The Shell

- With `save-key`, a saved email opens instead of the host's first `value`, and stays when the host sets that first email again. (#42)
- Reading `value` or calling `exportHtml()` before the first update starts the Shell, so `value` is the email the editor opens. (#79)
- `actions` isn't reflected back to its attribute. (#78)
- A saved email that can't be opened is kept under `<save-key>:unopened`. (#66)

## Core and the document

- An insert or a removal gives its place as `at`, as a move gives `from` and `to`. An ID at the top of an Operation names what changed. (#80)
- `undo()` returns a boolean. (#36)
- `setRowLayout` to the layout a Row already has comes back `unchanged`. (#52)
- A saved language that isn't a code still loads, and can be sent back unchanged. Only a new one has to be a code. (#79)
- An email is at most 1200px wide, and a font family needs at least one name. (#78)
- Exports from `core` marked "not a promise to hosts" are for Mail Quilt's own packages. (#61)

## Rendering

- MJML is given `fonts: {}`, so an exported email never loads web fonts. (#52)
- The renderer writes MJML as strings, escaping in one place. It meets the code standard as it is. (ADR 0004)
- Any `&`, `<`, `>` or `"` inside a Merge Tag is escaped, and the docs say so. Tags should be plain names. (#53, #81)
- An Image in a Column narrower than its padding gets MJML's own negative width. Only very narrow emails reach it. (#36)

## Packages and the docs site

- The editor has no `jsdelivr` or `unpkg` field. The CDN build is loaded by its full path, as the quick start shows. (#36 R7)
- `@repo/typescript-config` stays in the published devDependencies, and core's types keep tsdown's bare `import "valibot"`. Neither affects installs. (#36)
- `withBase` stays: it's Blume's own helper. (#36)
- `loadDocument` runs before `renderEmail` on the docs pages, for a clearer build error. (#36)

## Tests

- There's no unit-test setup for the editor. Its tests run in the browser. (#36)
- Core keeps a "stores…" test for each Block type's own settings. (#82)
- "A Row on the canvas shows an outline and its toolbar on hover" failed once in WebKit CI and passed on retry, with no cause found in 25 local runs. It isn't treated as flaky unless it fails again. (#36)
