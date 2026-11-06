import { createEditor } from "@mailquilt/core";
import type { BlocksDocument, Editor, RichTextDocument } from "@mailquilt/core";
import { renderEmail } from "@mailquilt/renderer";
import { css, html, LitElement, nothing } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { styleMap } from "lit/directives/style-map.js";

import { createTextBlockView } from "./text-block-view.js";
import type { TextBlockView } from "./text-block-view.js";

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
  /** The document last received from or sent to the host. */
  #lastKnownDocument: BlocksDocument | undefined;
  readonly #views = new Map<string, TextBlockView>();

  get value() {
    return this.#editor?.getDocument();
  }

  /** Setting the document this element already knows about changes nothing. */
  set value(document: BlocksDocument | undefined) {
    if (document === this.#lastKnownDocument) {
      return;
    }
    this.#lastKnownDocument = document;
    this.#destroyViews();
    this.#editor = document && createEditor({ document });
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
                (next) => this.#commitText(block.id, next)
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
    const result = editor.apply({
      blockId,
      props: { content },
      type: "updateProps",
    });
    if (!result.ok) {
      // Tiptap's schema should be no wider than core's, so this is a bug here.
      console.error(`<mail-quilt> rejected an edit: ${result.reason}`);
      return;
    }
    const document = editor.getDocument();
    this.#lastKnownDocument = document;
    this.dispatchEvent(
      new CustomEvent("mq-change", {
        bubbles: true,
        composed: true,
        detail: { document },
      })
    );
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
  }

  interface HTMLElementTagNameMap {
    "mail-quilt": MailQuilt;
  }
}
