import { describe, expect, it } from "vitest";

import { pastedContent } from "../src/pasted-text.js";
import { createTextSchema } from "../src/text-schema.js";

const schema = createTextSchema({ lists: true });

describe("text pasted outside any text, as a new Text Block's", () => {
  it("is a paragraph for each line, with a tab as a space and each Merge Tag a node, as a paste into text is", () => {
    const content = pastedContent(schema, {
      html: "",
      text: "Hi {{name}},\r\n\n\tSee you",
    });

    // As it's saved, as ProseMirror's own objects have no prototype.
    expect(structuredClone(content)).toStrictEqual({
      content: [
        {
          content: [
            { text: "Hi ", type: "text" },
            { attrs: { name: "name" }, type: "mergeTag" },
            { text: ",", type: "text" },
          ],
          type: "paragraph",
        },
        { content: [{ text: " See you", type: "text" }], type: "paragraph" },
      ],
      type: "doc",
    });
  });

  it("is nothing for text that's only spaces, so no empty Block is added", () => {
    expect(pastedContent(schema, { html: "", text: " \n\t" })).toBeUndefined();
  });
});
