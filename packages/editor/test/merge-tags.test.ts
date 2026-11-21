import type { Mark, Node } from "prosemirror-model";
import { EditorState, TextSelection } from "prosemirror-state";
import type { Transaction } from "prosemirror-state";
import { describe, expect, it } from "vitest";

import { mergeTagsFromText } from "../src/merge-tags.js";
import { createTextSchema } from "../src/text-schema.js";

const schema = createTextSchema();
const bold = schema.marks.bold.create();
const italic = schema.marks.italic.create();
const SHOWN = "test:shown";

const text = (words: string, ...marks: Mark[]) => schema.text(words, marks);
const tag = (name: string, ...marks: Mark[]) =>
  schema.nodes.mergeTag.create({ name }, null, marks);

/** One paragraph of `inline`, with the cursor at its end. */
const textOf = (...inline: Node[]) => {
  const doc = schema.nodes.doc.create(null, [
    schema.nodes.paragraph.create(null, inline),
  ]);
  return EditorState.create({
    doc,
    plugins: [mergeTagsFromText(schema, (tr) => tr.getMeta(SHOWN) === true)],
    selection: TextSelection.atEnd(doc),
  });
};

/** The state after `change`, with what the plugin appends. */
const after = (state: EditorState, change: (tr: Transaction) => Transaction) =>
  state.applyTransaction(change(state.tr)).state;

const inlineOf = ({ doc }: EditorState) => doc.firstChild?.children;

describe(mergeTagsFromText, () => {
  it("makes a tag a node when typing }} closes it, with its text's marks, its name as typed", () => {
    const state = after(textOf(text("Hi {{ first name }", bold)), (tr) =>
      tr.insertText("}")
    );

    expect(inlineOf(state)).toStrictEqual([
      text("Hi ", bold),
      tag(" first name ", bold),
    ]);
    // After the tag, where typing goes on: 1 into the paragraph, 3 for "Hi ", 1 for the tag.
    expect(state.selection.from).toBe(5);
  });

  it("makes a tag a node when }} closes it across runs with different marks, with all their marks", () => {
    const state = after(textOf(text("{{first", bold), text("_name}")), (tr) =>
      tr.insertText("}")
    );

    expect(inlineOf(state)).toStrictEqual([tag("first_name", bold)]);
  });

  it("leaves a tag the change didn't touch as text", () => {
    const state = after(textOf(text("{{a}}", bold), text(" and")), (tr) =>
      tr.insertText("!")
    );

    expect(inlineOf(state)).toStrictEqual([text("{{a}}", bold), text(" and!")]);
  });

  it("leaves the text the editor shows from the email as it is", () => {
    const state = after(textOf(text("Hi")), (tr) =>
      tr.insertText(" {{x}}", 3).setMeta(SHOWN, true)
    );

    expect(inlineOf(state)).toStrictEqual([text("Hi {{x}}")]);
  });

  it("makes each tag in pasted text a node", () => {
    const state = after(textOf(text("Hi ", italic)), (tr) =>
      tr.replaceSelectionWith(text("{{a}}{{b}} and {{{c}}}"), false)
    );

    expect(inlineOf(state)).toStrictEqual([
      text("Hi ", italic),
      tag("a"),
      tag("b"),
      text(" and {"),
      tag("c"),
      text("}"),
    ]);
  });
});
