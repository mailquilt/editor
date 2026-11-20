import { createEditor, isSameDocument, loadDocument } from "@mailquilt/core";
import type {
  BlocksDocument,
  Command,
  Editor,
  RichTextDocument,
} from "@mailquilt/core";
import { blockLabel } from "@mailquilt/core/internal";
import { renderEmail } from "@mailquilt/renderer";
import { html, LitElement, nothing } from "lit";

import { createAnnouncements } from "./announcements.js";
import { blockContentStyles, hasRichText } from "./block-content.js";
import { createBlockDragging } from "./block-dragging.js";
import type { BlockDragging } from "./block-dragging.js";
import {
  MIN_EDITOR_WIDTH,
  renderFloatingToolbar,
  renderNarrowNotice,
  renderRows,
} from "./canvas.js";
import type { CanvasEvents, CanvasState } from "./canvas.js";
import { createEditingActions } from "./editing-actions.js";
import { findPlace } from "./editor-places.js";
import { createLinkForm, formatBarStyles } from "./format-bar.js";
import { createKeyDispatch } from "./key-dispatch.js";
import { keyLabel } from "./key-map.js";
import type { Action, Place } from "./key-map.js";
import { editorStyles } from "./mail-quilt-styles.js";
import type { PanelActions, PanelApi } from "./panel-api.js";
import { blocksIn } from "./places.js";
import { createPreview, previewStyles, renderPreview } from "./preview.js";
import { refuseFiles } from "./refuse-files.js";
import { createSelection } from "./selection.js";
import { createSettingsDrafts, settingsPanelStyles } from "./settings-panel.js";
import { renderSidePanel, sidePanelStyles } from "./side-panel.js";
import { styleProperties } from "./style-properties.js";
import { createTextBlockView } from "./text-block-view.js";
import type { TextBlockView } from "./text-block-view.js";
import type { TextFormats } from "./text-commands.js";
import { TEXT_SCHEMAS } from "./text-schema.js";
import { themeTokens, UI_LANG, uiStyles } from "./theme.js";
import { createToolPlacement } from "./tool-placement.js";
import type { ToolPlacement } from "./tool-placement.js";
import { createTooltips } from "./tooltips.js";
import type { Tooltips } from "./tooltips.js";
import { takeValueSetEarly } from "./value-set-early.js";

/** Typing after a gap this long starts a new undo step. */
const TYPING_PAUSE_MS = 1000;

/**
 * The keys for an action, for the Block key help, which a screen reader reads,
 * so each key is named as `aria-keyshortcuts` names it: "A, B, or C".
 */
const keysFor = (place: Place, action: Action) =>
  new Intl.ListFormat(UI_LANG, { type: "disjunction" }).format(
    keyLabel(place, action).shortcuts.split(" ")
  );
const EDIT_TEXT = keysFor("block", "editText");
const BACK_TO_BLOCK = keysFor("text", "backToBlock");
const FORMAT_BAR = keysFor("text", "focusFormatBar");
const SELECT_BLOCK = keysFor("block", "selectBlock");
const MOVE_BLOCK = keysFor("block", "moveBlock");

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
    onEnter: (value) => {
      // An image URL that failed may load now, so entering it again tries again.
      if (typeof value === "string" && this.#failedImages.delete(value)) {
        this.requestUpdate();
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
    dialog: () =>
      findPlace(this.renderRoot, "preview") as HTMLDialogElement | null,
    exportHtml: () => this.exportHtml(),
    requestUpdate: () => this.requestUpdate(),
  });
  /** Set while the element is connected. */
  #dragging: BlockDragging | undefined;
  /** Set while the element is connected, as it observes sizes on the page. */
  #toolPlacement: ToolPlacement | undefined;
  #tooltips: { element: HTMLElement; tooltips: Tooltips } | undefined;
  /** The last press began on the workspace itself, not after a drag from a Block. */
  #pressedOnWorkspace = false;
  /** Too narrow to edit in, as on a phone or in a narrow part of a page. */
  #narrow = false;
  /** Made on the page, as a server rendering the editor has no ResizeObserver. */
  #resizeObserver: ResizeObserver | undefined;

  readonly #announcements = createAnnouncements({
    document: () => this.#editor?.getDocument(),
    requestUpdate: () => this.requestUpdate(),
  });
  readonly #editing = createEditingActions({
    announcements: this.#announcements,
    apply: (command) => this.#apply(command),
    document: () => this.#editor?.getDocument(),
    selection: this.#selection,
  });
  readonly #keys = createKeyDispatch({
    canStep: (step) =>
      step === "undo"
        ? (this.#editor?.canUndo() ?? false)
        : (this.#editor?.canRedo() ?? false),
    drafts: this.#drafts,
    editing: this.#editing,
    isDragging: () => this.#dragging?.isDragging() ?? false,
    linkForm: this.#linkForm,
    previewIsOpen: () => this.#preview.isOpen,
    selection: this.#selection,
    stepHistory: (step) => this.#stepHistory(step),
  });

  /** Every change the Side panel, its settings and the toolbars make. */
  readonly #panelActions: PanelActions = {
    addBlock: (blockType, place) => this.#editing.addBlock(blockType, place),
    addRow: (layout) => this.#editing.addRow(layout),
    apply: (command) => this.#apply(command),
    cancelLink: () => this.#linkForm.cancel(),
    deleteBlock: (fromKeyboard) => this.#editing.deleteBlock(fromKeyboard),
    deleteRow: (rowId, fromKeyboard) =>
      this.#editing.deleteRow(rowId, fromKeyboard),
    insertLineBreak: () => this.#selection.selectedText?.insertLineBreak(),
    moveBlock: (direction) => this.#editing.moveBlock(direction),
    moveRow: (rowId, direction) => this.#editing.moveRow(rowId, direction),
    openLinkField: () => this.#linkForm.open(),
    openPreview: () => this.#preview.open(),
    removeLink: () => this.#linkForm.remove(),
    selectRow: (rowId) => this.#selection.selectRow(rowId),
    selectTab: (tab) => this.#selection.selectTab(tab),
    settings: this.#drafts.events,
    showTabs: () => this.#selection.showTabs(),
    stepHistory: (step) => this.#stepHistory(step),
    submitLink: (href) => this.#linkForm.submit(href),
    toggleMark: (mark) => this.#selection.selectedText?.toggleMark(mark),
  };

  readonly #canvasEvents: CanvasEvents = {
    onBlockClick: (blockId, target) =>
      this.#selection.onBlockClick(blockId, target),
    onBlockFocus: (blockId) => this.#selection.onBlockFocus(blockId),
    onBlockFocusout: () => this.#selection.onBlockFocusout(),
    onImageError: (src) => this.#onImageError(src),
  };

  protected override createRenderRoot() {
    const root = super.createRenderRoot();
    root.addEventListener("keydown", this.#keys.onKeydown);
    root.addEventListener("mousedown", (event) =>
      this.#selection.onMousedown(event as MouseEvent)
    );
    root.addEventListener(
      "wheel",
      (event) => this.#selection.onWheel(event as WheelEvent),
      { passive: true }
    );
    return root;
  }

  constructor() {
    super();
    // On the way in, because ProseMirror handles the key before it bubbles here.
    this.addEventListener("keydown", this.#keys.onKeydownCapture, {
      capture: true,
    });
    this.addEventListener("dragover", refuseFiles);
    this.addEventListener("drop", refuseFiles);
    takeValueSetEarly(this);
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
      onDrop: (source, place) => this.#editing.drop(source, place),
      root: this.renderRoot as ShadowRoot,
    });
    this.#toolPlacement = createToolPlacement(
      this.renderRoot as ShadowRoot,
      () => this.#tooltips?.tooltips.sync()
    );
    this.requestUpdate();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.#resizeObserver?.disconnect();
    this.#dragging?.destroy();
    this.#dragging = undefined;
    this.#toolPlacement?.destroy();
    this.#toolPlacement = undefined;
    this.#tooltips?.tooltips.destroy();
    this.#tooltips = undefined;
    this.#reset();
  }

  protected override willUpdate() {
    this.#rendered = this.value;
    const email = this.isConnected ? this.#rendered : undefined;
    const blocks = email ? blocksIn(email) : [];
    const blockIds = new Set(blocks.map(({ id }) => id));
    this.#selection.beforeUpdate(
      email && { blockIds, rowIds: new Set(email.rows.map(({ id }) => id)) }
    );
    // Lit still updates detached elements, and nothing would destroy these
    // views. connectedCallback requests an update that creates them instead.
    if (!this.isConnected) {
      return;
    }
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
            schema: TEXT_SCHEMAS[block.type],
          })
        );
      }
    }
    this.#removeViewsExcept(blockIds);
    for (const view of this.#views.values()) {
      view.setLang(this.#emailLang);
    }
  }

  protected override updated() {
    // First, so focus that moves scrolls to where the tools end up.
    this.#toolPlacement?.sync();
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
    const { settings } = document;
    const api = this.#panelApi(document);

    return html`
      ${renderPreview(this.#preview.shown, this.#preview.events)}
      ${this.#announcements.render()}
      <p hidden id="block-keys" lang=${UI_LANG}>
        Press ${EDIT_TEXT} to edit the text, and ${BACK_TO_BLOCK} to come back.
        In the text, press ${FORMAT_BAR} to reach its formatting. Press
        ${SELECT_BLOCK} to select another Block, and ${MOVE_BLOCK} to move this
        one.
      </p>
      <p hidden id="block-keys-no-text" lang=${UI_LANG}>
        Press ${SELECT_BLOCK} to select another Block, and ${MOVE_BLOCK} to move
        this one.
      </p>
      ${this.#narrow ? renderNarrowNotice(api) : nothing}
      <div
        class="ui frame editor"
        data-place="editor"
        data-testid="editor"
        lang=${UI_LANG}
        part="frame"
        ?data-collapsed=${this.#narrow}
        style=${styleProperties({ "--email-width": `${settings.width}px` })}
      >
        <div
          class="canvas-area"
          data-place="workspace"
          data-testid="workspace"
          @click=${this.#onWorkspaceClick}
          @pointerdown=${this.#onWorkspacePointerdown}
        >
          <div
            class="email"
            data-place="email"
            data-testid="email"
            @beforeinput=${this.#keys.onBeforeInput}
            style=${styleProperties({
              // Also for what's dragged, which has nothing behind it.
              "--_mq-email-background": settings.backgroundColor,
              "background-color": settings.backgroundColor,
              "font-family": settings.fontFamily,
              width: `${settings.width}px`,
            })}
          >
            ${renderRows(api, this.#canvasState, this.#canvasEvents)}
            <div
              class="drop-indicator"
              data-place="dropIndicator"
              data-testid="drop-indicator"
              hidden
            ></div>
          </div>
          ${renderFloatingToolbar(api)}
        </div>
        ${renderSidePanel(api)}
        <div
          class="ui tooltip"
          data-place="tooltip"
          hidden
          role="tooltip"
        ></div>
      </div>
    `;
  }

  /** What the Side panel, its settings and the toolbars show, and what they do. */
  #panelApi(email: BlocksDocument): PanelApi {
    return {
      ...this.#panelActions,
      canRedo: this.#editor?.canRedo() ?? false,
      canUndo: this.#editor?.canUndo() ?? false,
      editingText: this.#selection.editingText,
      email,
      formats: this.#formats,
      linkField: this.#linkForm.state,
      selectedBlock: this.#editing.selectedBlock(email),
      selectedRow: this.#editing.selectedRow(email),
      showsSettings: this.#selection.showsSettings,
      tab: this.#selection.tab,
    };
  }

  get #canvasState(): CanvasState {
    return {
      emailLang: this.#emailLang,
      failedImages: this.#failedImages,
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
    if (!editor) {
      return;
    }
    const could = { redo: editor.canRedo(), undo: editor.canUndo() };
    const result = editor.apply(command, { mergeKey });
    if (!result.ok) {
      if (!(result.code === "unchanged" || refusable)) {
        // The controls only offer what's allowed, so this is a bug here.
        console.error(`<mail-quilt> rejected a Command: ${result.reason}`);
      }
      return result;
    }
    // Undo and Redo show whether there's a step to take, typing included.
    if (
      render ||
      could.undo !== editor.canUndo() ||
      could.redo !== editor.canRedo()
    ) {
      this.requestUpdate();
    }
    this.#emitChange(editor.getDocument());
    return result;
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
    this.#selection.focus({ on: "emailTools" }, { focusVisible: false });
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

  /** A new render can replace the tooltip, along with everything else. */
  #syncTooltips(root: ShadowRoot) {
    const element = findPlace(root, "tooltip");
    if (element !== this.#tooltips?.element) {
      this.#tooltips?.tooltips.destroy();
      this.#tooltips = element
        ? { element, tooltips: createTooltips(root, element) }
        : undefined;
    }
    this.#tooltips?.tooltips.sync();
  }

  #stepHistory(step: "redo" | "undo") {
    const editor = this.#editor;
    if (!editor) {
      return;
    }
    if (!editor[step]()) {
      return;
    }
    // The change can move the selection the link field would apply to.
    this.#linkForm.close();
    // What was refused may be fine now, and the fields show what's come back.
    this.#drafts.clear();
    this.#editing.historyStepped(step);
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

  #show(document: BlocksDocument | undefined) {
    const hadFocus = Boolean(this.shadowRoot?.activeElement);
    this.#lastKnownDocument = document;
    this.#preview.forget();
    this.#announcements.clear();
    this.#drafts.clear();
    // A URL that failed before may load now, as its image may have been
    // uploading, or the connection down.
    this.#failedImages.clear();
    this.#reset();
    this.#editor = document && createEditor({ document });
    this.#editor?.subscribe(this.#editing.onOperations);
    this.requestUpdate();
    // Taking down the text views took focus out of the editor if it was in
    // one, before the update could see where it was.
    if (hadFocus && !this.shadowRoot?.activeElement) {
      this.#selection.focusWhenRendered({ on: "emailTools" });
    }
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
