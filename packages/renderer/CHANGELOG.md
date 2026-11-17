# @mailquilt/renderer

## 0.1.0

### Minor Changes

- 72b0977: First release of the renderer, which turns a saved email into HTML for email clients.
  
  - `renderEmail(document)` returns the HTML, built with MJML, in Node and in the browser alike.
  - It checks the document first, and rejects with the reason if it isn't an email Mail Quilt accepts.
  - Exported emails load no web fonts. MJML would otherwise add Google Fonts for some font names.
  - A URL written as text becomes a link to itself, and a word of 20 or more characters gets zero-width spaces after its slashes and dots, so it wraps in every client. Merge Tags and link addresses are left as written.
  - The HTML was checked in Gmail, Apple Mail, iOS Mail, Outlook from 2016 to Microsoft 365, Yahoo, AOL and European webmail, in light and dark mode. The docs list the clients and the known limits.

### Patch Changes

- Updated dependencies [72b0977]
  - @mailquilt/core@0.1.0
