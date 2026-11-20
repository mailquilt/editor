import type { Mark, Node } from "prosemirror-model";
import { AllSelection, EditorState, TextSelection } from "prosemirror-state";
import type { Command as TextCommand } from "prosemirror-state";
import { describe, expect, it } from "vitest";

import { createTextCommands } from "../src/text-commands.js";
import { createTextSchema } from "../src/text-schema.js";

const schema = createTextSchema();
const commands = createTextCommands(schema, { canBold: true });
const { bold, link } = schema.marks;

const linkTo = (href: string) => link.create({ href });
const text = (words: string, ...marks: Mark[]) => schema.text(words, marks);
const lineBreak = () => schema.nodes.hardBreak.create();
const paragraph = (...inline: Node[]) =>
  schema.nodes.paragraph.create(null, inline);

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

/** Each paragraph's pieces of text, with their marks, such as "exa[link:https://a]". */
const shown = ({ doc }: EditorState) =>
  doc.children.map((each) =>
    each.children.map((node) => {
      if (!node.isText) {
        return "<br>";
      }
      const marks = node.marks.map(({ attrs, type }) =>
        type === link ? `link:${attrs.href as string}` : type.name
      );
      return marks.length > 0 ? `${node.text}[${marks.join(" ")}]` : node.text;
    })
  );

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
      italic: false,
      linkHref: "https://a.example",
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
