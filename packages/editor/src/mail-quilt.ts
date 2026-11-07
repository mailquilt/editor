import {
  createEditor,
  findBlockPosition,
  isAllowedLinkHref,
  isSameDocument,
  loadDocument,
  ROW_LAYOUTS,
  rowLayoutOf,
} from "@mailquilt/core";
import type {
  ApplyOptions,
  BlocksDocument,
  Column,
  Command,
  Editor,
  RichTextDocument,
  Row,
  RowLayout,
} from "@mailquilt/core";
import { renderEmail } from "@mailquilt/renderer";
import { css, html, LitElement, nothing } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { styleMap } from "lit/directives/style-map.js";

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

/** Joins the Row made for a Block in an email with no Rows to that Block's step. */
const FIRST_BLOCK_MERGE_KEY = "first-block";

const INVALID_LINK_MESSAGE =
  "Use a URL starting with https://, http://, mailto: or tel:, or a Merge Tag such as {{cta_url}}.";

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

const historyInput = (event: InputEvent) => {
  if (event.inputType === "historyUndo") {
    return "undo";
  }
  if (event.inputType === "historyRedo") {
    return "redo";
  }
};

/** Pressing a toolbar button leaves focus and the selection in the Block. */
const keepFocusInBlock = (event: MouseEvent) => {
  if (!(event.target instanceof HTMLInputElement)) {
    event.preventDefault();
  }
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

export class MailQuilt extends LitElement {
  static override styles = css`
    :host {
      display: block;
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
    }

    .row {
      display: flex;
    }

    .column {
      min-width: 0;
    }

    .column.empty {
      align-items: center;
      display: flex;
      justify-content: center;
      min-height: 56px;
      outline: 1px dashed #71717a;
      outline-offset: -1px;
    }

    .block[aria-current="true"] {
      outline: 2px solid #2563eb;
      outline-offset: -2px;
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
    }

    .layouts {
      display: flex;
      flex-wrap: wrap;
      gap: 2px;
    }

    .add-block {
      font-family: system-ui, sans-serif;
      font-size: 12px;
      margin: 8px;
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
      z-index: 1;
    }

    .formatting {
      align-items: center;
      display: flex;
      flex: 1;
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
  `;

  #editor: Editor | undefined;
  /** A private copy of the document last received from or sent to the host. */
  #lastKnownDocument: BlocksDocument | undefined;
  readonly #views = new Map<string, TextBlockView>();
  /** Edits in the same typing session merge into one undo step. */
  #typingSession = 0;
  #lastTypedAt = 0;
  /** The selected Block, which the toolbar acts on: the last one to have focus. */
  #activeBlockId: string | undefined;
  /** Whether focus was in the editor when the current update began. */
  #hadFocus = false;
  #formats: TextFormats | undefined;
  /** Set while the link field is open. */
  #linkForm: { error: boolean } | undefined;
  /** Set while the Preview is open. */
  #preview: Preview | undefined;
  /** The current document's HTML, once the Preview has rendered it. */
  #previewHtml: string | undefined;

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
    this.#destroyViews();
  }

  protected override willUpdate() {
    this.#hadFocus = Boolean(this.shadowRoot?.activeElement);
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
          if (!this.#views.has(block.id)) {
            this.#views.set(
              block.id,
              createTextBlockView({
                content: block.props.content as RichTextDocument,
                onChange: (next) => this.#commitText(block.id, next),
                onFocus: () => {
                  this.#activeBlockId = block.id;
                  this.#closeLinkForm();
                  this.#syncFormats();
                  this.requestUpdate();
                },
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
   * editor, where undo still works: on the selected Block, which may just have
   * moved to another Column, or else on the palette.
   */
  protected override updated() {
    const active = this.shadowRoot?.activeElement as
      | HTMLButtonElement
      | null
      | undefined;
    if (this.#hadFocus && (!active || active.disabled)) {
      (this.#activeView ?? this.#paletteButton)?.focus();
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
      <div
        class="email"
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
          (row, index) => html`
            ${this.#renderRowControls(row, index)}
            <div class="row">
              ${repeat(
                row.columns,
                (column) => column.id,
                (column) => this.#renderColumn(column)
              )}
            </div>
          `
        )}
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
        @mousedown=${keepFocusInBlock}
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

  #renderColumn({ blocks, id, width }: Column) {
    return html`
      <div
        class=${blocks.length === 0 ? "column empty" : "column"}
        style=${styleMap({ width: `${width}%` })}
      >
        ${repeat(
          blocks,
          (block) => block.id,
          (block) => html`
            <div
              aria-current=${block.id === this.#activeBlockId ? "true" : nothing}
              class="block"
            >
              ${this.#views.get(block.id)?.element}
            </div>
          `
        )}
        ${
          blocks.length === 0
            ? html`
                <button
                  class="add-block"
                  type="button"
                  @click=${() => this.#addTextBlock({ columnId: id, index: 0 })}
                >
                  Add Text Block here
                </button>
              `
            : nothing
        }
      </div>
    `;
  }

  #renderToolbar() {
    const formats = this.#formats;
    return html`
      <div
        class="toolbar"
        @keydown=${this.#onToolbarKeydown}
        @mousedown=${keepFocusInBlock}
      >
        <div aria-label="Add content" class="palette" role="group">
          <button
            title="Add a Text Block"
            type="button"
            @click=${() => this.#addTextBlock()}
          >
            Text
          </button>
        </div>
        <button type="button" @click=${this.#addRow}>Add Row</button>
        <button
          ?disabled=${this.#activeBlockId === undefined}
          type="button"
          @click=${this.#deleteSelectedBlock}
        >
          Delete Block
        </button>
        <div aria-label="Text formatting" class="formatting" role="group">
          ${MARK_BUTTONS.map(
            ({ label, mark, text }) => html`
              <button
                aria-label=${label}
                aria-pressed=${formats?.[mark] ? "true" : "false"}
                class=${mark}
                ?disabled=${!formats}
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
            ? html`<p id="link-error" role="alert">${INVALID_LINK_MESSAGE}</p>`
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

  get #paletteButton() {
    return this.renderRoot.querySelector<HTMLElement>(".palette button");
  }

  /** Applies a Command that changes the structure of the email. */
  #apply(command: Command) {
    const editor = this.#editor;
    if (!editor) {
      return;
    }
    const result = editor.apply(command);
    if (!result.ok) {
      // The controls only offer what's allowed, so this is a bug here.
      console.error(`<mail-quilt> rejected a Command: ${result.reason}`);
      return;
    }
    this.requestUpdate();
    this.#emitChange(editor.getDocument());
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
   * Adds a Text Block and selects it, ready to type in. By default it goes after
   * the selected Block, or else at the end of the last Column.
   */
  async #addTextBlock(place?: { columnId: string; index: number }) {
    const editor = this.#editor;
    if (!editor) {
      return;
    }
    let target = place ?? this.#defaultBlockPlace(editor);
    let options: ApplyOptions | undefined;
    if (!target) {
      options = { mergeKey: FIRST_BLOCK_MERGE_KEY };
      editor.apply({ index: 0, layout: "100", type: "insertRow" }, options);
      target = this.#defaultBlockPlace(editor);
    }
    if (!target) {
      return;
    }

    const result = editor.apply(
      { blockType: "text", ...target, type: "insertBlock" },
      options
    );
    if (!result.ok) {
      console.error(`<mail-quilt> rejected a Command: ${result.reason}`);
      return;
    }
    this.#activeBlockId = result.createdId;
    this.requestUpdate();
    this.#emitChange(editor.getDocument());
    await this.updateComplete;
    this.#activeView?.focus();
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
      // Tiptap's schema should be no wider than core's, so this is a bug here.
      console.error(`<mail-quilt> rejected an edit: ${result.reason}`);
      return;
    }
    this.#emitChange(editor.getDocument());
  }

  #onBeforeInput(event: InputEvent) {
    // WebKit types into a Block's selection even with focus on the dialog.
    if (this.#previewDialog?.open) {
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
    if (!editor?.[step]()) {
      return;
    }
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

  #show(document: BlocksDocument | undefined) {
    this.#lastKnownDocument = document;
    this.#previewHtml = undefined;
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
