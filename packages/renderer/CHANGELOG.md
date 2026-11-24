# @mailquilt/renderer

## 0.3.0

### Minor Changes

- 703bc4e: Breaking: a Text Block can hold bulleted and numbered Lists, one level deep, with one paragraph in each item. In rich text they're `bulletList` and `orderedList` nodes holding `listItem`s, part of format version 3, and `RichTextDocument`'s `content` can now hold a `RichTextList` as well as a `RichTextParagraph`. A Heading can't have Lists, and its text is the new `RichTextHeadingDocument` type. The export writes each List as `<ul>` or `<ol>` with its margins and padding inline, and each item with a paragraph's styles and line height. A numbered List starts at 1. The format bar gets Bulleted list and Numbered list buttons, which show when they're on, and Shift+Ctrl/⌘+8 and Shift+Ctrl/⌘+7 turn them on and off on any keyboard layout. Enter in an empty item leaves the List, Backspace at the start of an item makes it a paragraph, and Backspace at the start of the paragraph after a List joins it to the last item. Delete at the end of a List's last item, or of the paragraph before a List, pulls in the next paragraph or the next List's first item, and that List keeps its type. Two Lists of one type left next to each other by Backspace or Delete become one. A pasted List comes in as a List, with any List inside it flattened to one level. Typing "- " or "1. " stays as typed.
- 77b334b: Breaking: the saved format is version 3, and a Merge Tag in a Text or Heading Block is one unit. In rich text it's a `mergeTag` node, `{ "type": "mergeTag", "attrs": { "name": "first_name" } }`, whose name is what goes between the braces, exactly as written. Backspace and Delete remove a tag whole, the cursor can't go inside it, and formatting goes on all of it. A tag becomes a node when its `}}` is typed, and each tag in pasted text does too. On the canvas a tag shows its name, and a screen reader, its tooltip and a plain-text copy give `{{name}}`. An email saved with version 2 is upgraded as it loads, and exports exactly as before. An email saved with version 3 can't be opened by an older package. Every email saved with `0.3` is version 3, even one that uses none of the new features, so where a web app and a render worker are on different versions, such as a web app that saves emails with `0.3` and a worker that renders them with `0.2`, the worker refuses them. Update the worker first, or both together. The new `RichTextMergeTag` type describes the node.
- 1a5332b: Breaking: a Row has padding on each side, can be hidden on phones, and can keep its Columns side by side on phones. Its props in format version 3 can hold `paddingTop`, `paddingRight`, `paddingBottom` and `paddingLeft`, whole pixels from 0 to 200 that default to 0, `hideOnPhone`, which defaults to `false`, and `stackOnPhone`, which defaults to `true`. An email without them exports as before. The export gives the Row its padding, and each Column's desktop width is its share of the email's width less the Row's left and right padding. A Row hidden on phones is hidden on screens under 480px wide, though a client that drops the email's styles on a phone, such as the Gmail app with an account that isn't Google's, still shows it. A Row that doesn't stack puts its Columns in MJML's `mj-group`, with their widths inline, so they stay side by side in every client. The Row's settings get the four paddings and a switch for each choice, with Stack Columns on phones only for a Row with more than one Column. The canvas shows the padding, and a Row hidden on phones has a "Hidden on phones" mark in its toolbar.
- 647bc11: Breaking: a Social Block, in format version 3, shows linked icons for Facebook, Instagram, LinkedIn, X, YouTube, TikTok, Pinterest, Threads, Bluesky and a website. Its props are `links`, a list of `{ network, url }` in the order the icons show, with each network at most once, `iconStyle`, `"color"` or `"white"`, `iconSize`, 32, 40 or 48, and `align`. Each URL is checked as a link, so it can hold a Merge Tag. A link without a URL stays in the list, faded on the canvas, and is left out of the export, and a Social Block with no URL at all is left out, as an Image without one is. A new Social Block has no links, and the Side panel sets its links, style, size and alignment. There, a person adds a network not yet in the list, types its URL, and moves it up or down or removes it with buttons. Each link's buttons are one toolbar, one stop for Tab with the arrow keys across it, focus stays with a link that moves, and each change is announced.
  
  The export writes the icons with MJML's social element, each one's image given, so nothing loads from Mailjet, with the network's name as its alt text and a gap of half the icon's size. The icons are PNGs in the renderer's `icons` folder, and emails load them from jsDelivr at the renderer's exact version. `renderEmail` takes a `socialIconsUrl` option, and `<mail-quilt>`, `<mail-quilt-shell>` and both React components take a `socialIconsUrl` property, so a Host app can serve the icons from its own storage. The canvas and Preview load the same URLs as the export, and an empty `socialIconsUrl` counts as none. On the canvas, a faded icon's name says it has no URL yet. A Social Block copied into another app gives its linked networks' names. The logos are their owners' trademarks, and `icons/NOTICE.md` credits each source and its licence.

### Patch Changes

- 729d5d7: Two details of the export, found by the 0.3.0 Email on Acid run. Each paragraph and List item has the email's font on its own tag, as a heading does, because Libero gave paragraphs a font of its own while List items kept the email's. And a Social Block's icons that wrap onto a second line now line up the same on every line: right-aligned, each line ends at the Block's edge, where before the last line ended further right. Half the gap between icons is on every side of each icon, and the Block's padding is that much less, so a single line sits where it did, on the canvas and in the email.
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

## 0.2.0

### Minor Changes

- 7c1e04c: A link or image URL that starts with `httpſ:` in place of `https:`, or a color with anything but a plain space after a comma, such as `rgb(0,\n0,0)` or a no-break space, is refused when set. Neither is a link or a color the docs describe. The same goes for a new language code with `ſ` or the Kelvin sign `K` in place of s or k. A saved language still loads whatever it is.
  
  An email saved with 0.1.0 that holds one of these still opens. **Breaking:** emails are now saved as version 2 of the format, and a version 1 email is upgraded as it loads: such a color gets a plain space after each comma, and such a URL starts with `https:`. Mail Quilt 0.1.0 refuses a version 2 email as newer, so update every package that reads your emails, such as a renderer on your server, at the same time.

### Patch Changes

- 4382c3e: A Merge Tag with spaces inside its braces, such as `{{ customer.preferred_name }}`, is exported as typed, so a sending service can fill it. A long one no longer gets invisible break points, two spaces in one no longer become a no-break space, and a URL written as text that holds one is linked whole, not to the address up to its first space.
- 91086d5:
  - A Button's label gets break points in a word of 20 or more characters, as text does, so a long label such as a file name no longer widens the email in clients that won't break it.
  - A Button label or preheader that reads like MJML's own Column markup is left as typed. Before, it could get a `max-width` added to it.
  - `mjml-browser` is pinned to 5.4.1, because the export's Column widths depend on the exact HTML that version writes.
- 1f2ddc8: A word of 20 or more characters gets break points however it's formatted, so one with a bold part, such as `projects/mail-` and a bold `quilt/welcome`, no longer widens the email. A Merge Tag partly formatted stays whole, and a word gets no break point after its last character, such as the full stop after a URL. A URL written as text ends before Japanese, Chinese or Thai written straight after it, and before their full-width punctuation, so `詳細はhttps://example.jp/をご覧ください` links `https://example.jp/`. A URL with such letters typed in its path links only up to them, so paste it percent-encoded, as browsers copy it, or link it yourself.
- aa4dab9: A URL or email address written as text links to exactly what's written. An address with letters outside ASCII, such as `müller@example.com` or `info@müller.de`, links whole, and one that runs straight into a character it can't hold, such as `a@b.c_d`, isn't linked. Japanese or Chinese written straight before or after an address isn't linked as part of it. A URL or address whose formatting changes partway, such as a bold letter in it, links whole, and one that runs into a link isn't linked. No-break spaces at the ends of a Button's label are kept. A long run of tabs or spaces no longer stalls the export, which took time that grew with the square of the run.
- 886808f: A URL or email address written as text links correctly in the export. A URL with brackets in it, such as `https://en.wikipedia.org/wiki/Mercury_(planet)`, links whole, and one in brackets still links without the closing bracket. An email address links as `mailto:`, and a URL starting with `www.` or with its scheme in capitals, such as `HTTPS://`, links as other URLs do. A URL or address inside a Merge Tag, such as its default value, stays part of the tag. A word of 19 characters with an `&`, `<` or `>` in it no longer gets break points, and a line break in a link or image address no longer becomes a space.
- Updated dependencies [7c1e04c]
- Updated dependencies [290cedb]
- Updated dependencies [2f78ecf]
- Updated dependencies [808da79]
- Updated dependencies [abea3ec]
  - @mailquilt/core@0.2.0

## 0.1.0

### Minor Changes

- 72b0977: First release of the renderer, which turns a saved email into HTML for email clients.
  
  - `renderEmail(document)` returns the HTML, built with MJML, in Node and in the browser alike.
  - It checks the document first, and rejects with the reason if it isn't an email Mail Quilt accepts.
  - Exported emails load no web fonts. MJML would otherwise add Google Fonts for some font names.
  - A URL written as text becomes a link to itself, and a word of 20 or more characters gets zero-width spaces after its slashes and dots, so it wraps in every client. Merge Tags and link addresses are left as written.
  - The HTML was checked in Gmail, Apple Mail, iOS Mail, Outlook from 2016 to Microsoft 365, Yahoo, AOL and European webmail, in light and dark mode. The docs list the clients and the known limits.

### Patch Changes

- Updated dependencies [72b0977]
  - @mailquilt/core@0.1.0
