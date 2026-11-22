# @mailquilt/react

## 0.3.0

### Minor Changes

- 703bc4e: Breaking: a Text Block can hold bulleted and numbered Lists, one level deep, with one paragraph in each item. In rich text they're `bulletList` and `orderedList` nodes holding `listItem`s, part of format version 3, and `RichTextDocument`'s `content` can now hold a `RichTextList` as well as a `RichTextParagraph`. A Heading can't have Lists, and its text is the new `RichTextHeadingDocument` type. The export writes each List as `<ul>` or `<ol>` with its margins and padding inline, and each item with a paragraph's styles and line height. A numbered List starts at 1. The format bar gets Bulleted list and Numbered list buttons, which show when they're on, and Shift+Ctrl/⌘+8 and Shift+Ctrl/⌘+7 turn them on and off on any keyboard layout. Enter in an empty item leaves the List, Backspace at the start of an item makes it a paragraph, and Backspace at the start of the paragraph after a List joins it to the last item. Delete at the end of a List's last item, or of the paragraph before a List, pulls in the next paragraph or the next List's first item, and that List keeps its type. Two Lists of one type left next to each other by Backspace or Delete become one. A pasted List comes in as a List, with any List inside it flattened to one level. Typing "- " or "1. " stays as typed.
- 77b334b: Breaking: the saved format is version 3, and a Merge Tag in a Text or Heading Block is one unit. In rich text it's a `mergeTag` node, `{ "type": "mergeTag", "attrs": { "name": "first_name" } }`, whose name is what goes between the braces, exactly as written. Backspace and Delete remove a tag whole, the cursor can't go inside it, and formatting goes on all of it. A tag becomes a node when its `}}` is typed, and each tag in pasted text does too. On the canvas a tag shows its name, and a screen reader, its tooltip and a plain-text copy give `{{name}}`. An email saved with version 2 is upgraded as it loads, and exports exactly as before. An email saved with version 3 can't be opened by an older package. Every email saved with `0.3` is version 3, even one that uses none of the new features, so where a web app and a render worker are on different versions, such as a web app that saves emails with `0.3` and a worker that renders them with `0.2`, the worker refuses them. Update the worker first, or both together. The new `RichTextMergeTag` type describes the node.
- 20992ed: A Merge Tag picker in text. Give `<mail-quilt>` your app's Merge Tags as `mergeTags`, an array of `{ name, label }`, and typing `{{` in a Text or Heading Block opens a list of them at the cursor, which what's typed after `{{` narrows by name and label. ↑ and ↓ move through it, Enter or Tab puts in the highlighted tag as one unit in place of what was typed, and Escape closes it and leaves the text. A click on a tag puts it in too. Focus stays in the text, which names the list and its highlighted tag to a screen reader. The format bar gets a Merge Tag button that types `{{`. On the canvas a tag shows its label, or its name without one, and a change to `mergeTags` redraws the labels without changing the email. The Preview and the export still have `{{name}}`. A tag typed by hand still becomes one unit when its `}}` is typed, listed or not. Without `mergeTags`, nothing changes. `<mail-quilt-shell>` takes the same property, and `MailQuilt` and `MailQuiltShell` take it as a prop.
- 647bc11: Breaking: a Social Block, in format version 3, shows linked icons for Facebook, Instagram, LinkedIn, X, YouTube, TikTok, Pinterest, Threads, Bluesky and a website. Its props are `links`, a list of `{ network, url }` in the order the icons show, with each network at most once, `iconStyle`, `"color"` or `"white"`, `iconSize`, 32, 40 or 48, and `align`. Each URL is checked as a link, so it can hold a Merge Tag. A link without a URL stays in the list, faded on the canvas, and is left out of the export, and a Social Block with no URL at all is left out, as an Image without one is. A new Social Block has no links, and the Side panel sets its links, style, size and alignment. There, a person adds a network not yet in the list, types its URL, and moves it up or down or removes it with buttons. Each link's buttons are one toolbar, one stop for Tab with the arrow keys across it, focus stays with a link that moves, and each change is announced.
  
  The export writes the icons with MJML's social element, each one's image given, so nothing loads from Mailjet, with the network's name as its alt text and a gap of half the icon's size. The icons are PNGs in the renderer's `icons` folder, and emails load them from jsDelivr at the renderer's exact version. `renderEmail` takes a `socialIconsUrl` option, and `<mail-quilt>`, `<mail-quilt-shell>` and both React components take a `socialIconsUrl` property, so a Host app can serve the icons from its own storage. The canvas and Preview load the same URLs as the export, and an empty `socialIconsUrl` counts as none. On the canvas, a faded icon's name says it has no URL yet. A Social Block copied into another app gives its linked networks' names. The logos are their owners' trademarks, and `icons/NOTICE.md` credits each source and its licence.
- 9648b8a: Image upload. Give `<mail-quilt>` an `uploadImage` function, which uploads a file to your own storage and returns `{ url }`, and the Image settings get an Upload image button beside the Image URL. `<mail-quilt-shell>` takes the same property, and `MailQuilt` and `MailQuiltShell` take it as a prop. The picker offers PNG, JPEG and GIF, and refuses other files before your function is called. While the upload runs, the Image Block shows "Uploading…", and the URL your function returns is checked as a typed Image URL is. A rejection's `Error` message is shown by the Image URL field and read out. Image files can also be dropped: one dropped on an Image Block sets its image, and files dropped elsewhere on the email each add an Image Block where they land, with the same drop line as a Block from the Content tab. The upload is aborted through `signal` when its Image Block is deleted, undone or replaced by a new `value`. The new `HostAppProperties` type lists the properties. [Upload images](https://editor.mailquilt.com/docs/upload-images) shows a pre-signed upload.

### Patch Changes

- Updated dependencies [f08e0bc]
- Updated dependencies [9925d65]
- Updated dependencies [10b300f]
- Updated dependencies [703bc4e]
- Updated dependencies [77b334b]
- Updated dependencies [20992ed]
- Updated dependencies [151b5dc]
- Updated dependencies [63f6621]
- Updated dependencies [1a5332b]
- Updated dependencies [647bc11]
- Updated dependencies [9648b8a]
  - @mailquilt/editor@0.3.0

## 0.2.0

### Minor Changes

- 7c1e04c: A link or image URL that starts with `httpſ:` in place of `https:`, or a color with anything but a plain space after a comma, such as `rgb(0,\n0,0)` or a no-break space, is refused when set. Neither is a link or a color the docs describe. The same goes for a new language code with `ſ` or the Kelvin sign `K` in place of s or k. A saved language still loads whatever it is.
  
  An email saved with 0.1.0 that holds one of these still opens. **Breaking:** emails are now saved as version 2 of the format, and a version 1 email is upgraded as it loads: such a color gets a plain space after each comma, and such a URL starts with `https:`. Mail Quilt 0.1.0 refuses a version 2 email as newer, so update every package that reads your emails, such as a renderer on your server, at the same time.
- 83b7114: **Breaking:** `MailQuilt` and `MailQuiltShell` take only the props that mean something on their element. Besides their own, those are `aria-*` attributes, React's events such as `onKeyDown`, and `className`, `hidden`, `id`, `inert`, `lang`, `role`, `slot`, `style`, `suppressHydrationWarning` and `title`. Before, they took every prop of an HTML element, such as a form field's `defaultValue`, and `dir`, though the editor is left to right on any page, and `translate`, which React set as a property, so `translate="no"` turned translation on. Those are now type errors.

### Patch Changes

- 739ee11: When the editor's code can't load, such as when its file fails to download, `onError` is called with the reason, starting "The editor couldn't load:". Before, the component stayed empty and nothing was called. Without `onError`, the failure is an unhandled rejection, as before, and only one under StrictMode, which mounts the component twice. A component removed before its load fails reports nothing, with or without `onError`.
- Updated dependencies [4154f21]
- Updated dependencies [f4c0806]
- Updated dependencies [7c1e04c]
- Updated dependencies [3eb84b6]
- Updated dependencies [146b517]
- Updated dependencies [07ac505]
- Updated dependencies [362d8c5]
- Updated dependencies [18a5e61]
- Updated dependencies [7c1e04c]
- Updated dependencies [87a4e62]
- Updated dependencies [5cbbfdc]
- Updated dependencies [27d37bf]
- Updated dependencies [27d37bf]
- Updated dependencies [2ed9203]
- Updated dependencies [4d6cd17]
- Updated dependencies [91086d5]
- Updated dependencies [5bf5d47]
- Updated dependencies [38882f8]
- Updated dependencies [5911f8e]
- Updated dependencies [e878b73]
- Updated dependencies [593d67f]
- Updated dependencies [abea3ec]
- Updated dependencies [5533e5a]
  - @mailquilt/editor@0.2.0

## 0.1.0

### Minor Changes

- 72b0977: First release of the React components.
  
  - `<MailQuilt>` and `<MailQuiltShell>` wrap the editor, with `value`, `onChange` and `onError`.
  - `className`, `style`, `id` and `aria-*` pass through to the element.
  - Works in Next.js, including Server Components, which render an empty element that the editor fills in the browser.

### Patch Changes

- Updated dependencies [72b0977]
  - @mailquilt/editor@0.1.0
