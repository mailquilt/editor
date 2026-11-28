---
"@mailquilt/editor": minor
"@mailquilt/renderer": minor
"@mailquilt/react": minor
---

Breaking: the Preview dialog is gone, and the Check Mode takes its place. Check shows the exported email in an inbox, at the email's width and in a phone's frame at 375px, with a line for it as an inbox lists it: the host's `sender` and `subject`, then the preheader, or the email's first words without one. Beside it, "Before you export" lists the email's Problems, from `checkEmail`, each with what's wrong and why it matters, and then what passed. Each Problem but an email too large for Gmail has a fix button, which opens Edit with that part selected and focus in the field that fixes it, or for a list field, such as a Social Block's links, in its first item. With no unsubscribe link there's no field, so its button selects the last Row, where an email's footer is. With a Merge Tag that has a `sample`, "Show sample values" fills the tags with their samples. After a check, the Check tab shows how many Problems there are, and the count is announced. Problems never stop an export.

What changes for a host:

- The Preview dialog, and the Escape that closed it, are gone. A test of your own that clicked "Preview" now chooses the Check tab. Check's email is in sandboxed iframes titled "The email on a desktop" and "The email on a phone".
- The floating toolbar's button below the email is "Check the email", with a tick, and opens Check.
- The narrow notice below 640px has no button, as it no longer offers a preview. It's now a region named by its title, and takes focus when nothing else in the editor can.
- MJML loads the first time someone opens Check or exports. Check's email still needs `'unsafe-inline'` in `style-src`, as the Preview did.
- Theme tokens: `--mq-color-backdrop` is removed. `--mq-color-warning` (`#c2410c`, dark `#ff9b5e`), for the Problems' icons and the Check tab's count, `--mq-color-on-warning` (`#ffffff`, dark `#101113`), for the count's number, and `--mq-color-success` (`#15803d`, dark `#4ade80`), for the ticks of what passed and the "Ready to export" mark, are added.
- New properties on `<mail-quilt>` and `<mail-quilt-shell>`, and props on `MailQuilt` and `MailQuiltShell`: `sender` and `subject`, for Check's inbox. A Merge Tag in `mergeTags` can have a `sample`, which Check shows in its place, and `unsubscribe: true`, which marks the unsubscribe link Check looks for. The Shell and both React components pass them to the editor.
- The renderer's `checkEmail` takes an `html` option, the email's HTML if it's rendered already, which it measures instead of rendering the email again. A contrast Problem has `contrast`, with the `color` and `background` as `#rrggbb`, the `ratio` and the `required` ratio, and a `vague-link-text` Problem has `linkText`, what the link says. The new `Contrast` type describes the first.
