# @mailquilt/editor

The Mail Quilt email editor as Web Components: `<mail-quilt>`, a drag-and-drop editor you put in your own page, and `<mail-quilt-shell>`, a whole editor page with Import, Export and saving in the browser. They work in any framework, or none.

[![Building an email in the Mail Quilt editor: changing the heading, adding a bulleted list, dragging in a Social Block and giving it links, then previewing the email at a phone's width](https://editor.mailquilt.com/editor-demo.gif)](https://editor.mailquilt.com/playground)

```bash
npm install @mailquilt/editor
```

```html
<mail-quilt></mail-quilt>
```

```js
import "@mailquilt/editor";

const editor = document.querySelector("mail-quilt");
editor.addEventListener("mq-change", (event) => {
  save(event.detail.document);
});
editor.addEventListener("mq-error", (event) => {
  console.log(event.detail.reason);
});
editor.value = savedEmail;

const html = await editor.exportHtml();
```

For a page with no bundler, load the CDN build by its full path, with the version pinned:

```html
<script type="module">
  import "https://cdn.jsdelivr.net/npm/@mailquilt/editor@0.2.0/dist/cdn/index.js";
</script>
```

In React, use [`@mailquilt/react`](https://www.npmjs.com/package/@mailquilt/react).

[Docs](https://editor.mailquilt.com/docs/quick-start) · [Playground](https://editor.mailquilt.com/playground) · [Source](https://github.com/mailquilt/editor) · MIT
