# Store rich text as limited Tiptap JSON

Text and Heading Blocks store Tiptap's JSON format, limited to paragraphs, bold, italic, underline, links and line breaks, rather than an HTML string. Stored HTML would have to be sanitized on every load, including on servers with no DOM, while limited JSON can be validated like any other Block property. `renderer` converts this JSON to HTML with its own small function, so `core` and `renderer` never load Tiptap. A Heading's paragraphs export as lines of one heading, because a screen reader would read separate elements as several.
