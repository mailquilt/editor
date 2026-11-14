import { css, html, nothing } from "lit";

import { UI_LANG } from "./theme.js";

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

  /* With its default too, as older browsers don't pass tokens to a backdrop. */
  .preview::backdrop {
    background: var(--mq-color-backdrop, rgb(16 24 40 / 55%));
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

interface PreviewEvents {
  /** The Close button was pressed. */
  onClose: () => void;
  /** The dialog closed, however it was closed. */
  onClosed: () => void;
}

const stopEscape = (event: KeyboardEvent) => {
  if (event.key === "Escape") {
    event.stopPropagation();
  }
};

/**
 * The dialog stays rendered so that closing it, not removing it, returns focus.
 * An empty `sandbox` gives the email an opaque origin and no scripts, forms,
 * popups or top-level navigation. Escape closes it and goes no further, so a
 * modal of the host's around the editor stays open.
 */
export const renderPreview = (
  preview: Preview | undefined,
  { onClose, onClosed }: PreviewEvents
) => html`
  <dialog
    aria-labelledby="preview-title"
    class="preview"
    lang=${UI_LANG}
    @close=${onClosed}
    @keydown=${stopEscape}
  >
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

interface PreviewHost {
  dialog: () => HTMLDialogElement | null;
  exportHtml: () => Promise<string>;
  requestUpdate: () => void;
}

/**
 * The Preview's state: the opening on screen, if any, and the current
 * document's HTML once it has been rendered.
 */
export const createPreview = (host: PreviewHost) => {
  let shown: Preview | undefined;
  let rendered: string | undefined;

  const events: PreviewEvents = {
    onClose: () => host.dialog()?.close(),
    onClosed: () => {
      // This event is queued, so it can arrive after the next opening.
      if (host.dialog()?.open) {
        return;
      }
      shown = undefined;
      host.requestUpdate();
    },
  };

  return {
    /**
     * Closes it for good, as it shows the old document. A removed dialog also
     * stays `open`, so it would come back without being modal.
     */
    end: () => {
      if (shown) {
        host.dialog()?.close();
        shown = undefined;
      }
    },
    events,
    /** The document changed, so its HTML has to be rendered again. */
    forget: () => {
      rendered = undefined;
    },
    get isOpen() {
      return host.dialog()?.open ?? false;
    },
    /** Shows the document as it is now, compiling it only if it has changed. */
    open: async () => {
      const cached = rendered;
      const preview: Preview = {};
      if (cached !== undefined) {
        preview.result = { html: cached };
      }
      shown = preview;
      host.dialog()?.showModal();
      host.requestUpdate();
      if (cached !== undefined) {
        return;
      }

      try {
        const email = await host.exportHtml();
        preview.result = { html: email };
        // Closed in the meantime, so the document may have changed since.
        if (shown === preview) {
          rendered = email;
        }
      } catch (error) {
        console.error("<mail-quilt> couldn't render the preview", error);
        preview.result = {
          failure: error instanceof Error ? error.message : String(error),
        };
      }
      host.requestUpdate();
    },
    get shown() {
      return shown;
    },
  };
};
