import { macBaseKeymap, pcBaseKeymap } from "prosemirror-commands";
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
    code: /^[A-Za-z]$/u.test(key) ? `Key${key.toUpperCase()}` : key,
    ctrlKey: apple ? parts.includes("Ctrl") : mod,
    isComposing: false,
    key,
    keyCode: 0,
    metaKey: apple ? mod : false,
    shiftKey: parts.includes("Shift") || /^[A-Z]$/u.test(key),
    ...rest,
  };
};

/**
 * With a Block that has text selected, on Windows and Linux, unless a test says
 * otherwise.
 */
const keyIn = (
  place: Place,
  each: KeyPress,
  context: { apple?: boolean; dragging?: boolean; selectedText?: boolean } = {}
) => keyFor(place, each, { apple: false, selectedText: true, ...context });

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

  it("Enter with a modifier goes into the text too", () => {
    expect(keyIn("block", press("Shift-Enter"))?.action).toBe("editText");
  });

  it("Escape reaches the host page", () => {
    expect(keyIn("block", press("Escape"))).toBeUndefined();
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

  // The browser tests copy and paste through events, so they can't see this.
  it("Ctrl/⌘+C and Ctrl/⌘+V are left to the browser, to copy and paste", () => {
    expect(keyIn("text", press("Mod-c"))).toBeUndefined();
    expect(keyIn("text", press("Mod-v"))).toBeUndefined();
  });

  it("an arrow key moves the cursor", () => {
    expect(keyIn("text", press("ArrowUp"))).toBeUndefined();
  });

  it("Alt+F10 goes to the format bar", () => {
    expect(keyIn("text", press("Alt-F10"))).toStrictEqual(
      acts("focusFormatBar")
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

  it("reads the Kelvin sign by its place on the keyboard, not as k", () => {
    expect(
      keyIn("text", press("Mod-k", { code: "KeyJ", key: "\u212A" }))
    ).toBeUndefined();
  });

  it.each([
    ["Windows and Linux", false],
    ["Apple devices", true],
  ])(
    "isn't the editor's for a key ProseMirror answers first, on %s",
    (_platform, apple) => {
      const answered = TEXT_KEYS.flatMap(({ aliases = [], keys }) => [
        ...keys,
        ...aliases,
      ]).filter((name) => keyIn("text", press(name, { apple }), { apple }));
      expect(answered).toStrictEqual([]);
    }
  );
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

  it("an arrow key goes along its buttons", () => {
    expect(keyIn("rowToolbar", press("ArrowLeft"))).toStrictEqual(
      acts("previousButton")
    );
  });

  it("Escape reaches the host page", () => {
    expect(keyIn("rowToolbar", press("Escape"))).toBeUndefined();
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

describe("Ctrl/⌘+K", () => {
  it.each([
    "block",
    "text",
    "blockToolbar",
    "formatBar",
    "rowToolbar",
    "email",
  ] as const)(
    "from %s, opens the link field in the selected Block's text, and stops there",
    (place) => {
      expect(keyIn(place, press("Mod-k"))).toStrictEqual(
        acts("openLinkField", { stops: true })
      );
    }
  );

  it("with no Block that has text selected, such as a Button, reaches the host page", () => {
    expect(
      keyIn("block", press("Mod-k"), { selectedText: false })
    ).toBeUndefined();
  });
});

describe("Alt+← and Alt+→", () => {
  // Some places move a Block or Row with them, but not during a drag.
  it.each([
    ["block", acts("keepPage")],
    ["blockToolbar", acts("keepPage")],
    ["formatBar", acts("keepPage")],
    ["rowToolbar", acts("keepPage")],
    ["email", acts("keepPage")],
    ["panelTabs", acts("keepPage")],
    ["settingsDraft", acts("keepPage")],
    ["editor", acts("keepPage")],
    ["preview", acts("keepPage")],
    ["notice", acts("keepPage")],
    // The field keeps every key to itself.
    ["linkField", acts("keepPage", { stops: true })],
  ] as const)(
    "from %s, even during a drag, don't go forward a page",
    (place, binding) => {
      expect(
        keyIn(place, press("Alt-ArrowRight"), { dragging: true })
      ).toStrictEqual(binding);
    }
  );
});

describe("while a Block or Row is dragged, which the key would change", () => {
  it.each([
    ["block", "ArrowDown"],
    ["block", "Alt-ArrowUp"],
    ["block", "Enter"],
    ["rowToolbar", "Alt-ArrowUp"],
  ] as const)("on %s, %s does nothing", (place, name) => {
    expect(keyIn(place, press(name), { dragging: true })).toBeUndefined();
  });
});

describe("anywhere in the editor but a field or the Preview", () => {
  it.each([
    "block",
    "text",
    "blockToolbar",
    "formatBar",
    "rowToolbar",
    "email",
    "panelTabs",
    "editor",
  ] as const)("from %s, Ctrl/⌘+Z undoes, and stops there", (place) => {
    expect(keyIn(place, press("Mod-z"))).toStrictEqual(
      acts("undo", { stops: true })
    );
  });

  it("on Apple devices, ⌘+Z undoes", () => {
    expect(
      keyIn("editor", press("Mod-z", { apple: true }), { apple: true })?.action
    ).toBe("undo");
  });

  it("Ctrl and ⌘ together don't undo", () => {
    expect(keyIn("editor", press("Mod-z", { metaKey: true }))).toBeUndefined();
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
  it("are each text key, with Shift and a letter written as the capital, so Shift+Ctrl/⌘+B, I and U still format", () => {
    expect(proseMirrorKeys({ apple: false })).toStrictEqual([
      ["Mod-b", "bold"],
      ["Mod-B", "bold"],
      ["Mod-i", "italic"],
      ["Mod-I", "italic"],
      ["Mod-u", "underline"],
      ["Mod-U", "underline"],
      ["Shift-Enter", "lineBreak"],
      ["Mod-Enter", "lineBreak"],
      ["Enter", "newParagraph"],
      ["Delete", "deleteForward"],
      ["Mod-Delete", "deleteForward"],
      ["ArrowLeft", "toStart"],
      ["ArrowRight", "toEnd"],
    ]);
  });

  it.each([
    ["Windows and Linux", false, pcBaseKeymap],
    ["Apple devices", true, macBaseKeymap],
  ])(
    "on %s, include every key ProseMirror binds to Enter or Delete, so none of them skips the editor's rules",
    (_platform, apple, base) => {
      const named = new Map(proseMirrorKeys({ apple }));
      const rules = new Map([
        [pcBaseKeymap.Enter, "newParagraph"],
        [pcBaseKeymap.Delete, "deleteForward"],
      ]);
      const bound = Object.entries(base).filter(([, command]) =>
        rules.has(command)
      );
      expect(bound.length).toBeGreaterThan(0);
      for (const [key, command] of bound) {
        expect(named.get(key)).toBe(rules.get(command));
      }
    }
  );
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
