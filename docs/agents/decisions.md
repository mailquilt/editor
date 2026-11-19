# Decisions

Choices that are settled. A review doesn't raise these again unless something has changed since, such as a bug report or a new feature that depends on them. Bigger design decisions, with their reasons, are in `docs/adr/`.

A PR that changes one of these says so, gives the reason and updates this page.

## Keys and focus

- Every key the editor answers to is in its key map, `packages/editor/src/key-map.ts`, which says for each place what the key does and whether the press stops there. Handlers hold no rules of their own, and tooltips and `aria-keyshortcuts` name keys from it. (#145)
- Which Block or Row is selected, where focus is, and what the Side panel shows, are owned by `packages/editor/src/selection.ts`. Everything else asks it to select something or move focus, and names where focus goes, such as a Block, its text or a Row's tool. A control pressed with nothing in the editor focused takes focus through the module too, so the Preview returns focus to it. Tooltips read focus from the browser and keep no copy of it. When an update removes or disables the element with focus, focus goes to the same thing again, or else to the nearest one left: a Block's tool gives way to its text, then to the Block, and the link field and the format bar give way to the text. With none of those left, the floating toolbar takes it. A Block's text puts focus back in itself after a format command, which isn't a move. (#146)
- Each place that focus, keys, a press or a drag finds is declared once, in `packages/editor/src/editor-places.ts`, and found by its `data-place`. No code finds the editor's own elements by a class. A place's keys are under its name in the key map, and the innermost place with keys answers. Input to a Block's text is the only input the editor checks, so a field inside a Block needs nothing of its own. (#175, ADR 0007)
- A key acts only with the modifiers the key map gives it. Escape, Tab in a toolbar, and Enter on a Block or held down act with any. (#145)
- Escape closes one thing and stops there: the focused control's tooltip, the link field, what was typed in a settings field, or the Preview. In a Block's text it goes back to the Block and stops. A hovered tooltip closes and the Escape goes on. An Escape that does none of these reaches the host page, so a host's dialog can close. (#66, #78, #79)
- A key that an input method handled does nothing, so an Escape that ends a composition doesn't close a tooltip either. The link field still keeps every key to itself. (#66, #78, #145)
- Ctrl/⌘+Z and Ctrl/⌘+K that the editor acts on don't reach the host page. Ctrl/⌘+K acts only with a Block that has text selected, so on a Button, or with nothing selected, it reaches the host page. (#79, #165)
- Alt+← and Alt+→ never go back a page from anywhere in the editor, the narrow notice and the email in the Preview too, and during a drag. On a Mac, in text, they still move by word. (#54, #79, #145, #165)
- Shift+Ctrl/⌘+B, I and U format text too, or the browser would format it outside the editor on Windows and Linux. (#78)
- The Block and Row toolbars are one Tab stop each, with arrow keys between their buttons. Shift+Tab leaves the toolbar. (#60, #78)
- Each empty Column has one Tab stop per Block type, and `keyboard.mdx` says so. (#36)
- After Delete Block or Delete Row from the keyboard, focus goes to the neighbour and the deletion is announced. (#54)
- The Link button keeps `aria-pressed`, so screen readers say whether the cursor is on a link. (#36)

## The panels

- The Side panel, its settings, the format bar, and the Block, Row and floating toolbars reach the editor only through `PanelApi` in `packages/editor/src/panel-api.ts`: what's selected and its settings, and every change they make. It isn't exported or documented in 0.2. It carries no DOM events or elements: a press that keeps focus is heard by the selection module, and a settings field reports its text. (#147, #175)
- The selected Block's toolbar and format bar are placed by CSS, then moved back inside the canvas by `packages/editor/src/tool-placement.ts` after each update and when the canvas, the email or the selected Block changes size, on a page that scales the editor too. The format bar starts where its Block does when it's wider than the Block, and goes above the Block, or past the toolbar, rather than cover the toolbar or be cut off. Both sit over the floating toolbar. (#162)

## Editing

- Links accept any `https:`, `http:`, `mailto:` or `tel:` URL, or a Merge Tag. (#36)
- A new Row from the Rows tab is selected, as a dragged one is. (#54)
- A drag scrolls a container only within 60px of its edge, and passes on to the next container once one can't go further. (#78)
- A file dropped on the editor is refused, as there's no image upload yet. (#79) That includes the Preview, the narrow notice and the Shell. The Preview's email has the host page's origin, with scripts still off, so the editor can refuse a file dropped on it too, and keep Alt+← from going back a page (#165). Safari runs no listener there, so it still opens a file dropped on the email in the Preview. (#161)
- Import JSON has no confirm, and reads a file of any size. (#36)
- The editor and the Shell are left to right on any page, so the canvas matches the export until right-to-left emails are built. A heading the host gives the Shell takes its direction from its own text. (#166)
- `value` and each keystroke copy the whole email. That's fine at email sizes. (#36 E15)

## The Shell

- With `save-key`, a saved email opens instead of the host's first `value`. Setting that first email again leaves the open email as it is, whether it's a saved one or the first email the person has edited on a first visit. One opened by a new `save-key` stays when the host sets its email again too. Removing `save-key` leaves the open email standing in, so a host that renders again can't replace the person's work. A different email opens, as on `<mail-quilt>`. (#42, #142, #160)
- Reading `value` or calling `exportHtml()` before the first update starts the Shell, so `value` is the email the editor opens. (#79)
- `actions` isn't reflected back to its attribute. (#78)
- A saved email that can't be opened is kept under `<save-key>:unopened`. If it can't be copied there, nothing is saved over it, and the Shell says it can't save. (#66, #160)

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
- A word of 20 or more characters gets a zero-width space after each `/ . - ? & = _`, outside Merge Tags and a URL's `//`, so it can wrap where CSS can't break it. Copied text includes them, and a link's address never does. A URL written as text, and not already linked, is exported as a link to itself, because the break points stop Apple Mail and Gmail linking it. (#91) So is one starting with `www.`, to `http://`, and an email address, as `mailto:`, rather than leaving an address without break points, which would widen the email in the clients that need them. A Merge Tag is never linked inside, so one holding an address as its default still fills in. An address right after an apostrophe, as in `'a@example.com'`, isn't linked, so a long word is read once. (#167)
- Any `&`, `<`, `>` or `"` inside a Merge Tag is escaped, and the docs say so. Tags should be plain names. (#53, #81)
- An Image in a Column narrower than its padding gets MJML's own negative width. Only very narrow emails reach it. (#36)

## Packages and the docs site

- The editor has no `jsdelivr` or `unpkg` field. The CDN build is loaded by its full path, as the quick start shows. (#36 R7)
- `@repo/typescript-config` stays in the published devDependencies, and core's types keep tsdown's bare `import "valibot"`. Neither affects installs. (#36)
- `withBase` stays: it's Blume's own helper. (#36)
- `loadDocument` runs before `renderEmail` on the docs pages, for a clearer build error. (#36)

## Tests

- The editor's tests run in the browser, apart from the key map's, which are unit tests. (#36, #145)
- Browser tests find an element by role and name, or by a documented part. An element with neither, such as a drag handle, a Column or the Side panel, has a `data-testid`, and no selector uses a class. (#147) The rule is for the editor's own elements and the test pages. These are found otherwise: (#171)
  - The email's own markup, which has no roles or test ids: the text's paragraphs and marks and an Image's picture on the canvas, and the exported HTML, by its tags and MJML's classes.
  - A state, by the attribute that holds it, such as `aria-current`, `aria-pressed` or `data-drag-ghost`.
  - A control's icon, by its `svg`, and the host page's `html` and `body`, which hold what a test records.
  - Code run in the page, which has no locators, by tag and role attributes.
- CI fails on a test that passes only on a retry, so a flake is seen and fixed. The retries stay, to tell a flake from a test that always fails and to keep a trace. (#171)
- Tests copy and paste through events, not the system's clipboard, which tests running at the same time could share. (#171)
- Core keeps a "stores…" test for each Block type's own settings. (#82)
- "A Row on the canvas shows an outline and its toolbar on hover" failed once in WebKit CI and passed on retry, with no cause found in 25 local runs. It isn't treated as flaky unless it fails again. (#36)
