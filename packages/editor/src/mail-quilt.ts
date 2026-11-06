import {
  createEditor,
  isAllowedLinkHref,
  isSameDocument,
  loadDocument,
} from "@mailquilt/core";
import type { BlocksDocument, Editor, RichTextDocument } from "@mailquilt/core";
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

    .toolbar button {
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

    .toolbar button:hover:not(:disabled) {
      background: #f4f4f5;
    }

    .toolbar button:focus-visible,
    .toolbar input:focus-visible {
      outline: 2px solid #2563eb;
      outline-offset: 1px;
    }

    .toolbar button[aria-pressed="true"] {
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
  `;

  #editor: Editor | undefined;
  /** A private copy of the document last received from or sent to the host. */
  #lastKnownDocument: BlocksDocument | undefined;
  readonly #views = new Map<string, TextBlockView>();
  /** Edits in the same typing session merge into one undo step. */
  #typingSession = 0;
  #lastTypedAt = 0;
  /** The Block the toolbar acts on: the last one to have focus. */
  #activeBlockId: string | undefined;
  #formats: TextFormats | undefined;
  /** Set while the link field is open. */
  #linkForm: { error: boolean } | undefined;

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
    // Lit still updates detached elements, and nothing would destroy these
    // views. connectedCallback requests an update that creates them instead.
    if (!this.isConnected) {
      return;
    }
    for (const row of this.value?.rows ?? []) {
      for (const column of row.columns) {
        for (const block of column.blocks) {
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
  }

  protected override render() {
    const document = this.value;
    if (!document) {
      return nothing;
    }
    const { rows, settings } = document;

    return html`
      ${this.#renderToolbar()}
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
          (row) => html`
            <div class="row">
              ${repeat(
                row.columns,
                (column) => column.id,
                (column) => html`
                  <div
                    class="column"
                    style=${styleMap({ width: `${column.width}%` })}
                  >
                    ${repeat(
                      column.blocks,
                      (block) => block.id,
                      (block) => this.#views.get(block.id)?.element
                    )}
                  </div>
                `
              )}
            </div>
          `
        )}
      </div>
    `;
  }

  #renderToolbar() {
    const formats = this.#formats;
    return html`
      <div
        aria-label="Text formatting"
        class="toolbar"
        role="group"
        @mousedown=${keepFocusInBlock}
      >
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

  #runHistoryStep(event: Event, step: "redo" | "undo" | undefined) {
    if (!step) {
      return;
    }
    // The browser's own undo would change the text behind the document's back.
    event.preventDefault();
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
    this.#emitChange(document);
  }

  #show(document: BlocksDocument | undefined) {
    this.#lastKnownDocument = document;
    this.#destroyViews();
    this.#editor = document && createEditor({ document });
    this.requestUpdate();
  }

  #emitChange(document: BlocksDocument) {
    // A copy, because the host owns what it receives and may change it.
    this.#lastKnownDocument = structuredClone(document);
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

  #destroyViews() {
    for (const view of this.#views.values()) {
      view.destroy();
    }
    this.#views.clear();
    // The toolbar's state describes those views and their selections.
    this.#activeBlockId = undefined;
    this.#formats = undefined;
    this.#linkForm = undefined;
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
