---
name: mail-quilt
description: "Add Mail Quilt's drag-and-drop email editor to a web app (<mail-quilt>, the ready-made <mail-quilt-shell>, or the React components), save and load emails as JSON, export or render them as HTML, change them in code, and lay out, theme or restyle the editor. Use whenever a task involves Mail Quilt or its packages (@mailquilt/editor, @mailquilt/react, @mailquilt/core, @mailquilt/renderer), or adding an email editor or email builder to an app that uses them."
---

# Mail Quilt

Mail Quilt is a set of free, MIT-licensed packages for adding a drag-and-drop email editor to a web app. The docs at https://editor.mailquilt.com are the facts: read the page for the task before you write code, and don't rely on memory, as the API is at `0.x` and can change. Add `.md` to any docs URL for its Markdown. This skill adds what the docs don't: which package to pick, the order of work, and the mistakes to avoid.

## Pick the package

Ask what the user's app needs, or read it from the code, before installing anything:

| The app needs | Use | Install |
| --- | --- | --- |
| A whole editor page, with Export, Import and messages | The Shell, `<mail-quilt-shell>`, or `MailQuiltShell` in React | `@mailquilt/editor`, or `@mailquilt/react` |
| An editor inside a page the app lays out, such as below a form | `<mail-quilt>`, or `MailQuilt` in React | `@mailquilt/editor`, or `@mailquilt/react` |
| A page with no build step, such as Rails, Laravel or plain HTML | The CDN build of either element | Nothing; a `<script type="module">` |
| HTML on a server from a saved email | `renderEmail()` | `@mailquilt/renderer` |
| Emails created, checked or changed in code | `createEmail()`, `loadDocument()`, `createEditor()` and Commands | `@mailquilt/core` |

React needs React 19, and `@mailquilt/react` installs the editor with it. An app needs only one of the editor packages. Details: [Packages](https://editor.mailquilt.com/docs/packages.md), [Shell or `<mail-quilt>`](https://editor.mailquilt.com/docs/shell.md).

## Set it up

1. **Copy the example for the app's setup**, rather than writing the wiring from scratch. It opens an email, saves each change, shows why an email was refused, and exports HTML, and it's tested against the built packages: [HTML, no build step](https://editor.mailquilt.com/docs/html.md), [Quick start, with a bundler](https://editor.mailquilt.com/docs/quick-start.md), [React](https://editor.mailquilt.com/docs/react.md), [Next.js](https://editor.mailquilt.com/docs/nextjs.md), [Shell](https://editor.mailquilt.com/docs/shell.md). Vue, Angular and Svelte use the element directly, untested so far: [Vue, Angular and Svelte](https://editor.mailquilt.com/docs/other-frameworks.md). Every property, event and prop is in the [Editor API](https://editor.mailquilt.com/docs/api.md).
2. **Use an email to start from.** Use one the app already has, or the example email in the [document format](https://editor.mailquilt.com/docs/document-format.md). `createEmail()` from `@mailquilt/core` makes a new one, with one empty Text Block.
3. **Save the JSON, not the HTML.** The JSON from `mq-change` (`onChange` in React) is the email. Store it, and make HTML from it with `exportHtml()` in the browser or `renderEmail()` on a server: [Render on a server](https://editor.mailquilt.com/docs/render-on-a-server.md).
4. **Check JSON from anywhere you don't control** with `loadDocument()` before you store or render it: [Change emails in code](https://editor.mailquilt.com/docs/change-emails-in-code.md).

### Mistakes to avoid

- **Listening for `mq-error` too late.** It fires once, just after the code that sets `value` finishes. Add the listener before setting `value`, or straight after. One added later, such as in a `useEffect`, misses it, and the user sees an empty editor with no reason. React's `onError` is always in time.
- **Setting `value` from anything but the latest email.** An older one counts as a different email: it opens and clears undo. Don't set `value` from each server response after a save, or a slow response replaces what was typed since. Passing back the email from `mq-change` is safe.
- **Loading the CDN build by a short URL.** Use the full, pinned path, `https://cdn.jsdelivr.net/npm/@mailquilt/editor@<version>/dist/cdn/index.js`. The bare package URL loads a build that needs a bundler, and an unpinned one can ask for a file the latest release no longer has.
- **Passing callbacks from a Next.js Server Component.** `MailQuilt` and `MailQuiltShell` render safely on the server, but `onChange` and `onError` need a Client Component. A Shell with `saveKey` and no callbacks can stay a Server Component.
- **Sharing one `save-key` between emails or people.** Each email and each person needs a key of their own, or one email opens in place of another, and on a shared browser one person's email opens for the next. Start it with the app's name, so no other app on the origin uses it, and add the IDs the app has, such as `my-app:${userId}:${emailId}`. Set it before the Shell opens.
- **Giving the editor too little room.** It needs at least 640px of width, or it shows a notice instead, and at least 600px of height, growing with the email. Don't give `<mail-quilt>` a fixed height or put it in anything that clips it. For a box of a fixed height, use the Shell.
- **Expecting Merge Tags to come through unchanged whatever they hold.** Tags such as `{{first_name}}` reach the HTML as typed, but any `&`, `<` or `>` inside one is escaped, and a `"` too in a link or image URL. Keep tags to plain names.
- **Forgetting the Content Security Policy.** Preview needs `'unsafe-inline'` in `style-src`, or it shows the email without its styling. The canvas works without it. `img-src` has to allow the sites the email's images are on, or the canvas and Preview don't show them. A page using the CDN build also needs `script-src` to allow the `dist/cdn/` folder: [Content Security Policy](https://editor.mailquilt.com/docs/api.md).
- **Yarn Plug'n'Play, or pnpm with `hoist=false`.** MJML needs `cheerio` added as a package extension: [Packages](https://editor.mailquilt.com/docs/packages.md).

## Restyle the editor

Work in this order, and stop as soon as it matches the app:

1. **Layout.** Give `<mail-quilt>` the full width of the content area, in the page's normal flow. The side panel sits beside the email only while the editor is at least the email's width plus 400px, which is 1000px for the usual 600px email: [Fit the editor into your page](https://editor.mailquilt.com/docs/design-your-editor-page.md).
2. **Font and accent.** Set `--mq-font-family` and the four accent tokens on the `<mail-quilt>` element, or on `<mail-quilt-shell>` for a Shell: [Theme the editor](https://editor.mailquilt.com/docs/theme-the-editor.md), and every token in [Theme tokens](https://editor.mailquilt.com/docs/theme-tokens.md).
3. **A dark theme, if the app has one.** Set every color token, never a few, or light defaults are left beside dark ones. Start from the complete dark theme in [Theme the editor](https://editor.mailquilt.com/docs/theme-the-editor.md), then change the accent. Keep these pairs readable together, at 4.5:1 for text:
   - `--mq-color-surface` on `--mq-color-text`, the selected Block's tag and toolbar
   - `--mq-color-on-accent` on `--mq-color-accent`. White on a mid-tone accent such as `#8b5cf6` falls short, so use a dark one.
   - `--mq-color-accent-strong` on `--mq-color-accent-soft`, pressed buttons such as Bold. On a dark theme the strong accent is the lighter one.
   - `--mq-color-on-tooltip` on `--mq-color-tooltip`

   Set `--mq-color-scheme: dark` too, or the browser's own dropdown lists and color picker stay light. The page's own `color-scheme` doesn't reach the editor.
4. **The frame.** Only if tokens aren't enough, style `mail-quilt::part(frame)`, such as `border-radius: 0` for an editor that fills a panel.
5. **The Shell's header and messages.** Choose its buttons with `actions`, name it with `heading`, and style its CSS parts, such as `mail-quilt-shell::part(header)`: [Shell](https://editor.mailquilt.com/docs/shell.md).

Don't:

- **Theme the email.** The tokens never change the email, which keeps its own background, colors and font, so it looks as it will when sent. People change those in the editor's Settings tab.
- **Reach into the editor's Shadow DOM, or style its internal class names.** They aren't part of the API and change between versions. Use tokens and the documented parts.
- **Rebuild the editor's own controls**, such as the side panel or toolbars. They aren't replaceable in `0.x`. Put the app's own controls around the editor, or use the Shell's header.

Before you finish, check what [Fit the editor into your page](https://editor.mailquilt.com/docs/design-your-editor-page.md) lists:

- the window narrowed below 640px and back
- the editor used from the keyboard
- contrast with the new colors
- the Preview opened, and the HTML exported once

## More

- Every key the editor answers to, and what screen readers hear: [Keyboard and screen readers](https://editor.mailquilt.com/docs/keyboard.md).
- Which email clients the HTML has been checked in: [Tested email clients](https://editor.mailquilt.com/docs/email-clients.md).
- Every page, with a one-line summary: [llms.txt](https://editor.mailquilt.com/llms.txt).
