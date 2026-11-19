---
"@mailquilt/renderer": patch
---

- A Button's label gets break points in a word of 20 or more characters, as text does, so a long label such as a file name no longer widens the email in clients that won't break it.
- A Button label or preheader that reads like MJML's own Column markup is left as typed. Before, it could get a `max-width` added to it.
- `mjml-browser` is pinned to 5.4.1, because the export's Column widths depend on the exact HTML that version writes.
