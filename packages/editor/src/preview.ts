import { css, html, nothing } from "lit";

import { claim, keyFor } from "./key-map.js";
import { refuseFiles } from "./refuse-files.js";
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

  /*
   * With its default too, as a backdrop gets no tokens before Chrome 122,
   * Firefox 120 and Safari 17.4.
   */
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

  /* Where the email will be, so it takes the same room when it arrives. */
  .preview-loading {
    background: var(--mq-color-workspace);
    flex: 1;
    min-height: 0;
    overflow: hidden;
    padding: var(--mq-space-5) var(--mq-space-4);
  }

  /*
   * The width of a new email. Shown only after a moment, so a quick render
   * doesn't flash it.
   */
  .preview-skeleton {
    animation: preview-skeleton-in 200ms ease-out 150ms both;
    background: var(--mq-color-surface);
    border-radius: var(--mq-radius-small);
    box-shadow: var(--mq-shadow-small);
    display: flex;
    flex-direction: column;
    gap: var(--mq-space-3);
    margin-inline: auto;
    max-width: 600px;
    padding: 32px;
  }

  .preview-skeleton > span {
    animation: preview-skeleton-shimmer 1.4s ease-in-out infinite;
    background: linear-gradient(
        90deg,
        var(--mq-color-surface-hover) 30%,
        var(--mq-color-surface-muted) 50%,
        var(--mq-color-surface-hover) 70%
      )
      0 0 / 300% 100%;
    border-radius: 4px;
    display: block;
    height: 12px;
  }

  .preview-skeleton > .long {
    width: 92%;
  }

  .preview-skeleton > .medium {
    width: 78%;
  }

  .preview-skeleton > .short {
    width: 64%;
  }

  .preview-skeleton > .heading {
    height: 22px;
    margin-block-end: var(--mq-space-2);
    width: 55%;
  }

  .preview-skeleton > .image {
    border-radius: var(--mq-radius-small);
    height: 180px;
    margin-block: var(--mq-space-3);
  }

  .preview-skeleton > .action {
    border-radius: var(--mq-radius-small);
    height: 40px;
    margin-block-start: var(--mq-space-3);
    width: 160px;
  }

  @keyframes preview-skeleton-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes preview-skeleton-shimmer {
    from {
      background-position: 100% 0;
    }
    to {
      background-position: 0 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .preview-skeleton,
    .preview-skeleton > span {
      animation: none;
    }
  }
`;

/** The outline of an email, in the shapes most emails start with. */
const previewSkeleton = html`
  <div aria-hidden="true" class="preview-skeleton">
    <span class="heading"></span>
    <span></span>
    <span class="long"></span>
    <span class="short"></span>
    <span class="image"></span>
    <span class="long"></span>
    <span class="medium"></span>
    <span class="action"></span>
  </div>
`;

/**
 * How long the Preview waits to say it's loading, as long as its outline waits
 * to show, so a quick render says nothing.
 */
const LOADING_SAID_AFTER_MS = 150;

/** One opening of the Preview. */
interface Preview {
  /** Unset while the email renders. */
  result?: { html: string } | { failure: string };
  /** Set once it's time to say the email is loading. */
  saysLoading?: boolean;
}

/**
 * A key pressed in the email is pressed in the Preview, as the key map has it.
 * The browser doesn't close the dialog for an Escape in the email's own
 * document, so that one closes it here.
 */
const claimKey = (event: KeyboardEvent) => {
  const binding = keyFor("preview", event);
  if (binding) {
    claim(event, binding);
  }
  if (binding?.action === "closePreview") {
    event.view?.frameElement?.closest("dialog")?.close();
  }
};

/**
 * The email's own document would let the browser open a dropped file, and
 * Alt+← go back a page, as the editor never hears what happens in it.
 */
const guardEmail = (event: Event) => {
  const email = (event.currentTarget as HTMLIFrameElement).contentDocument;
  email?.addEventListener("dragover", refuseFiles);
  email?.addEventListener("drop", refuseFiles);
  email?.addEventListener("keydown", claimKey);
};

const renderPreviewContent = ({ result }: Preview) => {
  if (!result) {
    return html` <div class="preview-loading">${previewSkeleton}</div> `;
  }
  return "html" in result
    ? html`
        <iframe
          sandbox="allow-same-origin"
          srcdoc=${result.html}
          title="Email preview"
          @load=${guardEmail}
        ></iframe>
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

/**
 * The dialog stays rendered so that closing it, not removing it, returns focus.
 * The `sandbox` gives the email no scripts, forms, popups or top-level
 * navigation. Its origin is the host page's, only so the editor can refuse a
 * file dropped on it, and keep Alt+← from going back a page. Never add
 * `allow-scripts` with it: together they let the email remove its own sandbox.
 * Escape closes it and goes no further, so a modal of the host's around the
 * editor stays open.
 */
export const renderPreview = (
  preview: Preview | undefined,
  { onClose, onClosed }: PreviewEvents
) => html`
  <dialog
    aria-labelledby="preview-title"
    class="preview"
    data-place="preview"
    lang=${UI_LANG}
    @close=${onClosed}
  >
    <div class="ui preview-panel">
      <div class="preview-header">
        <h2 id="preview-title">Preview</h2>
        <button class="text-button" type="button" @click=${onClose}>
          Close
        </button>
      </div>
      <p class="visually-hidden" role="status">
        ${preview?.saysLoading && !preview.result ? "Loading preview…" : ""}
      </p>
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
export const createPreview = ({
  dialog,
  exportHtml,
  requestUpdate,
}: PreviewHost) => {
  let shown: Preview | undefined;
  let rendered: string | undefined;

  const events: PreviewEvents = {
    onClose: () => dialog()?.close(),
    onClosed: () => {
      // This event is queued, so it can arrive after the next opening.
      if (dialog()?.open) {
        return;
      }
      shown = undefined;
      requestUpdate();
    },
  };

  return {
    /**
     * Closes it for good, as it shows the old document. A removed dialog also
     * stays `open`, so it would come back without being modal.
     */
    end: () => {
      if (shown) {
        dialog()?.close();
        shown = undefined;
      }
    },
    events,
    /** The document changed, so its HTML has to be rendered again. */
    forget: () => {
      rendered = undefined;
    },
    get isOpen() {
      return dialog()?.open ?? false;
    },
    /** Shows the document as it is now, compiling it only if it has changed. */
    open: async () => {
      const cached = rendered;
      const preview: Preview = {};
      if (cached !== undefined) {
        preview.result = { html: cached };
      }
      shown = preview;
      dialog()?.showModal();
      requestUpdate();
      if (cached !== undefined) {
        return;
      }
      // Said into a status that's there already, as the dialog opened before,
      // since a screen reader may not say one that arrives with its text.
      setTimeout(() => {
        if (shown === preview && !preview.result) {
          preview.saysLoading = true;
          requestUpdate();
        }
      }, LOADING_SAID_AFTER_MS);

      try {
        const email = await exportHtml();
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
      requestUpdate();
    },
    get shown() {
      return shown;
    },
  };
};
