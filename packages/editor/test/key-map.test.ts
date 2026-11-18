import { describe, expect, it } from "vitest";

import {
  keyFor,
  keyLabel,
  proseMirrorKeys,
  TEXT_KEYS,
  textKeyLabel,
} from "../src/key-map.js";
import type { KeyPress, Place } from "../src/key-map.js";

/**
 * A press by name, such as "Alt-ArrowUp" or "Shift-Mod-z". Mod is ⌘ on Apple
 * devices and Ctrl elsewhere.
 */
const press = (
  name: string,
  { apple = false, ...rest }: Partial<KeyPress> & { apple?: boolean } = {}
): KeyPress => {
  const parts = name.split("-");
  const key = parts.pop() ?? "";
  const mod = parts.includes("Mod");
  return {
    altKey: parts.includes("Alt"),
    code: /^[a-z]$/iu.test(key) ? `Key${key.toUpperCase()}` : key,
    ctrlKey: apple ? parts.includes("Ctrl") : mod,
    isComposing: false,
    key,
    keyCode: 0,
    metaKey: apple ? mod : false,
    shiftKey: parts.includes("Shift") || /^[A-Z]$/u.test(key),
    ...rest,
  };
};

/** Windows and Linux, unless a test says it's an Apple device. */
const keyIn = (
  place: Place,
  each: KeyPress,
  context: { apple?: boolean; dragging?: boolean } = {}
) => keyFor(place, each, { apple: false, ...context });

/** The press acts, and the browser does nothing else with it. */
const acts = (action: string, extra: object = {}) => ({
  action,
  keepsDefault: false,
  stops: false,
  ...extra,
});

describe("on a Block", () => {
  it("an arrow key selects the Block that way, and keeps the page still", () => {
    expect(keyIn("block", press("ArrowUp"))).toStrictEqual(
      acts("selectBlock", { direction: "up" })
    );
  });

  it("Alt with an arrow key moves the Block", () => {
    expect(keyIn("block", press("Alt-ArrowLeft"))).toStrictEqual(
      acts("moveBlock", { direction: "left" })
    );
  });

  it("an arrow key with another modifier isn't the editor's", () => {
    expect(keyIn("block", press("Shift-ArrowUp"))).toBeUndefined();
  });

  it("Enter goes into the text", () => {
    expect(keyIn("block", press("Enter"))).toStrictEqual(acts("editText"));
  });

  it("Escape reaches the host page", () => {
    expect(keyIn("block", press("Escape"))).toBeUndefined();
  });

  it("doesn't move the Block while a Block or Row is dragged, which the move would change", () => {
    expect(
      keyIn("block", press("Alt-ArrowUp"), { dragging: true })
    ).toBeUndefined();
  });

  it("while a Block or Row is dragged, Alt+← still doesn't go back a page", () => {
    expect(
      keyIn("block", press("Alt-ArrowLeft"), { dragging: true })
    ).toStrictEqual(acts("keepPage"));
  });
});

describe("in a Block's text", () => {
  it("Escape goes back to the Block, and stops there", () => {
    expect(keyIn("text", press("Escape"))).toStrictEqual(
      acts("backToBlock", { stops: true })
    );
  });

  it("Escape with Shift held goes back too", () => {
    expect(keyIn("text", press("Shift-Escape"))?.action).toBe("backToBlock");
  });

  it("Escape that an input method handled does nothing", () => {
    expect(
      keyIn("text", press("Escape", { isComposing: true }))
    ).toBeUndefined();
  });

  it("WebKit's Escape that ended a composition does nothing either", () => {
    expect(keyIn("text", press("Escape", { keyCode: 229 }))).toBeUndefined();
  });

  it("Alt+← and Alt+→ don't go back a page", () => {
    expect(keyIn("text", press("Alt-ArrowLeft"))).toStrictEqual(
      acts("keepPage")
    );
  });

  it("on Apple devices, Alt+← moves the cursor by word", () => {
    expect(
      keyIn("text", press("Alt-ArrowLeft", { apple: true }), { apple: true })
    ).toBeUndefined();
  });

  it("an arrow key moves the cursor", () => {
    expect(keyIn("text", press("ArrowUp"))).toBeUndefined();
  });

  it("Alt+F10 goes to the format bar", () => {
    expect(keyIn("text", press("Alt-F10"))).toStrictEqual(
      acts("focusFormatBar")
    );
  });

  it("Ctrl/⌘+K opens the link field, and stops there", () => {
    expect(keyIn("text", press("Mod-k"))).toStrictEqual(
      acts("openLinkField", { stops: true })
    );
  });

  it("on Apple devices, Ctrl+K is the text's own, deleting to the end of the line", () => {
    expect(
      keyIn("text", press("Ctrl-k", { apple: true }), { apple: true })
    ).toBeUndefined();
  });

  it("a shortcut is found by its place on the keyboard, in a layout without Latin letters", () => {
    expect(
      keyIn("text", press("Mod-k", { code: "KeyK", key: "л" }))?.action
    ).toBe("openLinkField");
  });

  it("isn't the editor's for a key ProseMirror answers first", () => {
    const answered = TEXT_KEYS.flatMap(({ aliases = [], keys }) => [
      ...keys,
      ...aliases,
    ]).filter((name) => keyIn("text", press(name)));
    expect(answered).toStrictEqual([]);
  });
});

describe("in the format bar", () => {
  it("Escape goes back to the text, and stops there", () => {
    expect(keyIn("formatBar", press("Escape"))).toStrictEqual(
      acts("backToText", { stops: true })
    );
  });

  it("an arrow key goes along its buttons", () => {
    expect(keyIn("formatBar", press("ArrowRight"))).toStrictEqual(
      acts("nextButton")
    );
  });
});

describe("in the link field", () => {
  it("Escape closes it, and stops there", () => {
    expect(keyIn("linkField", press("Escape"))).toStrictEqual(
      acts("cancelLink", { stops: true })
    );
  });

  it("every other key is the field's own, including its undo", () => {
    expect(keyIn("linkField", press("Mod-z"))).toStrictEqual(
      acts("typeInField", { keepsDefault: true, stops: true })
    );
  });

  it("keeps a key that an input method handled too", () => {
    expect(keyIn("linkField", press("a", { isComposing: true }))?.action).toBe(
      "typeInField"
    );
  });
});

describe("in the Block's toolbar", () => {
  it("Escape goes back to the Block, and stops there", () => {
    expect(keyIn("blockToolbar", press("Escape"))).toStrictEqual(
      acts("backToBlock", { stops: true })
    );
  });

  it("Alt with an arrow key moves the Block", () => {
    expect(keyIn("blockToolbar", press("Alt-ArrowDown"))).toStrictEqual(
      acts("moveBlock", { direction: "down" })
    );
  });

  it("an arrow key goes along its buttons", () => {
    expect(keyIn("blockToolbar", press("ArrowUp"))).toStrictEqual(
      acts("previousButton")
    );
  });

  it("Home and End go to its first and last buttons", () => {
    expect(
      [press("Home"), press("End")].map(
        (each) => keyIn("blockToolbar", each)?.action
      )
    ).toStrictEqual(["firstButton", "lastButton"]);
  });

  it("Shift+Tab leaves it, from its one stop", () => {
    expect(keyIn("blockToolbar", press("Shift-Tab"))).toStrictEqual(
      acts("leaveToolbar", { keepsDefault: true })
    );
  });
});

describe("in a Row's toolbar", () => {
  it("Alt with an arrow key moves the Row", () => {
    expect(keyIn("rowToolbar", press("Alt-ArrowUp"))).toStrictEqual(
      acts("moveRow", { direction: "up" })
    );
  });

  it("Escape reaches the host page", () => {
    expect(keyIn("rowToolbar", press("Escape"))).toBeUndefined();
  });
});

describe("elsewhere in the email", () => {
  it("Ctrl/⌘+K opens the link field", () => {
    expect(keyIn("email", press("Mod-k"))?.action).toBe("openLinkField");
  });
});

describe("in the side panel's tabs", () => {
  it("an arrow key goes to the next tab", () => {
    expect(keyIn("panelTabs", press("ArrowDown"))?.action).toBe("nextButton");
  });

  it("Ctrl/⌘+K isn't the editor's", () => {
    expect(keyIn("panelTabs", press("Mod-k"))).toBeUndefined();
  });
});

describe("in a settings field with typed text that isn't applied", () => {
  it("Escape takes back what was typed, and stops there", () => {
    expect(keyIn("settingsDraft", press("Escape"))).toStrictEqual(
      acts("discardDraft", { stops: true })
    );
  });

  it("Ctrl/⌘+Z is the field's own undo", () => {
    expect(keyIn("settingsDraft", press("Mod-z"))).toBeUndefined();
  });
});

describe("anywhere else in the editor", () => {
  it("Ctrl/⌘+Z undoes, and stops there", () => {
    expect(keyIn("editor", press("Mod-z"))).toStrictEqual(
      acts("undo", { stops: true })
    );
  });

  it("Shift+Ctrl/⌘+Z redoes", () => {
    expect(keyIn("editor", press("Shift-Mod-z"))?.action).toBe("redo");
  });

  it("Ctrl+Y redoes too", () => {
    expect(keyIn("editor", press("Mod-y"))?.action).toBe("redo");
  });

  it("in a Latin layout such as Dvorak, Ctrl+; on the Z key's place doesn't undo", () => {
    expect(keyIn("editor", press("Mod-;", { code: "KeyZ" }))).toBeUndefined();
  });

  it("on Apple devices, ⌘+Y doesn't redo", () => {
    expect(
      keyIn("editor", press("Mod-y", { apple: true }), { apple: true })
    ).toBeUndefined();
  });

  it("Escape reaches the host page", () => {
    expect(keyIn("editor", press("Escape"))).toBeUndefined();
  });
});

describe("in the Preview", () => {
  it("Escape closes it, as the browser closes a dialog, and stops there", () => {
    expect(keyIn("preview", press("Escape"))).toStrictEqual(
      acts("closePreview", { keepsDefault: true, stops: true })
    );
  });

  it("Ctrl/⌘+Z doesn't undo behind it", () => {
    expect(keyIn("preview", press("Mod-z"))).toBeUndefined();
  });
});

describe("while a Block or Row is dragged", () => {
  it("Escape cancels the drag, before anything else hears it", () => {
    expect(keyIn("drag", press("Escape"))).toStrictEqual(
      acts("cancelDrag", { stops: true })
    );
  });
});

describe("while a tooltip shows", () => {
  it("Escape closes the focused control's, and stops there", () => {
    expect(keyIn("focusedTooltip", press("Escape"))).toStrictEqual(
      acts("closeTooltip", { keepsDefault: true, stops: true })
    );
  });

  it("Escape closes a hovered control's, and goes on", () => {
    expect(keyIn("hoveredTooltip", press("Escape"))).toStrictEqual(
      acts("closeTooltip", { keepsDefault: true })
    );
  });
});

describe("a key held down", () => {
  it("Enter repeating where it wasn't pressed, such as in text it moved focus to, does nothing", () => {
    expect(keyIn("heldElsewhere", press("Shift-Enter"))).toStrictEqual(
      acts("ignore", { stops: true })
    );
  });

  it("an arrow key repeating goes on to the next Block", () => {
    expect(keyIn("heldElsewhere", press("ArrowDown"))).toBeUndefined();
  });
});

describe("ProseMirror's names for the text's keys", () => {
  it("write Shift with a letter as the capital, so Shift+Ctrl/⌘+B still formats", () => {
    expect(proseMirrorKeys()).toContainEqual(["Mod-B", "bold"]);
  });
});

describe("how a key is named, for a tooltip and for aria-keyshortcuts", () => {
  it("with Ctrl, on Windows and Linux", () => {
    expect(keyLabel("editor", "undo", { apple: false })).toStrictEqual({
      keys: "Ctrl+Z",
      shortcuts: "Control+Z",
    });
  });

  it("with Alt and an arrow", () => {
    expect(
      keyLabel("blockToolbar", "moveBlock", { apple: false, direction: "up" })
    ).toStrictEqual({ keys: "Alt+↑", shortcuts: "Alt+ArrowUp" });
  });

  it("shows the first of several keys, and gives all of them to aria-keyshortcuts", () => {
    expect(keyLabel("editor", "redo", { apple: false })).toStrictEqual({
      keys: "Ctrl+Y",
      shortcuts: "Control+Y Control+Shift+Z",
    });
  });

  it("on Apple devices, with their symbols, and without a key they don't have", () => {
    expect(keyLabel("editor", "redo", { apple: true })).toStrictEqual({
      keys: "⇧⌘Z",
      shortcuts: "Meta+Shift+Z",
    });
  });

  it("names Enter with Apple's symbol for it too", () => {
    expect(textKeyLabel("lineBreak", { apple: true })).toStrictEqual({
      keys: "⇧↩",
      shortcuts: "Shift+Enter",
    });
  });

  it("leaves out a key that only keeps the browser from acting, such as Shift+Ctrl+B", () => {
    expect(textKeyLabel("bold", { apple: false })).toStrictEqual({
      keys: "Ctrl+B",
      shortcuts: "Control+B",
    });
  });
});
