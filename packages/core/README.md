# @mailquilt/core

The Mail Quilt email as data: the document format, the Commands that change it, and undo. It runs without a DOM, in Node or a browser.

```bash
npm install @mailquilt/core
```

```js
import { createEditor, createEmail, loadDocument } from "@mailquilt/core";

// Check an email your app saved before trusting it.
const loaded = loadDocument(JSON.parse(savedJson));
const editor = createEditor({
  document: loaded.ok ? loaded.document : createEmail(),
});

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

[Source and docs](https://github.com/yourcodebuddy-in/mailquilt) · MIT
