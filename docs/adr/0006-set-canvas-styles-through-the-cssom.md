# Set the canvas's styles through the CSSOM

The editor works on a page whose Content Security Policy has no `'unsafe-inline'` in `style-src`, as many apps that embed an editor have one. Only Check, which replaced the Preview in 0.4.0, still needs it, because the email it shows relies on inline styles (#180, #320).

Such a policy blocks every `style` attribute the browser parses or a script sets with `setAttribute`. It allows styles set through an element's `style` object, such as `style.setProperty`, and constructed style sheets. The canvas gives each element what comes from the email, such as the email's width, background and font, a Row's background, a Column's width and a Block's settings, as inline styles, because they differ for each email and each element. Lit's `styleMap` set them as a `style` attribute on the first render and through `style` only after that. Under a strict policy the canvas lost them, and some came back after an edit (#159).

## How

- `styleProperties`, in `packages/editor/src/style-properties.ts`, takes the place of `styleMap`. It sets each property with `style.setProperty` and removes one that's gone with `style.removeProperty`, on the first render too. It never writes the attribute. A property that's undefined isn't set, as with `styleMap`.
- The editor's lint config refuses an import of `lit/directives/style-map.js`.
- What already moved things, such as the drop line, a drag's copy, the tooltips and the toolbars, set `style` properties already. The cursor during a drag is a constructed style sheet.
- The editor's own CSS is Lit's static styles, which Lit adopts as constructed style sheets, so the policy doesn't apply to them either.
- ProseMirror reads pasted or dropped HTML into a document that has the page's policy, so Chromium and WebKit blocked its `style` attributes, and Chromium its `<style>` elements. Text from Google Docs came in all bold, without its italic and underline (#208). `packages/editor/src/pasted-html.ts` moves both into `data-` attributes before ProseMirror reads the HTML, and gives them back with `style.cssText` and a constructed style sheet before its parse rules run, in the order ProseMirror applies them. No other way to read HTML in WebKit, such as `DOMParser` or a `<template>`, escapes the policy, so the module reads the HTML text once, as the HTML spec's tokenizer does, and leaves comments, values in quotes and the text of elements such as `<textarea>` as they are.
- A dropdown's arrow is an icon in the page, not a `data:` image, so a policy's `img-src` can't hide it.
- A browser test loads the editor under `style-src 'self'; img-src 'self'`, checks the email's settings on the canvas, drags a Block, shows a tooltip, pastes text from Google Docs and Word, and fails on anything the policy reports blocking.

## Alternatives

- **A constructed style sheet of rules for each email.** Each Row, Column and Block would need a selector of its own, rebuilt on every change, where inline styles already apply to one element.
- **A nonce from the host.** A nonce allows `<style>` elements, not `style` attributes, so it would mean that style sheet too. Every host would have to pass one in.
- **Documenting the limit.** No code, but a host with a strict policy would have to loosen it for the whole page to embed the editor.

## Consequences

- The canvas's styles can't be written into the HTML Lit renders on a server. The editor doesn't render on a server.
- A drag's copy is a clone of the dragged element, and it keeps the copied element's inline styles under the policy in Chromium, Firefox and WebKit. The browser test checks one.
- Check still needs `'unsafe-inline'` in `style-src`, as the Preview did. The email in it is the exported HTML, which relies on inline styles in every email client.
