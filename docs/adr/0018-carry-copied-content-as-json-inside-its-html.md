# Carry copied content as JSON inside its HTML

A copied Block or Row goes to the clipboard as plain text and as simple HTML. The HTML's wrapper carries the content and the format version as JSON in a `data-mail-quilt` attribute. A Mail Quilt editor that's pasted into reads the JSON. Any other app reads the HTML or the text.

The JSON is what makes a paste exact: a Button keeps its colors and an Image its width, which HTML alone would lose. It has to work between emails and between tabs, and the Host app may serve two editors from different origins.

## How

- The plain text is the content's text, with each Merge Tag written as `{{name}}`.
- The HTML is made without MJML: text keeps its marks and Lists, an Image is an `img`, and a Button is a link. It's readable when pasted into a document or another email.
- On paste, core checks the JSON as it checks any email from outside. It migrates an older version, refuses a newer one with the message `value` gives, and gives every Row, Column and Block a new ID.
- Paste inside a Block's text stays the text editor's own. It reads the HTML, as it reads any pasted HTML.

## Alternatives

- **A custom clipboard type,** such as `application/x-mail-quilt`. It's cleaner, but Safari limits custom types between origins, and it gives nothing to other apps.
- **HTML alone, read back into Blocks.** No JSON, but every setting HTML can't show would be lost on paste, even within the same email.

## Consequences

- Browsers clean pasted HTML differently, so a browser test copies and pastes between two pages through the real clipboard in each browser, and checks that the JSON survives.
- The pasted JSON is untrusted, so it can never hold more than a saved email can.
- The clipboard's HTML has to be written for everything text can hold. That's why copy and paste is built after Merge Tags and Lists.
