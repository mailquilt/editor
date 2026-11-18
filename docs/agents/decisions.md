# Decisions

Choices that are settled. A review doesn't raise these again unless something has changed since, such as a bug report or a new feature that depends on them. Bigger design decisions, with their reasons, are in `docs/adr/`.

A PR that changes one of these says so, gives the reason and updates this page.

## Keys and focus

- Every key the editor answers to is in its key map, `packages/editor/src/key-map.ts`, which says for each place what the key does and whether the press stops there. Handlers hold no rules of their own, and tooltips and `aria-keyshortcuts` name keys from it. (#145)
- Which Block or Row is selected, and where focus is, are owned by `packages/editor/src/selection.ts`. Everything else asks it to select something or move focus, and names where focus goes, such as a Block, its text or a Row's tool. A control pressed with nothing in the editor focused takes focus through the module too, so the Preview returns focus to it. Tooltips read focus from the browser and keep no copy of it. When an update removes or disables the element with focus, focus goes to the same thing again, or else to the nearest one left: a Block's tool gives way to its text, then to the Block, and the link field and the format bar give way to the text. With none of those left, the floating toolbar takes it. A Block's text puts focus back in itself after a format command, which isn't a move. (#146)
- A key acts only with the modifiers the key map gives it. Escape, Tab in a toolbar, and Enter on a Block or held down act with any. (#145)
- Escape closes one thing and stops there: the focused control's tooltip, the link field, what was typed in a settings field, or the Preview. In a Block's text it goes back to the Block and stops. A hovered tooltip closes and the Escape goes on. An Escape that does none of these reaches the host page, so a host's dialog can close. (#66, #78, #79)
- A key that an input method handled does nothing, so an Escape that ends a composition doesn't close a tooltip either. The link field still keeps every key to itself. (#66, #78, #145)
- Ctrl/⌘+Z and Ctrl/⌘+K that the editor acts on don't reach the host page. (#79)
- Alt+← and Alt+→ never go back a page: on a Block, in its toolbar, in its text or in the Row toolbar, and during a drag too. On a Mac, in text, they still move by word. (#54, #79, #145)
- Shift+Ctrl/⌘+B, I and U format text too, or the browser would format it outside the editor on Windows and Linux. (#78)
- The Block and Row toolbars are one Tab stop each, with arrow keys between their buttons. Shift+Tab leaves the toolbar. (#60, #78)
- Each empty Column has one Tab stop per Block type, and `keyboard.mdx` says so. (#36)
- After Delete Block or Delete Row from the keyboard, focus goes to the neighbour and the deletion is announced. (#54)
- The Link button keeps `aria-pressed`, so screen readers say whether the cursor is on a link. (#36)

## The panels

- The Side panel, its settings, the format bar, and the Block, Row and floating toolbars reach the editor only through `PanelApi` in `packages/editor/src/panel-api.ts`: what's selected and its settings, and every change they make. It isn't exported or documented in 0.2. Its `apply` treats a refused Command as an answer, not a bug, as a host's own panel would. (#147)

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
- Exports from `core` marked "not a promise to hosts" are for Mail Quilt's own packages, and come from `@mailquilt/core/internal`, not the main entry. (#61, #84)

## Rendering

- MJML is given `fonts: {}`, so an exported email never loads web fonts. (#52)
- The renderer writes MJML as strings, escaping in one place. It meets the code standard as it is. (ADR 0004)
- Columns that share a Row get their desktop width inline, added to MJML's HTML after it renders, so clients that drop media queries keep them side by side. (#92, ADR 0005)
- Columns don't use the Fab Four `calc()` widths. Outlook.com, Outlook for Mac and Web.de in Firefox stacked them on a desktop. (#92, ADR 0005)
- Text and Headings get their line height in pixels, 1.5 times the font size rounded up, with `mso-line-height-rule:exactly`. With 1.5, classic Outlook drew thin lines under text. (#95)
- A word of 20 or more characters gets a zero-width space after each `/ . - ? & = _`, outside Merge Tags and a URL's `//`, so it can wrap where CSS can't break it. Copied text includes them, and a link's address never does. A URL written as text, and not already linked, is exported as a link to itself, because the break points stop Apple Mail and Gmail linking it. (#91)
- Any `&`, `<`, `>` or `"` inside a Merge Tag is escaped, and the docs say so. Tags should be plain names. (#53, #81)
- An Image in a Column narrower than its padding gets MJML's own negative width. Only very narrow emails reach it. (#36)

## Packages and the docs site

- The editor has no `jsdelivr` or `unpkg` field. The CDN build is loaded by its full path, as the quick start shows. (#36 R7)
- `@repo/typescript-config` stays in the published devDependencies, and core's types keep tsdown's bare `import "valibot"`. Neither affects installs. (#36)
- `withBase` stays: it's Blume's own helper. (#36)
- `loadDocument` runs before `renderEmail` on the docs pages, for a clearer build error. (#36)

## Tests

- The editor's tests run in the browser, apart from the key map's, which are unit tests. (#36, #145)
- Browser tests find an element by role and name, or by a documented part. An element with neither, such as a drag handle, a Column or the Side panel, has a `data-testid`, and no selector uses a class. (#147)
- Core keeps a "stores…" test for each Block type's own settings. (#82)
- "A Row on the canvas shows an outline and its toolbar on hover" failed once in WebKit CI and passed on retry, with no cause found in 25 local runs. It isn't treated as flaky unless it fails again. (#36)
