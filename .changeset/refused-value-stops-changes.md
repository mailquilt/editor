---
"@mailquilt/editor": patch
---

After the editor refuses an email set as `value`, such as a copy from a newer version, it keeps showing the email it had and sends no `mq-change` until the host sets a `value` it takes. Before, the next edit sent the email still open, so a host that saves each change to the record it had just set wrote the old email over it. Edits made in between still show, and the person can keep working, but they aren't sent. On `<mail-quilt-shell>`, nothing is saved under `save-key` in that time either.
