---
"@mailquilt/renderer": minor
---

`checkEmail(email, options)` lists an email's Problems, what would go wrong for its readers, so a host's server can stop a send that has any. Each Problem has a `code`, an English `message` for developers, the `rowId`, `columnId` and `blockId` it's in, and the `field` that fixes it. It finds an Image with no image or no alt text, a Button with no link, an empty preheader, no language, HTML over Gmail's 102 KB, text, links or a Button's label below WCAG AA contrast with what's behind them, and link text such as "click here". Given the Host app's `mergeTags`, it also finds a tag not in the list, and, when one is marked `unsubscribe`, an email with no link to it. The `CheckEmailOptions`, `Problem` and `ProblemCode` types describe it. The Render on a server page lists each code.
