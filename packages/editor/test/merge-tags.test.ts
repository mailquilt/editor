import type { Mark, Node } from "prosemirror-model";
import { EditorState, TextSelection } from "prosemirror-state";
import type { Transaction } from "prosemirror-state";
import { describe, expect, it } from "vitest";

import {
  closeMergeTagPicker,
  mergeTagPicker,
  mergeTagsFromText,
  moveInMergeTagPicker,
  pickMergeTag,
  pickerOf,
  startMergeTag,
} from "../src/merge-tags.js";
import type { MergeTag } from "../src/merge-tags.js";
import { createTextSchema } from "../src/text-schema.js";

const schema = createTextSchema({ lists: false });
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

  it("makes a tag split across runs a node when formatting touches part of it", () => {
    // "{{na" is at 1 to 5, and "me}}" at 5 to 9.
    const state = after(textOf(text("{{na", bold), text("me}}")), (tr) =>
      tr.addMark(5, 7, italic)
    );

    expect(inlineOf(state)).toStrictEqual([tag("name", bold, italic)]);
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

const TAGS: MergeTag[] = [
  { label: "First name", name: "first_name" },
  { label: "Last name", name: "last_name" },
  { name: "company" },
];

/** One paragraph of `inline`, the cursor at its end, and the picker with `tags`. */
const withPicker = (tags: readonly MergeTag[], ...inline: Node[]) => {
  const doc = schema.nodes.doc.create(null, [
    schema.nodes.paragraph.create(null, inline),
  ]);
  return EditorState.create({
    doc,
    plugins: [
      mergeTagsFromText(schema, () => false),
      mergeTagPicker(() => tags),
    ],
    selection: TextSelection.atEnd(doc),
  });
};

const typed = (state: EditorState, words: string) =>
  after(state, (tr) => tr.insertText(words));

/** The state after a text command, which must act. */
const ran = (
  state: EditorState,
  command: (state: EditorState, dispatch?: (tr: Transaction) => void) => boolean
) => {
  let next = state;
  expect(command(state, (tr) => (next = state.apply(tr)))).toBeTruthy();
  return next;
};

const namesIn = (state: EditorState) =>
  pickerOf(state)?.options.map(({ name }) => name);

describe(mergeTagPicker, () => {
  it("opens with every tag when {{ is typed", () => {
    const state = typed(withPicker(TAGS, text("Hi ")), "{{");

    expect(namesIn(state)).toStrictEqual([
      "first_name",
      "last_name",
      "company",
    ]);
    expect(pickerOf(state)?.highlighted).toBe(0);
  });

  it("narrows by name and label, whatever their case", () => {
    const state = withPicker(TAGS, text("Hi "));

    expect(namesIn(typed(state, "{{LAST"))).toStrictEqual(["last_name"]);
    expect(namesIn(typed(state, "{{name"))).toStrictEqual([
      "first_name",
      "last_name",
    ]);
    expect(namesIn(typed(state, "{{first n"))).toStrictEqual(["first_name"]);
  });

  it("stays closed without tags, with none that match, and after }}", () => {
    expect(pickerOf(typed(withPicker([], text("Hi ")), "{{"))).toBeUndefined();
    expect(
      pickerOf(typed(withPicker(TAGS, text("Hi ")), "{{zip"))
    ).toBeUndefined();
    expect(
      pickerOf(typed(withPicker(TAGS, text("Hi ")), "{{company}}"))
    ).toBeUndefined();
  });

  it("doesn't read a query across a tag or a line break", () => {
    expect(
      pickerOf(withPicker(TAGS, text("{{"), tag("a"), text("co")))
    ).toBeUndefined();
    expect(
      pickerOf(
        withPicker(TAGS, text("{{"), schema.nodes.hardBreak.create(), text("c"))
      )
    ).toBeUndefined();
  });

  it("leaves out a tag whose name couldn't be put in text", () => {
    const state = typed(
      withPicker([{ name: "{{first_name}}" }, { name: "" }, ...TAGS]),
      "{{"
    );

    expect(namesIn(state)).toStrictEqual([
      "first_name",
      "last_name",
      "company",
    ]);
  });

  it("goes along the tags both ways round, and back to the first when the query changes", () => {
    let state = typed(withPicker(TAGS), "{{");
    state = ran(state, moveInMergeTagPicker(-1));
    expect(pickerOf(state)?.highlighted).toBe(2);
    state = ran(state, moveInMergeTagPicker(1));
    expect(pickerOf(state)?.highlighted).toBe(0);
    state = ran(state, moveInMergeTagPicker(1));
    expect(pickerOf(state)?.highlighted).toBe(1);

    expect(pickerOf(typed(state, "n"))?.highlighted).toBe(0);
  });

  it("puts in the highlighted tag in place of what's typed, with its marks, and closes", () => {
    let state = withPicker(TAGS, text("Hi ", bold));
    state = typed(state, "{{nam");
    state = ran(state, moveInMergeTagPicker(1));
    state = ran(state, pickMergeTag());

    expect(inlineOf(state)).toStrictEqual([
      text("Hi ", bold),
      tag("last_name", bold),
    ]);
    // After the tag: 1 into the paragraph, 3 for "Hi ", 1 for the tag.
    expect(state.selection.from).toBe(5);
    expect(pickerOf(state)).toBeUndefined();
  });

  it("puts in the tag at an index, as a click picks it", () => {
    const state = ran(typed(withPicker(TAGS), "{{"), pickMergeTag(2));

    expect(inlineOf(state)).toStrictEqual([tag("company")]);
  });

  it("closes, leaving the typed text, and stays closed until another {{", () => {
    let state = typed(withPicker(TAGS, text("Hi ")), "{{f");
    state = ran(state, closeMergeTagPicker);
    expect(inlineOf(state)).toStrictEqual([text("Hi {{f")]);
    expect(pickerOf(state)).toBeUndefined();

    expect(pickerOf(typed(state, "i"))).toBeUndefined();
    expect(namesIn(typed(state, " {{"))).toHaveLength(3);
  });

  it("acts only while open", () => {
    const state = withPicker(TAGS, text("Hi"));

    expect(pickMergeTag()(state)).toBeFalsy();
    expect(moveInMergeTagPicker(1)(state)).toBeFalsy();
    expect(closeMergeTagPicker(state)).toBeFalsy();
  });
});

describe(startMergeTag, () => {
  it("types {{ at the cursor, which opens the picker", () => {
    const state = ran(withPicker(TAGS, text("Hi ", bold)), startMergeTag);

    expect(inlineOf(state)).toStrictEqual([text("Hi {{", bold)]);
    expect(namesIn(state)).toHaveLength(3);
  });

  it("types it in place of selected text", () => {
    const start = withPicker(TAGS, text("Hi you"));
    const state = ran(
      start.apply(start.tr.setSelection(TextSelection.create(start.doc, 4, 7))),
      startMergeTag
    );

    expect(inlineOf(state)).toStrictEqual([text("Hi {{")]);
  });
});
