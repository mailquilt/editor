# @mailquilt/core

The Mail Quilt email as data: the document format, the Commands that change it, and undo. It runs without a DOM, in Node or a browser.

```bash
npm install @mailquilt/core
```

```js
import { createEditor, createEmail, loadDocument } from "@mailquilt/core";

// Start a new email, or check one your app saved before trusting it.
const loaded = savedJson ? loadDocument(JSON.parse(savedJson)) : undefined;
if (loaded && !loaded.ok) {
  // Keep the saved email as it is, rather than saving a blank one over it.
  throw new Error(`The saved email can't be opened: ${loaded.reason}`);
}
const editor = createEditor({ document: loaded?.document ?? createEmail() });

// Commands change the email, and each one can be undone.
const result = editor.apply({
  blockType: "heading",
  rowIndex: 0,
  type: "insertBlockInNewRow",
});
if (!result.ok) {
  console.log(result.reason);
}
editor.undo();
```

The other Mail Quilt packages are built on this one. To turn an email into HTML, use [`@mailquilt/renderer`](https://www.npmjs.com/package/@mailquilt/renderer). For the editor, use [`@mailquilt/editor`](https://www.npmjs.com/package/@mailquilt/editor) or [`@mailquilt/react`](https://www.npmjs.com/package/@mailquilt/react).

[Docs](https://editor.mailquilt.com/docs/change-emails-in-code) · [Playground](https://editor.mailquilt.com/playground) · [Source](https://github.com/mailquilt/editor) · MIT
