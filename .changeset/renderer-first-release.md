---
"@mailquilt/renderer": minor
---

First release of the renderer, which turns a saved email into HTML for email clients.

- `renderEmail(document)` returns the HTML, built with MJML, in Node and in the browser alike.
- It checks the document first, and rejects with the reason if it isn't an email Mail Quilt accepts.
- Exported emails load no web fonts. MJML would otherwise add Google Fonts for some font names.
- Outlook relies on MJML alone and is untested. The docs list the email clients that were checked.
