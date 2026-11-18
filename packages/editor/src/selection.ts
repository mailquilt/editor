import { BLOCKS } from "./block-dragging.js";
import type { Action, Binding } from "./key-map.js";
import type { PanelTab } from "./side-panel.js";
import type { TextBlockView } from "./text-block-view.js";

/**
 * Which Block or Row is selected, and where focus is. Everything else in the
 * editor asks this module to select something or to move focus, and none of it
 * moves focus itself.
 */

/** A Block, which the toolbars act on, a Row, or nothing. */
export type Selected = { blockId: string } | { rowId: string } | undefined;

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
  /** Resolves once the update that's due has rendered. */
  updateComplete: () => Promise<unknown>;
  /** The selection changed, so what describes it is out of date. */
  onSelect: () => void;
}

/**
 * Goes along the buttons of the toolbar, or the tabs, that a key was pressed in,
 * either way round. Tab leaves from its one stop, wherever the arrow keys got
 * to, so Shift+Tab doesn't land back on that stop.
 */
export const focusToolbarButton = (
  { target }: KeyboardEvent,
  { action }: Binding
) => {
  const button = target as HTMLButtonElement;
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
  const next: Partial<Record<Action, HTMLButtonElement | undefined>> = {
    firstButton: buttons[0],
    lastButton: buttons[last],
    // Focus moves on from there once this returns.
    leaveToolbar: buttons.find(({ tabIndex }) => tabIndex === 0),
    nextButton: buttons[index === last ? 0 : index + 1],
    previousButton: buttons[index === 0 ? last : index - 1],
  };
  next[action]?.focus();
};

/** What focus on an element in the editor is on, or else the floating toolbar. */
const targetOf = (element: Element): FocusTarget => {
  if (element.closest(".link-form")) {
    return { on: "linkField" };
  }
  if (element.closest(".format-bar")) {
    return { on: "formatBar" };
  }
  const { action } = (element as HTMLElement).dataset;
  const rowId = element.closest(".row-toolbar")
    ? element.closest<HTMLElement>(".row-frame")?.dataset.rowId
    : undefined;
  if (rowId !== undefined) {
    return { action, on: "rowTool", rowId };
  }
  const block = element.closest<HTMLElement>(BLOCKS);
  if (block && element.closest(".block-toolbar") && action !== undefined) {
    return { action, on: "blockTool" };
  }
  if (block && (element === block || element.closest(".ProseMirror"))) {
    return {
      blockId: block.dataset.blockId,
      on: element === block ? "block" : "text",
    };
  }
  return { on: "emailTools" };
};

export const createSelection = (host: SelectionHost) => {
  let selected: Selected;
  /** Whether focus is in the selected Block's text or its format bar. */
  let editingText = false;
  /** Whether the side panel shows what's selected, not its tabs. */
  let showsSettings = false;
  /** Where focus was when the current update began. */
  let focusedBeforeUpdate: FocusTarget | undefined;
  /** Set while focus goes back after an update, which selects nothing new. */
  let restoring = false;

  const active = () => host.root().activeElement;

  const selectedBlockId = () =>
    selected && "blockId" in selected ? selected.blockId : undefined;

  const selectedRowId = () =>
    selected && "rowId" in selected ? selected.rowId : undefined;

  const blockElement = (blockId: string) =>
    host
      .root()
      .querySelector<HTMLElement>(
        `${BLOCKS}[data-block-id="${CSS.escape(blockId)}"]`
      );

  const rowFrame = (rowId: string) =>
    host
      .root()
      .querySelector<HTMLElement>(
        `.row-frame[data-row-id="${CSS.escape(rowId)}"]`
      );

  /** A Row's tools that work, the Select Row button first. */
  const rowTools = (rowId: string) => [
    ...(rowFrame(rowId)?.querySelectorAll<HTMLButtonElement>(
      ".row-toolbar button:not(:disabled)"
    ) ?? []),
  ];

  /** What takes focus for a target, if it's there. */
  const focusableFor = (target: FocusTarget): Focusable | null | undefined => {
    switch (target.on) {
      case "block":
      case "text": {
        const blockId = target.blockId ?? selectedBlockId();
        if (blockId === undefined) {
          return;
        }
        return target.on === "text"
          ? host.textOf(blockId)
          : blockElement(blockId);
      }
      case "blockTool": {
        const blockId = selectedBlockId();
        return blockId === undefined
          ? undefined
          : blockElement(blockId)?.querySelector<HTMLElement>(
              `.block-toolbar [data-action="${CSS.escape(target.action)}"]`
            );
      }
      case "formatBar": {
        return host
          .root()
          .querySelector<HTMLElement>(".format-bar > button:not(:disabled)");
      }
      case "linkField": {
        const field = host
          .root()
          .querySelector<HTMLInputElement>(".link-form input");
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
        return host.root().querySelector<HTMLElement>(`#tab-${target.tab}`);
      }
      case "emailTools": {
        const toolbar = host
          .root()
          .querySelector<HTMLElement>(".floating-toolbar");
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

  /** For a target that the update that's due will render. */
  const focusWhenRendered = async (
    target: FocusTarget,
    options?: FocusOptions
  ) => {
    await host.updateComplete();
    focus(target, options);
  };

  /**
   * Selects a Block, a Row or nothing, and shows what's selected in the side
   * panel. Whether a Block's text is being edited is up to where focus is.
   */
  const select = (target: Selected) => {
    selected = target;
    showsSettings = target !== undefined;
    if (selectedBlockId() === undefined) {
      editingText = false;
    }
    host.onSelect();
  };

  /** Focus on a Block, or in its text, selects the Block. */
  const focusedOn = (blockId: string, inText: boolean) => {
    editingText = inText;
    // The Block is selected already, and the panel stays as it was left.
    if (!restoring) {
      select({ blockId });
    }
  };

  /** Shows the selected Block's or Row's settings in the side panel. */
  const showSettings = () => {
    if (!showsSettings) {
      showsSettings = true;
      host.requestUpdate();
    }
  };

  /**
   * Focus alone doesn't do this. A Block keeps focus if its neighbour is what moves
   * in the DOM, and focusing its text doesn't scroll.
   */
  const revealBlock = async (blockId: string) => {
    await host.updateComplete();
    const block = blockElement(blockId);
    block?.scrollIntoView({ block: "nearest" });
    // Its tools can reach past a thin Block, under the floating toolbar, which
    // would hide the one with focus.
    block
      ?.querySelector(".block-toolbar")
      ?.scrollIntoView({ block: "nearest" });
  };

  /**
   * The presses below keep focus where it is, so a settings field would hold on
   * to what's typed in it while the press acts on the email. Blurring commits it.
   */
  const commitFocusedField = () => {
    const element = active();
    if (element?.closest(".settings")) {
      (element as HTMLElement).blur();
    }
  };

  return {
    /**
     * After an update: a change can remove the element with focus, or disable it.
     * Focus stays on what it was on, such as a Block that moved, or the same tool
     * of a Row that moved. Otherwise the floating toolbar takes it, so it stays in
     * the editor, where undo still works, and a key that activated a button does
     * nothing when it's pressed again or held down.
     */
    afterUpdate() {
      const target = focusedBeforeUpdate;
      focusedBeforeUpdate = undefined;
      const element = active() as HTMLButtonElement | null;
      if (!target || (element && !element.disabled)) {
        return;
      }
      restoring = true;
      (find(target) ?? focusableFor({ on: "emailTools" }))?.focus();
      restoring = false;
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
    onBlockClick({ currentTarget, target }: MouseEvent) {
      if (
        (currentTarget as HTMLElement).dataset.blockId === selectedBlockId() &&
        !(target as Element).closest(".block-toolbar, .format-bar")
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
        if (
          editingText &&
          document.hasFocus() &&
          !active()?.closest(".ProseMirror, .format-bar, .preview")
        ) {
          editingText = false;
          host.requestUpdate();
        }
      }, 0);
    },

    /**
     * Pressing a control leaves focus and the selection in the Block. With no
     * focus in the editor, the control takes it, without a ring as for any other
     * press with the pointer, because keyboard undo only reaches the editor from
     * inside it. A drag handle in a toolbar has its own.
     */
    onControlMousedown(event: MouseEvent) {
      const { target } = event;
      if (
        target instanceof HTMLInputElement ||
        (target instanceof Element && target.closest(".drag-handle"))
      ) {
        return;
      }
      event.preventDefault();
      commitFocusedField();
      const button = target instanceof Element && target.closest("button");
      if (button && !active()) {
        button.focus({ focusVisible: false } as FocusOptions);
      }
    },

    /**
     * Leaves focus and the selection where they are. With no focus in the editor,
     * the floating toolbar takes it, because keyboard undo only reaches the editor
     * from inside.
     */
    onHandleMousedown(event: MouseEvent) {
      event.preventDefault();
      commitFocusedField();
      if (!active()) {
        focus({ on: "emailTools" });
      }
    },

    onTextFocus(blockId: string) {
      focusedOn(blockId, true);
    },

    revealBlock,

    async revealRow(rowId: string) {
      await host.updateComplete();
      rowFrame(rowId)?.scrollIntoView({ block: "nearest" });
    },

    get rowId() {
      return selectedRowId();
    },

    select,

    /**
     * Selects a Block that was just put in place, with focus in its text if it
     * has any. Unlike focus on the Block, focus in its text doesn't scroll.
     */
    async selectPlaced(blockId: string | undefined) {
      select(blockId === undefined ? undefined : { blockId });
      await host.updateComplete();
      if (blockId !== undefined) {
        focus({ blockId, on: "text" });
        revealBlock(blockId);
      }
    },

    /**
     * Selects a Row in place of any Block, and shows its settings. Its toolbar's
     * button takes focus, so typing can't go on in a Block's text. From the
     * keyboard, as from the Rows tab, the focus ring follows.
     */
    async selectRow(rowId: string) {
      const focusVisible = active()?.matches(":focus-visible") ?? false;
      select({ rowId });
      await host.updateComplete();
      const [button] = rowTools(rowId);
      if (button && active() !== button) {
        button.focus({ focusVisible } as FocusOptions);
      }
    },

    /** The selected Block's text, if it has any. */
    get selectedText() {
      const blockId = selectedBlockId();
      return blockId === undefined ? undefined : host.textOf(blockId);
    },

    /**
     * Back to the side panel's tabs, at this one if Back was pressed from the
     * keyboard, with the Block still selected for what's added next.
     */
    async showTabs(tab: PanelTab) {
      const fromKeyboard = active()?.matches(".back-button") ?? false;
      showsSettings = false;
      host.requestUpdate();
      if (fromKeyboard) {
        await focusWhenRendered({ on: "tab", tab });
      }
    },

    get showsSettings() {
      return showsSettings;
    },
  };
};
