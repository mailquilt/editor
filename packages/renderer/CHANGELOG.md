# @mailquilt/renderer

## 0.2.0

### Minor Changes

- 7c1e04c: A link or image URL that starts with `httpſ:` in place of `https:`, or a color with anything but a plain space after a comma, such as `rgb(0,\n0,0)` or a no-break space, is refused when set. Neither is a link or a color the docs describe. The same goes for a new language code with `ſ` or the Kelvin sign `K` in place of s or k. A saved language still loads whatever it is.
  
  An email saved with 0.1.0 that holds one of these still opens. **Breaking:** emails are now saved as version 2 of the format, and a version 1 email is upgraded as it loads: such a color gets a plain space after each comma, and such a URL starts with `https:`. Mail Quilt 0.1.0 refuses a version 2 email as newer, so update every package that reads your emails, such as a renderer on your server, at the same time.

### Patch Changes

- 4382c3e: A Merge Tag with spaces inside its braces, such as `{{ customer.preferred_name }}`, is exported as typed, so a sending service can fill it. A long one no longer gets invisible break points, two spaces in one no longer become a no-break space, and a URL written as text that holds one is linked whole, not to the address up to its first space.
- 91086d5:
  - A Button's label gets break points in a word of 20 or more characters, as text does, so a long label such as a file name no longer widens the email in clients that won't break it.
  - A Button label or preheader that reads like MJML's own Column markup is left as typed. Before, it could get a `max-width` added to it.
  - `mjml-browser` is pinned to 5.4.1, because the export's Column widths depend on the exact HTML that version writes.
- 1f2ddc8: A word of 20 or more characters gets break points however it's formatted, so one with a bold part, such as `projects/mail-` and a bold `quilt/welcome`, no longer widens the email. A Merge Tag partly formatted stays whole, and a word gets no break point after its last character, such as the full stop after a URL. A URL written as text ends before Japanese, Chinese or Thai written straight after it, and before their full-width punctuation, so `詳細はhttps://example.jp/をご覧ください` links `https://example.jp/`. A URL with such letters typed in its path links only up to them, so paste it percent-encoded, as browsers copy it, or link it yourself.
- aa4dab9: A URL or email address written as text links to exactly what's written. An address with letters outside ASCII, such as `müller@example.com` or `info@müller.de`, links whole, and one that runs straight into a character it can't hold, such as `a@b.c_d`, isn't linked. Japanese or Chinese written straight before or after an address isn't linked as part of it. A URL or address whose formatting changes partway, such as a bold letter in it, links whole, and one that runs into a link isn't linked. No-break spaces at the ends of a Button's label are kept. A long run of tabs or spaces no longer stalls the export, which took time that grew with the square of the run.
- 886808f: A URL or email address written as text links correctly in the export. A URL with brackets in it, such as `https://en.wikipedia.org/wiki/Mercury_(planet)`, links whole, and one in brackets still links without the closing bracket. An email address links as `mailto:`, and a URL starting with `www.` or with its scheme in capitals, such as `HTTPS://`, links as other URLs do. A URL or address inside a Merge Tag, such as its default value, stays part of the tag. A word of 19 characters with an `&`, `<` or `>` in it no longer gets break points, and a line break in a link or image address no longer becomes a space.
- Updated dependencies [7c1e04c]
- Updated dependencies [290cedb]
- Updated dependencies [2f78ecf]
- Updated dependencies [808da79]
- Updated dependencies [abea3ec]
  - @mailquilt/core@0.2.0

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
