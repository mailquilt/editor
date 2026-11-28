---
"@mailquilt/editor": minor
---

Breaking: `<mail-quilt>` has a top bar above the email, with Undo and Redo, the three Modes, Edit, Style and Check, and Desktop and Phone views. Edit is the editor as before. A person moves between the Modes by pointer, or from the keyboard as one Tab stop with the arrow keys, and Style and Check are off while the email is empty. Phone shows the email at a phone's width. Undo and Redo have left the toolbar below the email. The top bar is the `top-bar` part, and the editor stays at least 600px tall with it.

In `<mail-quilt-shell>`, the email's name, whether it's saved, and Export and Import are in the same top bar, and the message bar is below it, so the page has one header. Export is one button with a menu of the HTML file and the JSON file, off while the email is empty, and Import JSON is in a More menu. With `save-key`, the bar says "Saved", or "Not saved" when the browser can't save, and that message has an Export JSON button.

What changes for a host:

- `mail-quilt-shell::part(header)` still styles the bar, which is now the editor's. `import-json`, `export-json` and `export-html` are the menus' items, and the Export button is the new `export` part. `status` is the save status.
- A test of your own that clicks the Shell's Export HTML, Export JSON or Import JSON button now opens Export or More first, then picks HTML file, JSON file or Import JSON….
- The Shell is as tall as the editor, 600px at least, where its header used to add 48px.
