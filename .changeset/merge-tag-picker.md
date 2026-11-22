---
"@mailquilt/editor": minor
"@mailquilt/react": minor
---

A Merge Tag picker in text. Give `<mail-quilt>` your app's Merge Tags as `mergeTags`, an array of `{ name, label }`, and typing `{{` in a Text or Heading Block opens a list of them at the cursor, which what's typed after `{{` narrows by name and label. ↑ and ↓ move through it, Enter or Tab puts in the highlighted tag as one unit in place of what was typed, and Escape closes it and leaves the text. A click on a tag puts it in too. Focus stays in the text, which names the list and its highlighted tag to a screen reader. The format bar gets a Merge Tag button that types `{{`. On the canvas a tag shows its label, or its name without one, and a change to `mergeTags` redraws the labels without changing the email. The Preview and the export still have `{{name}}`. A tag typed by hand still becomes one unit when its `}}` is typed, listed or not. Without `mergeTags`, nothing changes. `<mail-quilt-shell>` takes the same property, and `MailQuilt` and `MailQuiltShell` take it as a prop.
