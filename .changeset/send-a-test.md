---
"@mailquilt/editor": minor
"@mailquilt/react": minor
---

Breaking, for the `HostAppProperties` type only: send a test from Check. A host passes `sendTest`, a function that gets `{ html, text, subject }`, the email as `exportHtml()` and `exportText()` give it and the host's `subject`, and sends it through its own sending service to whoever it chooses. Check then has a Send a test button in "Before you export", off until the email is checked. While the test sends it says "Sending…". Once the promise resolves, Check shows and announces "Test sent.". When it rejects with an `Error`, Check shows and announces its message, or "The test wasn't sent. Try again." when it has none, as an upload failure does.

What changes for a host:

- A new optional property `sendTest` on `<mail-quilt>` and `<mail-quilt-shell>`, and prop on `MailQuilt` and `MailQuiltShell`. The Shell and both React components pass it to the editor. Without it, there's no button. Nothing is removed or renamed.
- The exported `HostAppProperties` type gains `sendTest`. Code that uses it as usual keeps compiling: `MailQuiltProps` objects, setting properties on the element, and `implements HostAppProperties`. Code that needs every property stops compiling until it adds `sendTest`, such as `Required<HostAppProperties>` or a `{ [Name in keyof HostAppProperties]-?: … }` list.
- No theme token is added or changed.
