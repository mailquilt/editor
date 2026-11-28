---
"@mailquilt/editor": patch
---

Host app input the editor can't use is left out with a console error, and the editor keeps working, as a font it can't take already is:

- A `language` in `strings` that isn't a language tag, such as `en_US` or an empty string, made every render throw, so the editor showed nothing. It's now left out, and the editor's words stay in `en`.
- A `null` or empty entry in `starterEmails` or `fonts`, which plain JavaScript can give, threw while the editor updated. It's now left out, as one in `savedRows` already was.
- A Starter email whose `description` isn't text is left out, rather than shown on its card as `[object Object]`.

The editor's texts now all write an apostrophe as `'`. Fourteen used `’`, such as "Paste the video’s link first".
