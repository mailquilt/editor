---
"@mailquilt/editor": minor
"@mailquilt/renderer": minor
---

An email's plain text, to send beside its HTML for email apps that show only text. The renderer's new `renderText(email)` returns it at once, as it needs no MJML, and `<mail-quilt>` and `<mail-quilt-shell>` get `exportText()`. Each Block is a paragraph: a Heading in capitals, a Text Block's lines and Lists, a link as its text with its URL after it, a Button as its label and URL, an Image as its alt text, and a Social Block's links. Merge Tags stay as written, so the sending service fills them in.

Check gets three tabs above the email: Inbox, as before, Plain text, and HTML, which shows the export a tag to a line with its size. Both are read-only, with Copy text and Copy HTML, which copy them as exported, with their Merge Tags, and a copy is announced, or that it couldn't be made. Show sample values works in Plain text too, for reading only.

What changes for a host:

- New methods `exportText()` on `<mail-quilt>` and `<mail-quilt-shell>`, and `renderText` from `@mailquilt/renderer`. Nothing is removed or renamed.
- No theme token is added or changed. The HTML's tag names use `--mq-color-accent-strong` and its attribute values `--mq-color-success`.
- Copying fires the browser's copy event on the page, as More's Copy does, with the text as `text/plain`.
