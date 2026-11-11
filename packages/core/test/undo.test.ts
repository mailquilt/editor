import { describe, expect, it } from "vitest";

import { createEditor, createEmail } from "../src/index.js";

const paragraph = (text: string) => ({
  content: [{ content: [{ text, type: "text" }], type: "paragraph" }],
  type: "doc",
});

const setup = () => {
  const document = createEmail();
  const blockId = document.rows[0]?.columns[0]?.blocks[0]?.id ?? "";
  const editor = createEditor({ document });
  const setText = (text: string, options?: { mergeKey: string }) =>
    editor.apply(
      { blockId, props: { content: paragraph(text) }, type: "updateProps" },
      options
    );
  return { blockId, document, editor, setText };
};

describe("undo", () => {
  it("restores the document from before an accepted Command", () => {
    const { document, editor, setText } = setup();
    setText("Changed");

    expect(editor.undo()).toBeTruthy();

    expect(editor.getDocument()).toStrictEqual(document);
  });
});

describe("redo", () => {
  it("restores the document that undo took away", () => {
    const { editor, setText } = setup();
    setText("Changed");
    const changed = editor.getDocument();
    editor.undo();

    expect(editor.redo()).toBeTruthy();

    expect(editor.getDocument()).toStrictEqual(changed);
  });
});

describe("the undo history", () => {
  it("undoes one Command per step, most recent first", () => {
    const { editor, setText } = setup();
    setText("First");
    const afterFirst = editor.getDocument();
    setText("Second");

    editor.undo();

    expect(editor.getDocument()).toStrictEqual(afterFirst);
  });

  it("has nothing to undo or redo in a new editor", () => {
    const { document, editor } = setup();

    expect(editor.undo()).toBeFalsy();
    expect(editor.redo()).toBeFalsy();
    expect(editor.getDocument()).toStrictEqual(document);
  });

  it("has no step for a rejected Command", () => {
    const { blockId, editor, setText } = setup();
    setText("Kept");
    const before = editor.getDocument();

    const result = editor.apply({
      blockId,
      props: { colour: "red" },
      type: "updateProps",
    });

    expect(result.ok).toBeFalsy();
    expect(editor.getDocument()).toStrictEqual(before);
    editor.undo();
    expect(editor.getDocument()).not.toStrictEqual(before);
  });

  it("clears redo when a new Command is accepted", () => {
    const { editor, setText } = setup();
    setText("Undone");
    editor.undo();
    setText("New");
    const afterNew = editor.getDocument();

    expect(editor.redo()).toBeFalsy();
    expect(editor.getDocument()).toStrictEqual(afterNew);
  });
});

describe("merging Commands into one undo step", () => {
  it("undoes Commands with the same merge key together", () => {
    const { document, editor, setText } = setup();
    setText("H", { mergeKey: "typing" });
    setText("Hi", { mergeKey: "typing" });

    editor.undo();

    expect(editor.getDocument()).toStrictEqual(document);
  });

  it("redoes a merged step as a whole", () => {
    const { editor, setText } = setup();
    setText("H", { mergeKey: "typing" });
    setText("Hi", { mergeKey: "typing" });
    const typed = editor.getDocument();
    editor.undo();

    editor.redo();

    expect(editor.getDocument()).toStrictEqual(typed);
  });

  it("starts a new step when the merge key changes", () => {
    const { editor, setText } = setup();
    setText("H", { mergeKey: "first" });
    const afterFirst = editor.getDocument();
    setText("Hi", { mergeKey: "second" });

    editor.undo();

    expect(editor.getDocument()).toStrictEqual(afterFirst);
  });

  it("doesn't merge a Command without a merge key", () => {
    const { editor, setText } = setup();
    setText("H", { mergeKey: "typing" });
    const afterTyping = editor.getDocument();
    setText("Hi");

    editor.undo();

    expect(editor.getDocument()).toStrictEqual(afterTyping);
  });

  it("doesn't merge across a Command without a merge key", () => {
    const { editor, setText } = setup();
    setText("H", { mergeKey: "typing" });
    setText("Hi");
    const beforeLast = editor.getDocument();
    setText("Hi there", { mergeKey: "typing" });

    editor.undo();

    expect(editor.getDocument()).toStrictEqual(beforeLast);
  });

  it("doesn't merge into a step after undo", () => {
    const { editor, setText } = setup();
    setText("A", { mergeKey: "older" });
    const afterOlder = editor.getDocument();
    setText("B", { mergeKey: "typing" });
    setText("BC", { mergeKey: "typing" });
    editor.undo();
    setText("D", { mergeKey: "older" });

    editor.undo();

    expect(editor.getDocument()).toStrictEqual(afterOlder);
  });

  it("doesn't merge into a step after redo", () => {
    const { editor, setText } = setup();
    setText("A", { mergeKey: "typing" });
    const afterA = editor.getDocument();
    editor.undo();
    editor.redo();
    setText("AB", { mergeKey: "typing" });

    editor.undo();

    expect(editor.getDocument()).toStrictEqual(afterA);
  });

  it("keeps merging after a rejected Command", () => {
    const { blockId, document, editor, setText } = setup();
    setText("H", { mergeKey: "typing" });
    editor.apply(
      { blockId, props: { colour: "red" }, type: "updateProps" },
      { mergeKey: "typing" }
    );
    setText("Hi", { mergeKey: "typing" });

    editor.undo();

    expect(editor.getDocument()).toStrictEqual(document);
  });

  it("leaves no step for changes that end where they started", () => {
    const { blockId, document, editor, setText } = setup();
    const original = document.rows[0]?.columns[0]?.blocks[0]?.props ?? {};
    setText("A", { mergeKey: "typing" });
    editor.apply(
      { blockId, props: original, type: "updateProps" },
      { mergeKey: "typing" }
    );

    expect(editor.undo()).toBeFalsy();
  });

  it("starts a new step after changes that ended where they started", () => {
    const { editor, setText } = setup();
    setText("X");
    const afterX = editor.getDocument();
    setText("XA", { mergeKey: "typing" });
    setText("X", { mergeKey: "typing" });
    setText("XB", { mergeKey: "typing" });

    editor.undo();

    expect(editor.getDocument()).toStrictEqual(afterX);
  });
});

describe("subscribing to Operations", () => {
  it("sends a set properties Operation for an accepted Command", () => {
    const { blockId, document, editor, setText } = setup();
    const received: unknown[] = [];
    editor.subscribe((operations) => received.push(operations));

    setText("Hi");

    expect(received).toStrictEqual([
      [
        {
          blockId,
          previousProps: document.rows[0]?.columns[0]?.blocks[0]?.props,
          props: { content: paragraph("Hi") },
          type: "setProps",
        },
      ],
    ]);
  });

  it("sends the reverse Operations for undo and the originals for redo", () => {
    const { blockId, document, editor, setText } = setup();
    const original = document.rows[0]?.columns[0]?.blocks[0]?.props;
    const changed = { content: paragraph("Hi") };
    setText("Hi");
    const received: unknown[] = [];
    editor.subscribe((operations) => received.push(operations));

    editor.undo();
    editor.redo();

    expect(received).toStrictEqual([
      [{ blockId, previousProps: changed, props: original, type: "setProps" }],
      [{ blockId, previousProps: original, props: changed, type: "setProps" }],
    ]);
  });

  it("sends one Operation for a merged run of changes to one Block", () => {
    const { blockId, document, editor, setText } = setup();
    const before = document.rows[0]?.columns[0]?.blocks[0]?.props;
    setText("A", { mergeKey: "typing" });
    setText("AB", { mergeKey: "typing" });
    const received: unknown[][] = [];
    editor.subscribe((operations) => received.push(operations));

    editor.undo();

    expect(received).toStrictEqual([
      [
        {
          blockId,
          previousProps: { content: paragraph("AB") },
          props: before,
          type: "setProps",
        },
      ],
    ]);
  });

  it("sends nothing for a rejected Command or an empty undo", () => {
    const { blockId, editor } = setup();
    const received: unknown[] = [];
    editor.subscribe((operations) => received.push(operations));

    editor.apply({ blockId, props: { colour: "red" }, type: "updateProps" });
    editor.undo();
    editor.redo();

    expect(received).toStrictEqual([]);
  });

  it("stops sending once the subscription ends", () => {
    const { editor, setText } = setup();
    const received: unknown[] = [];
    const unsubscribe = editor.subscribe((operations) =>
      received.push(operations)
    );

    unsubscribe();
    setText("Hi");

    expect(received).toStrictEqual([]);
  });

  it("keeps the history safe from a listener changing what it received", () => {
    const { document, editor, setText } = setup();
    editor.subscribe((operations) => {
      for (const operation of operations) {
        if (operation.type === "setProps") {
          operation.previousProps.content = "damaged";
        }
      }
    });
    setText("Hi");

    editor.undo();

    expect(editor.getDocument().rows).toStrictEqual(document.rows);
  });

  it("sends Operations that survive a JSON round trip", () => {
    const { editor, setText } = setup();
    const received: unknown[] = [];
    editor.subscribe((operations) => received.push(operations));

    setText("Hi");
    editor.undo();

    // oxlint-disable-next-line unicorn/prefer-structured-clone -- JSON is what hosts send Operations as, so this tests JSON itself.
    expect(JSON.parse(JSON.stringify(received))).toStrictEqual(received);
  });

  it("keeps the undo step when a listener throws during apply", () => {
    const { document, editor, setText } = setup();
    const unsubscribe = editor.subscribe(() => {
      throw new Error("Listener failed");
    });

    expect(() => setText("Hi")).toThrow("Listener failed");

    unsubscribe();
    editor.undo();
    expect(editor.getDocument()).toStrictEqual(document);
  });

  it("keeps the step when a listener throws during undo and redo", () => {
    const { document, editor, setText } = setup();
    setText("Hi");
    const changed = editor.getDocument();
    const unsubscribe = editor.subscribe(() => {
      throw new Error("Listener failed");
    });

    expect(() => editor.undo()).toThrow("Listener failed");
    expect(editor.getDocument()).toStrictEqual(document);
    expect(() => editor.redo()).toThrow("Listener failed");
    expect(editor.getDocument()).toStrictEqual(changed);

    unsubscribe();
    editor.undo();
    expect(editor.getDocument()).toStrictEqual(document);
  });

  it("keeps steps in order when a listener applies a Command", () => {
    const { document, editor, setText } = setup();
    let isFirst = true;
    const unsubscribe = editor.subscribe(() => {
      if (isFirst) {
        isFirst = false;
        setText("From listener");
      }
    });
    setText("First");
    unsubscribe();
    const afterFirst = structuredClone(document);
    const block = afterFirst.rows[0]?.columns[0]?.blocks[0];
    if (block) {
      block.props = { content: paragraph("First") };
    }

    editor.undo();
    expect(editor.getDocument()).toStrictEqual(afterFirst);
    editor.undo();
    expect(editor.getDocument()).toStrictEqual(document);
  });
});
