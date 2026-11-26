import {
  closestPlace,
  findBlock,
  findPlace,
  findRow,
  isOfText,
} from "./editor-places.js";
import type { Place } from "./editor-places.js";
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
  /**
   * A control in the Selection bar, by its `data-action` while it works. Or
   * else the button that took its place, at `index` among those that work, or
   * the next after it, or the bar's last.
   */
  | { on: "bar"; action?: string; index?: number }
  /** The first field of the open popover from the Selection bar. */
  | { on: "barPopover" }
  /** The first item of the menu from the Selection bar's chip. */
  | { on: "barMenu" }
  /**
   * In the More panel: a control by its `data-action`, or else its first
   * field or control.
   */
  | { on: "more"; action?: string }
  /** The selected Block's format bar, at its first button that works. */
  | { on: "formatBar" }
  /** The link field, with its URL selected to type over. */
  | { on: "linkField" }
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

/** The Selection bar, which is one of three places by what's selected. */
const BAR_PLACES = [
  "blockBar",
  "rowBar",
  "emailBar",
] as const satisfies Place[];

/**
 * The Selection bar that `element` is one of the controls of, if any: not in a
 * popover, the chip's menu or More, which are in the bar but have their own.
 */
export const barOf = (element: Element) => {
  const owner = closestPlace(
    element,
    "barPopover",
    "barMenu",
    "morePanel",
    ...BAR_PLACES
  );
  return owner &&
    (BAR_PLACES as readonly string[]).includes(owner.dataset.place ?? "")
    ? owner
    : null;
};

/**
 * The Selection bar's controls that work, in order: each has a `data-action`.
 * Not those in a popover, its menu or a More panel inside it, nor any it hides
 * where it's narrow.
 */
const barControls = (bar: Element) =>
  [...bar.querySelectorAll<HTMLElement>("[data-action]")].filter(
    (control) =>
      closestPlace(
        control,
        "barPopover",
        "barMenu",
        "morePanel",
        ...BAR_PLACES
      ) === bar &&
      !control.matches(":disabled") &&
      control.getClientRects().length > 0
  );

/**
 * Where a popover from the bar takes focus: its first field to type in, as a
 * color's hex field rather than its picker, which opens a dialog, or else its
 * first control, such as a switch.
 */
const popoverStart = (popover: Element | null | undefined) =>
  popover?.querySelector<HTMLElement>(
    'input:not([type="color"], [type="checkbox"]), select'
  ) ?? popover?.querySelector<HTMLElement>('input:not([type="color"]), button');

/**
 * Goes along the Selection bar's controls from `from`. In a field, only from
 * the end of its text that way, as the arrow keys move the cursor otherwise.
 */
const focusBarControl = (
  bar: Element,
  from: HTMLElement,
  step: ToolbarStep
) => {
  if (
    from instanceof HTMLInputElement &&
    from.selectionStart !== null &&
    (step === "previous" || step === "next")
  ) {
    const { selectionEnd, selectionStart, value } = from;
    const atEdge =
      selectionStart === selectionEnd &&
      selectionStart === (step === "previous" ? 0 : value.length);
    if (!atEdge) {
      return;
    }
  }
  const controls = barControls(bar);
  const index = controls.indexOf(from);
  const last = controls.length - 1;
  const next: Record<ToolbarStep, HTMLElement | undefined> = {
    first: controls[0],
    last: controls[last],
    leave: controls.find(({ tabIndex }) => tabIndex === 0),
    next: controls[index === last ? 0 : index + 1],
    previous: controls[index <= 0 ? last : index - 1],
  };
  const to = next[step];
  to?.focus();
  if (!(to instanceof HTMLInputElement)) {
    return;
  }
  // Into a field from one side, the cursor is at that side, ready to go on.
  // A number has no cursor to place, so it's selected, to type over.
  if (to.selectionStart === null) {
    to.select();
  } else {
    const at = step === "previous" || step === "last" ? to.value.length : 0;
    to.setSelectionRange(at, at);
  }
};

/**
 * Goes along the buttons of the toolbar, or the tabs, that `from` is in, or
 * along the Selection bar's controls. Tab leaves from its one stop, wherever
 * the arrow keys got to, so Shift+Tab doesn't land back on that stop.
 */
export const focusToolbarButton = (from: Element, step: ToolbarStep) => {
  // A toolbar in a popover from the bar, such as a link's, is its own.
  const bar = closestPlace(from, "listItemTools") ? null : barOf(from);
  if (bar) {
    focusBarControl(bar, from as HTMLElement, step);
    return;
  }
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
  const { action } = (element as HTMLElement).dataset;
  if (closestPlace(element, "morePanel")) {
    return { action, on: "more" };
  }
  if (closestPlace(element, "barPopover")) {
    return { on: "barPopover" };
  }
  if (closestPlace(element, "barMenu")) {
    return { action: "chip", on: "bar" };
  }
  const bar = barOf(element);
  if (bar) {
    return {
      action,
      index: barControls(bar).indexOf(element as HTMLElement),
      on: "bar",
    };
  }
  const found = closestPlace(element, "text", "block", "history");
  const place = found?.dataset.place;
  switch (place) {
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

  /** The control that takes a bar target's focus. */
  const barControl = ({
    action,
    index = 0,
  }: {
    action?: string;
    index?: number;
  }) => {
    const bar = BAR_PLACES.map((name) => findPlace(root(), name)).find(Boolean);
    const controls = bar ? barControls(bar) : [];
    return (
      controls.find((control) => control.dataset.action === action) ??
      controls[Math.min(index, controls.length - 1)] ??
      controls[0]
    );
  };

  /** What takes a More panel target's focus. */
  const moreControl = (action: string | undefined) => {
    const panel = findPlace(root(), "morePanel");
    // Not the actions it only shows where the bar is short of room.
    const controls = [
      ...(panel?.querySelectorAll<HTMLElement>(
        "input, select, button:not(:disabled)"
      ) ?? []),
    ].filter((control) => control.getClientRects().length > 0);
    return (
      controls.find((control) => control.dataset.action === action) ??
      // Its first field, or its first action, past its Close button.
      controls.find((control) => control.dataset.action !== "close-more") ??
      controls[0]
    );
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
      case "bar": {
        return barControl(target);
      }
      case "barPopover": {
        return popoverStart(findPlace(root(), "barPopover"));
      }
      case "barMenu": {
        return findPlace(root(), "barMenu")?.querySelector<HTMLElement>(
          "button:not(:disabled)"
        );
      }
      case "more": {
        return moreControl(target.action);
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
   * What takes focus for a target, or else for the nearest one that's there:
   * a Block's text gives way to the Block itself, and a control in the More
   * panel, once it's closed, to the bar's More button.
   */
  const find = (target: FocusTarget): Focusable | undefined => {
    const found =
      target.on === "list"
        ? inList(root(), target.listId, target.at)
        : focusableFor(target);
    if (found) {
      return found;
    }
    if (target.on === "more") {
      return find({ action: "more", on: "bar" });
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
    // Where the page scrolls around a Shell, which scrolls too, the Selection
    // bar keeps to the Shell's top and the page can take it out of sight. It
    // comes first, so the Block or Row wins where both don't fit, and at once,
    // as a page that scrolls smoothly would otherwise go only to the second.
    root()
      .querySelector(".bar-dock")
      ?.scrollIntoView({ behavior: "instant", block: "nearest" });
    if ("rowId" in target) {
      rowFrame(target.rowId)?.scrollIntoView({ block: "nearest" });
      return;
    }
    blockElement(target.blockId)?.scrollIntoView({ block: "nearest" });
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
