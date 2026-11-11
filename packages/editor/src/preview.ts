import { css, html, nothing } from "lit";

export const previewStyles = css`
  /* A closed dialog relies on the browser's display: none, so no all: initial. */
  .preview {
    background: var(--mq-color-surface);
    border: 0;
    border-radius: var(--mq-radius);
    box-shadow: var(--mq-shadow);
    /*
     * The window less a gap, up to a size that still reads as a dialog. A
     * wider email scrolls inside it.
     */
    height: calc(100dvh - 32px);
    max-height: 880px;
    max-width: 960px;
    overflow: hidden;
    padding: 0;
    width: calc(100vw - 32px);
  }

  .preview::backdrop {
    background: rgb(16 24 40 / 55%);
    backdrop-filter: blur(2px);
  }

  .preview-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .preview-header {
    align-items: center;
    border-bottom: 1px solid var(--mq-color-border);
    display: flex;
    justify-content: space-between;
    padding: var(--mq-space-2) var(--mq-space-3) var(--mq-space-2)
      var(--mq-space-4);
  }

  .preview-header h2 {
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    margin: 0;
  }

  .preview-panel iframe {
    background: var(--mq-color-workspace);
    border: 0;
    flex: 1;
    min-height: 0;
    width: 100%;
  }

  .preview-panel > p {
    margin: 0;
    padding: var(--mq-space-4);
  }

  .preview-panel > p[role="alert"] {
    color: var(--mq-color-danger);
  }
`;

/** One opening of the Preview. */
export interface Preview {
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

export interface PreviewEvents {
  /** The Close button was pressed. */
  onClose: () => void;
  /** The dialog closed, however it was closed. */
  onClosed: () => void;
}

/**
 * The dialog stays rendered so that closing it, not removing it, returns focus.
 * An empty `sandbox` gives the email an opaque origin and no scripts, forms,
 * popups or top-level navigation.
 */
export const renderPreview = (
  preview: Preview | undefined,
  { onClose, onClosed }: PreviewEvents
) => html`
  <dialog aria-labelledby="preview-title" class="preview" @close=${onClosed}>
    <div class="ui preview-panel">
      <div class="preview-header">
        <h2 id="preview-title">Preview</h2>
        <button class="text-button" type="button" @click=${onClose}>
          Close
        </button>
      </div>
      ${preview ? renderPreviewContent(preview) : nothing}
    </div>
  </dialog>
`;
