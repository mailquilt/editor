---
"@mailquilt/editor": minor
---

First release of the editor, a Web Component that works in any framework or none.

- **`<mail-quilt>`:** drag Blocks and Rows, or do all of it from the keyboard. Edit text with formatting and links, change settings in the side panel, and preview the real exported HTML in a sandboxed frame.
- **API:** set `value`, listen for `mq-change` and `mq-error`, and call `exportHtml()`. The `MailQuiltChangeEvent` and `MailQuiltErrorEvent` types are exported.
- **`<mail-quilt-shell>`:** a ready-made editor page with Import, Export and messages, which can keep the email in the browser under `save-key`.
- **Theming:** `--mq-*` tokens and the `frame` part match the editor to your app.
- **CDN build:** `dist/cdn/index.js`, for pages without a bundler.
