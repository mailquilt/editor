import {
  closestPlace,
  findBlock,
  findPlace,
  findRow,
  pressOn,
} from "./editor-places.js";
import type { TextBlockView } from "./text-block-view.js";

/**
 * Which Block or Row is selected, where focus is, and what the Side panel shows.
 * Everything else in the editor asks this module to select something or to move
 * focus, and none of it moves focus itself.
 */

/** The Side panel's tabs, one of which it shows while it doesn't show what's selected. */
export type PanelTab = "content" | "rows" | "settings";

/** A Block, which the toolbars act on, a Row, or nothing. */
type Selected = { blockId: string } | { rowId: string } | undefined;

/**
 * Somewhere focus can go, by what it's on rather than by its element, so that
 * it's found again after an update replaces the element. A Block is the
 * selected one unless it's named.
 */
type FocusTarget =
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
  /** The floating toolbar, which keeps keyboard undo working. */
  | { on: "emailTools" };

interface Focusable {
  focus: (options?: FocusOptions) => void;
}

interface SelectionHost {
  /** Made once the element is connected. */
  root: () => ShadowRoot;
  requestUpdate: () => void;
  /** A Block's text, once its editor has been made. */
  textOf: (blockId: string) => TextBlockView | undefined;
  /** The selection changed, so what describes it is out of date. */
  onSelect: () => void;
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

/** What focus on an element in the editor is on, or else the floating toolbar. */
const targetOf = (element: Element): FocusTarget => {
  const found = closestPlace(
    element,
    "linkField",
    "formatBar",
    "text",
    "blockToolbar",
    "block",
    "rowToolbar"
  );
  const place = found?.dataset.place;
  const { action } = (element as HTMLElement).dataset;
  switch (place) {
    case "linkField":
    case "formatBar": {
      return { on: place };
    }
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

export type EditorSelection = ReturnType<typeof createSelection>;

export const createSelection = ({
  onSelect,
  requestUpdate,
  root,
  textOf,
}: SelectionHost) => {
  let selected: Selected;
  /** Whether focus is in the selected Block's text or its format bar. */
  let editingText = false;
  /** Whether the side panel shows what's selected, not its tabs. */
  let showsSettings = false;
  /** The Side panel's tab, which it shows while it doesn't show what's selected. */
  let tab: PanelTab = "content";
  /** Where focus was when the current update began. */
  let focusedBeforeUpdate: FocusTarget | undefined;
  /** Set while focus goes back after an update, which selects nothing new. */
  let restoring = false;
  /** Where the update that's due is to put focus, as a change named it. */
  let focusAfterUpdate:
    | { options?: FocusOptions; target: FocusTarget }
    | undefined;
  /** What the update that's due is to scroll into view, as a change named it. */
  let revealAfterUpdate: Selected;

  const active = () => root().activeElement;

  const selectedBlockId = () =>
    selected && "blockId" in selected ? selected.blockId : undefined;

  const selectedRowId = () =>
    selected && "rowId" in selected ? selected.rowId : undefined;

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
      case "emailTools": {
        const toolbar = findPlace(root(), "emailTools");
        // Without scrolling the page to it: in a Shell whose bottom is below the
        // window, the toolbar is out of view.
        return (
          toolbar && {
            focus: (options) =>
              toolbar.focus({ ...options, preventScroll: true }),
          }
        );
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
    const found = focusableFor(target);
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

  /** Moves focus to a target, or the nearest one that's there. */
  const focus = (target: FocusTarget, options?: FocusOptions) => {
    find(target)?.focus(options);
  };

  /**
   * For a target that the next update will render. The update moves focus there
   * itself, so focus doesn't stop on the way, such as on the floating toolbar
   * when the element with focus is removed.
   */
  const focusWhenRendered = (target: FocusTarget, options?: FocusOptions) => {
    focusAfterUpdate = { options, target };
    requestUpdate();
  };

  /**
   * Once the next update has rendered a Block's or Row's tools. Focus alone
   * doesn't scroll to it: a Block keeps focus if its neighbour is what moves in
   * the DOM, and focusing its text doesn't scroll.
   */
  const revealWhenRendered = (target: Selected) => {
    revealAfterUpdate = target;
    requestUpdate();
  };

  const reveal = (target: NonNullable<Selected>) => {
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

  const isSelected = (target: Selected) => {
    if (target === undefined) {
      return selected === undefined;
    }
    return "blockId" in target
      ? target.blockId === selectedBlockId()
      : target.rowId === selectedRowId();
  };

  /**
   * Selects a Block, a Row or nothing, and shows what's selected in the side
   * panel. Whether a Block's text is being edited is up to where focus is.
   */
  const select = (target: Selected) => {
    if (isSelected(target) && showsSettings === (target !== undefined)) {
      return;
    }
    selected = target;
    showsSettings = target !== undefined;
    if (selectedBlockId() === undefined) {
      editingText = false;
    }
    onSelect();
  };

  /** Focus on a Block, or in its text, selects the Block. */
  const focusedOn = (blockId: string, inText: boolean) => {
    if (editingText !== inText) {
      editingText = inText;
      requestUpdate();
    }
    // The Block is selected already, and the panel stays as it was left.
    if (!restoring) {
      select({ blockId });
    }
  };

  /** Shows the selected Block's or Row's settings in the side panel. */
  const showSettings = () => {
    if (!showsSettings) {
      showsSettings = true;
      requestUpdate();
    }
  };

  const revealBlock = (blockId: string) => revealWhenRendered({ blockId });

  /**
   * The presses below keep focus where it is, so a settings field would hold on
   * to what's typed in it while the press acts on the email. Blurring commits it.
   */
  const commitFocusedField = () => {
    const element = active();
    if (element && closestPlace(element, "settings")) {
      (element as HTMLElement).blur();
    }
  };

  /**
   * Pressing a control leaves focus and the selection in the Block. With no
   * focus in the editor, the control takes it, without a ring as for any other
   * press with the pointer, because keyboard undo only reaches the editor from
   * inside it. The Preview returns focus there too, when it closes.
   */
  const onControlMousedown = (event: MouseEvent, target: Element) => {
    if (target instanceof HTMLInputElement) {
      return;
    }
    event.preventDefault();
    commitFocusedField();
    const button = target.closest("button");
    if (button && !active()) {
      button.focus({ focusVisible: false });
    }
  };

  /**
   * A press on a drag handle leaves focus and the selection where they are.
   * With no focus in the editor, the floating toolbar takes it, because
   * keyboard undo only reaches the editor from inside.
   */
  const onHandleMousedown = (event: MouseEvent) => {
    event.preventDefault();
    commitFocusedField();
    if (!active()) {
      focus({ on: "emailTools" });
    }
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
      const element = active();
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

    /**
     * Before an update: notes where focus is, and drops a selection that the
     * update's email no longer has.
     */
    beforeUpdate(
      email:
        | { blockIds: ReadonlySet<string>; rowIds: ReadonlySet<string> }
        | undefined
    ) {
      const element = active();
      focusedBeforeUpdate = element ? targetOf(element) : undefined;
      // The link field and the format bar may close, and their text stays.
      if (
        focusedBeforeUpdate?.on === "linkField" ||
        focusedBeforeUpdate?.on === "formatBar"
      ) {
        focusedBeforeUpdate = { on: "text" };
      }
      if (!email) {
        return;
      }
      const blockId = selectedBlockId();
      const rowId = selectedRowId();
      if (
        (blockId !== undefined && !email.blockIds.has(blockId)) ||
        (rowId !== undefined && !email.rowIds.has(rowId))
      ) {
        select(undefined);
      }
    },

    get blockId() {
      return selectedBlockId();
    },

    get editingText() {
      return editingText;
    },

    focus,

    /**
     * Whether focus is in the editor but not in a Block's text, such as on a
     * control, the link field or a Block itself.
     */
    get focusIsOutsideText() {
      const element = active();
      return element !== null && targetOf(element).on !== "text";
    },

    focusWhenRendered,

    /**
     * Shows the selected Block's settings again after Back, when its text still has
     * focus and so gets no new focus event. Its own toolbars leave the panel be.
     */
    onBlockClick(blockId: string, target: Element) {
      if (
        blockId === selectedBlockId() &&
        !closestPlace(target, "blockToolbar", "formatBar")
      ) {
        showSettings();
      }
    },

    onBlockFocus(blockId: string) {
      focusedOn(blockId, false);
      revealBlock(blockId);
    },

    /**
     * The text stops being edited once focus leaves it and its format bar. State
     * rather than CSS, which would hide the bar while focus is on its way there.
     * Checked once focus has landed: the Preview opening over the text, or the
     * window losing focus while a URL is copied elsewhere, leave the bar as it is.
     */
    onBlockFocusout() {
      if (!editingText) {
        return;
      }
      setTimeout(() => {
        const element = active();
        if (
          editingText &&
          document.hasFocus() &&
          !(element && closestPlace(element, "text", "formatBar", "preview"))
        ) {
          editingText = false;
          requestUpdate();
        }
      }, 0);
    },

    /**
     * Any press in the editor. One on a drag handle, a Row's tag, or a place
     * where a press keeps focus, leaves focus and the selection where they are.
     */
    onMousedown(event: MouseEvent) {
      const { target } = event;
      if (!(target instanceof Element)) {
        return;
      }
      const press = pressOn(target);
      if (press === "grabs") {
        onHandleMousedown(event);
      } else if (press === "keepsFocus") {
        onControlMousedown(event, target);
      }
    },

    onTextFocus(blockId: string) {
      focusedOn(blockId, true);
    },

    /**
     * A focused number field would step with the wheel, though it has no
     * arrows, while the person only meant to scroll the panel. Focus leaves it
     * for the floating toolbar, which commits it and keeps keyboard undo working.
     */
    onWheel({ target }: WheelEvent) {
      const element = active();
      if (
        element === target &&
        element instanceof HTMLInputElement &&
        element.type === "number"
      ) {
        focus({ on: "emailTools" }, { focusVisible: false });
      }
    },

    revealBlock,

    revealRow: (rowId: string) => revealWhenRendered({ rowId }),

    get rowId() {
      return selectedRowId();
    },

    select,

    /**
     * Selects a Block that has just landed, added or dropped, with focus in its
     * text if it has any. Unlike focus on the Block, focus in its text doesn't
     * scroll.
     */
    selectLanded(blockId: string | undefined) {
      select(blockId === undefined ? undefined : { blockId });
      if (blockId !== undefined) {
        focusWhenRendered({ blockId, on: "text" });
        revealBlock(blockId);
      }
    },

    /**
     * Selects a Row instead of any Block, and shows its settings. Its toolbar's
     * button takes focus, so typing can't go on in a Block's text. From the
     * keyboard, as from the Rows tab, the focus ring follows.
     */
    selectRow(rowId: string) {
      const focusVisible = active()?.matches(":focus-visible") ?? false;
      select({ rowId });
      focusWhenRendered(
        { action: "select-row", on: "rowTool", rowId },
        { focusVisible }
      );
    },

    /** The ARIA tabs pattern: a tab that arrow keys move to shows its panel too. */
    selectTab(next: PanelTab) {
      if (next !== tab) {
        tab = next;
        requestUpdate();
      }
    },

    /** The selected Block's text, if it has any. */
    get selectedText() {
      const blockId = selectedBlockId();
      return blockId === undefined ? undefined : textOf(blockId);
    },

    /**
     * Back to the side panel's tabs, at the current one if Back has focus, as from
     * the keyboard, with the Block still selected for what's added next.
     */
    showTabs() {
      const fromKeyboard =
        (active() as HTMLElement | null)?.dataset.action === "back";
      showsSettings = false;
      requestUpdate();
      if (fromKeyboard) {
        focusWhenRendered({ on: "tab", tab });
      }
    },

    get showsSettings() {
      return showsSettings;
    },

    get tab() {
      return tab;
    },
  };
};
