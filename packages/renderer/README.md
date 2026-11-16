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

MJML needs `cheerio` without listing it, so this package lists it and relies on it being hoisted, as npm and pnpm do by default. With Yarn Plug'n'Play, or pnpm with `hoist=false`, add it for `mjml-browser` with `packageExtensions`, in `.yarnrc.yml` or `pnpm-workspace.yaml`:

```yaml
packageExtensions:
  mjml-browser@5:
    dependencies:
      cheerio: ^1.2.0
```

[Docs](https://editor.mailquilt.com/docs/render-on-a-server) · [Playground](https://editor.mailquilt.com/playground) · [Source](https://github.com/mailquilt/editor) · MIT
