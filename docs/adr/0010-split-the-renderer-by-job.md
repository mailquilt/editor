# Split the renderer by job

The renderer's one module, `to-mjml.ts`, did three jobs: it turned text into HTML, built the MJML, and held part of the pass over MJML's HTML, whose other part was in `index.ts`. Each job is now a module of its own, and the patterns that read text are a module too (#211).

Before, `to-mjml.ts` was 528 lines, and its regexes were built from strings, so every `\` was written twice. That is how finding 114 of #205 got in: `\\w` in a string reads as `\w` in the regex, which takes only ASCII letters, and nothing in the code showed it. The pass over MJML's HTML matched MJML's Column markup anywhere in the HTML, so a Button label or preheader written the same way got a `max-width` (finding 148).

## How

- `text-patterns.ts` holds every regex that reads the email's text: where words, spaces, Merge Tags, break points, URLs and email addresses are. Each is written with `String.raw`, so it reads as a regex literal would. The ones the renderer uses are exported, so they can be tested on their own, without MJML.
- `escape.ts` is the one place that escapes what goes into MJML (ADR 0004).
- `text-to-html.ts` turns a Text Block's paragraphs, a Heading and a Button's label into the HTML inside MJML's tags: marks, kept spaces, break points and links to written addresses.
- `to-mjml.ts` builds the MJML from the email's settings, Rows, Columns and Blocks.
- `finish-html.ts` is the pass over MJML's HTML: it takes out MJML's layout whitespace and gives shared Columns their width (ADR 0005). Its Column pattern starts at the tag's `<`, which text never has unescaped.
- `render-email.ts` runs them in order and loads MJML. It was in `index.ts` until `check-email.ts`, which renders the email to measure it, needed it without importing `index.ts`, which exports both (#319).
- `check-email.ts` finds an email's Problems. It reads text through `text-to-html.ts`, so it sees each piece of text, and each address linked in it, as the email draws them.
- `index.ts` exports what hosts use, and nothing else.

The exported HTML doesn't change, apart from the fixes made with the split: a Button's label gets break points as text does, and a label or preheader that looks like Column markup is left alone.

## Alternatives

- **One module per pattern's user, with the patterns inside.** The patterns would be beside their only callers, but the address patterns are most of the code where bugs have come from, and are easier to read and test together.
- **Regex literals.** The patterns share parts, such as a Merge Tag and the scripts written without spaces, which a literal can't take in. `String.raw` keeps each part written once.

## Consequences

- A new rule about text goes in `text-to-html.ts`, and its pattern in `text-patterns.ts`.
- A change MJML can't make while it renders goes in `finish-html.ts`. It may depend on MJML's exact output, which is why `mjml-browser` is pinned to one version.
