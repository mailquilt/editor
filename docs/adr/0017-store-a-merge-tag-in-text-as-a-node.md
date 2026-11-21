# Store a Merge Tag in text as a node that keeps its name as written

In a Text or Heading Block, a Merge Tag is an inline node, `{ "type": "mergeTag", "attrs": { "name": "first_name" } }`, rather than plain text that a pattern finds. The name is exactly what's between the braces, byte for byte. The renderer writes it back as `{{name}}`.

As plain text, a tag could be broken by any edit: Backspace inside `{{first_name}}` left `{{first_name}`. Making the editor treat a run of text as one unit would have meant code of our own for the cursor, selection and input methods, and anything that reads text later, such as the email checker or sample values in the Preview, would have had to find the tags again. ProseMirror treats a node as one unit with no extra code.

## How

- The name is kept exactly as typed, so tags such as `{{#if vip}}` and `{{ user.name | upcase }}` survive. The node is a unit of text, not a claim that the name is valid. Checking names is the email checker's job.
- The node can carry marks, so a bold or linked tag still works.
- Format version 3 comes with a migration that turns each tag in saved text into a node. It converts only a tag that sits whole in one run of text, and the node takes that run's marks. A tag split across runs with different marks, which only an email written outside the editor can have, stays text and still exports the same.
- A tag typed by hand becomes a node when `}}` closes it, whether the Host app lists it or not. Pasted text is treated the same way.
- Settings fields, such as a link URL, an Image URL or a Button label, are strings and stay strings. A tag there is text.

## Alternatives

- **Keep plain text and fake one unit in the editor.** No format change, but the cursor can still land inside a tag by a click, a selection or an input method, and each of those is a rule of our own.
- **Store the syntax, not the name,** such as a node that holds `{{first_name}}`. It ties the format to `{{ }}`. Storing the name leaves Handlebars or Liquid output to the renderer later.

## Consequences

- An email saved with version 3 can't be opened by a package that only knows version 2.
- The migration has to leave the export unchanged. A test renders saved version 2 emails before and after it, and compares the HTML exactly.
- The Merge Tag picker puts in a node through the text view, as typing does, so it doesn't need a text view that follows every change to the email.
