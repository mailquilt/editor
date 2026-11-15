import {
  blockLabel,
  createEditor,
  isSameDocument,
  loadDocument,
} from "@mailquilt/core";
import type {
  BlocksDocument,
  Command,
  Editor,
  Operation,
  RichTextDocument,
  RowLayout,
} from "@mailquilt/core";
import { renderEmail } from "@mailquilt/renderer";
import { html, LitElement, nothing } from "lit";
import { keyed } from "lit/directives/keyed.js";
import { styleMap } from "lit/directives/style-map.js";

import { blockContentStyles, hasRichText } from "./block-content.js";
import { BLOCKS, createBlockDragging, dropCommand } from "./block-dragging.js";
import type { BlockDragging, DragSource, DropPlace } from "./block-dragging.js";
import {
  arrowDirection,
  historyInput,
  historyShortcut,
  isComposing,
  isLinkShortcut,
  isPageHistoryArrow,
} from "./block-keyboard.js";
import type { Direction } from "./block-keyboard.js";
import {
  MIN_EDITOR_WIDTH,
  renderFloatingToolbar,
  renderNarrowNotice,
  renderRows,
} from "./canvas.js";
import type { CanvasEvents, CanvasState } from "./canvas.js";
import { createLinkForm, formatBarStyles } from "./format-bar.js";
import type { FormatBarEvents } from "./format-bar.js";
import { editorStyles } from "./mail-quilt-styles.js";
import {
  blocksIn,
  locate,
  moveCommand,
  moveRowCommand,
  neighbourBlockId,
  placeLabel,
  positionLabel,
} from "./places.js";
import { createPreview, previewStyles, renderPreview } from "./preview.js";
import { createSettingsDrafts, settingsPanelStyles } from "./settings-panel.js";
import { renderSidePanel, sidePanelStyles } from "./side-panel.js";
import type { PanelTab, SidePanelEvents } from "./side-panel.js";
import { createTextBlockView } from "./text-block-view.js";
import type { TextBlockView, TextFormats } from "./text-block-view.js";
import { themeTokens, UI_LANG, uiStyles } from "./theme.js";
import { createTooltips } from "./tooltips.js";
import type { Tooltips } from "./tooltips.js";

/** Typing after a gap this long starts a new undo step. */
const TYPING_PAUSE_MS = 1000;

/**
 * A file dropped on the editor would open in the tab, in place of the page and
 * the email. Dragged text still moves.
 */
const refuseFiles = (event: DragEvent) => {
  if (event.dataTransfer?.types.includes("Files")) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "none";
  }
};

type MoveOperation = Extract<Operation, { type: "move" }>;

export class MailQuilt extends LitElement {
  static override styles = [
    themeTokens,
    uiStyles,
    settingsPanelStyles,
    sidePanelStyles,
    blockContentStyles,
    formatBarStyles,
    previewStyles,
    editorStyles,
  ];

  #editor: Editor | undefined;
  /** A private copy of the document last received from or sent to the host. */
  #lastKnownDocument: BlocksDocument | undefined;
  readonly #views = new Map<string, TextBlockView>();
  /** Edits in the same typing session merge into one undo step. */
  #typingSession = 0;
  #lastTypedAt = 0;
  /** The selected Block, which the toolbars act on: the last one to have focus. */
  #selectedBlockId: string | undefined;
  /** Whether focus is in the selected Block's text or its format bar. */
  #editingText = false;
  /** The selected Row, when a Row rather than a Block is selected. */
  #selectedRowId: string | undefined;
  /** Whether the side panel shows the selected Block's or Row's settings, not its tabs. */
  #showProperties = false;
  #panelTab: PanelTab = "content";
  /** What had focus in the editor when the current update began. */
  #focusedBeforeUpdate: Element | null | undefined;
  /** Set while `updated` gives focus back, which selects nothing new. */
  #restoringFocus = false;
  #formats: TextFormats | undefined;
  readonly #drafts = createSettingsDrafts({
    apply: (command) => this.#apply(command, { refusable: true }),
    controlOf: (key) =>
      this.renderRoot.querySelector<HTMLInputElement>(
        `[data-draft-key="${CSS.escape(key)}"]`
      ),
    onEnter: (value) => {
      // An image URL that failed may load now, so entering it again tries again.
      if (typeof value === "string") {
        this.#failedImages.delete(value);
      }
    },
    requestUpdate: () => this.requestUpdate(),
  });
  /** One copy of the document for each update, as `value` makes a new one. */
  #rendered: BlocksDocument | undefined;
  /** Image URLs that didn't load, which the canvas stops trying to show. */
  readonly #failedImages = new Set<string>();
  readonly #linkForm = createLinkForm({
    editingText: () => this.#editingText,
    field: async () => {
      await this.updateComplete;
      return this.renderRoot.querySelector<HTMLInputElement>(
        ".link-form input"
      );
    },
    requestUpdate: () => this.requestUpdate(),
    view: () => this.#selectedView,
  });
  readonly #preview = createPreview({
    dialog: () => this.renderRoot.querySelector<HTMLDialogElement>(".preview"),
    exportHtml: () => this.exportHtml(),
    requestUpdate: () => this.requestUpdate(),
  });
  /** Set while the element is connected. */
  #dragging: BlockDragging | undefined;
  #tooltips: { element: HTMLElement; tooltips: Tooltips } | undefined;
  /** What the screen reader last heard about a move. */
  #announcement = "";
  /** Each announcement gets a new element, so the same words are read again. */
  #announcementId = 0;
  /** Where the Enter key now held down was pressed. */
  #enterPressedOn: EventTarget | undefined;
  /** The last press began on the workspace itself, not after a drag from a Block. */
  #pressedOnWorkspace = false;
  /** Too narrow to edit in, as on a phone or in a narrow part of a page. */
  #narrow = false;
  /** Made on the page, as a server rendering the editor has no ResizeObserver. */
  #resizeObserver: ResizeObserver | undefined;

  readonly #sidePanelEvents: SidePanelEvents = {
    onAddBlock: (blockType) => this.#addBlock(blockType),
    onAddRow: (layout) => this.#addRow(layout),
    onBack: () => this.#showTabs(),
    onChooseLayout: (rowId, layout) =>
      this.#apply({ layout, rowId, type: "setRowLayout" }),
    onControlMousedown: (event) => this.#onControlMousedown(event),
    onSelectTab: (tab) => this.#selectTab(tab),
    settings: this.#drafts.events,
  };

  readonly #formatBarEvents: FormatBarEvents = {
    ...this.#linkForm.events,
    onBack: () => this.#selectedView?.focus(),
    onControlMousedown: (event) => this.#onControlMousedown(event),
    onLineBreak: () => this.#selectedView?.insertLineBreak(),
    onToggleMark: (mark) => this.#selectedView?.toggleMark(mark),
  };

  readonly #canvasEvents: CanvasEvents = {
    formatBar: this.#formatBarEvents,
    onAddBlock: (blockType, place) => this.#addBlock(blockType, place),
    onBlockClick: (event) => this.#onBlockClick(event),
    onBlockFocus: (event, blockId) => this.#onBlockFocus(event, blockId),
    onBlockFocusout: () => this.#onBlockFocusout(),
    onBlockKeydown: (event) => this.#onBlockKeydown(event),
    onControlMousedown: (event) => this.#onControlMousedown(event),
    onDeleteRow: (rowId, fromKeyboard) => this.#deleteRow(rowId, fromKeyboard),
    onDeleteSelectedBlock: (fromKeyboard) =>
      this.#deleteSelectedBlock(fromKeyboard),
    onHandleMousedown: (event) => this.#onHandleMousedown(event),
    onImageError: (src) => this.#onImageError(src),
    onMoveRow: (rowId, direction) => this.#moveRow(rowId, direction),
    onMoveSelectedBlock: (direction) => this.#moveSelectedBlock(direction),
    onOpenPreview: (event) => this.#openPreview(event),
    onRowToolbarKeydown: (event, rowId) =>
      this.#onRowToolbarKeydown(event, rowId),
    onSelectRow: (rowId) => this.#selectRow(rowId),
    onStepHistory: (step) => this.#stepHistory(step),
  };

  constructor() {
    super();
    // On the way in, because ProseMirror handles the key before it bubbles here.
    this.addEventListener("keydown", this.#onKeydownCapture, { capture: true });
    // A host may set `value` before this element is defined, which leaves an
    // own property in front of the setter.
    if (Object.hasOwn(this, "value")) {
      const { value } = this;
      Reflect.deleteProperty(this, "value");
      this.value = value;
    }
  }

  get value(): BlocksDocument | undefined {
    return this.#editor?.getDocument();
  }

  /**
   * A document with the same content as the last one received or sent out
   * changes nothing, so a controlled host keeps its undo history and cursor. Any
   * other document loads and clears undo history. A document that can't be
   * trusted fires `mq-error`, and the current email stays as it was. Any value
   * is checked, such as a saved email read back from JSON, so any is allowed.
   */
  set value(document: unknown) {
    // Checked first, because a controlled host does this after every keystroke.
    if (isSameDocument(document, this.#lastKnownDocument)) {
      return;
    }
    // Null too, which is what JSON.parse gives for nothing saved.
    if (document === undefined || document === null) {
      this.#show(undefined);
      return;
    }
    const loaded = loadDocument(document);
    if (!loaded.ok) {
      this.#emitError(loaded.reason);
      return;
    }
    // An older document only matches the current one once it has been migrated.
    if (!isSameDocument(loaded.document, this.#lastKnownDocument)) {
      this.#show(loaded.document);
    }
  }

  /** Returns the final HTML. MJML loads the first time this is called. */
  async exportHtml() {
    if (!this.#editor) {
      throw new Error("<mail-quilt> has no document to export");
    }
    return await renderEmail(this.#editor.getDocument());
  }

  override connectedCallback() {
    super.connectedCallback();
    this.#resizeObserver ??= new ResizeObserver(([entry]) => {
      const narrow = (entry?.contentRect.width ?? 0) < MIN_EDITOR_WIDTH;
      if (narrow !== this.#narrow) {
        this.#narrow = narrow;
        // A frame later, as changing size inside this callback is reported as a
        // ResizeObserver loop error.
        requestAnimationFrame(() => this.requestUpdate());
      }
    });
    this.#resizeObserver.observe(this);
    this.#dragging = createBlockDragging({
      onDrop: (source, place) => this.#drop(source, place),
      root: this.renderRoot as ShadowRoot,
    });
    this.requestUpdate();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.#resizeObserver?.disconnect();
    this.#dragging?.destroy();
    this.#dragging = undefined;
    this.#tooltips?.tooltips.destroy();
    this.#tooltips = undefined;
    this.#reset();
  }

  protected override willUpdate() {
    this.#focusedBeforeUpdate = this.shadowRoot?.activeElement;
    this.#rendered = this.value;
    // Lit still updates detached elements, and nothing would destroy these
    // views. connectedCallback requests an update that creates them instead.
    if (!this.isConnected) {
      return;
    }
    const blocks = this.#rendered ? blocksIn(this.#rendered) : [];
    for (const block of blocks) {
      if (hasRichText(block) && !this.#views.has(block.id)) {
        this.#views.set(
          block.id,
          createTextBlockView({
            // A Heading is bold already, so the mark would change nothing.
            canBold: block.type !== "heading",
            content: block.props.content as RichTextDocument,
            label: `${blockLabel(block.type)} Block`,
            onChange: (next) => this.#commitText(block.id, next),
            onFocus: () => this.#selectFocused(block.id, true),
            onStateChange: () => this.#syncFormats(),
            onTypingBreak: () => {
              this.#typingSession += 1;
            },
          })
        );
      }
    }
    const blockIds = new Set(blocks.map(({ id }) => id));
    this.#removeViewsExcept(blockIds);
    for (const view of this.#views.values()) {
      view.setLang(this.#emailLang);
    }
    // What was selected may have been removed.
    const rows = this.#rendered?.rows ?? [];
    if (
      (this.#selectedBlockId !== undefined &&
        !blockIds.has(this.#selectedBlockId)) ||
      (this.#selectedRowId !== undefined &&
        !rows.some(({ id }) => id === this.#selectedRowId))
    ) {
      this.#select(undefined);
    }
  }

  /**
   * A change can remove the element with focus, or disable it. Focus stays in the
   * editor, where undo still works. A Block that just moved, or whose link field
   * just closed, gets it back, on the Block itself or the same tool if that's
   * where it was, so that the next move works. Otherwise the floating toolbar
   * takes it, because it does nothing when a key that activated a button is
   * pressed again or held down.
   */
  protected override updated() {
    const before = this.#focusedBeforeUpdate;
    const active = this.shadowRoot?.activeElement as
      | HTMLButtonElement
      | null
      | undefined;
    if (before && (!active || active.disabled)) {
      const selected =
        this.#selectedBlockId === undefined
          ? undefined
          : this.#blockElement(this.#selectedBlockId);
      const { action } = (before as HTMLElement).dataset;
      const tool =
        action === undefined
          ? undefined
          : selected?.querySelector<HTMLElement>(
              `.block-toolbar [data-action="${action}"]`
            );
      const block = before.matches(".block") ? selected : undefined;
      // What was removed is detached by now, without the Block around it.
      const view = before.closest(".block, .format-bar, .link-form")
        ? this.#selectedView
        : undefined;
      // A Row that moved keeps its tools. At either end, one of them is disabled.
      const rowTools = before.isConnected
        ? before.closest(".row-toolbar")
        : undefined;
      const rowTool = rowTools
        ? (
            [
              before,
              ...rowTools.querySelectorAll("button"),
            ] as HTMLButtonElement[]
          ).find((button) => !button.disabled)
        : undefined;
      this.#restoringFocus = true;
      (tool ?? block ?? view ?? rowTool ?? this.#floatingToolbar)?.focus();
      this.#restoringFocus = false;
    }
    if (this.isConnected && this.shadowRoot) {
      this.#syncTooltips(this.shadowRoot);
    }
  }

  protected override render() {
    const document = this.#rendered;
    if (!document) {
      return nothing;
    }
    const { rows, settings } = document;
    const selected = this.#selectedPosition(document);

    return html`
      ${renderPreview(this.#preview.shown, this.#preview.events)}
      <div class="visually-hidden" lang=${UI_LANG} role="status">
        ${keyed(this.#announcementId, html`<span>${this.#announcement}</span>`)}
      </div>
      <p hidden id="block-keys" lang=${UI_LANG}>
        Press Enter to edit the text, and Escape to come back. In the text,
        press Alt+F10 to reach its formatting. Use arrow keys to select another
        Block, and Alt with arrow keys to move this one.
      </p>
      <p hidden id="block-keys-no-text" lang=${UI_LANG}>
        Use arrow keys to select another Block, and Alt with arrow keys to move
        this one.
      </p>
      ${this.#narrow ? renderNarrowNotice(this.#canvasEvents.onOpenPreview) : nothing}
      <div
        class="ui editor"
        lang=${UI_LANG}
        part="frame"
        ?data-collapsed=${this.#narrow}
        style=${styleMap({ "--email-width": `${settings.width}px` })}
        @keydown=${this.#onEditorKeydown}
        @dragover=${refuseFiles}
        @drop=${refuseFiles}
      >
        <div
          class="canvas-area"
          @click=${this.#onWorkspaceClick}
          @pointerdown=${this.#onWorkspacePointerdown}
        >
          <div
            class="email"
            @beforeinput=${this.#onBeforeInput}
            @keydown=${this.#onEmailKeydown}
            style=${styleMap({
              // Also for what's dragged, which has nothing behind it.
              "--_mq-email-background": settings.backgroundColor,
              "background-color": settings.backgroundColor,
              "font-family": settings.fontFamily,
              width: `${settings.width}px`,
            })}
          >
            ${renderRows(rows, this.#canvasState, this.#canvasEvents)}
            <div class="drop-indicator" hidden></div>
          </div>
          ${renderFloatingToolbar(this.#canvasEvents)}
        </div>
        ${renderSidePanel(
          {
            document,
            selectedBlock: selected,
            selectedRowId: this.#selectedRowId,
            showProperties: this.#showProperties,
            tab: this.#panelTab,
          },
          this.#sidePanelEvents
        )}
        <div class="ui tooltip" hidden role="tooltip"></div>
      </div>
    `;
  }

  get #canvasState(): CanvasState {
    return {
      editingText: this.#editingText,
      emailLang: this.#emailLang,
      failedImages: this.#failedImages,
      formatBar: { formats: this.#formats, linkForm: this.#linkForm.state },
      selectedBlockId: this.#selectedBlockId,
      selectedRowId: this.#selectedRowId,
      textOf: (blockId) => this.#views.get(blockId)?.element,
    };
  }

  /** On each Block's content. With none set, it's unknown, as in the export. */
  get #emailLang() {
    return this.#rendered?.settings.language ?? "";
  }

  /** The first of a Row's tools, where Tab reaches its toolbar. */
  #selectRowButton(rowId: string) {
    return this.renderRoot.querySelector<HTMLElement>(
      `.row-frame[data-row-id="${CSS.escape(rowId)}"] [data-action="select-row"]`
    );
  }

  get #selectedView() {
    return this.#selectedBlockId === undefined
      ? undefined
      : this.#views.get(this.#selectedBlockId);
  }

  /** Firefox's scroll on focus leaves a Block that's partly in view where it is. */
  #onBlockFocus({ currentTarget }: FocusEvent, blockId: string) {
    this.#selectFocused(blockId, false);
    (currentTarget as HTMLElement).scrollIntoView({ block: "nearest" });
    this.#revealBlock(blockId);
  }

  /**
   * Shows the selected Block's settings again after Back, when its text still has
   * focus and so gets no new focus event. Its own toolbars leave the panel be.
   */
  #onBlockClick({ currentTarget, target }: MouseEvent) {
    if (
      !this.#showProperties &&
      (currentTarget as HTMLElement).dataset.blockId ===
        this.#selectedBlockId &&
      !(target as Element).closest(".block-toolbar, .format-bar")
    ) {
      this.#showProperties = true;
      this.requestUpdate();
    }
  }

  /**
   * The text stops being edited once focus leaves it and its format bar. State
   * rather than CSS, which would hide the bar while focus is on its way there.
   * Checked once focus has landed: the Preview opening over the text, or the
   * window losing focus while a URL is copied elsewhere, leave the bar as it is.
   */
  #onBlockFocusout() {
    if (!this.#editingText) {
      return;
    }
    setTimeout(() => {
      const active = this.shadowRoot?.activeElement;
      if (
        this.#editingText &&
        document.hasFocus() &&
        !active?.closest(".ProseMirror, .format-bar, .preview")
      ) {
        this.#editingText = false;
        this.requestUpdate();
      }
    }, 0);
  }

  /** Focus on a Block, or in its text, selects the Block. */
  #selectFocused(blockId: string, inText: boolean) {
    this.#editingText = inText;
    // The Block is selected already, and the panel stays as it was left.
    if (!this.#restoringFocus) {
      this.#select({ blockId });
    }
  }

  /**
   * Selects a Block, a Row or nothing, and shows what's selected in the side
   * panel. Whether a Block's text is being edited is up to where focus is.
   */
  #select(target: { blockId: string } | { rowId: string } | undefined) {
    const blockId = target && "blockId" in target ? target.blockId : undefined;
    this.#selectedBlockId = blockId;
    this.#selectedRowId =
      target && "rowId" in target ? target.rowId : undefined;
    this.#showProperties = target !== undefined;
    this.#linkForm.close();
    if (blockId === undefined) {
      this.#editingText = false;
    }
    this.#formats = this.#selectedView?.formats();
    this.requestUpdate();
  }

  /**
   * Selects a Row in place of any Block, and shows its settings. Its toolbar's
   * button takes focus, so typing can't go on in a Block's text.
   */
  async #selectRow(rowId: string) {
    // From the keyboard, as from the Rows tab, the focus ring follows.
    const focusVisible =
      this.shadowRoot?.activeElement?.matches(":focus-visible") ?? false;
    this.#select({ rowId });
    await this.updateComplete;
    const button = this.#selectRowButton(rowId);
    if (button && this.shadowRoot?.activeElement !== button) {
      button.focus({ focusVisible } as FocusOptions);
    }
  }

  /** Re-renders only on a change, because this runs on every transaction. */
  #syncFormats() {
    const formats = this.#selectedView?.formats();
    if (JSON.stringify(formats) !== JSON.stringify(this.#formats)) {
      this.#formats = formats;
      this.requestUpdate();
    }
  }

  async #openPreview({ currentTarget }: Event) {
    // Toolbar buttons don't take focus from a mouse press, and the dialog returns
    // focus to whatever had it.
    if (!this.shadowRoot?.activeElement) {
      (currentTarget as HTMLElement).focus();
    }
    await this.#preview.open();
  }

  #onImageError(src: string) {
    this.#failedImages.add(src);
    this.requestUpdate();
  }

  /**
   * Applies a Command and reports a change with `mq-change`. A rejection is a bug
   * here unless it's `refusable`, as what a person typed is. Text on the canvas
   * shows its own change, so it needs no `render`.
   */
  #apply(
    command: Command,
    {
      mergeKey,
      refusable = false,
      render = true,
    }: { mergeKey?: string; refusable?: boolean; render?: boolean } = {}
  ) {
    const editor = this.#editor;
    const result = editor?.apply(command, { mergeKey });
    if (!(editor && result)) {
      return;
    }
    if (!result.ok) {
      if (!(result.unchanged || refusable)) {
        // The controls only offer what's allowed, so this is a bug here.
        console.error(`<mail-quilt> rejected a Command: ${result.reason}`);
      }
      return result;
    }
    if (render) {
      this.requestUpdate();
    }
    this.#emitChange(editor.getDocument());
    return result;
  }

  /**
   * Undo and redo, from anywhere in the editor. Text being typed in a settings
   * field has the field's own undo, like the link field, which keeps its keys.
   */
  #onEditorKeydown(event: KeyboardEvent) {
    if (this.#drafts.draftKeyOf(event) === undefined) {
      this.#runHistoryStep(event, historyShortcut(event));
    }
  }

  #selectedPosition(document: BlocksDocument) {
    return this.#selectedBlockId === undefined
      ? undefined
      : locate(document, this.#selectedBlockId);
  }

  /** After the selected Block's Row, or else at the end, and selects it. */
  async #addRow(layout: RowLayout) {
    const document = this.#editor?.getDocument();
    if (!document) {
      return;
    }
    const selectedRow = document.rows.findIndex(
      ({ id }) => id === this.#selectedRowId
    );
    const rowIndex =
      selectedRow === -1
        ? this.#selectedPosition(document)?.rowIndex
        : selectedRow;
    const result = this.#apply({
      index: rowIndex === undefined ? document.rows.length : rowIndex + 1,
      layout,
      type: "insertRow",
    });
    if (result?.ok && result.createdId !== undefined) {
      await this.#selectRow(result.createdId);
    }
  }

  #onWorkspacePointerdown({ currentTarget, target }: PointerEvent) {
    this.#pressedOnWorkspace = target === currentTarget;
  }

  /**
   * A click on the workspace around the email clears the selection, as in any
   * design tool. The floating toolbar takes focus, so keyboard undo still works.
   */
  #onWorkspaceClick({ currentTarget, target }: MouseEvent) {
    if (
      target !== currentTarget ||
      !this.#pressedOnWorkspace ||
      (this.#selectedBlockId === undefined && this.#selectedRowId === undefined)
    ) {
      return;
    }
    this.#select(undefined);
    this.#floatingToolbar?.focus({ focusVisible: false } as FocusOptions);
  }

  /** Back to the tabs, with the Block still selected for what's added next. */
  async #showTabs() {
    const fromKeyboard =
      this.shadowRoot?.activeElement?.matches(".back-button") ?? false;
    this.#showProperties = false;
    this.requestUpdate();
    if (fromKeyboard) {
      await this.updateComplete;
      this.#tabButton(this.#panelTab)?.focus();
    }
  }

  /** The ARIA tabs pattern: a tab that arrow keys move to shows its panel too. */
  #selectTab(tab: PanelTab) {
    if (tab !== this.#panelTab) {
      this.#panelTab = tab;
      this.requestUpdate();
    }
  }

  #tabButton(tab: PanelTab) {
    return this.renderRoot.querySelector<HTMLElement>(`#tab-${tab}`);
  }

  /**
   * From the keyboard, focus goes to the next Block, or else the one before, as
   * it would be lost. A button pressed with a key clicks with a `detail` of 0.
   */
  async #deleteSelectedBlock(fromKeyboard: boolean) {
    const document = this.#editor?.getDocument();
    const blockId = this.#selectedBlockId;
    if (!document || blockId === undefined) {
      return;
    }
    const neighbour =
      neighbourBlockId(document, blockId, "down") ??
      neighbourBlockId(document, blockId, "up");
    if (this.#apply({ blockId, type: "removeBlock" })?.ok) {
      this.#announce("Block deleted.");
      await this.updateComplete;
      if (fromKeyboard && neighbour !== undefined) {
        this.#blockElement(neighbour)?.focus();
      }
    }
  }

  /**
   * From the keyboard, focus goes to the next Row's tools, or else the one
   * before, as it would be lost.
   */
  async #deleteRow(rowId: string, fromKeyboard: boolean) {
    const rows = this.#editor?.getDocument().rows ?? [];
    const index = rows.findIndex(({ id }) => id === rowId);
    const neighbour = rows[index + 1] ?? rows[index - 1];
    if (this.#apply({ rowId, type: "removeRow" })?.ok) {
      this.#announce("Row deleted.");
      await this.updateComplete;
      if (fromKeyboard && neighbour) {
        this.#selectRowButton(neighbour.id)?.focus();
      }
    }
  }

  /**
   * Adds a Block and selects it, ready to type in if it has text. By default it
   * goes where `#defaultBlockPlace` says.
   */
  async #addBlock(
    blockType: string,
    place?: { columnId: string; index: number }
  ) {
    const editor = this.#editor;
    if (!editor) {
      return;
    }
    const target = place ?? this.#defaultBlockPlace(editor);
    const result = this.#apply(
      target
        ? { blockType, ...target, type: "insertBlock" }
        : { blockType, rowIndex: 0, type: "insertBlockInNewRow" }
    );
    if (result?.ok) {
      await this.#showPlaced(result.createdId);
    }
  }

  /** Selects a Block that was just put in place, in its text if it has any. */
  async #showPlaced(blockId: string | undefined) {
    this.#select(blockId === undefined ? undefined : { blockId });
    await this.updateComplete;
    if (blockId === undefined) {
      return;
    }
    if (this.#selectedView) {
      this.#selectedView.focus();
      // Unlike focus on the Block, focus in its text doesn't scroll.
      this.#revealBlock(blockId);
    } else {
      this.#blockElement(blockId)?.focus();
    }
  }

  /**
   * After the selected Block, at the end of the selected Row's first Column, or
   * else at the end of the email.
   */
  #defaultBlockPlace(editor: Editor) {
    const document = editor.getDocument();
    const selected = this.#selectedPosition(document);
    if (selected) {
      return { columnId: selected.columnId, index: selected.index + 1 };
    }
    const column =
      document.rows.find(({ id }) => id === this.#selectedRowId)?.columns[0] ??
      document.rows.at(-1)?.columns.at(-1);
    return column && { columnId: column.id, index: column.blocks.length };
  }

  async #drop(source: DragSource, place: DropPlace) {
    const result = this.#apply(dropCommand(source, place));
    if (!result?.ok) {
      return;
    }
    if ("rowId" in source) {
      this.#announceRowMove(source.rowId);
      return;
    }
    if ("rowLayout" in source) {
      if (result.createdId !== undefined) {
        await this.#selectRow(result.createdId);
      }
      return;
    }
    if ("blockId" in source) {
      this.#announceMove(source.blockId);
    }
    await this.#showPlaced(
      "blockId" in source ? source.blockId : result.createdId
    );
  }

  /** The text schema is no wider than core's, so a rejection is a bug here. */
  #commitText(blockId: string, content: RichTextDocument) {
    const now = performance.now();
    if (now - this.#lastTypedAt >= TYPING_PAUSE_MS) {
      this.#typingSession += 1;
    }
    this.#lastTypedAt = now;
    this.#apply(
      { blockId, props: { content }, type: "updateBlockProps" },
      { mergeKey: `${blockId}:${this.#typingSession}`, render: false }
    );
  }

  #onBeforeInput(event: InputEvent) {
    // WebKit types into a Block's selection, and undoes there too, even with focus
    // on the dialog, a control, the link field or the Block itself.
    const active = this.shadowRoot?.activeElement;
    if (this.#preview.isOpen || (active && !active.closest(".ProseMirror"))) {
      event.preventDefault();
      return;
    }
    this.#runHistoryStep(event, historyInput(event));
  }

  #onEmailKeydown(event: KeyboardEvent) {
    if (
      event.altKey &&
      event.key === "F10" &&
      (event.target as Element).closest(".ProseMirror")
    ) {
      event.preventDefault();
      this.renderRoot
        .querySelector<HTMLElement>(".format-bar > button:not(:disabled)")
        ?.focus();
      return;
    }
    if (isLinkShortcut(event)) {
      // Browsers use this one to focus their search or address bar, and a host
      // page may use it for its own search.
      event.preventDefault();
      event.stopPropagation();
      this.#linkForm.open();
    }
  }

  /**
   * A key that moved focus into a Block's text would otherwise keep repeating
   * there, adding empty paragraphs. Repeats only count where the press began.
   */
  readonly #onKeydownCapture = (event: KeyboardEvent) => {
    if (event.key !== "Enter") {
      return;
    }
    const [target] = event.composedPath();
    if (!event.repeat) {
      this.#enterPressedOn = target;
    } else if (target !== this.#enterPressedOn) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  /**
   * These act only with focus on the Block itself, apart from the Move buttons'
   * Alt+arrow shortcuts, which also work in its toolbar. In its text, the same
   * keys move the cursor, by word with Alt on macOS, and Enter starts a new
   * paragraph.
   */
  #onBlockKeydown(event: KeyboardEvent) {
    // The Blocks would change under a drag that's still going.
    if (this.#dragging?.isDragging()) {
      return;
    }
    const block = event.currentTarget as HTMLElement;
    const target = event.target as Element;
    const direction = arrowDirection(event);
    if (event.altKey && direction && target.closest(".block-toolbar")) {
      // Alt+Left would go back in history.
      event.preventDefault();
      this.#moveSelectedBlock(direction);
      return;
    }
    if (target !== block) {
      if (event.key === "Escape" && !isComposing(event)) {
        event.preventDefault();
        // This one is used up, so a host's dialog stays open. Pressed again on the
        // Block, it reaches the host.
        event.stopPropagation();
        block.focus();
      } else if (event.altKey && isPageHistoryArrow(direction)) {
        // In the text and its format bar, these would leave the page.
        event.preventDefault();
      }
      return;
    }
    if (event.key === "Enter") {
      // Otherwise the new paragraph lands in the text that just took focus.
      event.preventDefault();
      this.#selectedView?.focus();
      return;
    }
    if (!direction) {
      return;
    }
    // The page would scroll too, or go back in history with Alt+Left.
    event.preventDefault();
    if (event.altKey) {
      this.#moveSelectedBlock(direction);
    } else {
      this.#selectNeighbour(direction);
    }
  }

  #selectNeighbour(direction: Direction) {
    const document = this.#editor?.getDocument();
    const blockId = this.#selectedBlockId;
    const next =
      document &&
      blockId !== undefined &&
      neighbourBlockId(document, blockId, direction);
    if (next) {
      this.#blockElement(next)?.focus();
    }
  }

  #moveSelectedBlock(direction: Direction) {
    const document = this.#editor?.getDocument();
    const blockId = this.#selectedBlockId;
    if (!document || blockId === undefined) {
      return;
    }
    const command = moveCommand(document, blockId, direction);
    if (command && this.#apply(command)?.ok) {
      this.#announceMove(blockId);
      this.#revealBlock(blockId);
    } else {
      this.#announce(`The Block can't move ${direction}.`);
    }
  }

  #announceMove(blockId: string, prefix = "Moved to") {
    const document = this.#editor?.getDocument();
    const place = document && placeLabel(document, blockId);
    if (place) {
      this.#announce(`${prefix} ${place}.`);
    }
  }

  #announce(text: string) {
    this.#announcement = text;
    this.#announcementId += 1;
    this.requestUpdate();
  }

  #onRowToolbarKeydown(event: KeyboardEvent, rowId: string) {
    // The Rows would change under a drag that's still going.
    if (this.#dragging?.isDragging()) {
      return;
    }
    const direction = arrowDirection(event);
    if (!(event.altKey && direction)) {
      return;
    }
    // Alt+Left would go back in history.
    event.preventDefault();
    if (direction === "up" || direction === "down") {
      this.#moveRow(rowId, direction);
    } else {
      this.#announce(`The Row can't move ${direction}.`);
    }
  }

  /** One step, keeping the selection, and focus on the Row's tools if it was there. */
  #moveRow(rowId: string, direction: "down" | "up") {
    const document = this.#editor?.getDocument();
    const command = document && moveRowCommand(document, rowId, direction);
    if (!command) {
      this.#announce(`The Row can't move ${direction}.`);
      return;
    }
    if (this.#apply(command)?.ok) {
      this.#announceRowMove(rowId);
      this.#revealRow(rowId);
    }
  }

  #announceRowMove(rowId: string, prefix = "Row moved to") {
    const rows = this.#editor?.getDocument().rows ?? [];
    const index = rows.findIndex(({ id }) => id === rowId);
    if (index !== -1) {
      this.#announce(`${prefix} ${positionLabel(index, rows.length)}.`);
    }
  }

  async #revealRow(rowId: string) {
    await this.updateComplete;
    this.renderRoot
      .querySelector(`.row-frame[data-row-id="${CSS.escape(rowId)}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }

  /**
   * Focus alone doesn't do this. A Block keeps focus if its neighbour is what moves
   * in the DOM, and focusing its text doesn't scroll.
   */
  async #revealBlock(blockId: string) {
    await this.updateComplete;
    const block = this.#blockElement(blockId);
    block?.scrollIntoView({ block: "nearest" });
    // Its tools can reach past a thin Block, under the floating toolbar, which
    // would hide the one with focus.
    block
      ?.querySelector(".block-toolbar")
      ?.scrollIntoView({ block: "nearest" });
  }

  #blockElement(blockId: string) {
    return this.renderRoot.querySelector<HTMLElement>(
      `${BLOCKS}[data-block-id="${CSS.escape(blockId)}"]`
    );
  }

  /**
   * Pressing a control leaves focus and the selection in the Block. With no focus
   * in the editor, the control takes it, because keyboard undo only reaches the
   * editor from inside it. Browsers disagree on whether a press focuses a button.
   * A drag handle in a toolbar has its own.
   */
  #onControlMousedown(event: MouseEvent) {
    const { target } = event;
    if (
      target instanceof HTMLInputElement ||
      (target instanceof Element && target.closest(".drag-handle"))
    ) {
      return;
    }
    event.preventDefault();
    this.#commitFocusedField();
    if (!this.shadowRoot?.activeElement && target instanceof Element) {
      // Without a ring, as for any other press with the pointer.
      target.closest("button")?.focus({ focusVisible: false } as FocusOptions);
    }
  }

  /**
   * Leaves focus and the selection where they are. With no focus in the editor,
   * the floating toolbar takes it, because keyboard undo only reaches the editor
   * from inside.
   */
  #onHandleMousedown(event: MouseEvent) {
    event.preventDefault();
    this.#commitFocusedField();
    if (!this.shadowRoot?.activeElement) {
      this.#floatingToolbar?.focus();
    }
  }

  get #floatingToolbar() {
    return this.renderRoot.querySelector<HTMLElement>(".floating-toolbar");
  }

  /** A new render can replace the tooltip, along with everything else. */
  #syncTooltips(root: ShadowRoot) {
    const element = root.querySelector<HTMLElement>(".tooltip");
    if (element !== this.#tooltips?.element) {
      this.#tooltips?.tooltips.destroy();
      this.#tooltips = element
        ? { element, tooltips: createTooltips(root, element) }
        : undefined;
    }
    this.#tooltips?.tooltips.sync();
  }

  /**
   * The presses above keep focus where it is, so a settings field would hold on to
   * what's typed in it while the press acts on the email. Blurring commits it.
   */
  #commitFocusedField() {
    const active = this.shadowRoot?.activeElement;
    if (active?.closest(".settings")) {
      (active as HTMLElement).blur();
    }
  }

  #runHistoryStep(event: Event, step: "redo" | "undo" | undefined) {
    if (!step) {
      return;
    }
    // The browser's own undo would change the text behind the document's back,
    // and a host page's own undo would act on the same keys.
    event.preventDefault();
    event.stopPropagation();
    this.#stepHistory(step);
  }

  #stepHistory(step: "redo" | "undo") {
    const editor = this.#editor;
    if (!editor) {
      return;
    }
    let moved: MoveOperation[] = [];
    const stopListening = editor.subscribe((operations) => {
      moved = operations.filter(
        (operation): operation is MoveOperation => operation.type === "move"
      );
    });
    const changed = editor[step]();
    stopListening();
    if (!changed) {
      return;
    }
    // The change can move the selection the link field would apply to.
    this.#linkForm.close();
    // What was refused may be fine now, and the fields show what's come back.
    this.#drafts.clear();
    this.#announceHistoryStep(step, moved);
    const document = editor.getDocument();
    for (const block of blocksIn(document)) {
      this.#views
        .get(block.id)
        ?.setContent(block.props.content as RichTextDocument);
    }
    // Undo and redo can add, remove or move Blocks, Columns and Rows.
    this.requestUpdate();
    this.#emitChange(document);
  }

  /** One Block or Row moved, or nothing to say. A layout can move many at once. */
  #announceHistoryStep(step: "redo" | "undo", moved: MoveOperation[]) {
    const [operation] = moved;
    if (operation === undefined || moved.length > 1) {
      this.#announce("");
      return;
    }
    const prefix = step === "undo" ? "Undo moved" : "Redo moved";
    if ("rowId" in operation) {
      this.#announceRowMove(operation.rowId, `${prefix} a Row to`);
      return;
    }
    const { blockId } = operation;
    this.#announceMove(blockId, `${prefix} a Block to`);
    if (blockId === this.#selectedBlockId) {
      this.#revealBlock(blockId);
    }
  }

  #show(document: BlocksDocument | undefined) {
    this.#lastKnownDocument = document;
    this.#preview.forget();
    this.#announcement = "";
    this.#drafts.clear();
    // A URL that failed before may load now, as its image may have been
    // uploading, or the connection down.
    this.#failedImages.clear();
    this.#reset();
    this.#editor = document && createEditor({ document });
    this.requestUpdate();
  }

  #emitChange(document: BlocksDocument) {
    // A copy, because the host owns what it receives and may change it.
    this.#lastKnownDocument = structuredClone(document);
    this.#preview.forget();
    this.dispatchEvent(
      new CustomEvent("mq-change", {
        bubbles: true,
        composed: true,
        detail: { document },
      })
    );
  }

  #emitError(reason: string) {
    // Later, because a host may set `value` just before adding its listener.
    queueMicrotask(() => {
      this.dispatchEvent(
        new CustomEvent("mq-error", {
          bubbles: true,
          composed: true,
          detail: { reason },
        })
      );
    });
  }

  /** A Block that undo brings back gets a new view from the document. */
  #removeViewsExcept(blockIds: Set<string>) {
    for (const [blockId, view] of this.#views) {
      if (!blockIds.has(blockId)) {
        view.destroy();
        this.#views.delete(blockId);
      }
    }
  }

  /** Destroys the text views, and the selection and Preview that describe them. */
  #reset() {
    for (const view of this.#views.values()) {
      view.destroy();
    }
    this.#views.clear();
    // The toolbar's state describes those views and their selections.
    this.#select(undefined);
    this.#preview.end();
  }
}

if (!customElements.get("mail-quilt")) {
  customElements.define("mail-quilt", MailQuilt);
}

/** Fired with the new document after each change. */
export type MailQuiltChangeEvent = CustomEvent<{ document: BlocksDocument }>;
/** Fired when a document set as `value` is refused, with why. */
export type MailQuiltErrorEvent = CustomEvent<{ reason: string }>;

declare global {
  interface HTMLElementEventMap {
    "mq-change": MailQuiltChangeEvent;
    "mq-error": MailQuiltErrorEvent;
  }

  interface HTMLElementTagNameMap {
    "mail-quilt": MailQuilt;
  }
}
