import { isSameDocument, loadDocument } from "@mailquilt/core";
import type {
  BlocksDocument,
  Command,
  Editor,
  LoadResult,
  RichTextDocument,
} from "@mailquilt/core";
import {
  blockLabel,
  EMAIL_LOOK,
  editorOfLoaded,
} from "@mailquilt/core/internal";
import { renderEmail } from "@mailquilt/renderer";
import { css, html, LitElement, nothing, unsafeCSS } from "lit";
import type { PropertyValues } from "lit";

import { createAnnouncements } from "./announcements.js";
import { BLOCK_VIEWS, blockTypeStyles, hasRichText } from "./block-types.js";
import {
  canvasStyles,
  MIN_EDITOR_WIDTH,
  renderFloatingToolbar,
  renderNarrowNotice,
  renderRows,
} from "./canvas.js";
import type { CanvasEvents, CanvasState } from "./canvas.js";
import { createDragging } from "./dragging.js";
import type { Dragging } from "./dragging.js";
import { createEditingActions } from "./editing-actions.js";
import { findPlace, place } from "./editor-places.js";
import { createFieldMergeTags } from "./field-merge-tags.js";
import { createFocus } from "./focus.js";
import { createLinkForm, formatBarStyles } from "./format-bar.js";
import type { HostAppProperties } from "./host-app.js";
import { createImageUploads } from "./image-uploads.js";
import { createKeyDispatch } from "./key-dispatch.js";
import { keyLabel } from "./key-map.js";
import type { Action, KeyScope } from "./key-map.js";
import {
  mergeTagPickerStyles,
  showHighlightedTag,
} from "./merge-tag-picker.js";
import type { PanelApi } from "./panel-api.js";
import { blocksIn, locate } from "./positions.js";
import { createPresses } from "./presses.js";
import { createPreview, previewStyles, renderPreview } from "./preview.js";
import { createSelection } from "./selection.js";
import { createSettingsDrafts, settingsPanelStyles } from "./settings-panel.js";
import {
  blockDraftKey,
  renderSidePanel,
  sidePanelStyles,
} from "./side-panel.js";
import { styleProperties } from "./style-properties.js";
import { createTextBlockView, textBlockStyles } from "./text-block-view.js";
import type { ShownMergeTagPicker, TextBlockView } from "./text-block-view.js";
import type { TextFormats } from "./text-commands.js";
import { isMergeTagName } from "./text-schema.js";
import { themeTokens, UI_LANG, uiStyles } from "./theme.js";
import { createToolFitting } from "./tool-fitting.js";
import type { ToolFitting } from "./tool-fitting.js";
import { createTooltips } from "./tooltips.js";
import type { Tooltips } from "./tooltips.js";
import { takeValueSetEarly } from "./value-set-early.js";

/** Typing after a gap this long starts a new undo step. */
const TYPING_PAUSE_MS = 1000;

/**
 * The keys for an action, for the Block key help, which a screen reader reads,
 * so each key is named as `aria-keyshortcuts` names it: "A, B, or C".
 */
const keysFor = (scope: KeyScope, action: Action) =>
  new Intl.ListFormat(UI_LANG, { type: "disjunction" }).format(
    keyLabel(scope, action).shortcuts.split(" ")
  );
const EDIT_TEXT = keysFor("block", "editText");
const BACK_TO_BLOCK = keysFor("text", "backToBlock");
const FORMAT_BAR = keysFor("text", "focusFormatBar");
const SELECT_BLOCK = keysFor("block", "selectBlock");
const MOVE_BLOCK = keysFor("block", "moveBlock");

/** The element's own frame, the workspace, the email card and the drop line. */
const elementStyles = css`
  /* A column, so the editor fills any height the host gives the element. */
  :host {
    display: flex;
    flex-direction: column;
  }

  :host([hidden]) {
    display: none;
  }

  /*
   * The canvas, then the side panel docked on its right. In a host too narrow
   * for both, the panel goes below rather than squeeze the email. Clipped
   * rather than hidden, which would stop the panel and toolbar sticking.
   */
  .editor {
    /* Beside the email, room for a Block's tools and a Row's. */
    --_mq-gutter: 40px;
    --_mq-panel-width: 320px;
    /* Where the email and the panel stop fitting side by side. */
    --_mq-side-by-side: calc(
      var(--_mq-email-width) + 2 * var(--_mq-gutter) + var(--_mq-panel-width)
    );
    align-items: stretch;
    display: flex;
    overflow: clip;
    /* Fills any height the host gives, but never shrinks below the email. */
    flex: 1 0 auto;
    flex-wrap: wrap;
    min-height: 600px;
  }

  /*
   * Behind the notice for a host too narrow to edit in. Out of sight, but
   * still in the layout, so a host that takes the width of its content
   * keeps the width the editor gives it, and grows again with the window.
   * Every part hides, as the email card and the tools start their styles
   * again, and so none of them takes focus. Important, as otherwise a host's
   * size for ::part(frame), which the notice shares, would win here.
   */
  .editor[data-collapsed] {
    flex-grow: 0 !important;
    height: 0 !important;
    min-height: 0 !important;
  }

  .editor[data-collapsed],
  .editor[data-collapsed] * {
    visibility: hidden !important;
  }

  .canvas-area {
    background-color: var(--mq-color-workspace);
    display: flex;
    /* The email's own width, so the panel wraps before the email shrinks. */
    flex: 999 1 calc(var(--_mq-email-width) + 2 * var(--_mq-gutter));
    flex-direction: column;
    gap: var(--mq-space-5);
    /* Room for a selected Block's tools when the panel has gone below. */
    min-height: 480px;
    min-width: 0;
    /* Room for a Row's toolbar beside the email, and a Block's tag above. */
    padding: 56px var(--_mq-gutter) var(--mq-space-4);
  }

  /*
   * The email card: the email's own settings, and of the editor's tokens only
   * its shadow, on the workspace. Inherited properties cross the Shadow DOM
   * boundary, so hostile values on the host element stop here. Direction and
   * custom properties aren't reset by all, so the email takes the editor's:
   * left to right, as its export is, and the tokens for its outlines and tools.
   */
  .email {
    all: initial;
    box-shadow: var(--mq-shadow);
    box-sizing: border-box;
    color: #000000;
    display: block;
    font-size: ${unsafeCSS(EMAIL_LOOK.fontSize)};
    line-height: ${unsafeCSS(EMAIL_LOOK.lineHeight)};
    margin: 0 auto;
    max-width: 100%;
    position: relative;
  }

  .drop-indicator {
    background: var(--mq-color-accent);
    border-radius: 2px;
    box-shadow: 0 0 0 2px rgb(255 255 255 / 80%);
    height: 3px;
    margin-block-start: -1.5px;
    pointer-events: none;
    position: absolute;
    z-index: var(--_mq-layer-drop-indicator);
  }

  .drop-indicator::before,
  .drop-indicator::after {
    background: var(--mq-color-surface);
    border: 2px solid var(--mq-color-accent);
    border-radius: 50%;
    content: "";
    height: 9px;
    position: absolute;
    top: -3px;
    width: 9px;
  }

  .drop-indicator::before {
    left: -5px;
  }

  .drop-indicator::after {
    right: -5px;
  }

  /*
   * Forced colors drop the line's background, which is all it's drawn with.
   * The text's color stands out from the email in every palette.
   */
  @media (forced-colors: active) {
    .drop-indicator {
      background: CanvasText;
      forced-color-adjust: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .ui * {
      transition: none !important;
    }
  }
`;

export class MailQuilt extends LitElement implements HostAppProperties {
  static override properties = {
    // A React host gives a new list at each render, which only a change to
    // one of its tags redraws.
    mergeTags: {
      attribute: false,
      hasChanged: (
        next: HostAppProperties["mergeTags"],
        previous: HostAppProperties["mergeTags"]
      ) => JSON.stringify(next ?? []) !== JSON.stringify(previous ?? []),
    },
    // Only whether there's one changes what shows, and a React host may give
    // a new function at each render, such as on each key.
    uploadImage: {
      attribute: false,
      hasChanged: (next: unknown, previous: unknown) =>
        Boolean(next) !== Boolean(previous),
    },
  };

  static override styles = [
    themeTokens,
    uiStyles,
    settingsPanelStyles,
    sidePanelStyles,
    blockTypeStyles,
    formatBarStyles,
    mergeTagPickerStyles,
    previewStyles,
    elementStyles,
    canvasStyles,
    textBlockStyles,
  ];

  /** Lit's, which is this element's shadow root, as Lit attaches it. */
  declare readonly renderRoot: ShadowRoot;

  declare mergeTags: HostAppProperties["mergeTags"];
  declare uploadImage: HostAppProperties["uploadImage"];

  #editor: Editor | undefined;
  readonly #views = new Map<string, TextBlockView>();
  /** Edits in the same typing session merge into one undo step. */
  #typingSession = 0;
  #lastTypedAt = 0;
  #formats: TextFormats | undefined;
  #mergeTagPicker: ShownMergeTagPicker | undefined;
  readonly #mergeTagsGiven = () => this.mergeTags ?? [];
  readonly #focus = createFocus({
    requestUpdate: () => this.requestUpdate(),
    root: () => this.renderRoot,
    selectedBlockId: () => this.#selection.blockId,
    textOf: (blockId) => this.#views.get(blockId),
  });
  readonly #selection = createSelection({
    focus: this.#focus,
    onSelect: () => {
      this.#linkForm.close();
      this.#formats = this.#selection.selectedText?.formats();
      this.#mergeTagPicker = this.#selection.selectedText?.mergeTagPicker();
      this.requestUpdate();
    },
    requestUpdate: () => this.requestUpdate(),
    textOf: (blockId) => this.#views.get(blockId),
  });
  readonly #presses = createPresses({
    focus: this.#focus,
    selection: this.#selection,
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
    focusField: () => this.#focus.focusWhenRendered({ on: "linkField" }),
    focusText: () => this.#focus.focus({ on: "text" }),
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
  #dragging: Dragging | undefined;
  /** Set while the element is connected, as it observes sizes on the page. */
  #toolFitting: ToolFitting | undefined;
  #tooltips: { element: HTMLElement; tooltips: Tooltips } | undefined;
  /** Too narrow to edit in, as on a phone or in a narrow part of a page. */
  #narrow = false;
  /** Made on the page, as a server rendering the editor has no ResizeObserver. */
  #resizeObserver: ResizeObserver | undefined;

  readonly #announcements = createAnnouncements({
    email: () => this.#editor?.getDocument(),
    requestUpdate: () => this.requestUpdate(),
  });
  readonly #editing = createEditingActions({
    announcements: this.#announcements,
    apply: (command) => this.#apply(command),
    email: () => this.#editor?.getDocument(),
    focus: this.#focus,
    selection: this.#selection,
  });
  readonly #uploads = createImageUploads({
    addImageBlocks: (count, position) =>
      this.#editing.addBlocksAt("image", count, position),
    announcements: this.#announcements,
    email: () => this.#editor?.getDocument(),
    select: (blockId) => this.#selection.selectLanded(blockId),
    setImage: (blockId, src) => {
      const result = this.#apply(
        { blockId, props: { src }, type: "updateBlockProps" },
        { refusable: true }
      );
      // The field shows the new URL, rather than what was typed and refused,
      // and the canvas tries it again, as it may not have been there before.
      if (result?.ok || result?.code === "unchanged") {
        this.#drafts.forget(blockDraftKey(blockId, "src"));
        if (this.#failedImages.delete(src)) {
          this.requestUpdate();
        }
      }
      return result;
    },
    uploadImage: () => this.uploadImage,
  });
  readonly #uploadImage = (blockId: string, file: File) => {
    this.#uploads.upload(blockId, file);
  };
  readonly #fieldMergeTags = createFieldMergeTags({
    requestUpdate: () => this.requestUpdate(),
    tags: this.#mergeTagsGiven,
  });
  readonly #keys = createKeyDispatch({
    canStep: (step) =>
      step === "undo"
        ? (this.#editor?.canUndo() ?? false)
        : (this.#editor?.canRedo() ?? false),
    drafts: this.#drafts,
    editing: this.#editing,
    fieldMergeTags: this.#fieldMergeTags,
    focus: this.#focus,
    isDragging: () => this.#dragging?.isDragging() ?? false,
    linkForm: this.#linkForm,
    previewIsOpen: () => this.#preview.isOpen,
    selection: this.#selection,
    stepHistory: (step) => this.#stepHistory(step),
  });

  /** What the Side panel, its settings and the toolbars do, made once. */
  readonly #panelActions = {
    addBlock: (blockType, position) =>
      this.#editing.addBlock(blockType, position),
    addRow: (layout, fromKeyboard) =>
      this.#editing.addRow(layout, fromKeyboard),
    cancelLink: () => this.#linkForm.cancel(),
    deleteBlock: (fromKeyboard) => this.#editing.deleteBlock(fromKeyboard),
    deleteRow: (rowId, fromKeyboard) =>
      this.#editing.deleteRow(rowId, fromKeyboard),
    drafts: this.#drafts.fields,
    insertLineBreak: () => this.#selection.selectedText?.insertLineBreak(),
    moveBlock: (direction) => this.#editing.moveBlock(direction),
    moveRow: (rowId, direction) => this.#editing.moveRow(rowId, direction),
    openLinkField: () => this.#linkForm.open(),
    openPreview: () => this.#preview.open(),
    pickMergeTag: (index) => this.#selection.selectedText?.pickMergeTag(index),
    removeLink: () => this.#linkForm.remove(),
    selectRow: (rowId, fromKeyboard) =>
      this.#selection.selectRow(rowId, fromKeyboard),
    selectTab: (tab) => this.#selection.selectTab(tab),
    setRowLayout: (rowId, layout) => {
      this.#apply({ layout, rowId, type: "setRowLayout" });
    },
    showTabs: (fromKeyboard) => this.#selection.showTabs(fromKeyboard),
    stepHistory: (step) => this.#stepHistory(step),
    submitLink: (href) => this.#linkForm.submit(href),
    toggleMark: (mark) => this.#selection.selectedText?.toggleMark(mark),
  } satisfies Partial<PanelApi>;

  readonly #canvasEvents: CanvasEvents = {
    onBlockClick: (blockId, target) =>
      this.#selection.onBlockClick(blockId, target),
    onBlockFocus: (blockId) => {
      this.#linkForm.close();
      this.#selection.onBlockFocus(blockId);
    },
    onBlockFocusout: () => this.#selection.onBlockFocusout(),
    onImageError: (src) => this.#onImageError(src),
  };

  protected override createRenderRoot() {
    const root = super.createRenderRoot();
    root.addEventListener("keydown", this.#keys.onKeydown);
    // What's typed in a field, and where its cursor goes, for the Merge Tag
    // picker. A key that moves the cursor has moved it by its keyup.
    for (const type of ["click", "input", "keyup"]) {
      root.addEventListener(type, this.#fieldMergeTags.onFieldEvent);
    }
    root.addEventListener("focusout", (event) =>
      this.#fieldMergeTags.onFocusout(event as FocusEvent)
    );
    root.addEventListener("mousedown", (event) =>
      this.#presses.onMousedown(event as MouseEvent)
    );
    root.addEventListener(
      "wheel",
      (event) => this.#presses.onWheel(event as WheelEvent),
      { passive: true }
    );
    return root;
  }

  constructor() {
    super();
    // On the way in, because a Block's text answers a key before it bubbles here.
    this.addEventListener("keydown", this.#keys.onKeydownCapture, {
      capture: true,
    });
    takeValueSetEarly(this);
  }

  get value(): BlocksDocument | undefined {
    return this.#editor?.getDocument();
  }

  /**
   * A document with the same content as the current one changes nothing, so a
   * controlled host keeps its undo history and cursor. Any other document loads
   * and clears undo history. A document that can't be trusted fires `mq-error`,
   * and the current email stays as it was. Any value is checked, such as a
   * saved email read back from JSON, so any is allowed.
   */
  set value(value: unknown) {
    const current = this.#editor?.getDocument();
    // Checked first, because a controlled host does this after every keystroke.
    if (isSameDocument(value, current)) {
      return;
    }
    // Null too, which is what JSON.parse gives for nothing saved.
    if (value === undefined || value === null) {
      this.#show(undefined);
      return;
    }
    const loaded = loadDocument(value);
    if (!loaded.ok) {
      this.#emitError(loaded.reason);
      return;
    }
    // An older document only matches the current one once it has been migrated.
    if (!isSameDocument(loaded.document, current)) {
      this.#show(loaded);
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
    this.#dragging = createDragging({
      acceptsFiles: () => Boolean(this.uploadImage),
      onDrop: (source, position) => this.#editing.drop(source, position),
      onDropFiles: (files, target) => this.#uploads.drop(files, target),
      root: this.renderRoot,
      // As it's drawn, which a drag goes by.
      takesFiles: (blockId) => {
        const email = this.#rendered;
        return email ? locate(email, blockId)?.block.type === "image" : false;
      },
    });
    this.#toolFitting = createToolFitting({
      onMove: () => this.#tooltips?.tooltips.sync(),
      root: this.renderRoot,
    });
    this.requestUpdate();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.#resizeObserver?.disconnect();
    this.#dragging?.destroy();
    this.#dragging = undefined;
    this.#toolFitting?.destroy();
    this.#toolFitting = undefined;
    this.#tooltips?.tooltips.destroy();
    this.#tooltips = undefined;
    this.#reset();
  }

  protected override willUpdate(changed: PropertyValues<this>) {
    if (changed.has("mergeTags")) {
      for (const view of this.#views.values()) {
        view.showMergeTags();
      }
      this.#fieldMergeTags.showMergeTags();
      this.#syncFormats();
    }
    this.#rendered = this.value;
    const email = this.isConnected ? this.#rendered : undefined;
    const blocks = email ? blocksIn(email) : [];
    const blockIds = new Set(blocks.map(({ id }) => id));
    this.#focus.beforeUpdate();
    if (email) {
      this.#selection.beforeUpdate({
        blockIds,
        rowIds: new Set(email.rows.map(({ id }) => id)),
      });
    }
    // Lit still updates detached elements, and nothing would destroy these
    // views. connectedCallback requests an update that creates them instead.
    if (!this.isConnected) {
      return;
    }
    for (const block of blocks) {
      if (hasRichText(block) && !this.#views.has(block.id)) {
        const { canBold, schema } = BLOCK_VIEWS[block.type].text;
        this.#views.set(
          block.id,
          createTextBlockView({
            canBold,
            content: block.props.content,
            label: `${blockLabel(block.type)} Block`,
            mergeTags: this.#mergeTagsGiven,
            onChange: (next) => this.#commitText(block.id, next),
            onFocus: () => {
              // As on the Block: focus back in the text closes the link field.
              this.#linkForm.close();
              this.#selection.onTextFocus(block.id);
            },
            onKeyAnswered: (event) => this.#keys.onTextKeyAnswered(event),
            onPickerKey: (event) => this.#keys.onPickerKey(event),
            onStateChange: () => this.#syncFormats(),
            onTypingBreak: () => {
              this.#typingSession += 1;
            },
            schema,
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
    this.#toolFitting?.sync();
    this.#focus.afterUpdate();
    if (this.isConnected && this.shadowRoot) {
      this.#syncTooltips(this.shadowRoot);
      showHighlightedTag(this.shadowRoot);
    }
  }

  protected override render() {
    const email = this.#rendered;
    if (!email) {
      return nothing;
    }
    const { settings } = email;
    const api = this.#panelApi(email);

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
        data-place=${place("editor")}
        data-testid="editor"
        lang=${UI_LANG}
        part="frame"
        ?data-collapsed=${this.#narrow}
        style=${styleProperties({ "--_mq-email-width": `${settings.width}px` })}
      >
        <div
          class="canvas-area"
          data-place=${place("workspace")}
          data-testid="workspace"
          @click=${this.#presses.onWorkspaceClick}
          @pointerdown=${this.#presses.onWorkspacePointerdown}
        >
          <div
            class="email"
            data-place=${place("email")}
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
              data-place=${place("dropIndicator")}
              data-testid="drop-indicator"
              hidden
            ></div>
          </div>
          ${renderFloatingToolbar(api)}
        </div>
        ${renderSidePanel(api)}
        <div
          class="ui tooltip"
          data-place=${place("tooltip")}
          hidden
          role="tooltip"
        ></div>
      </div>
    `;
  }

  /** What the Side panel, its settings and the toolbars show, and what they do. */
  #panelApi(email: BlocksDocument): PanelApi {
    // Only with a tag the picker can offer.
    const offersTags =
      this.mergeTags?.some(({ name }) => isMergeTagName(name)) ?? false;
    return {
      ...this.#panelActions,
      canRedo: this.#editor?.canRedo() ?? false,
      canUndo: this.#editor?.canUndo() ?? false,
      editingText: this.#selection.editingText,
      email,
      fieldMergeTags: offersTags
        ? {
            pick: this.#pickFieldMergeTag,
            shown: this.#fieldMergeTags.shown,
          }
        : undefined,
      formats: this.#formats,
      insertMergeTag: offersTags ? this.#insertMergeTag : undefined,
      linkField: this.#linkForm.state,
      mergeTagPicker: this.#mergeTagPicker,
      selectedBlock: this.#editing.selectedBlock(email),
      selectedRow: this.#editing.selectedRow(email),
      showsSettings: this.#selection.showsSettings,
      tab: this.#selection.tab,
      uploadErrorOf: this.#uploads.errorOf,
      uploadImage: this.uploadImage ? this.#uploadImage : undefined,
    };
  }

  get #canvasState(): CanvasState {
    return {
      emailLang: this.#emailLang,
      failedImages: this.#failedImages,
      isUploading: this.#uploads.isUploading,
      textOf: (blockId) => this.#views.get(blockId)?.element,
    };
  }

  /**
   * On each Block's content. With none set, it's unknown, as in the export. A
   * Merge Tag is unknown too until it's filled, and isn't a language a screen
   * reader could read the Canvas in.
   */
  get #emailLang() {
    const language = this.#rendered?.settings.language ?? "";
    return language.startsWith("{{") ? "" : language;
  }

  readonly #insertMergeTag = () =>
    this.#selection.selectedText?.startMergeTag();

  readonly #pickFieldMergeTag = (index: number) =>
    this.#fieldMergeTags.pickMergeTag(index);

  /**
   * The formats and the Merge Tag picker the text shows. Re-renders only on a
   * change, because this runs on every transaction.
   */
  #syncFormats() {
    const text = this.#selection.selectedText;
    const formats = text?.formats();
    const picker = text?.mergeTagPicker();
    if (
      JSON.stringify([formats, picker]) !==
      JSON.stringify([this.#formats, this.#mergeTagPicker])
    ) {
      this.#formats = formats;
      this.#mergeTagPicker = picker;
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
        ? { element, tooltips: createTooltips({ root, tooltip: element }) }
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
    const email = editor.getDocument();
    for (const block of blocksIn(email)) {
      if (hasRichText(block)) {
        this.#views.get(block.id)?.setContent(block.props.content);
      }
    }
    // Undo and redo can add, remove or move Blocks, Columns and Rows.
    this.requestUpdate();
    this.#emitChange(email);
  }

  /** Opens an email that `loadDocument` accepted, or none. */
  #show(loaded: Extract<LoadResult, { ok: true }> | undefined) {
    const hadFocus = Boolean(this.shadowRoot?.activeElement);
    this.#preview.forget();
    this.#announcements.clear();
    this.#drafts.clear();
    // A URL that failed before may load now, as its image may have been
    // uploading, or the connection down.
    this.#failedImages.clear();
    // Their Blocks are gone with the email they were in.
    this.#uploads.clear();
    this.#reset();
    // Checked once, by the value's setter.
    this.#editor = loaded && editorOfLoaded(loaded);
    this.#editor?.subscribe(this.#editing.onOperations);
    this.#editor?.subscribe(this.#uploads.onChange);
    this.requestUpdate();
    // Taking down the text views took focus out of the editor if it was in
    // one, before the update could see where it was.
    if (hadFocus && !this.shadowRoot?.activeElement) {
      this.#focus.focusWhenRendered({ on: "emailTools" });
    }
  }

  /** With a copy of the email, which the host owns and may change. */
  #emitChange(email: BlocksDocument) {
    this.#preview.forget();
    this.dispatchEvent(
      new CustomEvent("mq-change", {
        bubbles: true,
        composed: true,
        detail: { document: email },
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
