import type { Mark, Node } from "prosemirror-model";
import {
  AllSelection,
  EditorState,
  NodeSelection,
  TextSelection,
} from "prosemirror-state";
import type { Command as TextCommand } from "prosemirror-state";
import { describe, expect, it } from "vitest";

import { createTextCommands } from "../src/text-commands.js";
import { createTextSchema } from "../src/text-schema.js";

const schema = createTextSchema({ lists: true });
const commands = createTextCommands(schema, { canBold: true });
const { bold, link } = schema.marks;

const linkTo = (href: string) => link.create({ href });
const text = (words: string, ...marks: Mark[]) => schema.text(words, marks);
const lineBreak = () => schema.nodes.hardBreak.create();
const mergeTag = (name: string, ...marks: Mark[]) =>
  schema.nodes.mergeTag.create({ name }, null, marks);
const paragraph = (...inline: Node[]) =>
  schema.nodes.paragraph.create(null, inline);
/** A node type only a Text Block's schema has. */
const listNode = (name: "bulletList" | "listItem" | "orderedList") => {
  const type = schema.nodes[name];
  if (!type) {
    throw new Error(`The schema has no ${name}`);
  }
  return type;
};
const item = (...inline: Node[]) =>
  listNode("listItem").create(null, paragraph(...inline));
const bullets = (...items: Node[]) =>
  listNode("bulletList").create(null, items);
const numbers = (...items: Node[]) =>
  listNode("orderedList").create(null, items);

/**
 * Text of `paragraphs`, with the text selected from `from` to `to`, or a cursor
 * at `from`. The first paragraph's text starts at 1.
 */
const textWith = (paragraphs: Node[], from: number, to = from) => {
  const doc = schema.nodes.doc.create(null, paragraphs);
  return EditorState.create({
    doc,
    selection: TextSelection.create(doc, from, to),
  });
};

/** Text of `paragraphs` with all of it selected, as select all does. */
const allOf = (...paragraphs: Node[]) => {
  const doc = schema.nodes.doc.create(null, paragraphs);
  return EditorState.create({ doc, selection: new AllSelection(doc) });
};

/** The state after `command`, which must act. */
const after = (command: TextCommand, state: EditorState) => {
  let next: EditorState | undefined;
  expect(
    command(state, (tr) => {
      next = state.apply(tr);
    })
  ).toBeTruthy();
  if (!next) {
    throw new Error("The command changed nothing");
  }
  return next;
};

/**
 * Each paragraph's pieces of text, with their marks, such as
 * "exa[link:https://a]", and each Merge Tag as `{{name}}`.
 */
const shown = ({ doc }: EditorState) =>
  doc.children.map((each) =>
    each.children.map((node) => {
      if (node.type === schema.nodes.hardBreak) {
        return "<br>";
      }
      const marks = node.marks.map(({ attrs, type }) =>
        type === link ? `link:${attrs.href as string}` : type.name
      );
      const words = node.text ?? `{{${node.attrs.name as string}}}`;
      return marks.length > 0 ? `${words}[${marks.join(" ")}]` : words;
    })
  );

/**
 * The text's paragraphs and Lists, each paragraph as its text and each List as
 * its type and its items' text.
 */
const outline = ({ doc }: EditorState) =>
  doc.children.map((node) =>
    node.type === schema.nodes.paragraph
      ? node.textContent
      : { [node.type.name]: node.children.map((each) => each.textContent) }
  );

/** The text of the paragraph the cursor is in, and how far into it it is. */
const cursorIn = ({ selection }: EditorState) => {
  expect(selection.empty).toBeTruthy();
  return [selection.$from.parent.textContent, selection.$from.parentOffset];
};

const isMarkedNext = (state: EditorState, type = bold) =>
  Boolean(type.isInSet(state.storedMarks ?? state.selection.$from.marks()));

describe("bold, italic and underline", () => {
  it("over text that's partly bold, make all of it bold", () => {
    const state = textWith(
      [paragraph(text("ab", bold.create()), text("cd"))],
      1,
      5
    );
    expect(shown(after(commands.toggleMark("bold"), state))).toStrictEqual([
      ["abcd[bold]"],
    ]);
  });

  it("over a Merge Tag alone, make it bold", () => {
    const state = textWith([paragraph(text("Hi "), mergeTag("name"))], 4, 5);
    expect(shown(after(commands.toggleMark("bold"), state))).toStrictEqual([
      ["Hi ", "{{name}}[bold]"],
    ]);
  });

  it("over bold text and a Merge Tag that isn't, make all of it bold", () => {
    const state = allOf(
      paragraph(text("Hi ", bold.create()), mergeTag("name"))
    );
    expect(shown(after(commands.toggleMark("bold"), state))).toStrictEqual([
      ["Hi [bold]", "{{name}}[bold]"],
    ]);
  });

  it("over text that's all bold, take it off", () => {
    const state = textWith(
      [paragraph(text("ab", bold.create()), text("cd"))],
      1,
      3
    );
    expect(shown(after(commands.toggleMark("bold"), state))).toStrictEqual([
      ["abcd"],
    ]);
  });

  it("with all of an empty text selected, go on what's typed next, at a cursor", () => {
    const next = after(commands.toggleMark("bold"), allOf(paragraph()));
    expect(next.selection.empty).toBeTruthy();
    expect(isMarkedNext(next)).toBeTruthy();
  });

  it("off, with only a line break after bold text selected, come off what's typed next", () => {
    const state = textWith(
      [paragraph(text("a", bold.create()), lineBreak())],
      2,
      3
    );
    const next = after(commands.toggleMark("bold"), state);
    expect(next.selection.empty).toBeTruthy();
    expect(isMarkedNext(next)).toBeFalsy();
    expect(shown(next)).toStrictEqual([["a[bold]", "<br>"]]);
  });

  it("where bold would change nothing, its key is taken and does nothing", () => {
    const { forKey } = createTextCommands(schema, { canBold: false });
    const state = textWith([paragraph(text("ab"))], 1, 3);
    expect(
      forKey.bold(state, () => {
        throw new Error("Bold changed the text");
      })
    ).toBeTruthy();
  });

  it("the formatting at the cursor is what the toolbar shows", () => {
    const state = textWith(
      [paragraph(text("abc", linkTo("https://a.example"), bold.create()))],
      2
    );
    expect(commands.formats(state)).toStrictEqual({
      bold: true,
      canBold: true,
      canList: true,
      italic: false,
      linkHref: "https://a.example",
      list: undefined,
      underline: false,
    });
  });
});

describe("line breaks", () => {
  it("replace the selection, with the cursor after, and keep the formatting for what's typed next", () => {
    const state = textWith([paragraph(text("abc", bold.create()))], 2, 3);
    const next = after(commands.forKey.lineBreak, state);
    expect(shown(next)).toStrictEqual([["a[bold]", "<br>", "c[bold]"]]);
    expect(next.selection.from).toBe(3);
    expect(isMarkedNext(next)).toBeTruthy();
  });

  it("over all the text, keep the break", () => {
    const next = after(
      commands.forKey.lineBreak,
      allOf(paragraph(text("a")), paragraph(text("b")))
    );
    expect(shown(next)).toStrictEqual([["<br>"]]);
  });
});

describe("Enter", () => {
  it("keeps the formatting for what's typed next", () => {
    const state = textWith([paragraph(text("ab", bold.create()))], 3);
    const next = after(commands.forKey.newParagraph, state);
    expect(shown(next)).toStrictEqual([["ab[bold]"], []]);
    expect(isMarkedNext(next)).toBeTruthy();
  });
});

describe("Delete", () => {
  it("in an empty last paragraph, removes it", () => {
    const state = textWith([paragraph(text("a")), paragraph()], 4);
    expect(shown(after(commands.forKey.deleteForward, state))).toStrictEqual([
      ["a"],
    ]);
  });
});

describe("← and →", () => {
  it("from all the text selected, go to its start and end", () => {
    const state = allOf(paragraph(text("ab")), paragraph(text("cd")));
    expect(
      after(commands.forKey.toStart, state).selection.toJSON()
    ).toStrictEqual({ anchor: 1, head: 1, type: "text" });
    expect(
      after(commands.forKey.toEnd, state).selection.toJSON()
    ).toStrictEqual({ anchor: 7, head: 7, type: "text" });
  });

  it("from any other selection, are left to the browser", () => {
    const state = textWith([paragraph(text("ab"))], 1, 3);
    expect(commands.forKey.toEnd(state)).toBeFalsy();
  });
});

describe("adding a link", () => {
  const href = "https://new.example";

  it("links the selected text", () => {
    const state = textWith([paragraph(text("abc"))], 2, 3);
    expect(shown(after(commands.setLink(href), state))).toStrictEqual([
      ["a", `b[link:${href}]`, "c"],
    ]);
  });

  it("with only a cursor, adds the URL as the linked text", () => {
    const state = textWith([paragraph(text("ab"))], 2);
    expect(shown(after(commands.setLink(href), state))).toStrictEqual([
      ["a", `${href}[link:${href}]`, "b"],
    ]);
  });

  it("on a selection of only a line break, puts the URL as the linked text in its place", () => {
    const state = textWith([paragraph(text("a"), lineBreak())], 2, 3);
    expect(shown(after(commands.setLink(href), state))).toStrictEqual([
      ["a", `${href}[link:${href}]`],
    ]);
  });

  it("with the cursor in a link, changes all of it, and keeps the cursor", () => {
    const state = textWith(
      [
        paragraph(
          text("a"),
          text("bcd", linkTo("https://old.example")),
          text("e")
        ),
      ],
      3
    );
    const next = after(commands.setLink(href), state);
    expect(shown(next)).toStrictEqual([["a", `bcd[link:${href}]`, "e"]]);
    expect(next.selection.toJSON()).toStrictEqual({
      anchor: 3,
      head: 3,
      type: "text",
    });
  });

  it("with the cursor in the first piece of a link in pieces, changes all of it", () => {
    const old = linkTo("https://old.example");
    const state = textWith(
      [paragraph(text("exa", old), text("mple", old, bold.create()))],
      2
    );
    expect(shown(after(commands.setLink(href), state))).toStrictEqual([
      [`exa[link:${href}]`, `mple[link:${href} bold]`],
    ]);
  });
});

describe("removing a link", () => {
  const first = linkTo("https://first.example");

  it("with only a cursor, takes off all of it", () => {
    const state = textWith(
      [paragraph(text("a"), text("bcd", first), text("e"))],
      3
    );
    expect(shown(after(commands.removeLink, state))).toStrictEqual([["abcde"]]);
  });

  it("with the cursor in the first piece of a link in pieces, takes off all of it", () => {
    const state = textWith(
      [paragraph(text("exa", first), text("mple", first, bold.create()))],
      2
    );
    expect(shown(after(commands.removeLink, state))).toStrictEqual([
      ["exa", "mple[bold]"],
    ]);
  });

  it.each([
    ["after it", 2, ["one", "two[link:https://second.example]"]],
    ["before it", 6, ["one[link:https://first.example]", "two"]],
  ])(
    "stops where a link to another URL starts %s",
    (_where, cursor, pieces) => {
      const second = linkTo("https://second.example");
      const state = textWith(
        [paragraph(text("one", first), text("two", second))],
        cursor
      );
      expect(shown(after(commands.removeLink, state))).toStrictEqual([pieces]);
    }
  );

  it("from selected text, takes it off only that text", () => {
    const state = textWith([paragraph(text("abc", first))], 2, 3);
    expect(shown(after(commands.removeLink, state))).toStrictEqual([
      ["a[link:https://first.example]", "b", "c[link:https://first.example]"],
    ]);
  });
});

// Positions in a List: the List opens at 0, its first item at 1, and that
// item's text starts at 3. Each item is its text's length and 4 more.
describe("Enter in a List", () => {
  it("in an item with text, starts a new item, keeping the formatting for what's typed next", () => {
    const state = textWith([bullets(item(text("ab", bold.create())))], 5);
    const next = after(commands.forKey.newParagraph, state);
    expect(outline(next)).toStrictEqual([{ bulletList: ["ab", ""] }]);
    expect(cursorIn(next)).toStrictEqual(["", 0]);
    expect(isMarkedNext(next)).toBeTruthy();
  });

  it("on an empty item in the middle, leaves the List, splitting it", () => {
    const state = textWith(
      [bullets(item(text("a")), item(), item(text("c")))],
      8
    );
    const next = after(commands.forKey.newParagraph, state);
    expect(outline(next)).toStrictEqual([
      { bulletList: ["a"] },
      "",
      { bulletList: ["c"] },
    ]);
    expect(cursorIn(next)).toStrictEqual(["", 0]);
  });
});

describe("Backspace in a List", () => {
  it("at the start of the first item, makes it a paragraph above the List", () => {
    const state = textWith(
      [paragraph(text("x")), numbers(item(text("a")), item(text("b")))],
      6
    );
    const next = after(commands.forKey.deleteBackward, state);
    expect(outline(next)).toStrictEqual(["x", "a", { orderedList: ["b"] }]);
    expect(cursorIn(next)).toStrictEqual(["a", 0]);
  });

  it("at the start of a later item, makes it a paragraph, splitting the List, and never merges it into the item above", () => {
    const state = textWith(
      [bullets(item(text("a")), item(text("b")), item(text("c")))],
      8
    );
    const next = after(commands.forKey.deleteBackward, state);
    expect(outline(next)).toStrictEqual([
      { bulletList: ["a"] },
      "b",
      { bulletList: ["c"] },
    ]);
    expect(cursorIn(next)).toStrictEqual(["b", 0]);
  });

  it("at the start of the paragraph just after a List, merges the paragraph into the last item", () => {
    const state = textWith(
      [bullets(item(text("a")), item(text("b"))), paragraph(text("c"))],
      13
    );
    const next = after(commands.forKey.deleteBackward, state);
    expect(outline(next)).toStrictEqual([{ bulletList: ["a", "bc"] }]);
    expect(cursorIn(next)).toStrictEqual(["bc", 1]);
  });

  it.each([
    ["Backspace", "deleteBackward"],
    ["Delete", "deleteForward"],
  ] as const)(
    "%s in an empty paragraph between two parts of a List joins them again",
    (_key, action) => {
      const state = textWith(
        [numbers(item(text("a"))), paragraph(), numbers(item(text("c")))],
        8
      );
      expect(outline(after(commands.forKey[action], state))).toStrictEqual([
        { orderedList: ["a", "c"] },
      ]);
    }
  );

  it("anywhere else, is left to the browser", () => {
    const state = textWith([bullets(item(text("ab")))], 4);
    expect(commands.forKey.deleteBackward(state)).toBeFalsy();
  });
});

describe("Delete in a List", () => {
  it("at the end of the last item, pulls the next paragraph into it, and the List after that joins it", () => {
    const state = textWith(
      [
        bullets(item(text("a"))),
        paragraph(text("b")),
        bullets(item(text("c"))),
      ],
      4
    );
    const next = after(commands.forKey.deleteForward, state);
    expect(outline(next)).toStrictEqual([{ bulletList: ["ab", "c"] }]);
    expect(cursorIn(next)).toStrictEqual(["ab", 1]);
  });

  it("at the end of the last item, pulls in the first item of a List of the other type after it, which keeps its type", () => {
    const state = textWith(
      [bullets(item(text("a"))), numbers(item(text("b")), item(text("c")))],
      4
    );
    const next = after(commands.forKey.deleteForward, state);
    expect(outline(next)).toStrictEqual([
      { bulletList: ["ab"] },
      { orderedList: ["c"] },
    ]);
    expect(cursorIn(next)).toStrictEqual(["ab", 1]);
  });

  it("at the end of the paragraph before a List, pulls in its first item", () => {
    const state = textWith(
      [paragraph(text("x")), bullets(item(text("a")), item(text("b")))],
      2
    );
    const next = after(commands.forKey.deleteForward, state);
    expect(outline(next)).toStrictEqual(["xa", { bulletList: ["b"] }]);
    expect(cursorIn(next)).toStrictEqual(["xa", 1]);
  });

  it("in an empty item, removes the item", () => {
    const state = textWith(
      [bullets(item(text("a")), item(), item(text("c")))],
      8
    );
    expect(outline(after(commands.forKey.deleteForward, state))).toStrictEqual([
      { bulletList: ["a", "c"] },
    ]);
  });

  it("in a List's only item, empty, removes the List", () => {
    const state = textWith([paragraph(text("a")), bullets(item())], 6);
    expect(outline(after(commands.forKey.deleteForward, state))).toStrictEqual([
      "a",
    ]);
  });
});

describe("turning a List on and off", () => {
  it("over several paragraphs, makes each an item of one List, and shows it's on", () => {
    const state = textWith(
      [paragraph(text("a")), paragraph(text("b")), paragraph(text("c"))],
      2,
      5
    );
    const next = after(commands.toggleList("bulletList"), state);
    expect(outline(next)).toStrictEqual([{ bulletList: ["a", "b"] }, "c"]);
    expect(next.selection.toJSON()).toMatchObject({ anchor: 4, head: 9 });
    expect(commands.formats(next).list).toBe("bulletList");
  });

  it("again, turns the selected items back into paragraphs, splitting the List", () => {
    const state = textWith(
      [bullets(item(text("a")), item(text("b")), item(text("c")))],
      8
    );
    const next = after(commands.toggleList("bulletList"), state);
    expect(outline(next)).toStrictEqual([
      { bulletList: ["a"] },
      "b",
      { bulletList: ["c"] },
    ]);
    expect(cursorIn(next)).toStrictEqual(["b", 0]);
    expect(commands.formats(next).list).toBeUndefined();
  });

  it("again, with one whole item selected, turns only that item back", () => {
    const doc = schema.nodes.doc.create(
      null,
      bullets(item(text("a")), item(text("b")), item(text("c")))
    );
    const state = EditorState.create({
      doc,
      selection: NodeSelection.create(doc, 6),
    });
    const next = after(commands.toggleList("bulletList"), state);
    expect(outline(next)).toStrictEqual([
      { bulletList: ["a"] },
      "b",
      { bulletList: ["c"] },
    ]);
    expect(next.selection.toJSON()).toMatchObject({ anchor: 8, head: 9 });
  });

  it("at a cursor, keeps the formatting turned on for what's typed next", () => {
    const state = textWith([paragraph()], 1);
    const bolded = after(commands.toggleMark("bold"), state);
    const next = after(commands.toggleList("bulletList"), bolded);
    expect(outline(next)).toStrictEqual([{ bulletList: [""] }]);
    expect(isMarkedNext(next)).toBeTruthy();
  });

  it("of the other type, switches the whole List's type", () => {
    const state = textWith([bullets(item(text("a")), item(text("b")))], 3);
    expect(
      outline(after(commands.toggleList("orderedList"), state))
    ).toStrictEqual([{ orderedList: ["a", "b"] }]);
  });

  it("on a paragraph between Lists of the same type, joins them into one", () => {
    const state = textWith(
      [
        numbers(item(text("a"))),
        paragraph(text("b")),
        numbers(item(text("c"))),
      ],
      8
    );
    expect(
      outline(after(commands.toggleList("orderedList"), state))
    ).toStrictEqual([{ orderedList: ["a", "b", "c"] }]);
  });

  it("isn't offered in text that can't have Lists, such as a Heading's", () => {
    const headingSchema = createTextSchema({ lists: false });
    const heading = createTextCommands(headingSchema, { canBold: false });
    const doc = headingSchema.nodes.doc.create(
      null,
      headingSchema.nodes.paragraph.create(null, headingSchema.text("a"))
    );
    const state = EditorState.create({ doc });
    expect(heading.formats(state).canList).toBeFalsy();
    expect(heading.toggleList("bulletList")(state)).toBeFalsy();
  });
});
