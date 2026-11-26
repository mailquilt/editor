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

`checkEmail(email, { mergeTags })` lists the email's Problems, what would go wrong for its readers, such as an Image with no alt text, so your server can stop a send that has any. Each has a `code` and an English `message`, and, where it applies, the Row, Column and Block it's in and the `field` that fixes it. [Check an email before you send](https://editor.mailquilt.com/docs/render-on-a-server#check-an-email-before-you-send) lists every code.

A Social Block's icons are PNGs in this package's `icons` folder, and an email loads them from jsDelivr at this package's exact version. To serve them from your own storage, copy the folder there and pass its URL: `renderEmail(email, { socialIconsUrl: "https://cdn.example.com/mail-icons/" })`. The logos are their owners' trademarks, and `icons/NOTICE.md` credits where each comes from. [Social icons](https://editor.mailquilt.com/docs/social-icons) says more.

MJML needs `cheerio` without listing it, so this package lists it and relies on it being hoisted, as npm and pnpm do by default. With Yarn Plug'n'Play, or pnpm with `hoist=false`, add it for `mjml-browser` with `packageExtensions`, in `.yarnrc.yml` or `pnpm-workspace.yaml`:

```yaml
packageExtensions:
  mjml-browser@5:
    dependencies:
      cheerio: ^1.2.0
```

[Docs](https://editor.mailquilt.com/docs/render-on-a-server) · [Playground](https://editor.mailquilt.com/playground) · [Source](https://github.com/mailquilt/editor) · MIT
