import { createEditor, isSameDocument, loadDocument } from "@mailquilt/core";
import type {
  BlocksDocument,
  Command,
  Editor,
  Operation,
  RichTextDocument,
  RowLayout,
} from "@mailquilt/core";
import { blockLabel } from "@mailquilt/core/internal";
import { renderEmail } from "@mailquilt/renderer";
import { html, LitElement, nothing } from "lit";
import { keyed } from "lit/directives/keyed.js";
import { styleMap } from "lit/directives/style-map.js";

import { blockContentStyles, hasRichText } from "./block-content.js";
import { BLOCKS, createBlockDragging, dropCommand } from "./block-dragging.js";
import type { BlockDragging, DragSource, DropPlace } from "./block-dragging.js";
import {
  MIN_EDITOR_WIDTH,
  renderFloatingToolbar,
  renderNarrowNotice,
  renderRows,
} from "./canvas.js";
import type { CanvasEvents, CanvasState } from "./canvas.js";
import { createLinkForm, formatBarStyles } from "./format-bar.js";
import type { FormatBarEvents } from "./format-bar.js";
import { claim, historyInput, keyFor } from "./key-map.js";
import type { Action, Binding, Direction, Place } from "./key-map.js";
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
import { createSelection, focusToolbarButton } from "./selection.js";
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

/** The places in the editor that have keys of their own, the innermost first. */
const PLACES: [selector: string, place: Place][] = [
  [".link-form", "linkField"],
  [".format-bar", "formatBar"],
  [".ProseMirror", "text"],
  [".block-toolbar", "blockToolbar"],
  [BLOCKS, "block"],
  [".row-toolbar", "rowToolbar"],
  [".email", "email"],
  ['[role="tablist"]', "panelTabs"],
];

/** For a key whose press only needs keeping from the browser, or stopping. */
const doNothing = () => {
  // Nothing more.
};

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
  #panelTab: PanelTab = "content";
  #formats: TextFormats | undefined;
  readonly #selection = createSelection({
    onSelect: () => {
      this.#linkForm.close();
      this.#formats = this.#selection.selectedText?.formats();
      this.requestUpdate();
    },
    requestUpdate: () => this.requestUpdate(),
    root: () => this.renderRoot as ShadowRoot,
    textOf: (blockId) => this.#views.get(blockId),
    updateComplete: () => this.updateComplete,
  });
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
    editingText: () => this.#selection.editingText,
    focusField: () => this.#selection.focusWhenRendered({ on: "linkField" }),
    focusText: () => this.#selection.focus({ on: "text" }),
    requestUpdate: () => this.requestUpdate(),
    view: () => this.#selection.selectedText,
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
  /** The last key pressed, and where, before it was held down. */
  #lastPress: { key: string; target: EventTarget | undefined } | undefined;
  /** The last press began on the workspace itself, not after a drag from a Block. */
  #pressedOnWorkspace = false;
  /** Too narrow to edit in, as on a phone or in a narrow part of a page. */
  #narrow = false;
  /** Made on the page, as a server rendering the editor has no ResizeObserver. */
  #resizeObserver: ResizeObserver | undefined;

  readonly #sidePanelEvents: SidePanelEvents = {
    onAddBlock: (blockType) => this.#addBlock(blockType),
    onAddRow: (layout) => this.#addRow(layout),
    onBack: () => this.#selection.showTabs(this.#panelTab),
    onChooseLayout: (rowId, layout) =>
      this.#apply({ layout, rowId, type: "setRowLayout" }),
    onControlMousedown: (event) => this.#selection.onControlMousedown(event),
    onSelectTab: (tab) => this.#selectTab(tab),
    settings: this.#drafts.events,
  };

  readonly #formatBarEvents: FormatBarEvents = {
    ...this.#linkForm.events,
    onControlMousedown: (event) => this.#selection.onControlMousedown(event),
    onLineBreak: () => this.#selection.selectedText?.insertLineBreak(),
    onToggleMark: (mark) => this.#selection.selectedText?.toggleMark(mark),
  };

  readonly #canvasEvents: CanvasEvents = {
    formatBar: this.#formatBarEvents,
    onAddBlock: (blockType, place) => this.#addBlock(blockType, place),
    onBlockClick: (event) => this.#selection.onBlockClick(event),
    onBlockFocus: (blockId) => this.#selection.onBlockFocus(blockId),
    onBlockFocusout: () => this.#selection.onBlockFocusout(),
    onControlMousedown: (event) => this.#selection.onControlMousedown(event),
    onDeleteRow: (rowId, fromKeyboard) => this.#deleteRow(rowId, fromKeyboard),
    onDeleteSelectedBlock: (fromKeyboard) =>
      this.#deleteSelectedBlock(fromKeyboard),
    onHandleMousedown: (event) => this.#selection.onHandleMousedown(event),
    onImageError: (src) => this.#onImageError(src),
    onMoveRow: (rowId, direction) => this.#moveRow(rowId, direction),
    onMoveSelectedBlock: (direction) => this.#moveSelectedBlock(direction),
    onOpenPreview: (event) => this.#openPreview(event),
    onSelectRow: (rowId) => this.#selection.selectRow(rowId),
    onStepHistory: (step) => this.#stepHistory(step),
  };

  protected override createRenderRoot() {
    const root = super.createRenderRoot();
    root.addEventListener("keydown", this.#onKeydown);
    return root;
  }

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
    this.#rendered = this.value;
    this.#selection.beforeUpdate(this.isConnected ? this.#rendered : undefined);
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
            onFocus: () => this.#selection.onTextFocus(block.id),
            onStateChange: () => this.#syncFormats(),
            onTypingBreak: () => {
              this.#typingSession += 1;
            },
          })
        );
      }
    }
    this.#removeViewsExcept(new Set(blocks.map(({ id }) => id)));
    for (const view of this.#views.values()) {
      view.setLang(this.#emailLang);
    }
  }

  protected override updated() {
    this.#selection.afterUpdate();
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
        class="ui frame editor"
        lang=${UI_LANG}
        part="frame"
        ?data-collapsed=${this.#narrow}
        style=${styleMap({ "--email-width": `${settings.width}px` })}
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
            selectedRowId: this.#selection.rowId,
            showProperties: this.#selection.showsSettings,
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
      editingText: this.#selection.editingText,
      emailLang: this.#emailLang,
      failedImages: this.#failedImages,
      formatBar: { formats: this.#formats, linkForm: this.#linkForm.state },
      selectedBlockId: this.#selection.blockId,
      selectedRowId: this.#selection.rowId,
      textOf: (blockId) => this.#views.get(blockId)?.element,
    };
  }

  /** On each Block's content. With none set, it's unknown, as in the export. */
  get #emailLang() {
    return this.#rendered?.settings.language ?? "";
  }

  /** Re-renders only on a change, because this runs on every transaction. */
  #syncFormats() {
    const formats = this.#selection.selectedText?.formats();
    if (JSON.stringify(formats) !== JSON.stringify(this.#formats)) {
      this.#formats = formats;
      this.requestUpdate();
    }
  }

  async #openPreview({ currentTarget }: Event) {
    // Toolbar buttons don't take focus from a mouse press, and the dialog returns
    // focus to whatever had it.
    this.#selection.focusIfNone(currentTarget as HTMLElement);
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

  #selectedPosition(document: BlocksDocument) {
    const { blockId } = this.#selection;
    return blockId === undefined ? undefined : locate(document, blockId);
  }

  /** After the selected Block's Row, or else at the end, and selects it. */
  async #addRow(layout: RowLayout) {
    const document = this.#editor?.getDocument();
    if (!document) {
      return;
    }
    const selectedRow = document.rows.findIndex(
      ({ id }) => id === this.#selection.rowId
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
      await this.#selection.selectRow(result.createdId);
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
      (this.#selection.blockId === undefined &&
        this.#selection.rowId === undefined)
    ) {
      return;
    }
    this.#selection.select(undefined);
    this.#selection.focus({ on: "emailTools" }, {
      focusVisible: false,
    } as FocusOptions);
  }

  /** The ARIA tabs pattern: a tab that arrow keys move to shows its panel too. */
  #selectTab(tab: PanelTab) {
    if (tab !== this.#panelTab) {
      this.#panelTab = tab;
      this.requestUpdate();
    }
  }

  /**
   * From the keyboard, focus goes to the next Block, or else the one before, as
   * it would be lost. A button pressed with a key clicks with a `detail` of 0.
   */
  async #deleteSelectedBlock(fromKeyboard: boolean) {
    const document = this.#editor?.getDocument();
    const { blockId } = this.#selection;
    if (!document || blockId === undefined) {
      return;
    }
    const neighbour =
      neighbourBlockId(document, blockId, "down") ??
      neighbourBlockId(document, blockId, "up");
    if (this.#apply({ blockId, type: "removeBlock" })?.ok) {
      this.#announce("Block deleted.");
      if (fromKeyboard && neighbour !== undefined) {
        await this.#selection.focusWhenRendered({
          blockId: neighbour,
          on: "block",
        });
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
      if (fromKeyboard && neighbour) {
        await this.#selection.focusWhenRendered({
          on: "rowTool",
          rowId: neighbour.id,
        });
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
      await this.#selection.selectPlaced(result.createdId);
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
      document.rows.find(({ id }) => id === this.#selection.rowId)
        ?.columns[0] ?? document.rows.at(-1)?.columns.at(-1);
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
        await this.#selection.selectRow(result.createdId);
      }
      return;
    }
    if ("blockId" in source) {
      this.#announceMove(source.blockId);
    }
    await this.#selection.selectPlaced(
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
    if (this.#preview.isOpen || this.#selection.focusIsOutsideText) {
      event.preventDefault();
      return;
    }
    this.#runHistoryStep(event, historyInput(event));
  }

  /**
   * Heard on the way in, before a Block's text, which acts on a key before it
   * bubbles out. A held key's repeats count only where it was pressed.
   */
  readonly #onKeydownCapture = (event: KeyboardEvent) => {
    const [target] = event.composedPath();
    if (!event.repeat) {
      this.#lastPress = { key: event.key, target };
      return;
    }
    const binding =
      this.#lastPress?.key === event.key && this.#lastPress.target === target
        ? undefined
        : keyFor("heldElsewhere", event);
    if (binding) {
      claim(event, binding);
    }
  };

  /**
   * Every key pressed in the editor, once what it was pressed on, such as a
   * Block's text, has had it. The key map says what it does there.
   */
  readonly #onKeydown = (event: Event) => {
    const keydown = event as KeyboardEvent;
    const place = this.#placeOf(keydown);
    const binding =
      place &&
      keyFor(place, keydown, {
        dragging: this.#dragging?.isDragging() ?? false,
      });
    if (binding) {
      claim(keydown, binding);
      this.#keyActions[binding.action](keydown, binding);
    }
  };

  /** Where in the editor a key was pressed, if it's a place in the key map. */
  #placeOf(event: KeyboardEvent): Place | undefined {
    const target = event.target as Element;
    if (target.closest(".preview")) {
      return "preview";
    }
    // Such as the narrow notice.
    if (!target.closest(".editor")) {
      return;
    }
    const [, place] =
      PLACES.find(([selector]) => target.closest(selector)) ?? [];
    if (place) {
      return place;
    }
    return this.#drafts.draftKeyOf(event) === undefined
      ? "editor"
      : "settingsDraft";
  }

  /** What each action in the key map does here. */
  readonly #keyActions: Record<
    Action,
    (event: KeyboardEvent, binding: Binding) => void
  > = {
    backToBlock: () => this.#selection.focus({ on: "block" }),
    backToText: () => this.#selection.focus({ on: "text" }),
    // The drag hears this itself.
    cancelDrag: doNothing,
    cancelLink: () => this.#linkForm.events.onCancelLink(),
    // The browser closes the dialog.
    closePreview: doNothing,
    // The tooltips hear this themselves.
    closeTooltip: doNothing,
    discardDraft: (event) => this.#drafts.discard(event),
    editText: () => this.#selection.focus({ on: "text" }),
    firstButton: focusToolbarButton,
    focusFormatBar: () => this.#selection.focus({ on: "formatBar" }),
    ignore: doNothing,
    keepPage: doNothing,
    lastButton: focusToolbarButton,
    leaveToolbar: focusToolbarButton,
    moveBlock: (_event, { direction }) => {
      if (direction) {
        this.#moveSelectedBlock(direction);
      }
    },
    moveRow: ({ target }, { direction }) => {
      const rowId = (target as Element).closest<HTMLElement>(".row-frame")
        ?.dataset.rowId;
      if (rowId === undefined) {
        return;
      }
      if (direction === "up" || direction === "down") {
        this.#moveRow(rowId, direction);
      } else {
        this.#announce(`The Row can't move ${direction}.`);
      }
    },
    nextButton: focusToolbarButton,
    openLinkField: () => this.#linkForm.open(),
    previousButton: focusToolbarButton,
    redo: () => this.#stepHistory("redo"),
    selectBlock: (_event, { direction }) => {
      if (direction) {
        this.#selectNeighbour(direction);
      }
    },
    typeInField: doNothing,
    undo: () => this.#stepHistory("undo"),
  };

  #selectNeighbour(direction: Direction) {
    const document = this.#editor?.getDocument();
    const { blockId } = this.#selection;
    const next =
      document &&
      blockId !== undefined &&
      neighbourBlockId(document, blockId, direction);
    if (next) {
      this.#selection.focus({ blockId: next, on: "block" });
    }
  }

  #moveSelectedBlock(direction: Direction) {
    const document = this.#editor?.getDocument();
    const { blockId } = this.#selection;
    if (!document || blockId === undefined) {
      return;
    }
    const command = moveCommand(document, blockId, direction);
    if (command && this.#apply(command)?.ok) {
      this.#announceMove(blockId);
      this.#selection.revealBlock(blockId);
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
      this.#selection.revealRow(rowId);
    }
  }

  #announceRowMove(rowId: string, prefix = "Row moved to") {
    const rows = this.#editor?.getDocument().rows ?? [];
    const index = rows.findIndex(({ id }) => id === rowId);
    if (index !== -1) {
      this.#announce(`${prefix} ${positionLabel(index, rows.length)}.`);
    }
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
    if (blockId === this.#selection.blockId) {
      this.#selection.revealBlock(blockId);
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
    this.#selection.select(undefined);
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
