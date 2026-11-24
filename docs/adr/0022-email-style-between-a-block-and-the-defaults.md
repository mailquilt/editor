# Email style sits between a Block and the built-in defaults

An email holds an Email style: its page and email colors, text, button and link colors, a heading and a body font, the sizes of Heading 1 to 3 and body text, and button corners. A Block uses its own value where it sets one, then the Email style's, then the built-in look it uses today. Every field is optional, so an email saved before keeps looking the same.

Until now each Block's colors and sizes fell straight back to a built-in look, so making every button brown meant changing every Button. Blocks already store only the values a person set, which leaves room for a layer in between without rewriting any email.

The existing background colour becomes the page colour and the existing font becomes the body font, so no field changes meaning in an email that has one. The new fields raise the format to version 4 once, with a migration that changes nothing, because the schema refuses keys it doesn't know and older packages must not open an email they would draw wrongly.

## Considered options

- **Styles from the host, as theme tokens.** They'd be the host's brand, not the email's, and the editor's tokens never change the email (GLOSSARY, Theme token). An email has to carry its own look to export the same anywhere.
- **Write the style into every Block when it changes.** No new layer, but a Block could no longer tell a value a person chose from one the style gave it, so changing the style later would overwrite choices.
- **A spacing preset (compact, regular, roomy).** Left out until it has a precise meaning: which paddings it changes, and how it meets a Row's own padding.
