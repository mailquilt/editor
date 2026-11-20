# @mailquilt/editor

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
