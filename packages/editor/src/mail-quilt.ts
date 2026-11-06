import { createEditor, isSameDocument, loadDocument } from "@mailquilt/core";
import type { BlocksDocument, Editor, RichTextDocument } from "@mailquilt/core";
import { renderEmail } from "@mailquilt/renderer";
import { css, html, LitElement, nothing } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { styleMap } from "lit/directives/style-map.js";

import { createTextBlockView } from "./text-block-view.js";
import type { TextBlockView } from "./text-block-view.js";

/** Typing after a gap this long starts a new undo step. */
const TYPING_PAUSE_MS = 1000;

const historyShortcut = (event: KeyboardEvent) => {
  if (event.isComposing || event.altKey) {
    return;
  }
  // Layouts without Latin letters report their own, so use the key's position.
  const key = /^[a-z]$/iu.test(event.key)
    ? event.key.toLowerCase()
    : event.code.replace("Key", "").toLowerCase();
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
  `;

  #editor: Editor | undefined;
  /** A private copy of the document last received from or sent to the host. */
  #lastKnownDocument: BlocksDocument | undefined;
  readonly #views = new Map<string, TextBlockView>();
  /** Edits in the same typing session merge into one undo step. */
  #typingSession = 0;
  #lastTypedAt = 0;

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
    if (isSameDocument(document, this.#lastKnownDocument)) {
      return;
    }
    let editor: Editor | undefined;
    if (document !== undefined) {
      const loaded = loadDocument(document);
      if (!loaded.ok) {
        this.#emitError(loaded.reason);
        return;
      }
      editor = createEditor({ document: loaded.document });
    }
    this.#lastKnownDocument = structuredClone(document);
    this.#destroyViews();
    this.#editor = editor;
    this.requestUpdate();
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
              createTextBlockView(
                block.props.content as RichTextDocument,
                (next) => this.#commitText(block.id, next),
                () => {
                  this.#typingSession += 1;
                }
              )
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
