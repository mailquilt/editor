# @mailquilt/editor

## 0.3.0

### Minor Changes

- f08e0bc: Copy, cut and paste Blocks and Rows. Ctrl/⌘+C, X and V, or the browser's Edit menu, copy, cut and paste a Block that has focus, or a Row from its toolbar, and paste from the toolbar below the email with nothing selected. A copy puts plain text on the clipboard, with each Merge Tag as `{{name}}`, and simple HTML made without MJML, whose wrapper holds the Block or Row and the format version as JSON in a `data-mail-quilt` attribute. Pasted into a Mail Quilt editor, in the same email, another email or another tab, it keeps every setting: the JSON is checked as an email from outside is, an older version is migrated, a newer one is refused with the reason `value` gives, and every Row, Column and Block gets a new ID. Text or HTML from another app becomes a Text Block, read as a paste into text is, and an image file becomes an Image Block uploaded through `uploadImage`, as a dropped file is, and is refused without it. A paste goes after the selected Block, or in a new Row after the selected Row, or at the end, and is selected. A pasted Block, Row or text is one undo step. Cut is copy, then Delete Block or Delete Row. Each is announced with where it happened. Paste inside a Block's text is unchanged.
- 9925d65: Duplicate, and Delete or Backspace, for a selected Block or Row. The Block's and Row's toolbars get a Duplicate button, and Ctrl/⌘+D on a Block, in its toolbar or in a Row's toolbar duplicates it there instead of bookmarking the page. The copy goes right after the original, is selected, and the editor says where it went, such as "Block duplicated, Row 1, Column 1, position 2 of 3". A Row whose Column widths aren't one of the layouts is copied with even Columns, as many as it has. Delete and Backspace on a Block, or in a Row's toolbar, delete it as the Delete buttons do. In text and fields these keys are unchanged. Underneath, `insertBlock` and `insertBlockInNewRow` take optional `props`, checked against the Block type's schema, and `insertRow` takes optional `props` for the Row and `columns`, one for each of the layout's Columns, with their Blocks as `{ type, props }`. Core makes every new ID, and each is one undo step. The new `NewBlock` and `NewColumn` types describe `columns`.
- 703bc4e: Breaking: a Text Block can hold bulleted and numbered Lists, one level deep, with one paragraph in each item. In rich text they're `bulletList` and `orderedList` nodes holding `listItem`s, part of format version 3, and `RichTextDocument`'s `content` can now hold a `RichTextList` as well as a `RichTextParagraph`. A Heading can't have Lists, and its text is the new `RichTextHeadingDocument` type. The export writes each List as `<ul>` or `<ol>` with its margins and padding inline, and each item with a paragraph's styles and line height. A numbered List starts at 1. The format bar gets Bulleted list and Numbered list buttons, which show when they're on, and Shift+Ctrl/⌘+8 and Shift+Ctrl/⌘+7 turn them on and off on any keyboard layout. Enter in an empty item leaves the List, Backspace at the start of an item makes it a paragraph, and Backspace at the start of the paragraph after a List joins it to the last item. Delete at the end of a List's last item, or of the paragraph before a List, pulls in the next paragraph or the next List's first item, and that List keeps its type. Two Lists of one type left next to each other by Backspace or Delete become one. A pasted List comes in as a List, with any List inside it flattened to one level. Typing "- " or "1. " stays as typed.
- 77b334b: Breaking: the saved format is version 3, and a Merge Tag in a Text or Heading Block is one unit. In rich text it's a `mergeTag` node, `{ "type": "mergeTag", "attrs": { "name": "first_name" } }`, whose name is what goes between the braces, exactly as written. Backspace and Delete remove a tag whole, the cursor can't go inside it, and formatting goes on all of it. A tag becomes a node when its `}}` is typed, and each tag in pasted text does too. On the canvas a tag shows its name, and a screen reader, its tooltip and a plain-text copy give `{{name}}`. An email saved with version 2 is upgraded as it loads, and exports exactly as before. An email saved with version 3 can't be opened by an older package. Every email saved with `0.3` is version 3, even one that uses none of the new features, so where a web app and a render worker are on different versions, such as a web app that saves emails with `0.3` and a worker that renders them with `0.2`, the worker refuses them. Update the worker first, or both together. The new `RichTextMergeTag` type describes the node.
- 20992ed: A Merge Tag picker in text. Give `<mail-quilt>` your app's Merge Tags as `mergeTags`, an array of `{ name, label }`, and typing `{{` in a Text or Heading Block opens a list of them at the cursor, which what's typed after `{{` narrows by name and label. ↑ and ↓ move through it, Enter or Tab puts in the highlighted tag as one unit in place of what was typed, and Escape closes it and leaves the text. A click on a tag puts it in too. Focus stays in the text, which names the list and its highlighted tag to a screen reader. The format bar gets a Merge Tag button that types `{{`. On the canvas a tag shows its label, or its name without one, and a change to `mergeTags` redraws the labels without changing the email. The Preview and the export still have `{{name}}`. A tag typed by hand still becomes one unit when its `}}` is typed, listed or not. Without `mergeTags`, nothing changes. `<mail-quilt-shell>` takes the same property, and `MailQuilt` and `MailQuiltShell` take it as a prop.
- 151b5dc: Merge Tags in every setting that holds text or a URL. With `mergeTags`, typing `{{` in a settings field such as a Button's label or link, an Image's alt text, or the email's preheader, or in the link field in text, opens the same list as in text, under the field. A tag goes in as the text `{{name}}`. Enter puts in the tag without applying the field, and the first Escape closes the list before the next one takes back what was typed or closes the link field. Each of these fields says under it that `{{` adds a Merge Tag. The email's language can now be one Merge Tag as its whole value, such as `{{language}}`, as well as a code. A URL that starts with a tag followed by a scheme, such as `{{#if vip}}https://…{{/if}}`, is still refused.
- 63f6621: The Preview gets a Desktop and Phone switch. Phone shows the same exported HTML in a frame 375px wide, so the email's phone styles apply there and a Row's Columns stack as they do on a phone. The switch keeps its last choice while the editor is open. Opening the Preview still moves focus to Close, and Escape still closes it at either width. The canvas stays at desktop width.
- 1a5332b: Breaking: a Row has padding on each side, can be hidden on phones, and can keep its Columns side by side on phones. Its props in format version 3 can hold `paddingTop`, `paddingRight`, `paddingBottom` and `paddingLeft`, whole pixels from 0 to 200 that default to 0, `hideOnPhone`, which defaults to `false`, and `stackOnPhone`, which defaults to `true`. An email without them exports as before. The export gives the Row its padding, and each Column's desktop width is its share of the email's width less the Row's left and right padding. A Row hidden on phones is hidden on screens under 480px wide, though a client that drops the email's styles on a phone, such as the Gmail app with an account that isn't Google's, still shows it. A Row that doesn't stack puts its Columns in MJML's `mj-group`, with their widths inline, so they stay side by side in every client. The Row's settings get the four paddings and a switch for each choice, with Stack Columns on phones only for a Row with more than one Column. The canvas shows the padding, and a Row hidden on phones has a "Hidden on phones" mark in its toolbar.
- 647bc11: Breaking: a Social Block, in format version 3, shows linked icons for Facebook, Instagram, LinkedIn, X, YouTube, TikTok, Pinterest, Threads, Bluesky and a website. Its props are `links`, a list of `{ network, url }` in the order the icons show, with each network at most once, `iconStyle`, `"color"` or `"white"`, `iconSize`, 32, 40 or 48, and `align`. Each URL is checked as a link, so it can hold a Merge Tag. A link without a URL stays in the list, faded on the canvas, and is left out of the export, and a Social Block with no URL at all is left out, as an Image without one is. A new Social Block has no links, and the Side panel sets its links, style, size and alignment. There, a person adds a network not yet in the list, types its URL, and moves it up or down or removes it with buttons. Each link's buttons are one toolbar, one stop for Tab with the arrow keys across it, focus stays with a link that moves, and each change is announced.
  
  The export writes the icons with MJML's social element, each one's image given, so nothing loads from Mailjet, with the network's name as its alt text and a gap of half the icon's size. The icons are PNGs in the renderer's `icons` folder, and emails load them from jsDelivr at the renderer's exact version. `renderEmail` takes a `socialIconsUrl` option, and `<mail-quilt>`, `<mail-quilt-shell>` and both React components take a `socialIconsUrl` property, so a Host app can serve the icons from its own storage. The canvas and Preview load the same URLs as the export, and an empty `socialIconsUrl` counts as none. On the canvas, a faded icon's name says it has no URL yet. A Social Block copied into another app gives its linked networks' names. The logos are their owners' trademarks, and `icons/NOTICE.md` credits each source and its licence.
- 9648b8a: Image upload. Give `<mail-quilt>` an `uploadImage` function, which uploads a file to your own storage and returns `{ url }`, and the Image settings get an Upload image button beside the Image URL. `<mail-quilt-shell>` takes the same property, and `MailQuilt` and `MailQuiltShell` take it as a prop. The picker offers PNG, JPEG and GIF, and refuses other files before your function is called. While the upload runs, the Image Block shows "Uploading…", and the URL your function returns is checked as a typed Image URL is. A rejection's `Error` message is shown by the Image URL field and read out. Image files can also be dropped: one dropped on an Image Block sets its image, and files dropped elsewhere on the email each add an Image Block where they land, with the same drop line as a Block from the Content tab. The upload is aborted through `signal` when its Image Block is deleted, undone or replaced by a new `value`. The new `HostAppProperties` type lists the properties. [Upload images](https://editor.mailquilt.com/docs/upload-images) shows a pre-signed upload.

### Patch Changes

- 5e07cec: The email is one stop for Tab, so a Block's or a Row's settings can be reached from the keyboard. Before, every Block and its text was a stop, and Tab selected each Block it passed, so the side panel showed the email's last Block by the time Tab got there, and a Row's settings couldn't be reached at all. Now only the selected Block is a stop, or with nothing selected the first, and the arrow keys go to the others as before. Tab goes from the selected Block to its text and toolbar, then past the toolbars of the Rows and empty Columns after it, to Preview and that Block's settings. While a Row is selected no Block is a stop, so Tab from Select Row goes the same way to the Row's settings, and Escape in a Row's toolbar unselects the Row and selects that toolbar's Row's first Block.
- 10b300f: An empty Column's add buttons are one toolbar, named for where it is, such as "Add a Block to Row 1, Column 2". It's one stop for Tab, as the Block's and Row's toolbars are: the arrow keys go across its buttons, Home and End go to the first and last, and Shift+Tab leaves it. Each button is now named "Add Text Block here" and so on, without the Column, which the toolbar's name gives. Before, each empty Column was one Tab stop per type of Block.
- 729d5d7: Two details of the export, found by the 0.3.0 Email on Acid run. Each paragraph and List item has the email's font on its own tag, as a heading does, because Libero gave paragraphs a font of its own while List items kept the email's. And a Social Block's icons that wrap onto a second line now line up the same on every line: right-aligned, each line ends at the Block's edge, where before the last line ended further right. Half the gap between icons is on every side of each icon, and the Block's padding is that much less, so a single line sits where it did, on the canvas and in the email.
- 4cb002d: The highlighted tag in the Merge Tag list, and a Merge Tag in text, have an edge at 3:1 or more. Before, the edge was at about 2:1, so a person with low vision couldn't easily tell which tag <kbd>Enter</kbd> would put in, or a tag from typed words. The highlighted tag's edge uses `--mq-color-accent-strong`, as a pressed button's does. A Merge Tag's edge in text is in the text's own color, so it stands out from the email as the text does, whatever the editor's theme.
- be4a8a2: A Social Block's icons that wrap onto a second line, as on a phone, have the same gap between the lines as between the icons. Before, the lines touched. Half the gap is above and below each icon, and the Block's padding above and below is that much less, so a single line of icons is as tall as before, in the email and on the canvas.
- 9b3ac5e: The Social Block's color icons can be seen in dark mode. X, Threads and TikTok are white on a black rounded square, and the website icon white on dark grey. Drawn black on their own, they disappeared where an email app's dark mode turned a white background near-black, as Outlook, Outlook.com, Yahoo and the Gmail app on iPhone do. The Side panel says that white icons need their dark background, which some email apps' dark modes make light, and that color icons show on light and dark backgrounds.
- Updated dependencies [f08e0bc]
- Updated dependencies [9925d65]
- Updated dependencies [729d5d7]
- Updated dependencies [703bc4e]
- Updated dependencies [77b334b]
- Updated dependencies [151b5dc]
- Updated dependencies [1a5332b]
- Updated dependencies [647bc11]
- Updated dependencies [be4a8a2]
- Updated dependencies [9b3ac5e]
  - @mailquilt/core@0.3.0
  - @mailquilt/renderer@0.3.0

## 0.2.0

### Minor Changes

- 7c1e04c: A link or image URL that starts with `httpſ:` in place of `https:`, or a color with anything but a plain space after a comma, such as `rgb(0,\n0,0)` or a no-break space, is refused when set. Neither is a link or a color the docs describe. The same goes for a new language code with `ſ` or the Kelvin sign `K` in place of s or k. A saved language still loads whatever it is.
  
  An email saved with 0.1.0 that holds one of these still opens. **Breaking:** emails are now saved as version 2 of the format, and a version 1 email is upgraded as it loads: such a color gets a plain space after each comma, and such a URL starts with `https:`. Mail Quilt 0.1.0 refuses a version 2 email as newer, so update every package that reads your emails, such as a renderer on your server, at the same time.
- 3eb84b6: A new theme token, `--mq-color-scheme`, sets the `color-scheme` of the editor's surfaces. Set it to `dark` with a dark theme, and what the browser draws itself, such as the side panel's open dropdown lists and the color picker, turns dark too. It defaults to `light`, so nothing changes without it.
- e878b73: Fixes in the Shell, `<mail-quilt-shell>`:
  
  - With `save-key` and nothing saved, an email the person imports stays when your app's first `value` arrives after it. Before, that first email replaced the import and cleared undo.
  - Importing a file that's the same as the open email changes nothing, so it fires no `mq-change` and saves nothing.
  - Each message in the message bar has its own place, so a refused email no longer hides why the saved email couldn't be opened. Export JSON and Export HTML both take away a failed export's message once they work, and leave every other message.
  - The messages that the browser can't save, and that the saved email couldn't be opened, go when `save-key` changes, as they were about the key before.
  - A saved email that can't be opened is copied to `<save-key>:unopened`, or to `:unopened:2` and on when an earlier copy holds a different email, so no copy is lost.
  - The Shell's frame is a CSS part, `frame`, so you can take off its corners and ring with `mail-quilt-shell::part(frame)`.
  - `exportHtml()` on a Shell with no email rejects with a message that names `<mail-quilt-shell>`.

### Patch Changes

- 4154f21: Small fixes on the canvas and in the text:
  
  - Setting `value` to a different email while someone types keeps focus in the editor, on the floating toolbar, instead of dropping it to the page.
  - After deleting a Block or Row from the keyboard, focus goes straight to its neighbour, without stopping on the floating toolbar.
  - Ctrl/⌘+Z and Shift+Ctrl/⌘+Z with nothing to undo or redo reach your page.
  - Alt+← and Alt+→ in a Row's toolbar no longer announce that the Row can't move.
  - Linking a selection of only a line break puts the URL in its place as linked text, instead of a link no one can see.
  - Bold, italic or underline with no text selected, such as all of an empty text, goes on or off what's typed next.
  - The drop line shows where a drag will land on a page that scales the editor.
  - Typing a failed image URL in again tries to load it again.
  - On a touch screen, each Row's tag shows, so a Row can be selected, and swiping up or down on the Side panel's tiles scrolls it.
  - A screen reader hears "Loading preview…" while a slow Preview renders, as its status is there before the message.
  - On Apple devices, tooltips write Alt as ⌥, like ⇧ and ⌘.
  - A Block's description for screen readers names each key it answers to from the editor's key map, such as Alt+ArrowUp.
- f4c0806: The editor works on a page whose Content Security Policy has no `'unsafe-inline'` in `style-src`, such as `style-src 'self'`. The canvas shows the email's width, background and font, and each Row's, Column's and Block's settings, where before it lost them. Only Preview still needs `'unsafe-inline'`, because the email relies on inline styles.
- 146b517:
  - Every shadow the editor draws is now a theme token's. A theme's `--mq-shadow` reaches the email card, and `--mq-shadow-small` the selected side panel tab, the tiles and the settings fields, which kept the light theme's own shadows before. With no theme set, those shadows change slightly to the tokens' defaults.
  - Each file of the CDN build starts with a comment saying the licenses of the packages bundled in it are in `THIRD-PARTY-LICENSES.txt`, beside it.
- 07ac505:
  - A drag near the edge of the window no longer jumps a long way when the tab comes back from the background, or after the page was busy. Each frame scrolls at most a tenth of a second's worth.
  - In forced colors, such as Windows High Contrast, a dropdown in the settings shows its arrow.
  - Scrolling with the wheel over a focused number field in the settings still leaves its value as it was. Focus now moves to the floating toolbar, rather than leaving the editor, so keyboard undo keeps working.
- 362d8c5: With the editor inside your page's modal `<dialog>`, Escape on a focused button with its tooltip showing closes only the tooltip. Before, the browser closed your dialog too.
- 18a5e61: The CDN build's `THIRD-PARTY-LICENSES.txt` gives the full license text of `boolbase` and `slick`, which ship without a license file. Before, it gave only their copyright lines.
- 7c1e04c: A Kelvin sign `K` typed with Ctrl or ⌘ is read by its place on the keyboard, as other letters outside A to Z are, not as k.
- 87a4e62: Ctrl/⌘+K now reaches the host page where it does nothing in the editor, such as on a Button Block, or on a Row's toolbar or an empty Column with no Block that has text selected. Alt+← and Alt+→ no longer go back or forward a page from an empty Column's buttons, the side panel, its tabs and fields, the link field, the Preview and the email in it, or the notice shown when there's no room to edit, as they already didn't on a Block, in its text or in a toolbar.
- 5cbbfdc: On a right-to-left page, the editor and the Shell stay left to right, so a Row's Columns show in the same order as the export and the Side panel stays on the right. A heading the host gives the Shell takes its direction from its own text.
- 27d37bf: When the Shell's `save-key` changes and a saved email opens under the new key, a host that sets its starter email again, as React does when it renders again, no longer replaces it, and the next change no longer saves over it. A saved email that opened when the Shell started already stayed this way.
- 27d37bf: On the notice shown when the editor has no room to edit, pressing Preview email gives that button focus, so focus goes back to it when the Preview closes. Before, in Safari and in Firefox on a Mac, where a click doesn't focus a button, closing the Preview left nothing focused.
- 2ed9203:
  - While a Block or Row is being dragged, Alt+← and Alt+→ no longer go back or forward a page with focus on a Block, in its text or in a toolbar, as they already didn't there at other times.
  - A shortcut acts only with the modifiers it's named with. Before, some also acted with another held, such as Ctrl and ⌘ together on a Mac. Escape, Tab in a toolbar, and Enter on a Block still act with any.
  - A key an input method used, such as while typing Japanese, does nothing in the editor anywhere. Before, some places still acted on it. The link field still takes every key.
  - On a layout such as Dvorak, Ctrl/⌘ with the key that types `;` no longer undoes because QWERTY has Z there. A shortcut's letter is read from the key's place only on a layout without Latin letters.
- 4d6cd17: Text pasted from Google Docs or Word keeps its bold, italic and underline on a page whose Content Security Policy has no `'unsafe-inline'` in `style-src`. Before, in Chrome, Edge and Safari, it came in all bold and lost its italic and underline. The dropdowns' arrows show under a policy whose `img-src` doesn't allow `data:`. The API page says what `img-src` the canvas and Preview need.
- 91086d5:
  - A tab pasted or dropped into a Block's text becomes a space, as the export shows it. Before, the canvas showed it as a wide gap that no email client can draw.
  - A Text Block or Heading has the export's line height on the canvas: 1.5 times its font size, rounded up to a whole pixel. Only a font size with a half pixel in its line height, such as 15px, changes.
- 5bf5d47: The editor installs `prosemirror-view` 1.42, and not 1.43. With 1.43.0, a click back into a text you had left put the cursor at the start of the text in Safari, not where you clicked, and typing straight after a click did the same in Chrome and Firefox.
- 38882f8: A file dragged over the open Preview, its email included, over the narrow notice, or over the Shell's header is refused, as it already was over the rest of the editor, so the browser no longer opens it in place of the page. Safari still opens a file dropped on the email in the Preview. The Preview's email now has the host page's origin, so the editor can refuse a file there. It still runs no scripts.
- 5911f8e: With `save-key`, a host that sets its starter email again no longer replaces what the person typed on their first visit, as it already didn't once a saved email had opened. A different email still opens. And when a saved email that can't be opened can't be copied to `<save-key>:unopened` either, the Shell no longer saves over it, and says it can't save.
- 593d67f: The selected Block's toolbar, the format bar and the link field stay inside the editor, so every button can be pressed. In a narrow first Column the format bar no longer reaches past the editor's left edge, and beside a short last Block, Delete Block is no longer cut off. The format bar keeps clear of the Block's toolbar too, and the floating toolbar no longer covers either of them.
- abea3ec: Core's editor has `canUndo()` and `canRedo()`, and the editor's Undo and Redo buttons are disabled when there's nothing to undo or redo. A refused Command's result has a `code`, such as `noSuchBlock` or `invalidProps`, beside its `reason`, so code can tell one refusal from another. The docs list the codes.
  
  A listener that throws no longer stops later listeners hearing of a change, and its error is still thrown once they all have. The function that ends a subscription returns nothing, and the docs say that subscribing a function that's already subscribed adds nothing.
- 5533e5a: Fixes from the WCAG 2.2 AA audit:
  
  - A pressed format button, such as Bold, and an active Link or Select Row button now have an edge, so you can tell they're on without relying on color.
  - Settings fields have a darker edge, at 3:1 against the panel, so an empty one still reads as a field.
  - Escape closes the Preview from inside its email too, as the docs say. In Safari, Shift+Tab still goes back to Close.
  - In forced colors, such as Windows High Contrast, the drop line during a drag and the tiles in the Content and Rows tabs are drawn in the system's colors instead of disappearing.
- Updated dependencies [7c1e04c]
- Updated dependencies [290cedb]
- Updated dependencies [2f78ecf]
- Updated dependencies [4382c3e]
- Updated dependencies [808da79]
- Updated dependencies [91086d5]
- Updated dependencies [1f2ddc8]
- Updated dependencies [aa4dab9]
- Updated dependencies [abea3ec]
- Updated dependencies [886808f]
  - @mailquilt/core@0.2.0
  - @mailquilt/renderer@0.2.0

## 0.1.0

### Minor Changes

- 72b0977: First release of the editor, a Web Component that works in any framework or none.
  
  - **`<mail-quilt>`:** drag Blocks and Rows, or do all of it from the keyboard. Edit text with formatting and links, change settings in the side panel, and preview the real exported HTML in a sandboxed frame, which shows an email skeleton while it loads.
  - **API:** set `value`, listen for `mq-change` and `mq-error`, and call `exportHtml()`. The `MailQuiltChangeEvent` and `MailQuiltErrorEvent` types are exported.
  - **`<mail-quilt-shell>`:** a ready-made editor page with Import, Export and messages, which can keep the email in the browser under `save-key`.
  - **Theming:** `--mq-*` tokens and the `frame` part match the editor to your app.
  - **CDN build:** `dist/cdn/index.js`, for pages without a bundler.

### Patch Changes

- Updated dependencies [72b0977]
- Updated dependencies [72b0977]
  - @mailquilt/core@0.1.0
  - @mailquilt/renderer@0.1.0
