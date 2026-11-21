# Decisions

Accepted limits, and rules a review doesn't raise again unless something has changed since, such as a bug report or a new feature that depends on them. A PR that changes one of these says so, gives the reason and updates this page.

Which module owns what, and why, is in `docs/adr/`:

- The key map and the text's keys, ADR 0004, 0008 and 0014.
- Places, key scopes, positions and labels, ADR 0007, 0012 and 0015.
- Selection, focus and presses, and focus after an update, ADR 0011 and 0016.
- What `<mail-quilt>` holds, and the modules it makes, ADR 0009 and 0012.
- The panels' interface, ADR 0004 and 0016.
- Block types across the packages, ADR 0013.
- The canvas's styles, ADR 0006.
- The renderer's modules, and Columns' width, ADR 0005 and 0010.
- Rich text, ADR 0001 and 0003, and Merge Tags in it, ADR 0017.
- What a copy puts on the clipboard, ADR 0018.
- Where the Social Block's icons come from, ADR 0019.

## Keys and focus

- `keyboard.mdx` writes every key it names in `<kbd>`. It names every key the key map names, and none it doesn't, and a unit test checks both. (#164)
- Keys heard before any place, during a drag, while a tooltip shows or held down, are in the key map's `HEARD_FIRST`, asked with `keyHeardFirst` by the module listening then, so key dispatch has no action it can't run. (#178)
- A key acts only with the modifiers the key map gives it. Escape, Tab in a toolbar, and Enter on a Block or held down act with any. (#145)
- An action that does more from the keyboard, such as moving focus to a neighbour or showing a focus ring, takes `fromKeyboard`, which a button's click gives as `detail === 0`. That's the one way the editor asks. (#220)
- When an update removes or disables the element with focus, focus goes to the same thing again, or else to the nearest one left: a Block's tool gives way to its text, then to the Block, and the link field and the format bar give way to the text. With none left, the floating toolbar takes it, as it does when a new `value` takes away the text that had focus. Selecting what's already selected is no change. (#146, #214)
- Escape closes one thing and stops there: the focused control's tooltip, the link field, what was typed in a settings field, or the Preview. In a Block's text it goes back to the Block and stops. A hovered tooltip closes and the Escape goes on. An Escape that does none of these reaches the host page, so a host's dialog can close. (#66, #78, #79)
- A key that an input method handled does nothing, so an Escape that ends a composition doesn't close a tooltip either. The link field still keeps every key to itself. (#66, #78, #145)
- Ctrl/⌘+Z and Ctrl/⌘+K reach the host page unless the editor acts on them. Ctrl/⌘+K acts only with a Block that has text selected, and undo and redo only with a step to take. (#79, #165, #212)
- Typing in a Block's text or a settings field reaches the host page, as typing in any field does, seen as coming from `<mail-quilt>` or `<mail-quilt-shell>`. The link field keeps every key. `keyboard.mdx` says so, and how a host skips those keys. (#212)
- Alt+← and Alt+→ never go back a page from anywhere in the editor, the narrow notice and the email in the Preview too, and during a drag. On a Mac, in text, they still move by word. (#54, #79, #145, #165)
- Shift+Ctrl/⌘+B, I and U format text too, or the browser would format it outside the editor on Windows and Linux. (#78)
- The Block and Row toolbars are one Tab stop each, with arrow keys between their buttons. Shift+Tab leaves the toolbar. (#60, #78)
- Each empty Column has one Tab stop per Block type, and `keyboard.mdx` says so. It stays until the Social Block adds a type. (#36, #205)
- After Delete Block or Delete Row from the keyboard, focus goes to the neighbour and the deletion is announced. (#54)
- Escape in the Preview's email closes the Preview, from the email's own key listener, as the browser only closes a dialog for an Escape in the page. Safari runs no listener there, so in Safari Shift+Tab to Close is the way out, and `keyboard.mdx` says so. (#143)
- The editor partly meets WCAG 2.2 AA. Below 640px, as at 400% zoom, it shows the narrow notice and the side panel can't be reached, which fails 1.4.10. The accessibility statement says so. (#143)
- The Preview's status is in its dialog from the start, empty, and says "Loading preview…" 150ms after opening, so a screen reader hears it arrive and a quick render says nothing. A status that arrives with its text may not be read. (#212)
- The Link button is named "Edit link" when the cursor is on a link, and has no pressed state, as pressing it opens the link field rather than taking the link away. (#36, #67)

## The panels

- The panels' interface, `PanelApi`, isn't exported or documented yet. (#147)
- The selected Block's toolbar and format bar are fitted back inside the canvas by `tool-fitting.ts`, on a page that scales the editor too. The format bar goes above the Block, or past the toolbar, rather than cover the toolbar or be cut off. (#162)
- Each module keeps its CSS beside its template, and styles shared by every surface are `theme.ts`'s. A custom property of the editor's own that isn't a theme token is named `--_mq-…`. Every shadow is a theme token's, apart from the white rings that keep a selection and the drop line visible on a dark email, and a color swatch's edge. (#220)

## Editing

- Links accept any `https:`, `http:`, `mailto:` or `tel:` URL, or a Merge Tag. (#36)
- A new Row from the Rows tab is selected, as a dragged one is. (#54)
- A drag scrolls a container only within 60px of its edge, and passes on to the next container once one can't go further. (#78)
- The Preview's email has the host page's origin, with scripts still off, so the editor can refuse a file dropped on it and keep Alt+← from going back a page. (#165)
- A file dropped on the editor is refused without `uploadImage`. With it, only the canvas takes files, and the Preview, the narrow notice and the Shell's header still refuse them. Safari runs no listener in the Preview's email, so it still opens a file dropped there, in place of the page. Only a cover over the email during a drag could stop it, which image upload would replace. (#79, #161, #165, #212, #271)
- Import JSON has no confirm, and reads a file of any size. The person chose the file, and Export JSON is beside it. (#36, #205)
- A pasted or dropped tab is a space, as the export shows it, where the canvas would show it at a tab stop no email client can draw. A tab already in a saved email stays until then. (#211)
- The editor and the Shell are left to right on any page, so the canvas matches the export until right-to-left emails are built. A heading the host gives the Shell takes its direction from its own text. (#166)
- `value` and each keystroke copy the whole email. That's fine at email sizes: a keystroke on an email of 600 Blocks takes 7 to 12ms to the next frame, of which the Shell's save is about 1ms, so the Shell saves each change at once. (#36, #219)

## The Shell

- With `save-key`, a saved email opens instead of the host's first `value`, and setting that first email again leaves the open email as it is. Removing `save-key` leaves the open email standing in, so a host that renders again can't replace the person's work. A different email opens, as on `<mail-quilt>`. An import stands in as a saved email does. (#42, #142, #160, #213)
- An email the host opens over a saved one is saved with the person's next change, while an import is saved at once. The Shell page says so. (#213)
- Reading `value` or calling `exportHtml()` before the first update starts the Shell, so `value` is the email the editor opens. (#79)
- `actions` isn't reflected back to its attribute. (#78)
- A saved email that can't be opened is kept under `<save-key>:unopened`, or `:unopened:2` and on, so no copy is lost. If it can't be copied there, nothing is saved over it, and the Shell says it can't save. (#66, #160, #213)
- Each kind of message in the Shell's message bar is kept apart, so none hides another. The Shell page says when each one goes. (#213)

## Core and the document

- An insert or a removal gives its position as `at`, as a move gives `from` and `to`. An ID at the top of an Operation names what changed. (#80)
- `undo()` returns a boolean. (#36)
- A Command that would change nothing, such as `setRowLayout` to the layout a Row has, is refused with the code `unchanged`, and that's the only way it says so. (#52, #210)
- A color is checked as MJML's strict check takes it, which the export runs: at most one space after each comma, an alpha as `0.5` and not `.5`, and up to three digits in a channel, which CSS shows past 255 as 255. Loosening it would make emails that don't export, and tightening it would need a migration. (#210)
- A listener's error is thrown once every listener has heard of each change, from the call that started the changes. A Command a listener applies returns before anyone hears of it, so each listener hears of the changes in order. (#210)
- A saved language that isn't a code still loads, and can be sent back unchanged. Only a new one has to be a code. (#79)
- A check on saved data that gets stricter comes with a migration, which raises the format version and rewrites what an older version saved as the check now takes it, so every email a release accepted keeps opening. A migration finds what it rewrites by the keys that hold it. (#209)
- A release that changes the format raises the version once, however many changes it holds. Its release notes say that emails it saves can't be opened by older packages, as a web app and a render worker on different versions would find. (#268)
- Version 3 is open on `main` until `0.3.0` is published: each pull request that changes the format extends the same version 3 schema and migration, and an email saved from `main` in between isn't supported. The version pull request is made only once all six features of the release are in, so nothing is published with half the format. (#268)
- An email is at most 1200px wide, and a font family needs at least one name. (#78)
- Exports from `core` marked "not a promise to hosts" are for Mail Quilt's own packages, and come from `@mailquilt/core/internal`, not the main entry. (#61, #84)

## Rendering

- MJML is given `fonts: {}`, so an exported email never loads web fonts. (#52)
- `mjml-browser` is pinned to one version, as the pass over its HTML reads its exact class and style text. A new one is taken on purpose. (#211, ADR 0010)
- `prosemirror-view` is held to 1.42 (`~1.42.9`). With 1.43.0, which handles mouse selection itself, a click back into a text put the cursor at its start in WebKit, and the install checks, which install with no lockfile, turned `main` red on it. Three editor browser tests fail on 1.43.0, so they say when a newer one can be taken. (#259)
- Dependabot keeps the lockfile current each week, a week after a release comes out, so the tests meet a new version of a package before a fresh install does. It was the install checks, which install with no lockfile, that found the `prosemirror-view` change, a day after it came out.
- Text and Headings get their line height in pixels, 1.5 times the font size rounded up, with `mso-line-height-rule:exactly`. With 1.5, classic Outlook drew thin lines under text. Core's styles give it, so the canvas shows the same height. (#95, #211)
- A word of 20 or more characters gets invisible break points after `/ . - ? & = _`, outside Merge Tags and a URL's `//`, which copy with it. The docs say so, and without them the email widens in five clients. A link's address never gets them. (#91, #205)
- A URL, a `www.` address or an email address written as text is exported as a link to itself, as the break points stop Apple Mail and Gmail linking it. A Merge Tag is never linked inside. (#91, #167)
- An address isn't linked when it runs straight into a character it can't hold, as in `a@b.c_d`, or right after an apostrophe. A URL or address that runs into a link isn't linked, so no link goes to part of one. (#167, #206)
- A URL or email address ends where letters of a language written without spaces start, such as Japanese, as that's the sentence far more often than the address. One with such letters typed in its path links only up to them. (#167, #211)
- A space other than HTML's own, such as a no-break space, goes to MJML as a character reference, because MJML trims every kind of space from the ends of a Button's label. A Merge Tag's spaces stay as typed, so it's still filled in. (#206)
- Any `&`, `<` or `>` in a Merge Tag is escaped, and a `"` too where the tag is in an attribute, such as a link or image URL. The docs say so. Tags should be plain names. (#53, #81)
- An Image in a Column narrower than its padding gets MJML's own negative width. Only very narrow emails reach it. (#36)

## Packages and the docs site

- CI's release job publishes on every commit on `main` that passes the checks, and `changeset publish` publishes only versions npm doesn't have, so the job needs no test for whether a commit is a release, and a failed publish goes out on a rerun. Each commit on `main` has a CI concurrency group of its own, so each release comes from the commit that versioned it. (#179)
- `PNPM_CONFIG_PROVENANCE` reaches `pnpm publish` in pnpm 11, so a publish that can't make provenance fails before it sends anything. (#227)
- The published packages are type-checked and built for ES2023, set in `@repo/typescript-config`. It's the lowest that runs core, the renderer and the editor: ES2023's array methods, and the renderer's lookbehinds, which need Safari 16.4. (#227)
- The editor has no `jsdelivr` or `unpkg` field. The CDN build is loaded by its full path, as `apps/docs/docs/html.mdx` shows. (#36)
- `@repo/typescript-config` stays in the published devDependencies, and core's types keep tsdown's bare `import "valibot"`. Neither affects installs. (#36)
- `withBase` stays: it's Blume's own helper. (#36)
- `loadDocument` runs before `renderEmail` on the docs pages, for a clearer build error. (#36)
- The docs site's `robots.txt`, which Blume writes, allows AI training. The docs are open and meant to be found. (#205)
- The React components take only the props that mean something on their element, as the API page lists. Two lines disable `react/immutability`, which reads an effect's `let` flag for a late result, React's own pattern, and setting the element's `value`, a DOM element in state, as changing state. (#224)
- The install checks read the published types with the repo's TypeScript and without `skipLibCheck`, and fail if a package of ours was installed from npm and not its tarball. (#224)

## Tests

- The editor's modules that need no page have unit tests: the key map, positions and the Commands that move and drop, the text commands, field values, scaling and pasted HTML. The rest of the editor is tested in the browser, where a rule a unit test covers gets one case, to show the UI is wired to it. (#36, #145, #222)
- Browser tests find an element by role and name, or by a documented part. An element with neither, such as a drag handle, a Column or the Side panel, has a `data-testid`, and no selector uses a class. (#147) The rule is for the editor's own elements and the test pages. These are found otherwise: (#171)
  - The email's own markup, which has no roles or test ids: the text's paragraphs and marks and an Image's picture on the canvas, and the exported HTML, by its tags and MJML's classes.
  - A state, by the attribute that holds it, such as `aria-current`, `aria-pressed` or `data-drag-ghost`.
  - A control's icon, by its `svg`, and the host page's `html` and `body`, which hold what a test records.
  - Code run in the page, which has no locators, by tag and role attributes.
- CI fails on a test that passes only on a retry, so a flake is seen and fixed. The retries stay, to tell a flake from a test that always fails. The trace kept is the first run's, the one that failed. (#171, #221)
- Tests copy and paste through events, not the system's clipboard, which tests running at the same time could share. (#171)
- A Command applies at once, and the test host's state has the change before a test can read it, so a test reads the editor's value, or the host's, once, right after an action. A poll would let a change that came late pass. Tests poll only for what settles later, such as layout, the Shell's saves and timers. (#221)
- Core keeps a "stores…" test for each Block type's own settings. (#82)
- The renderer's plain Node test builds the renderer into a folder of its own, so it never runs an older build of it, and never changes a `dist` that another task is reading. The install checks import the packed renderer by name. (#211)
- `focusStartOfTextBlock` is written in the editor's and the React package's browser tests and in the install checks. Sharing it would cost more than the copies. (#205)
