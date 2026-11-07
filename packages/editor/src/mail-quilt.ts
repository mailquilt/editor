import {
  BLOCK_TYPES,
  blockLabel,
  blockSettingsFields,
  blockStyles,
  createEditor,
  EMAIL_SETTINGS_FIELDS,
  findBlockPosition,
  INVALID_LINK,
  isAllowedLinkHref,
  isSameDocument,
  loadDocument,
  ROW_LAYOUTS,
  ROW_SETTINGS_FIELDS,
  rowLayoutOf,
  rowStyles,
} from "@mailquilt/core";
import type {
  Block,
  BlocksDocument,
  Column,
  Command,
  Editor,
  RichTextDocument,
  Row,
  RowLayout,
  SettingsField,
} from "@mailquilt/core";
import { renderEmail } from "@mailquilt/renderer";
import { css, html, LitElement, nothing } from "lit";
import { keyed } from "lit/directives/keyed.js";
import { repeat } from "lit/directives/repeat.js";
import { styleMap } from "lit/directives/style-map.js";

import { BLOCKS, createBlockDragging } from "./block-dragging.js";
import type { BlockDragging, DragSource, DropPlace } from "./block-dragging.js";
import {
  arrowDirection,
  columnLabel,
  moveCommand,
  neighbourBlockId,
  placeLabel,
  positionLabel,
} from "./block-keyboard.js";
import type { Direction } from "./block-keyboard.js";
import {
  draftKey,
  fieldText,
  fieldValue,
  renderSettingsPanel,
  settingsPanelStyles,
} from "./settings-panel.js";
import type { FieldDraft, SettingsSection } from "./settings-panel.js";
import { createTextBlockView } from "./text-block-view.js";
import type {
  TextBlockView,
  TextFormats,
  ToggleableMark,
} from "./text-block-view.js";

/** Typing after a gap this long starts a new undo step. */
const TYPING_PAUSE_MS = 1000;

const MARK_BUTTONS: { label: string; mark: ToggleableMark; text: string }[] = [
  { label: "Bold", mark: "bold", text: "B" },
  { label: "Italic", mark: "italic", text: "I" },
  { label: "Underline", mark: "underline", text: "U" },
];

const MOVE_BUTTONS: { direction: Direction; keys: string; text: string }[] = [
  { direction: "up", keys: "Alt+↑", text: "↑" },
  { direction: "down", keys: "Alt+↓", text: "↓" },
  { direction: "left", keys: "Alt+←", text: "←" },
  { direction: "right", keys: "Alt+→", text: "→" },
];

const NO_SELECTION_HINT = "Select a Block to change it and its Row.";

/** Whether a Block has text to edit on the canvas, and so a TextBlockView. */
const hasRichText = ({ type }: Pick<Block, "type">) =>
  type === "text" || type === "heading";

/** Layouts without Latin letters report their own, so use the key's position. */
const shortcutKey = (event: KeyboardEvent) =>
  /^[a-z]$/iu.test(event.key)
    ? event.key.toLowerCase()
    : event.code.replace("Key", "").toLowerCase();

const isLinkShortcut = (event: KeyboardEvent) =>
  !(event.isComposing || event.altKey || event.shiftKey) &&
  (event.metaKey || event.ctrlKey) &&
  shortcutKey(event) === "k";

const historyShortcut = (event: KeyboardEvent) => {
  if (event.isComposing || event.altKey) {
    return;
  }
  const key = shortcutKey(event);
  if (key === "z" && (event.metaKey || event.ctrlKey)) {
    return event.shiftKey ? "redo" : "undo";
  }
  if (key === "y" && event.ctrlKey && !event.metaKey && !event.shiftKey) {
    return "redo";
  }
};

/** WebKit can end a composition first, and then report the key as 229. */
const isComposing = (event: KeyboardEvent) =>
  event.isComposing || event.keyCode === 229;

const historyInput = (event: InputEvent) => {
  if (event.inputType === "historyUndo") {
    return "undo";
  }
  if (event.inputType === "historyRedo") {
    return "redo";
  }
};

/** The Command for a drop, which adds a Row if it landed outside any. */
const dropCommand = (source: DragSource, place: DropPlace): Command => {
  if ("blockId" in source) {
    return "columnId" in place
      ? { ...source, ...place, type: "moveBlock" }
      : { ...source, ...place, type: "moveBlockToNewRow" };
  }
  return "columnId" in place
    ? { ...source, ...place, type: "insertBlock" }
    : { ...source, ...place, type: "insertBlockInNewRow" };
};

/** One opening of the Preview. */
interface Preview {
  /** Unset while the email renders. */
  result?: { html: string } | { failure: string };
}

const renderPreviewContent = ({ result }: Preview) => {
  if (!result) {
    return html`<p role="status">Loading preview…</p>`;
  }
  return "html" in result
    ? html`
        <iframe sandbox="" srcdoc=${result.html} title="Email preview"></iframe>
      `
    : html`
        <p role="alert">The preview couldn't be loaded: ${result.failure}</p>
      `;
};

/**
 * A Button's face, and no link, because a click on the canvas selects it. Its
 * background belongs to this and not the whole Block, unlike a Block's other styles.
 */
const renderButton = (block: Block) => {
  const { "text-align": align, ...face } = blockStyles(block);
  return html`
    <div class="button-block" style=${styleMap({ "text-align": align })}>
      <span class="button" style=${styleMap(face)}>${block.props.label}</span>
    </div>
  `;
};

/**
 * The picture, and no link, because a click on the canvas selects it. A URL with a
 * Merge Tag has nothing to load until the email is sent, and a URL that failed
 * would otherwise collapse to nothing without alt text. Nor does a browser get to
 * drag the picture itself, which would take over from dragging the Block.
 */
const renderImage = (
  block: Block,
  failedImages: ReadonlySet<string>,
  onImageError: (src: string) => void
) => {
  const { alt = "", src } = block.props as { alt?: string; src?: string };
  const size = styleMap(blockStyles(block));
  const failed = src !== undefined && failedImages.has(src);
  return html`
    <div class="image-block">
      ${
        src === undefined || src.includes("{{") || failed
          ? html`
              <div class="image-placeholder" style=${size}>
                ${failed ? `Couldn't load ${src}` : (src ?? "No image URL yet")}
              </div>
            `
          : html`
              <img
                alt=${alt}
                draggable="false"
                src=${src}
                style=${size}
                @error=${() => onImageError(src)}
              />
            `
      }
    </div>
  `;
};

const renderDivider = (block: Block) => html`
  <div class="divider-block">
    <div class="divider" style=${styleMap(blockStyles(block))}></div>
  </div>
`;

const renderSpacer = (block: Block) =>
  html`<div class="spacer" style=${styleMap(blockStyles(block))}></div>`;

/** What a Block without text draws on the canvas. */
const renderBlockContent = (
  block: Block,
  failedImages: ReadonlySet<string>,
  onImageError: (src: string) => void
) => {
  switch (block.type) {
    case "button": {
      return renderButton(block);
    }
    case "image": {
      return renderImage(block, failedImages, onImageError);
    }
    case "divider": {
      return renderDivider(block);
    }
    case "spacer": {
      return renderSpacer(block);
    }
    default: {
      return nothing;
    }
  }
};

export class MailQuilt extends LitElement {
  static override styles = [
    settingsPanelStyles,
    css`
      :host {
        display: block;
      }

      /* Wraps the panel below the canvas once they don't both fit. */
      .workspace {
        all: initial;
        align-items: flex-start;
        display: flex;
        flex-wrap: wrap;
      }

      .canvas-area {
        flex-grow: 999;
        min-width: 0;
      }

      /*
     * Inherited properties cross the Shadow DOM boundary, so hostile values on
     * the host element stop here.
     */
      .email {
        all: initial;
        box-sizing: border-box;
        color: #000000;
        display: block;
        font-size: 16px;
        line-height: 1.5;
        margin: 0 auto;
        max-width: 100%;
        position: relative;
      }

      .drop-indicator {
        background: #2563eb;
        height: 3px;
        margin-block-start: -1.5px;
        pointer-events: none;
        position: absolute;
        z-index: 1;
      }

      .row {
        display: flex;
      }

      .column {
        min-width: 0;
      }

      .column.empty {
        align-content: center;
        align-items: center;
        /* So that the padding doesn't add to a width that matches the export's. */
        box-sizing: border-box;
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        justify-content: center;
        min-height: 56px;
        outline: 1px dashed #71717a;
        outline-offset: -1px;
        padding: 8px;
      }

      .block {
        position: relative;
      }

      /* Where a browser scrolls a focused Block to, clear of the sticky toolbar. */
      .block,
      .ProseMirror {
        scroll-margin-block-start: calc(var(--toolbar-height, 0px) + 8px);
      }

      .block[aria-current="true"] {
        outline: 2px solid #2563eb;
        outline-offset: -2px;
      }

      /* Stands out from a Block that's only selected, or whose text has focus. */
      .block:focus-visible {
        background-color: rgb(37 99 235 / 10%);
        outline: 3px solid #1d4ed8;
        outline-offset: -3px;
      }

      /* The Block that follows the pointer, which also shows what's under it. */
      .block[data-dnd-dragging] {
        background: #ffffff;
        box-shadow: 0 4px 12px rgb(0 0 0 / 25%);
        opacity: 0.8;
      }

      /*
     * Narrower than a Text Block's padding, so that a press on any text selects it
     * instead of dragging the Block.
     */
      .drag-handle {
        align-items: center;
        background: #e4e4e7;
        border-end-end-radius: 4px;
        color: #18181b;
        cursor: grab;
        display: flex;
        font:
          12px/1 system-ui,
          sans-serif;
        height: 24px;
        inset-block-start: 0;
        inset-inline-start: 0;
        justify-content: center;
        opacity: 0;
        position: absolute;
        touch-action: none;
        -webkit-user-select: none;
        user-select: none;
        width: 16px;
        z-index: 1;
      }

      .block:hover .drag-handle,
      .block[aria-current="true"] .drag-handle {
        opacity: 1;
        z-index: 2;
      }

      @media (hover: none) {
        .drag-handle {
          opacity: 1;
        }
      }

      /*
       * Only a thin Spacer's handle reaches past its Block. While it's hidden it
       * leaves that space alone. While it shows, it's on top, to be pressed.
       */
      @media (hover: hover) {
        .block:has(> .spacer):not(:hover, [aria-current="true"]) .drag-handle {
          pointer-events: none;
        }
      }

      [data-block-type] {
        touch-action: none;
      }

      /* Like the canvas, this stops inherited values from the email's settings. */
      .row-controls {
        all: initial;
        align-items: center;
        background: #f4f4f5;
        box-sizing: border-box;
        color: #18181b;
        display: flex;
        flex-wrap: wrap;
        font-family: system-ui, sans-serif;
        font-size: 12px;
        gap: 4px;
        justify-content: space-between;
        line-height: 1.5;
        padding: 2px 4px;
        /* Above a thin Spacer's click area, so that its buttons get clicks. */
        position: relative;
        z-index: 1;
      }

      .layouts {
        display: flex;
        flex-wrap: wrap;
        gap: 2px;
      }

      /* The same space as a Text Block's padding, as in the email output. */
      .button-block,
      .image-block,
      .divider-block {
        padding: 16px;
      }

      /* Like MJML: it fills the Column, and a width it's given stops at the Column. */
      .image-block img,
      .image-placeholder {
        box-sizing: border-box;
        display: block;
        margin-inline: auto;
        max-width: 100%;
        width: 100%;
      }

      .image-block img {
        height: auto;
        -webkit-user-select: none;
        user-select: none;
      }

      .image-placeholder {
        align-items: center;
        background: #f4f4f5;
        border: 1px dashed #71717a;
        color: #3f3f46;
        display: flex;
        font-size: 14px;
        justify-content: center;
        min-height: 96px;
        overflow-wrap: anywhere;
        padding: 8px;
        text-align: center;
        -webkit-user-select: none;
        user-select: none;
      }

      /* The color and width come from the Block, for the top border alone. */
      .divider {
        border-style: solid none none;
      }

      /* Nothing shows in the email, but a person has to be able to find it. */
      .spacer {
        outline: 1px dashed #71717a;
        outline-offset: -1px;
      }

      /* A thin one can still be clicked, without changing the space it takes up. */
      .spacer::before {
        content: "";
        /* Only as far as makes it 12px tall, so that a taller one takes nothing. */
        inset-block: min(0px, calc((100% - 12px) / 2));
        inset-inline: 0;
        position: absolute;
      }

      /* What MJML gives a button, so that the canvas looks like the email output. */
      .button {
        border-radius: 3px;
        display: inline-block;
        overflow-wrap: anywhere;
        padding: 10px 25px;
        /* MJML's table centers the lines of a label, wherever the Button sits. */
        text-align: center;
        -webkit-user-select: none;
        user-select: none;
      }

      /* ProseMirror's base styles (ADR 0002). */
      .ProseMirror {
        font-variant-ligatures: none;
        overflow-wrap: break-word;
        padding: 16px;
        position: relative;
        white-space: pre-wrap;
        white-space: break-spaces;
      }

      .ProseMirror:focus-visible {
        outline: 2px solid #2563eb;
        outline-offset: -2px;
      }

      .ProseMirror p {
        margin: 0;
      }

      .announcement {
        clip-path: inset(50%);
        height: 1px;
        overflow: hidden;
        position: absolute;
        white-space: nowrap;
        width: 1px;
      }

      /* Like the canvas, this stops inherited values from the host element. */
      .toolbar {
        all: initial;
        align-items: center;
        background: #ffffff;
        border-bottom: 1px solid #d4d4d8;
        box-sizing: border-box;
        color: #18181b;
        display: flex;
        flex-wrap: wrap;
        font-family: system-ui, sans-serif;
        font-size: 14px;
        gap: 4px;
        line-height: 1.5;
        padding: 4px;
        position: sticky;
        top: 0;
        z-index: 3;
      }

      .move-block {
        display: flex;
        gap: 2px;
      }

      /* Takes a line of its own before it would squeeze, as the link form needs. */
      .formatting {
        align-items: center;
        display: flex;
        flex: 1 1 auto;
        flex-wrap: wrap;
        gap: 4px;
        min-width: 0;
      }

      .toolbar button,
      .row-controls button,
      .add-block,
      .preview-header button {
        background: transparent;
        border: 1px solid transparent;
        border-radius: 4px;
        color: inherit;
        cursor: pointer;
        font: inherit;
        min-height: 28px;
        min-width: 28px;
        padding: 0 6px;
      }

      .toolbar button:hover:not(:disabled),
      .add-block:hover,
      .preview-header button:hover {
        background: #f4f4f5;
      }

      .row-controls button:hover {
        background: #e4e4e7;
      }

      .toolbar:focus-visible,
      .toolbar button:focus-visible,
      .toolbar input:focus-visible,
      .row-controls button:focus-visible,
      .add-block:focus-visible,
      .preview-header button:focus-visible {
        outline: 2px solid #2563eb;
        outline-offset: 1px;
      }

      .add-block {
        border-color: #71717a;
        font-family: system-ui, sans-serif;
        font-size: 12px;
      }

      .toolbar button[aria-pressed="true"],
      .row-controls button[aria-pressed="true"] {
        background: #e4e4e7;
        border-color: #71717a;
      }

      .toolbar button:disabled {
        color: #71717a;
        cursor: default;
      }

      .toolbar .bold {
        font-weight: 700;
      }

      .toolbar .italic {
        font-style: italic;
      }

      .toolbar .underline {
        text-decoration: underline;
      }

      .link-form {
        align-items: center;
        display: flex;
        flex-basis: 100%;
        flex-wrap: wrap;
        gap: 4px;
      }

      .link-form input {
        border: 1px solid #71717a;
        border-radius: 4px;
        box-sizing: border-box;
        color: inherit;
        font: inherit;
        margin-inline-start: 4px;
        min-height: 28px;
        padding: 0 6px;
        width: 20em;
      }

      .link-form p {
        color: #b91c1c;
        flex-basis: 100%;
        margin: 0;
      }

      /* A closed dialog relies on the browser's display: none, so no all: initial. */
      .preview {
        background: #ffffff;
        border: 0;
        border-radius: 8px;
        height: calc(100dvh - 32px);
        max-height: none;
        max-width: none;
        padding: 0;
        width: calc(100vw - 32px);
      }

      .preview::backdrop {
        background: rgb(0 0 0 / 50%);
      }

      /* Like the canvas, this stops inherited values from the host element. */
      .preview-panel {
        all: initial;
        box-sizing: border-box;
        color: #18181b;
        display: flex;
        flex-direction: column;
        font-family: system-ui, sans-serif;
        font-size: 14px;
        height: 100%;
        line-height: 1.5;
      }

      .preview-header {
        align-items: center;
        border-bottom: 1px solid #d4d4d8;
        display: flex;
        justify-content: space-between;
        padding: 4px 4px 4px 12px;
      }

      .preview-header h2 {
        font: inherit;
        font-weight: 600;
        margin: 0;
      }

      .preview-panel iframe {
        border: 0;
        flex: 1;
        min-height: 0;
        width: 100%;
      }

      .preview-panel > p {
        margin: 0;
        padding: 16px;
      }

      .preview-panel > p[role="alert"] {
        color: #b91c1c;
      }
    `,
  ];

  #editor: Editor | undefined;
  /** A private copy of the document last received from or sent to the host. */
  #lastKnownDocument: BlocksDocument | undefined;
  readonly #views = new Map<string, TextBlockView>();
  /** Edits in the same typing session merge into one undo step. */
  #typingSession = 0;
  #lastTypedAt = 0;
  /** The selected Block, which the toolbar acts on: the last one to have focus. */
  #activeBlockId: string | undefined;
  /** What had focus in the editor when the current update began. */
  #focusedBeforeUpdate: Element | null | undefined;
  #formats: TextFormats | undefined;
  /** Text in the settings panel that isn't the document's value. */
  readonly #drafts = new Map<string, FieldDraft>();
  /** Image URLs that didn't load, which the canvas stops trying to show. */
  readonly #failedImages = new Set<string>();
  /** Set while the link field is open. */
  #linkForm: { error: boolean } | undefined;
  /** Set while the Preview is open. */
  #preview: Preview | undefined;
  /** The current document's HTML, once the Preview has rendered it. */
  #previewHtml: string | undefined;
  /** Set while the element is connected and has rendered. */
  #dragging: BlockDragging | undefined;
  /** What the screen reader last heard about a move. */
  #announcement = "";
  /** Each announcement gets a new element, so the same words are read again. */
  #announcementId = 0;
  /** Where the Enter key now held down was pressed. */
  #enterPressedOn: EventTarget | undefined;
  #toolbarHeight = 0;
  /** The toolbar wraps at any width, and a Block has to scroll clear of it. */
  readonly #toolbarObserver = new ResizeObserver(([entry]) => {
    if (entry) {
      this.#toolbarHeight = entry.target.getBoundingClientRect().height;
      this.requestUpdate();
    }
  });
  #observedToolbar: Element | null = null;

  constructor() {
    super();
    // On the way in, because ProseMirror handles the key before it bubbles here.
    this.addEventListener("keydown", this.#onKeydownCapture, { capture: true });
  }

  get value() {
    return this.#editor?.getDocument();
  }

  /**
   * A document with the same content as the last one received or sent out
   * changes nothing, so a controlled host keeps its undo history and cursor. Any
   * other document loads and clears undo history. A document that can't be
   * trusted fires `mq-error`, and the current email stays as it was.
   */
  set value(document: BlocksDocument | undefined) {
    // Checked first, because a controlled host does this after every keystroke.
    if (isSameDocument(document, this.#lastKnownDocument)) {
      return;
    }
    if (document === undefined) {
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
    this.requestUpdate();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.#dragging?.destroy();
    this.#dragging = undefined;
    this.#toolbarObserver.disconnect();
    this.#observedToolbar = null;
    this.#destroyViews();
  }

  protected override willUpdate() {
    this.#focusedBeforeUpdate = this.shadowRoot?.activeElement;
    // Lit still updates detached elements, and nothing would destroy these
    // views. connectedCallback requests an update that creates them instead.
    if (!this.isConnected) {
      return;
    }
    const blockIds = new Set<string>();
    for (const row of this.value?.rows ?? []) {
      for (const column of row.columns) {
        for (const block of column.blocks) {
          blockIds.add(block.id);
          if (hasRichText(block) && !this.#views.has(block.id)) {
            this.#views.set(
              block.id,
              createTextBlockView({
                // A Heading is bold already, so the mark would change nothing.
                canBold: block.type !== "heading",
                content: block.props.content as RichTextDocument,
                label: `${blockLabel(block.type)} Block`,
                onChange: (next) => this.#commitText(block.id, next),
                onFocus: () => this.#selectBlock(block.id),
                onStateChange: () => this.#syncFormats(),
                onTypingBreak: () => {
                  this.#typingSession += 1;
                },
              })
            );
          }
        }
      }
    }
    this.#removeViewsExcept(blockIds);
  }

  /**
   * A change can remove the element with focus, or disable it. Focus stays in the
   * editor, where undo still works. A Block that just moved, or whose link field
   * just closed, gets it back, on the Block itself if that's where it was, so that
   * the next move works. Otherwise the toolbar takes it, because it does nothing
   * when a key that activated a button is pressed again or held down.
   */
  protected override updated() {
    const before = this.#focusedBeforeUpdate;
    const active = this.shadowRoot?.activeElement as
      | HTMLButtonElement
      | null
      | undefined;
    if (before && (!active || active.disabled)) {
      const block =
        before.matches(".block") && this.#activeBlockId !== undefined
          ? this.#blockElement(this.#activeBlockId)
          : undefined;
      const view = before.closest(".block, .link-form")
        ? this.#activeView
        : undefined;
      (
        block ??
        view ??
        this.renderRoot.querySelector<HTMLElement>(".toolbar")
      )?.focus();
    }
    this.#observeToolbar();
    if (this.isConnected && this.shadowRoot) {
      this.#dragging ??= createBlockDragging({
        onDrop: (source, place) => this.#drop(source, place),
        root: this.shadowRoot,
      });
      this.#dragging.sync();
    }
  }

  protected override render() {
    const document = this.value;
    if (!document) {
      return nothing;
    }
    const { rows, settings } = document;

    return html`
      ${this.#renderToolbar()} ${this.#renderPreview()}
      <div class="announcement" role="status">
        ${keyed(this.#announcementId, html`<span>${this.#announcement}</span>`)}
      </div>
      <p hidden id="block-keys">
        Press Enter to edit the text, and Escape to come back. Use arrow keys to
        select another Block, and Alt with arrow keys to move this one.
      </p>
      <p hidden id="block-keys-no-text">
        Use arrow keys to select another Block, and Alt with arrow keys to move
        this one.
      </p>
      <div
        class="workspace"
        style=${styleMap({ "--toolbar-height": `${this.#toolbarHeight}px` })}
      >
        <div
          class="canvas-area"
          style=${styleMap({ "flex-basis": `${settings.width}px` })}
        >
          <div
            class="email"
            lang=${settings.language ?? nothing}
            @beforeinput=${this.#onBeforeInput}
            @keydown=${this.#onKeydown}
            style=${styleMap({
              "background-color": settings.backgroundColor,
              "font-family": settings.fontFamily,
              width: `${settings.width}px`,
            })}
          >
            ${repeat(
              rows,
              (row) => row.id,
              (row, rowIndex) => html`
                ${this.#renderRowControls(row, rowIndex)}
                <div class="row" style=${styleMap(rowStyles(row))}>
                  ${repeat(
                    row.columns,
                    (column) => column.id,
                    (column, columnIndex) =>
                      this.#renderColumn(
                        column,
                        columnLabel(rowIndex, columnIndex)
                      )
                  )}
                </div>
              `
            )}
            <div class="drop-indicator" hidden></div>
          </div>
        </div>
        ${this.#renderSettings(document)}
      </div>
    `;
  }

  #renderRowControls(row: Row, index: number) {
    const current = rowLayoutOf(row);
    return html`
      <div
        aria-label=${`Row ${index + 1}`}
        class="row-controls"
        role="group"
        @mousedown=${this.#onControlMousedown}
      >
        <div aria-label="Layout" class="layouts" role="group">
          ${ROW_LAYOUTS.map(
            (layout) => html`
              <button
                aria-pressed=${layout === current ? "true" : "false"}
                type="button"
                @click=${() => this.#chooseLayout(row.id, layout, current)}
              >
                ${layout}
              </button>
            `
          )}
        </div>
        <button
          type="button"
          @click=${() => this.#apply({ rowId: row.id, type: "removeRow" })}
        >
          Delete Row
        </button>
      </div>
    `;
  }

  #renderColumn({ blocks, id, width }: Column, place: string) {
    return html`
      <div
        class=${blocks.length === 0 ? "column empty" : "column"}
        data-column-id=${id}
        style=${styleMap({ width: `${width}%` })}
      >
        ${repeat(
          blocks,
          (block) => block.id,
          (block, blockIndex) => html`
            <div
              aria-current=${block.id === this.#activeBlockId ? "true" : nothing}
              aria-describedby=${hasRichText(block) ? "block-keys" : "block-keys-no-text"}
              aria-label=${`${blockLabel(block.type)} Block, ${place}, ${positionLabel(blockIndex, blocks.length)}`}
              class="block"
              data-block-id=${block.id}
              role="group"
              style=${styleMap(hasRichText(block) ? blockStyles(block) : {})}
              tabindex="0"
              @focus=${(event: FocusEvent) =>
                this.#onBlockFocus(event, block.id)}
              @keydown=${this.#onBlockKeydown}
            >
              <div
                aria-hidden="true"
                class="drag-handle"
                title="Drag Block"
                @mousedown=${this.#onHandleMousedown}
              >
                ⋮⋮
              </div>
              ${hasRichText(block) ? this.#views.get(block.id)?.element : nothing}
              ${renderBlockContent(block, this.#failedImages, this.#onImageError)}
            </div>
          `
        )}
        ${
          blocks.length === 0
            ? BLOCK_TYPES.map(
                ({ label, type }) => html`
                  <button
                    aria-label=${`Add ${label} Block here, ${place}`}
                    class="add-block"
                    title=${`Add ${label} Block here`}
                    type="button"
                    @click=${() => this.#addBlock(type, { columnId: id, index: 0 })}
                  >
                    + ${label}
                  </button>
                `
              )
            : nothing
        }
      </div>
    `;
  }

  #renderToolbar() {
    const formats = this.#formats;
    return html`
      <div
        aria-label="Email tools"
        class="toolbar"
        role="group"
        tabindex="-1"
        @keydown=${this.#onToolbarKeydown}
        @mousedown=${this.#onControlMousedown}
      >
        <div aria-label="Add content" class="palette" role="group">
          ${BLOCK_TYPES.map(
            ({ label, type }) => html`
              <button
                data-block-type=${type}
                title=${`Add ${label} Block`}
                type="button"
                @click=${() => this.#addBlock(type)}
              >
                ${label}
              </button>
            `
          )}
        </div>
        <button type="button" @click=${this.#addRow}>Add Row</button>
        <button
          ?disabled=${this.#activeBlockId === undefined}
          type="button"
          @click=${this.#deleteSelectedBlock}
        >
          Delete Block
        </button>
        <div aria-label="Move Block" class="move-block" role="group">
          ${MOVE_BUTTONS.map(
            ({ direction, keys, text }) => html`
              <button
                aria-label=${`Move Block ${direction}`}
                ?disabled=${this.#activeBlockId === undefined}
                title=${`Move Block ${direction} (${keys})`}
                type="button"
                @click=${() => this.#moveSelectedBlock(direction)}
              >
                ${text}
              </button>
            `
          )}
        </div>
        <div aria-label="Text formatting" class="formatting" role="group">
          ${MARK_BUTTONS.map(
            ({ label, mark, text }) => html`
              <button
                aria-label=${label}
                aria-pressed=${formats?.[mark] ? "true" : "false"}
                class=${mark}
                ?disabled=${!formats || (mark === "bold" && !formats.canBold)}
                title=${label}
                type="button"
                @click=${() => this.#activeView?.toggleMark(mark)}
              >
                ${text}
              </button>
            `
          )}
          <button
            aria-pressed=${formats?.linkHref === undefined ? "false" : "true"}
            ?disabled=${!formats}
            type="button"
            @click=${this.#openLinkForm}
          >
            Link
          </button>
          <button
            ?disabled=${!formats}
            type="button"
            @click=${() => this.#activeView?.insertLineBreak()}
          >
            Line break
          </button>
          ${this.#linkForm ? this.#renderLinkForm(this.#linkForm.error) : nothing}
        </div>
        <button type="button" @click=${() => this.#stepHistory("undo")}>
          Undo
        </button>
        <button type="button" @click=${() => this.#stepHistory("redo")}>
          Redo
        </button>
        <button type="button" @click=${this.#openPreview}>Preview</button>
      </div>
    `;
  }

  #renderSettings(document: BlocksDocument) {
    const selected = this.#selectedPosition(document);
    const row = selected && document.rows[selected.rowIndex];
    const sections: SettingsSection[] = [];
    if (selected && row) {
      const { block } = selected;
      sections.push(
        {
          command: (props) => ({
            blockId: block.id,
            props,
            type: "updateProps",
          }),
          fields: blockSettingsFields(block),
          id: "block",
          legend: "Selected Block",
          targetId: block.id,
          values: block.props,
        },
        {
          command: (props) => ({
            props,
            rowId: row.id,
            type: "updateRowProps",
          }),
          fields: ROW_SETTINGS_FIELDS,
          id: "row",
          legend: "Row",
          targetId: row.id,
          unsetColor: document.settings.backgroundColor,
          values: row.props,
        }
      );
    }
    sections.push({
      command: (settings) => ({ settings, type: "updateEmailSettings" }),
      fields: EMAIL_SETTINGS_FIELDS,
      id: "email",
      legend: "Email",
      targetId: "",
      values: { ...document.settings },
    });
    return renderSettingsPanel(
      sections,
      selected ? undefined : NO_SELECTION_HINT,
      {
        draftOf: (key) => this.#drafts.get(key),
        onCommit: (section, field, control) =>
          this.#commitField(section, field, control),
        onInput: (section, field, { value }) =>
          this.#draftField(section, field, value),
        onKeydown: (event) => this.#onSettingsKeydown(event),
      }
    );
  }

  /**
   * The dialog stays rendered so that closing it, not removing it, returns focus.
   * An empty `sandbox` gives the email an opaque origin and no scripts, forms,
   * popups or top-level navigation.
   */
  #renderPreview() {
    const preview = this.#preview;
    return html`
      <dialog
        aria-labelledby="preview-title"
        class="preview"
        @close=${this.#onPreviewClose}
      >
        <div class="preview-panel">
          <div class="preview-header">
            <h2 id="preview-title">Preview</h2>
            <button type="button" @click=${this.#closePreview}>Close</button>
          </div>
          ${preview ? renderPreviewContent(preview) : nothing}
        </div>
      </dialog>
    `;
  }

  #renderLinkForm(error: boolean) {
    const href = this.#formats?.linkHref;
    return html`
      <form
        class="link-form"
        novalidate
        @keydown=${this.#onLinkFormKeydown}
        @submit=${this.#onLinkFormSubmit}
      >
        <label>
          Link URL
          <input
            aria-describedby=${error ? "link-error" : nothing}
            aria-invalid=${error ? "true" : "false"}
            autocomplete="off"
            name="href"
            spellcheck="false"
            type="text"
            value=${href ?? ""}
          />
        </label>
        <button type="submit">Apply</button>
        ${
          href === undefined
            ? nothing
            : html`
                <button type="button" @click=${this.#removeLink}>
                  Remove link
                </button>
              `
        }
        <button type="button" @click=${this.#cancelLinkForm}>Cancel</button>
        ${
          error
            ? html`<p id="link-error" role="alert">${INVALID_LINK}</p>`
            : nothing
        }
      </form>
    `;
  }

  get #activeView() {
    return this.#activeBlockId === undefined
      ? undefined
      : this.#views.get(this.#activeBlockId);
  }

  /** Firefox's scroll on focus leaves a Block that's partly in view where it is. */
  #onBlockFocus({ currentTarget }: FocusEvent, blockId: string) {
    this.#selectBlock(blockId);
    (currentTarget as HTMLElement).scrollIntoView({ block: "nearest" });
  }

  #selectBlock(blockId: string) {
    this.#activeBlockId = blockId;
    this.#closeLinkForm();
    this.#syncFormats();
    this.requestUpdate();
  }

  /** Re-renders only on a change, because this runs on every transaction. */
  #syncFormats() {
    const formats = this.#activeView?.formats();
    if (JSON.stringify(formats) !== JSON.stringify(this.#formats)) {
      this.#formats = formats;
      this.requestUpdate();
    }
  }

  async #openLinkForm() {
    if (!this.#activeView) {
      return;
    }
    this.#linkForm = { error: false };
    this.requestUpdate();
    await this.updateComplete;
    const input =
      this.renderRoot.querySelector<HTMLInputElement>(".link-form input");
    input?.focus();
    input?.select();
  }

  #closeLinkForm() {
    if (this.#linkForm) {
      this.#linkForm = undefined;
      this.requestUpdate();
    }
  }

  #cancelLinkForm() {
    this.#closeLinkForm();
    this.#activeView?.focus();
  }

  #removeLink() {
    this.#closeLinkForm();
    this.#activeView?.removeLink();
  }

  #onLinkFormKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      this.#cancelLinkForm();
    }
  }

  #onLinkFormSubmit(event: SubmitEvent) {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const href = String(new FormData(form).get("href")).trim();
    if (!isAllowedLinkHref(href)) {
      this.#linkForm = { error: true };
      this.requestUpdate();
      return;
    }
    this.#closeLinkForm();
    this.#activeView?.setLink(href);
  }

  get #previewDialog() {
    return this.renderRoot.querySelector<HTMLDialogElement>(".preview");
  }

  /** Shows the document as it is now, compiling it only if it has changed. */
  async #openPreview({ currentTarget }: Event) {
    // Toolbar buttons don't take focus from a mouse press, and the dialog returns
    // focus to whatever had it.
    if (!this.shadowRoot?.activeElement) {
      (currentTarget as HTMLElement).focus();
    }

    const cached = this.#previewHtml;
    const preview: Preview = {};
    if (cached !== undefined) {
      preview.result = { html: cached };
    }
    this.#preview = preview;
    this.#previewDialog?.showModal();
    this.requestUpdate();
    if (cached !== undefined) {
      return;
    }

    try {
      const email = await this.exportHtml();
      preview.result = { html: email };
      // Closed in the meantime, so the document may have changed since.
      if (this.#preview === preview) {
        this.#previewHtml = email;
      }
    } catch (error) {
      console.error("<mail-quilt> couldn't render the preview", error);
      preview.result = {
        failure: error instanceof Error ? error.message : String(error),
      };
    }
    this.requestUpdate();
  }

  #closePreview() {
    this.#previewDialog?.close();
  }

  #onPreviewClose() {
    // This event is queued, so it can arrive after the next opening.
    if (this.#previewDialog?.open) {
      return;
    }
    this.#preview = undefined;
    this.requestUpdate();
  }

  /** Applies a Command that changes the structure of the email. */
  #apply(command: Command) {
    if (this.#tryCommand(command)) {
      this.#publishStructure();
    }
  }

  readonly #onImageError = (src: string) => {
    this.#failedImages.add(src);
    this.requestUpdate();
  };

  /** The accepted result, leaving the caller to show and report the change. */
  #tryCommand(command: Command) {
    const result = this.#editor?.apply(command);
    if (result && !result.ok && !result.unchanged) {
      // The controls only offer what's allowed, so this is a bug here.
      console.error(`<mail-quilt> rejected a Command: ${result.reason}`);
    }
    return result?.ok ? result : undefined;
  }

  #publishStructure() {
    const document = this.#editor?.getDocument();
    if (document) {
      this.requestUpdate();
      this.#emitChange(document);
    }
  }

  #draftField(section: SettingsSection, field: SettingsField, text: string) {
    const key = draftKey(section, field);
    const refused = this.#drafts.get(key)?.refused ?? false;
    if (text === fieldText(field, section.values) && !refused) {
      this.#drafts.delete(key);
    } else {
      this.#drafts.set(key, { refused, text });
    }
  }

  /** Each commit is one undo step. What can't be accepted stays to be fixed. */
  #commitField(
    section: SettingsSection,
    field: SettingsField,
    control: HTMLInputElement | HTMLSelectElement
  ) {
    const key = draftKey(section, field);
    // Rejections are expected here, as they're what a person typed.
    const result = this.#editor?.apply(
      section.command({ [field.key]: fieldValue(field, control) })
    );
    if (result?.ok || result?.unchanged) {
      this.#drafts.delete(key);
    } else {
      this.#drafts.set(key, { refused: true, text: control.value });
    }
    if (result?.ok) {
      this.#publishStructure();
      this.#retryRefusedFields(section);
    } else {
      this.requestUpdate();
    }
  }

  /** A change to one field can make what another was refused for fine. */
  #retryRefusedFields(section: SettingsSection) {
    for (const field of section.fields) {
      const key = draftKey(section, field);
      const control = this.renderRoot.querySelector<HTMLInputElement>(
        `[data-draft-key="${CSS.escape(key)}"]`
      );
      if (control && this.#drafts.get(key)?.refused) {
        this.#commitField(section, field, control);
      }
    }
  }

  /**
   * Text being typed has the field's own undo, like the link field. Otherwise undo
   * is the email's, as everywhere else, and Escape takes back what was typed.
   */
  #onSettingsKeydown(event: KeyboardEvent) {
    const { dataset } = event.target as HTMLElement;
    const key = dataset.draftKey;
    if (key !== undefined && this.#drafts.has(key)) {
      if (event.key === "Escape" && !isComposing(event)) {
        event.preventDefault();
        event.stopPropagation();
        this.#drafts.delete(key);
        this.requestUpdate();
      }
      return;
    }
    this.#runHistoryStep(event, historyShortcut(event));
  }

  #chooseLayout(
    rowId: string,
    layout: RowLayout,
    current: RowLayout | undefined
  ) {
    if (layout !== current) {
      this.#apply({ layout, rowId, type: "setRowLayout" });
    }
  }

  #selectedPosition(document: BlocksDocument) {
    return this.#activeBlockId === undefined
      ? undefined
      : findBlockPosition(document, this.#activeBlockId);
  }

  #addRow() {
    const document = this.#editor?.getDocument();
    if (!document) {
      return;
    }
    const selected = this.#selectedPosition(document);
    this.#apply({
      index: selected ? selected.rowIndex + 1 : document.rows.length,
      layout: "100",
      type: "insertRow",
    });
  }

  #deleteSelectedBlock() {
    if (this.#activeBlockId !== undefined) {
      this.#apply({ blockId: this.#activeBlockId, type: "removeBlock" });
    }
  }

  /**
   * Adds a Block and selects it, ready to type in if it has text. By default it
   * goes after the selected Block, or else at the end of the last Column.
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
    const block = this.#tryCommand(
      target
        ? { blockType, ...target, type: "insertBlock" }
        : { blockType, rowIndex: 0, type: "insertBlockInNewRow" }
    );
    if (block) {
      await this.#showPlaced(block.createdId);
    }
  }

  /**
   * Reports a change that put a Block in place, then selects it, in its text if
   * it has any.
   */
  async #showPlaced(blockId: string | undefined) {
    this.#activeBlockId = blockId;
    this.#publishStructure();
    await this.updateComplete;
    if (this.#activeView) {
      this.#activeView.focus();
    } else if (blockId !== undefined) {
      this.#blockElement(blockId)?.focus();
    }
  }

  #defaultBlockPlace(editor: Editor) {
    const document = editor.getDocument();
    const selected = this.#selectedPosition(document);
    if (selected) {
      return { columnId: selected.columnId, index: selected.index + 1 };
    }
    const column = document.rows.at(-1)?.columns.at(-1);
    return column && { columnId: column.id, index: column.blocks.length };
  }

  async #drop(source: DragSource, place: DropPlace) {
    const result = this.#tryCommand(dropCommand(source, place));
    if (!result) {
      return;
    }
    if ("blockId" in source) {
      this.#announceMove(source.blockId);
    }
    await this.#showPlaced(
      "blockId" in source ? source.blockId : result.createdId
    );
  }

  #commitText(blockId: string, content: RichTextDocument) {
    const editor = this.#editor;
    if (!editor) {
      return;
    }
    const now = performance.now();
    if (now - this.#lastTypedAt >= TYPING_PAUSE_MS) {
      this.#typingSession += 1;
    }
    this.#lastTypedAt = now;
    const result = editor.apply(
      { blockId, props: { content }, type: "updateProps" },
      { mergeKey: `${blockId}:${this.#typingSession}` }
    );
    if (!result.ok) {
      if (!result.unchanged) {
        // Tiptap's schema should be no wider than core's, so this is a bug here.
        console.error(`<mail-quilt> rejected an edit: ${result.reason}`);
      }
      return;
    }
    this.#emitChange(editor.getDocument());
  }

  #onBeforeInput(event: InputEvent) {
    // WebKit types into a Block's selection, and undoes there too, even with focus
    // on the dialog, a control, the link field or the Block itself.
    const active = this.shadowRoot?.activeElement;
    if (
      this.#previewDialog?.open ||
      (active && !active.closest(".ProseMirror"))
    ) {
      event.preventDefault();
      return;
    }
    this.#runHistoryStep(event, historyInput(event));
  }

  #onKeydown(event: KeyboardEvent) {
    if (isLinkShortcut(event)) {
      // Browsers use this one to focus their search or address bar.
      event.preventDefault();
      this.#openLinkForm();
      return;
    }
    this.#runHistoryStep(event, historyShortcut(event));
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
   * These act only with focus on the Block itself. In its text, the same keys move
   * the cursor, by word with Alt on macOS, and Enter starts a new paragraph.
   */
  #onBlockKeydown(event: KeyboardEvent) {
    // Escape cancels a drag, and the cursor stays where it was.
    if (this.#dragging?.isDragging()) {
      return;
    }
    const block = event.currentTarget as HTMLElement;
    if (event.target !== block) {
      if (event.key === "Escape" && !isComposing(event)) {
        event.preventDefault();
        // This one is used up, so a host's dialog stays open. Pressed again on the
        // Block, it reaches the host.
        event.stopPropagation();
        block.focus();
      }
      return;
    }
    if (event.key === "Enter") {
      // Otherwise the new paragraph lands in the text that just took focus.
      event.preventDefault();
      this.#activeView?.focus();
      return;
    }
    const direction = arrowDirection(event);
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
    const blockId = this.#activeBlockId;
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
    const blockId = this.#activeBlockId;
    if (!document || blockId === undefined) {
      return;
    }
    const command = moveCommand(document, blockId, direction);
    if (!command) {
      this.#announce(`The Block can't move ${direction}.`);
      return;
    }
    if (this.#tryCommand(command)) {
      this.#announceMove(blockId);
      this.#publishStructure();
      this.#revealBlock(blockId);
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

  /**
   * Focus alone doesn't do this. A Block keeps focus if its neighbour is what moves
   * in the DOM, and focusing its text doesn't scroll.
   */
  async #revealBlock(blockId: string) {
    await this.updateComplete;
    this.#blockElement(blockId)?.scrollIntoView({ block: "nearest" });
  }

  #observeToolbar() {
    const toolbar = this.isConnected
      ? this.renderRoot.querySelector(".toolbar")
      : null;
    if (toolbar !== this.#observedToolbar) {
      this.#toolbarObserver.disconnect();
      if (toolbar) {
        this.#toolbarObserver.observe(toolbar);
      }
      this.#observedToolbar = toolbar;
    }
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
   */
  #onControlMousedown(event: MouseEvent) {
    const { target } = event;
    if (target instanceof HTMLInputElement) {
      return;
    }
    event.preventDefault();
    this.#commitFocusedField();
    if (!this.shadowRoot?.activeElement && target instanceof Element) {
      target.closest("button")?.focus();
    }
  }

  /**
   * Leaves focus and the selection where they are. With no focus in the editor,
   * the toolbar takes it, because keyboard undo only reaches the editor from inside.
   */
  #onHandleMousedown(event: MouseEvent) {
    event.preventDefault();
    this.#commitFocusedField();
    if (!this.shadowRoot?.activeElement) {
      this.renderRoot.querySelector<HTMLElement>(".toolbar")?.focus();
    }
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

  /** Undo and redo from a toolbar button, where a Block may no longer have focus. */
  #onToolbarKeydown(event: KeyboardEvent) {
    // The link field has its own undo for what's being typed in it.
    if (!(event.target instanceof HTMLInputElement)) {
      this.#runHistoryStep(event, historyShortcut(event));
    }
  }

  #runHistoryStep(event: Event, step: "redo" | "undo" | undefined) {
    if (!step) {
      return;
    }
    // The browser's own undo would change the text behind the document's back.
    event.preventDefault();
    this.#stepHistory(step);
  }

  #stepHistory(step: "redo" | "undo") {
    const editor = this.#editor;
    if (!editor) {
      return;
    }
    let moved: string[] = [];
    const stopListening = editor.subscribe((operations) => {
      moved = operations.flatMap((operation) =>
        operation.type === "move" ? [operation.blockId] : []
      );
    });
    const changed = editor[step]();
    stopListening();
    if (!changed) {
      return;
    }
    // The change can move the selection the link field would apply to.
    this.#closeLinkForm();
    // What was refused may be fine now, and the fields show what's come back.
    this.#drafts.clear();
    this.#announceHistoryStep(step, moved);
    const document = editor.getDocument();
    for (const row of document.rows) {
      for (const column of row.columns) {
        for (const block of column.blocks) {
          this.#views
            .get(block.id)
            ?.setContent(block.props.content as RichTextDocument);
        }
      }
    }
    // Undo and redo can add, remove or move Blocks, Columns and Rows.
    this.requestUpdate();
    this.#emitChange(document);
  }

  /** One Block moved, or nothing to say. A layout can move many at once. */
  #announceHistoryStep(step: "redo" | "undo", moved: string[]) {
    const [blockId] = moved;
    if (blockId === undefined || moved.length > 1) {
      this.#announce("");
      return;
    }
    this.#announceMove(
      blockId,
      `${step === "undo" ? "Undo" : "Redo"} moved a Block to`
    );
    if (blockId === this.#activeBlockId) {
      this.#revealBlock(blockId);
    }
  }

  #show(document: BlocksDocument | undefined) {
    this.#lastKnownDocument = document;
    this.#previewHtml = undefined;
    this.#announcement = "";
    this.#drafts.clear();
    this.#destroyViews();
    this.#editor = document && createEditor({ document });
    this.requestUpdate();
  }

  #emitChange(document: BlocksDocument) {
    // A copy, because the host owns what it receives and may change it.
    this.#lastKnownDocument = structuredClone(document);
    this.#previewHtml = undefined;
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
    if (
      this.#activeBlockId !== undefined &&
      !blockIds.has(this.#activeBlockId)
    ) {
      this.#activeBlockId = undefined;
      this.#formats = undefined;
      this.#linkForm = undefined;
    }
  }

  #destroyViews() {
    for (const view of this.#views.values()) {
      view.destroy();
    }
    this.#views.clear();
    // The toolbar's state describes those views and their selections.
    this.#activeBlockId = undefined;
    this.#formats = undefined;
    this.#linkForm = undefined;
    // The Preview shows the old document. A removed dialog also stays `open`, so
    // it would come back without being modal.
    if (this.#preview) {
      this.#previewDialog?.close();
      this.#preview = undefined;
    }
  }
}

if (!customElements.get("mail-quilt")) {
  customElements.define("mail-quilt", MailQuilt);
}

declare global {
  interface HTMLElementEventMap {
    "mq-change": CustomEvent<{ document: BlocksDocument }>;
    "mq-error": CustomEvent<{ reason: string }>;
  }

  interface HTMLElementTagNameMap {
    "mail-quilt": MailQuilt;
  }
}
