# @mailquilt/renderer

Turns a Mail Quilt email into HTML that email clients can show, with MJML. It runs without a DOM, so you can render on your server just before you send.

```bash
npm install @mailquilt/renderer
```

```js
import { renderEmail } from "@mailquilt/renderer";

// `email` is the JSON your app saved from the editor.
const html = await renderEmail(email);
```

`renderEmail` rejects with the reason if the email isn't one Mail Quilt accepts. MJML loads the first time you call it.

[Source and docs](https://github.com/yourcodebuddy-in/mailquilt) · MIT
