---
"@mailquilt/renderer": minor
---

`checkEmail(email, options)` lists an email's Problems, what would go wrong for its readers, so a host's server can stop a send that has any. Each Problem has a `code` and an English `message` for developers. A Problem in a Block also has the `rowId`, `columnId` and `blockId` it's in, and one in a Block or the email's settings has the `field` that fixes it. A Problem about the email as a whole, such as `html-too-large`, has neither. It finds an Image with no image or no alt text, a Button with no link, an empty preheader, no language, HTML over Gmail's 102 KB, text, links or a Button's label below WCAG AA contrast with what's behind them, and link text such as "click here". Given the Host app's `mergeTags`, it also finds a tag not in the list, and, when one is marked `unsubscribe`, an email with no link to it. The `CheckEmailOptions`, `Problem` and `ProblemCode` types describe it. The Render on a server page lists each code.
