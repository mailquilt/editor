---
"@mailquilt/editor": minor
---

Fixes in the Shell, `<mail-quilt-shell>`:

- With `save-key` and nothing saved, an email the person imports stays when your app's first `value` arrives after it. Before, that first email replaced the import and cleared undo.
- Importing a file that's the same as the open email changes nothing, so it fires no `mq-change` and saves nothing.
- Each message in the message bar has its own place, so a refused email no longer hides why the saved email couldn't be opened. Export JSON and Export HTML both take away a failed export's message once they work, and leave every other message.
- The messages that the browser can't save, and that the saved email couldn't be opened, go when `save-key` changes, as they were about the key before.
- A saved email that can't be opened is copied to `<save-key>:unopened`, or to `:unopened:2` and on when an earlier copy holds a different email, so no copy is lost.
- The Shell's frame is a CSS part, `frame`, so you can take off its corners and ring with `mail-quilt-shell::part(frame)`.
- `exportHtml()` on a Shell with no email rejects with a message that names `<mail-quilt-shell>`.
