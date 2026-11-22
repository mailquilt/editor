import { macBaseKeymap, pcBaseKeymap } from "prosemirror-commands";
import { describe, expect, it, vi } from "vitest";

import {
  claim,
  clipboardFor,
  hasKeys,
  historyInput,
  KEY_MAP,
  KEY_SCOPES,
  keyFor,
  keyHeardFirst,
  keyLabel,
  proseMirrorKeys,
  TEXT_KEYS,
  textKeyLabel,
} from "../src/key-map.js";
import type { KeyPress, KeyScope } from "../src/key-map.js";

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
 * With a Block that has text selected, and a step to undo and to redo, on
 * Windows and Linux, unless a test says otherwise.
 */
const keyIn = (
  scope: KeyScope,
  each: KeyPress,
  context: Parameters<typeof keyFor>[2] = {}
) =>
  keyFor(scope, each, {
    apple: false,
    canRedo: true,
    canUndo: true,
    selectedText: true,
    ...context,
  });

const SCOPES = Object.keys(KEY_MAP) as KeyScope[];

/**
 * Ctrl/⌘+C, X or V: the browser fires its clipboard event, which acts, as its
 * Edit menu's does, and the press goes no further.
 */
const leftToClipboard = (action: string) => ({
  action,
  keepsDefault: true,
  stops: true,
});

/** The key scopes within the email, or within the editor too. */
const scopesWithin = (...within: string[]) =>
  SCOPES.filter((scope) => within.includes(KEY_SCOPES[scope].within));

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

  it("Ctrl/⌘+D duplicates it, and stops there, so the browser doesn't bookmark the page", () => {
    expect(keyIn("block", press("Mod-d"))).toStrictEqual(
      acts("duplicateBlock", { stops: true })
    );
  });

  it("on Apple devices, ⌘+D duplicates it, and Ctrl+D doesn't", () => {
    expect(
      keyIn("block", press("Mod-d", { apple: true }), { apple: true })?.action
    ).toBe("duplicateBlock");
    expect(
      keyIn("block", press("Ctrl-d", { apple: true }), { apple: true })
    ).toBeUndefined();
  });

  it("Delete and Backspace delete it, and stop there", () => {
    expect(
      [press("Delete"), press("Backspace")].map((each) => keyIn("block", each))
    ).toStrictEqual([
      acts("deleteBlock", { stops: true }),
      acts("deleteBlock", { stops: true }),
    ]);
  });

  it("Ctrl/⌘+C, X and V are left to the browser's clipboard events, which copy, cut and paste", () => {
    expect(
      ["Mod-c", "Mod-x", "Mod-v"].map((each) => keyIn("block", press(each)))
    ).toStrictEqual([
      leftToClipboard("copyBlock"),
      leftToClipboard("cutBlock"),
      leftToClipboard("paste"),
    ]);
    expect(
      (["copy", "cut", "paste"] as const).map((type) =>
        clipboardFor("block", type)
      )
    ).toStrictEqual(["copyBlock", "cutBlock", "paste"]);
  });

  it("cut and paste wait for a drag, which would change, and copy doesn't", () => {
    expect(
      (["copy", "cut", "paste"] as const).map((type) =>
        clipboardFor("block", type, { dragging: true })
      )
    ).toStrictEqual(["copyBlock", undefined, undefined]);
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

  it("the browser's clipboard events are the text's own", () => {
    expect(
      (["copy", "cut", "paste"] as const).map((type) =>
        clipboardFor("text", type)
      )
    ).toStrictEqual([undefined, undefined, undefined]);
  });

  it("Delete, Backspace and Ctrl/⌘+D don't delete or duplicate the Block", () => {
    expect(
      [press("Delete"), press("Backspace"), press("Mod-d")].map((each) =>
        keyIn("text", each)
      )
    ).toStrictEqual([undefined, undefined, undefined]);
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

  it("a shortcut is found by its physical key, in a layout without Latin letters", () => {
    expect(
      keyIn("text", press("Mod-k", { code: "KeyK", key: "л" }))?.action
    ).toBe("openLinkField");
  });

  it("reads the Kelvin sign by its physical key, not as k", () => {
    expect(
      keyIn("text", press("Mod-k", { code: "KeyJ", key: "\u212A" }))
    ).toBeUndefined();
  });

  it.each([
    ["Windows and Linux", false],
    ["Apple devices", true],
  ])(
    "has no key ProseMirror answers first, which would never reach it, on %s",
    (_platform, apple) => {
      const answered = [
        ...TEXT_KEYS.flatMap(({ aliases = [], keys }) => [...keys, ...aliases]),
        ...Object.keys(apple ? macBaseKeymap : pcBaseKeymap),
      ].filter((name) => keyIn("text", press(name, { apple }), { apple }));
      expect(answered).toStrictEqual([]);
    }
  );
});

describe("in a Block's text with the Merge Tag picker open", () => {
  it("↑ and ↓ go along its tags, and stop there, as the cursor stays", () => {
    expect(keyIn("pickerOpen", press("ArrowUp"))).toStrictEqual(
      acts("previousMergeTag", { stops: true })
    );
    expect(keyIn("pickerOpen", press("ArrowDown"))).toStrictEqual(
      acts("nextMergeTag", { stops: true })
    );
  });

  it("Enter and Tab put in the highlighted tag, and stop there", () => {
    expect(keyIn("pickerOpen", press("Enter"))).toStrictEqual(
      acts("pickMergeTag", { stops: true })
    );
    expect(keyIn("pickerOpen", press("Tab"))?.action).toBe("pickMergeTag");
  });

  it("Shift+Tab and Shift+Enter are the text's, moving focus and adding a line break", () => {
    expect(keyIn("pickerOpen", press("Shift-Tab"))).toBeUndefined();
    expect(keyIn("pickerOpen", press("Shift-Enter"))).toBeUndefined();
  });

  it("Escape closes it, and stops there, so the next one goes back to the Block", () => {
    expect(keyIn("pickerOpen", press("Escape"))).toStrictEqual(
      acts("closeMergeTagPicker", { stops: true })
    );
  });

  it("Enter that an input method handled is the input method's", () => {
    expect(
      keyIn("pickerOpen", press("Enter", { isComposing: true }))
    ).toBeUndefined();
  });

  it("leaves every other key to the text, such as typing and undo", () => {
    expect(keyIn("pickerOpen", press("a"))).toBeUndefined();
    expect(keyIn("pickerOpen", press("Mod-z"))).toBeUndefined();
    expect(keyIn("pickerOpen", press("ArrowLeft"))).toBeUndefined();
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

  it("Ctrl/⌘+D duplicates the Block, as on the Block", () => {
    expect(keyIn("blockToolbar", press("Mod-d"))?.action).toBe(
      "duplicateBlock"
    );
  });

  it("Delete and Backspace don't delete the Block", () => {
    expect(keyIn("blockToolbar", press("Delete"))).toBeUndefined();
    expect(keyIn("blockToolbar", press("Backspace"))).toBeUndefined();
  });
});

describe("in a Row's toolbar", () => {
  it("Alt with an arrow key moves the Row", () => {
    expect(keyIn("rowToolbar", press("Alt-ArrowUp"))).toStrictEqual(
      acts("moveRow", { direction: "up" })
    );
  });

  it("Alt+← and Alt+→ don't move it, as a Row moves only up and down", () => {
    expect(keyIn("rowToolbar", press("Alt-ArrowLeft"))).toStrictEqual(
      acts("keepPage")
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

  it("Ctrl/⌘+D duplicates the Row, and stops there", () => {
    expect(keyIn("rowToolbar", press("Mod-d"))).toStrictEqual(
      acts("duplicateRow", { stops: true })
    );
  });

  it("Delete and Backspace delete the Row, and stop there", () => {
    expect(
      [press("Delete"), press("Backspace")].map((each) =>
        keyIn("rowToolbar", each)
      )
    ).toStrictEqual([
      acts("deleteRow", { stops: true }),
      acts("deleteRow", { stops: true }),
    ]);
  });

  it("the browser's clipboard events copy, cut and paste, from Ctrl/⌘+C, X and V", () => {
    expect(keyIn("rowToolbar", press("Mod-x"))).toStrictEqual(
      leftToClipboard("cutRow")
    );
    expect(
      (["copy", "cut", "paste"] as const).map((type) =>
        clipboardFor("rowToolbar", type)
      )
    ).toStrictEqual(["copyRow", "cutRow", "pasteAfterRow"]);
  });
});

describe("in an empty Column's toolbar", () => {
  it("an arrow key goes along its buttons", () => {
    expect(keyIn("addBlocks", press("ArrowRight"))).toStrictEqual(
      acts("nextButton")
    );
  });
});

describe("in the floating toolbar", () => {
  it("only paste is the editor's, as it has nothing of its own to copy", () => {
    expect(keyIn("emailTools", press("Mod-v"))).toStrictEqual(
      leftToClipboard("paste")
    );
    expect(keyIn("emailTools", press("Mod-c"))).toBeUndefined();
    expect(clipboardFor("emailTools", "copy")).toBeUndefined();
    expect(clipboardFor("emailTools", "paste")).toBe("paste");
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
  it.each(scopesWithin("email"))(
    "from %s, opens the link field in the selected Block's text, and stops there",
    (scope) => {
      expect(keyIn(scope, press("Mod-k"))).toStrictEqual(
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
  // Some key scopes move a Block or Row with them, but not during a drag. A
  // field that keeps every key to itself, such as the link field, stops them.
  it.each(SCOPES)(
    "from %s, even during a drag, don't go forward a page",
    (scope) => {
      expect(
        keyIn(scope, press("Alt-ArrowRight"), { dragging: true })
      ).toStrictEqual(
        acts("keepPage", {
          stops: keyIn(scope, press("a"))?.action === "typeInField",
        })
      );
    }
  );
});

describe("while a Block or Row is dragged, which the key would change", () => {
  it.each([
    ["block", "ArrowDown"],
    ["block", "Alt-ArrowUp"],
    ["block", "Enter"],
    ["block", "Mod-d"],
    ["block", "Delete"],
    ["rowToolbar", "Alt-ArrowUp"],
    ["rowToolbar", "Mod-d"],
    ["rowToolbar", "Backspace"],
  ] as const)("on %s, %s does nothing", (scope, name) => {
    expect(keyIn(scope, press(name), { dragging: true })).toBeUndefined();
  });
});

describe("anywhere in the editor but a field or the Preview", () => {
  it.each(scopesWithin("email", "editor"))(
    "from %s, Ctrl/⌘+Z undoes, and stops there",
    (scope) => {
      expect(keyIn(scope, press("Mod-z"))).toStrictEqual(
        acts("undo", { stops: true })
      );
    }
  );

  it("with nothing to undo or redo, Ctrl/⌘+Z and Shift+Ctrl/⌘+Z reach the host page", () => {
    expect(keyIn("text", press("Mod-z"), { canUndo: false })).toBeUndefined();
    expect(
      keyIn("text", press("Shift-Mod-z"), { canRedo: false })
    ).toBeUndefined();
  });

  it("on Apple devices, ⌘+Z undoes", () => {
    expect(
      keyIn("editor", press("Mod-z", { apple: true }), { apple: true })?.action
    ).toBe("undo");
  });

  it("Ctrl and ⌘ together don't undo", () => {
    expect(keyIn("editor", press("Mod-z", { metaKey: true }))).toBeUndefined();
  });

  it("Shift+Ctrl/⌘+Z redoes, as the browser reports it, with a capital Z", () => {
    expect(keyIn("editor", press("Shift-Mod-Z"))?.action).toBe("redo");
  });

  it("Ctrl/⌘+Z with Caps Lock on undoes too", () => {
    expect(keyIn("editor", press("Mod-z", { key: "Z" }))?.action).toBe("undo");
  });

  it("Ctrl+Y redoes too", () => {
    expect(keyIn("editor", press("Mod-y"))?.action).toBe("redo");
  });

  it("in a Latin layout such as Dvorak, Ctrl+; on the physical Z key doesn't undo", () => {
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
    expect(keyHeardFirst("drag", press("Escape"))).toStrictEqual(
      acts("cancelDrag", { stops: true })
    );
  });
});

describe("while a tooltip shows", () => {
  it("Escape closes the focused control's, and stops there, so a host's dialog stays open", () => {
    expect(keyHeardFirst("focusedTooltip", press("Escape"))).toStrictEqual(
      acts("closeTooltip", { stops: true })
    );
  });

  it("Escape that ends a composition doesn't close it", () => {
    expect(
      keyHeardFirst("focusedTooltip", press("Escape", { isComposing: true }))
    ).toBeUndefined();
  });

  it("Escape closes a hovered control's, and goes on", () => {
    expect(keyHeardFirst("hoveredTooltip", press("Escape"))).toStrictEqual(
      acts("closeTooltip", { keepsDefault: true })
    );
  });
});

describe("a key held down", () => {
  it("Enter repeating where it wasn't pressed, such as in text it moved focus to, does nothing", () => {
    expect(keyHeardFirst("heldElsewhere", press("Shift-Enter"))).toStrictEqual(
      acts("ignore", { stops: true })
    );
  });

  it("an arrow key repeating goes on to the next Block", () => {
    expect(keyHeardFirst("heldElsewhere", press("ArrowDown"))).toBeUndefined();
  });
});

describe("ProseMirror's names for the text's keys", () => {
  it("write Shift with a letter as the capital, as ProseMirror does, so Ctrl/⌘+B, I and U format with Shift or without", () => {
    const named = new Map(proseMirrorKeys({ apple: false }));
    expect(
      ["Mod-b", "Mod-B", "Mod-i", "Mod-I", "Mod-u", "Mod-U"].map((name) =>
        named.get(name)
      )
    ).toStrictEqual([
      "bold",
      "bold",
      "italic",
      "italic",
      "underline",
      "underline",
    ]);
  });

  it.each([
    ["Windows and Linux", false, pcBaseKeymap],
    ["Apple devices", true, macBaseKeymap],
  ])(
    "on %s, include every key ProseMirror binds to Enter, Backspace or Delete, so none of them skips the editor's rules",
    (_platform, apple, base) => {
      const named = new Map(proseMirrorKeys({ apple }));
      const rules = new Map([
        [pcBaseKeymap.Enter, "newParagraph"],
        [pcBaseKeymap.Backspace, "deleteBackward"],
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

  it("with no direction for an arrow key's action, names each way, in the order up, down, left, right", () => {
    expect(keyLabel("block", "moveBlock", { apple: false })).toStrictEqual({
      keys: "Alt+↑",
      shortcuts: "Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight",
    });
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

  it("on Apple devices, names Alt with its symbol too", () => {
    expect(
      keyLabel("blockToolbar", "moveBlock", { apple: true, direction: "up" })
    ).toStrictEqual({ keys: "⌥↑", shortcuts: "Alt+ArrowUp" });
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

describe("the places with keys of their own", () => {
  it("are the key map's key scopes", () => {
    expect(SCOPES.every(hasKeys)).toBeTruthy();
  });

  it("aren't a place with none, or a name every object has", () => {
    expect(hasKeys("dragHandle")).toBeFalsy();
    expect(hasKeys("constructor")).toBeFalsy();
  });
});

/** A press the browser could act on, and whether it was stopped. */
const keydown = () => {
  const event = new Event("keydown", { cancelable: true });
  const stopPropagation = vi.spyOn(event, "stopPropagation");
  return { event, stopPropagation };
};

describe("what the editor does with a press besides its action", () => {
  it("keeps the browser from acting on it, and stops it, unless its effect says otherwise", () => {
    const { event, stopPropagation } = keydown();
    claim(event, { keepsDefault: false, stops: true });
    expect([
      event.defaultPrevented,
      stopPropagation.mock.calls.length,
    ]).toStrictEqual([true, 1]);
  });

  it("leaves the browser to act, and the press to go on, when its effect says", () => {
    const { event, stopPropagation } = keydown();
    claim(event, { keepsDefault: true, stops: false });
    expect([
      event.defaultPrevented,
      stopPropagation.mock.calls.length,
    ]).toStrictEqual([false, 0]);
  });
});

describe("undo and redo from the browser's own menu, in a Block's text", () => {
  it.each([
    ["historyUndo", "undo"],
    ["historyRedo", "redo"],
    ["insertText", undefined],
  ])("%s is %s", (inputType, step) => {
    expect(historyInput({ inputType } as InputEvent)).toBe(step);
  });
});
