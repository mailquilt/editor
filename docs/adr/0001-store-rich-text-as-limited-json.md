# Store rich text as limited ProseMirror JSON

Text and Heading Blocks store ProseMirror's JSON format, which Tiptap uses too, limited to paragraphs, bold, italic, underline, links and line breaks, rather than an HTML string. Stored HTML would have to be sanitized on every load, including on servers with no DOM, while limited JSON can be validated like any other Block property. `renderer` converts this JSON to HTML with its own small function, so `core` and `renderer` never load the text editor. A Heading's paragraphs export as lines of one heading, because a screen reader would read separate elements as several.

The editor first used Tiptap, and since ADR 0003 uses ProseMirror directly. The format is the same for both.

Format version 3 adds two things, and the limit stays. A Text Block can hold Lists, bulleted or numbered, one level deep, with one paragraph in each item, because email clients disagree on nested indents. A Merge Tag is a node of its own, as ADR 0017 says. Each is checked like any other property.
