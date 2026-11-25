import {
  closestPlace,
  findBlock,
  findPlace,
  findRow,
  isOfText,
} from "./editor-places.js";
import type { PanelTab } from "./selection.js";
import type { ListFocus } from "./settings-panel.js";
import type { TextBlockView } from "./text-block-view.js";

/**
 * Where focus is, where it goes, and what scrolls into view after an update.
 * Everything else in the editor asks this module to move focus, and none of it
 * moves focus itself.
 */

/**
 * Somewhere focus can go, by what it's on rather than by its element, so that
 * it's found again after an update replaces the element. A Block is the
 * selected one unless it's named.
 */
export type FocusTarget =
  | { on: "block" | "text"; blockId?: string }
  /** A button on the selected Block's toolbar, by its `data-action`. */
  | { on: "blockTool"; action: string }
  /** The selected Block's format bar, at its first button that works. */
  | { on: "formatBar" }
  /** The link field, with its URL selected to type over. */
  | { on: "linkField" }
  /** A Row's tool, by its `data-action` while it's enabled, or else its first that is. */
  | { on: "rowTool"; action?: string; rowId: string }
  | { on: "tab"; tab: PanelTab }
  /** Undo or Redo in the top bar while it's enabled, or else the other. */
  | { on: "history"; action: "redo" | "undo" }
  /** A part of a list field in the settings, by the list's `id`. */
  | { on: "list"; listId: string; at: ListFocus }
  /**
   * The floating toolbar, which keeps keyboard undo working, or in Style and
   * Check, where it isn't shown, the Mode's tab.
   */
  | { on: "emailTools" };

/** A Block or a Row, to scroll into view. */
type Shown = { blockId: string } | { rowId: string };

interface Focusable {
  focus: (options?: FocusOptions) => void;
}

interface FocusHost {
  /**
   * Made once the element is connected. It holds every place, and no shadow
   * root of its own, so its active element is the one with focus.
   */
  root: () => ShadowRoot;
  requestUpdate: () => void;
  /** The selected Block, which a target is on unless it names one. */
  selectedBlockId: () => string | undefined;
  /** A Block's text, once its editor has been made. */
  textOf: (blockId: string) => TextBlockView | undefined;
}

/**
 * Where focus goes along a toolbar's buttons, or the tabs: to either end, one
 * button either way round, or to the toolbar's one Tab stop, for Tab to leave
 * from.
 */
export type ToolbarStep = "first" | "last" | "leave" | "next" | "previous";

/**
 * Goes along the buttons of the toolbar, or the tabs, that `from` is in. Tab
 * leaves from its one stop, wherever the arrow keys got to, so Shift+Tab doesn't
 * land back on that stop.
 */
export const focusToolbarButton = (from: Element, step: ToolbarStep) => {
  const button = from as HTMLButtonElement;
  const buttons = [
    ...(button.parentElement?.querySelectorAll<HTMLButtonElement>(
      ":scope > button:not(:disabled)"
    ) ?? []),
  ];
  const index = buttons.indexOf(button);
  if (index === -1) {
    return;
  }
  const last = buttons.length - 1;
  const next: Record<ToolbarStep, HTMLButtonElement | undefined> = {
    first: buttons[0],
    last: buttons[last],
    // Focus moves on from there once this returns.
    leave: buttons.find(({ tabIndex }) => tabIndex === 0),
    next: buttons[index === last ? 0 : index + 1],
    previous: buttons[index === 0 ? last : index - 1],
  };
  next[step]?.focus();
};

/**
 * What focus on an element in the editor is on, or else the floating toolbar.
 * In a place that belongs to the text being edited, it's on that text, which
 * stays when the place closes.
 */
/**
 * A button on a list field item's toolbar, as the same button of that item,
 * wherever the item goes.
 */
const listToolOf = (element: Element): FocusTarget | undefined => {
  const item =
    closestPlace(element, "listItemTools") &&
    element.closest<HTMLElement>("[data-item-key]");
  const listId = item?.closest('[role="group"]')?.id;
  const { action } = (element as HTMLElement).dataset;
  if (!(item?.dataset.itemKey && listId && action)) {
    return undefined;
  }
  return {
    at: {
      control: action as Exclude<ListFocus["control"], "add">,
      item: item.dataset.itemKey,
    },
    listId,
    on: "list",
  };
};

const targetOf = (element: Element): FocusTarget => {
  if (isOfText(element)) {
    return { on: "text" };
  }
  const listTool = listToolOf(element);
  if (listTool) {
    return listTool;
  }
  const found = closestPlace(
    element,
    "text",
    "blockToolbar",
    "block",
    "rowToolbar",
    "history"
  );
  const place = found?.dataset.place;
  const { action } = (element as HTMLElement).dataset;
  switch (place) {
    case "rowToolbar": {
      const rowId = closestPlace(element, "row")?.dataset.rowId;
      return rowId === undefined
        ? { on: "emailTools" }
        : { action, on: "rowTool", rowId };
    }
    case "blockToolbar": {
      return action === undefined
        ? { on: "emailTools" }
        : { action, on: "blockTool" };
    }
    case "text": {
      return {
        blockId: closestPlace(element, "block")?.dataset.blockId,
        on: "text",
      };
    }
    case "history": {
      return action === "redo" || action === "undo"
        ? { action, on: "history" }
        : { on: "emailTools" };
    }
    case "block": {
      return element === found
        ? { blockId: found.dataset.blockId, on: "block" }
        : { on: "emailTools" };
    }
    default: {
      return { on: "emailTools" };
    }
  }
};

/**
 * In the list field with the `id` `listId`: the way to add an item, an item's
 * text, or a button on its toolbar while it's enabled, or else its first that
 * is.
 */
const inList = (root: ShadowRoot, listId: string, at: ListFocus) => {
  const list = root.querySelector(`#${CSS.escape(listId)}`);
  if (at.control === "add") {
    return list?.querySelector("select");
  }
  const item = list?.querySelector(`[data-item-key="${CSS.escape(at.item)}"]`);
  if (at.control === "text") {
    return item?.querySelector("input");
  }
  const tools = [
    ...(item?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ??
      []),
  ];
  return tools.find((tool) => tool.dataset.action === at.control) ?? tools[0];
};

export type EditorFocus = ReturnType<typeof createFocus>;

export const createFocus = ({
  requestUpdate,
  root,
  selectedBlockId,
  textOf,
}: FocusHost) => {
  /** Where focus was when the current update began. */
  let focusedBeforeUpdate: FocusTarget | undefined;
  /** Set while focus goes back after an update, which selects nothing new. */
  let restoring = false;
  /** Where the update that's due is to put focus, as a change named it. */
  let focusAfterUpdate:
    | { options?: FocusOptions; target: FocusTarget }
    | undefined;
  /** What the update that's due is to scroll into view, as a change named it. */
  let revealAfterUpdate: Shown | undefined;

  const focused = () => root().activeElement;

  const blockElement = (blockId: string) => findBlock(root(), blockId);

  const rowFrame = (rowId: string) => findRow(root(), rowId);

  /** A Row's tools that work, the Select Row button first. */
  const rowTools = (rowId: string) => {
    const row = rowFrame(rowId);
    const toolbar = row && findPlace(row, "rowToolbar");
    return [
      ...(toolbar?.querySelectorAll<HTMLButtonElement>(
        "button:not(:disabled)"
      ) ?? []),
    ];
  };

  /** Undo or Redo while it's enabled, or else the other. */
  const historyStep = (action: "redo" | "undo") => {
    const steps = [
      ...(findPlace(root(), "history")?.querySelectorAll<HTMLElement>(
        "button:not(:disabled)"
      ) ?? []),
    ];
    return steps.find((step) => step.dataset.action === action) ?? steps[0];
  };

  /**
   * The floating toolbar, or in Style or Check, where it isn't shown, the
   * Mode's tab, or the narrow notice's button where the Modes aren't shown.
   */
  const emailTools = (): Focusable | null | undefined => {
    const toolbar = findPlace(root(), "emailTools");
    // Not shown: in Style or Check, or behind the narrow notice.
    if (toolbar?.closest("[hidden], [data-collapsed]")) {
      return (
        findPlace(root(), "modes")?.querySelector<HTMLElement>(
          '[aria-selected="true"]'
        ) ?? findPlace(root(), "notice")?.querySelector("button")
      );
    }
    // Without scrolling the page to it: in a Shell whose bottom is below the
    // window, the toolbar is out of view.
    return (
      toolbar && {
        focus: (options) => toolbar.focus({ ...options, preventScroll: true }),
      }
    );
  };

  /** What takes focus for a target, if it's there. */
  const focusableFor = (target: FocusTarget): Focusable | null | undefined => {
    switch (target.on) {
      case "block":
      case "text": {
        const blockId = target.blockId ?? selectedBlockId();
        if (blockId === undefined) {
          return;
        }
        return target.on === "text" ? textOf(blockId) : blockElement(blockId);
      }
      case "blockTool": {
        const blockId = selectedBlockId();
        const block = blockId === undefined ? undefined : blockElement(blockId);
        const toolbar = block && findPlace(block, "blockToolbar");
        return toolbar?.querySelector<HTMLElement>(
          `[data-action="${CSS.escape(target.action)}"]`
        );
      }
      case "formatBar": {
        return findPlace(root(), "formatBar")?.querySelector<HTMLElement>(
          ":scope > button:not(:disabled)"
        );
      }
      case "linkField": {
        const field = findPlace(root(), "linkField")?.querySelector("input");
        return (
          field && {
            focus: (options) => {
              field.focus(options);
              field.select();
            },
          }
        );
      }
      case "rowTool": {
        const tools = rowTools(target.rowId);
        return (
          tools.find((tool) => tool.dataset.action === target.action) ??
          tools[0]
        );
      }
      case "tab": {
        return root().querySelector<HTMLElement>(`#tab-${target.tab}`);
      }
      case "history": {
        return historyStep(target.action);
      }
      case "emailTools": {
        return emailTools();
      }
      default: {
        return undefined;
      }
    }
  };

  /**
   * What takes focus for a target, or else for the nearest one that's there: a
   * Block's tool gives way to its text, and its text to the Block itself.
   */
  const find = (target: FocusTarget): Focusable | undefined => {
    const found =
      target.on === "list"
        ? inList(root(), target.listId, target.at)
        : focusableFor(target);
    if (found) {
      return found;
    }
    if (target.on === "blockTool") {
      return find({ on: "text" });
    }
    if (target.on === "text") {
      return find({ blockId: target.blockId, on: "block" });
    }
    return undefined;
  };

  /**
   * Once the next update has rendered a Block's or Row's tools. Focus alone
   * doesn't scroll to it: a Block keeps focus if its neighbour is what moves in
   * the DOM, and focusing its text doesn't scroll.
   */
  const revealWhenRendered = (target: Shown) => {
    revealAfterUpdate = target;
    requestUpdate();
  };

  const reveal = (target: Shown) => {
    if ("rowId" in target) {
      rowFrame(target.rowId)?.scrollIntoView({ block: "nearest" });
      return;
    }
    const block = blockElement(target.blockId);
    block?.scrollIntoView({ block: "nearest" });
    // Its tools can reach past a thin Block, under the floating toolbar, which
    // would hide the one with focus.
    const toolbar = block && findPlace(block, "blockToolbar");
    toolbar?.scrollIntoView({ block: "nearest" });
  };

  return {
    /**
     * After an update: focus goes where a change named, if it's there. Otherwise a
     * change can remove the element with focus, or disable it. Focus stays on
     * what it was on, such as a Block that moved, or the same tool of a Row that
     * moved. Otherwise the floating toolbar takes it, so it stays in the editor,
     * where undo still works, and a key that activated a button does nothing
     * when it's pressed again or held down. Then what a change named scrolls
     * into view. What focus asks for on the way waits for the next update.
     */
    afterUpdate() {
      const target = focusedBeforeUpdate;
      focusedBeforeUpdate = undefined;
      const named = focusAfterUpdate;
      focusAfterUpdate = undefined;
      const shown = revealAfterUpdate;
      revealAfterUpdate = undefined;
      const found = named && find(named.target);
      const element = focused();
      if (found) {
        found.focus(named.options);
      } else if (target && (!element || element.matches(":disabled"))) {
        restoring = true;
        (find(target) ?? focusableFor({ on: "emailTools" }))?.focus();
        restoring = false;
      }
      if (shown) {
        reveal(shown);
      }
    },

    /** Before an update: notes where focus is. */
    beforeUpdate() {
      const element = focused();
      focusedBeforeUpdate = element ? targetOf(element) : undefined;
    },

    /** Moves focus to a target, or the nearest one that's there. */
    focus(target: FocusTarget, options?: FocusOptions) {
      find(target)?.focus(options);
    },

    /**
     * Whether focus is in the editor but not in a Block's text, such as on a
     * control, the link field or a Block itself.
     */
    get focusIsOutsideText() {
      const element = focused();
      return element !== null && !closestPlace(element, "text");
    },

    /**
     * For a target that the next update will render. The update moves focus there
     * itself, so focus doesn't stop on the way, such as on the floating toolbar
     * when the element with focus is removed.
     */
    focusWhenRendered(target: FocusTarget, options?: FocusOptions) {
      focusAfterUpdate = { options, target };
      requestUpdate();
    },

    /** The element in the editor with focus, if any. */
    focused,

    /** Whether focus is going back after an update, rather than moving. */
    get restoring() {
      return restoring;
    },

    revealBlock: (blockId: string) => revealWhenRendered({ blockId }),

    revealRow: (rowId: string) => revealWhenRendered({ rowId }),
  };
};
