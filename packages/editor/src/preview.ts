import { NEW_EMAIL_WIDTH } from "@mailquilt/core/internal";
import { css, html, nothing, unsafeCSS } from "lit";
import type { TemplateResult } from "lit";

import { place } from "./editor-places.js";
import { ICONS } from "./icons.js";
import { claim, keyFor } from "./key-map.js";
import { refuseFiles } from "./refuse-files.js";
import type { StringId } from "./strings.js";
import type { Text } from "./text.js";
import { BACKDROP } from "./theme.js";

/**
 * How long the Preview waits to say it's loading, as long as its outline waits
 * to show, so a quick render says nothing.
 */
const LOADING_SAID_AFTER_MS = 150;

/** A common phone's width, below every phone media query of an email's. */
const PHONE_WIDTH = 375;

/** The width the Preview shows the email at. */
type PreviewWidth = "desktop" | "phone";

const WIDTHS: {
  icon: TemplateResult;
  label: StringId;
  width: PreviewWidth;
}[] = [
  { icon: ICONS.monitor, label: "preview.desktop", width: "desktop" },
  { icon: ICONS.phone, label: "preview.phone", width: "phone" },
];

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
    background: var(--mq-color-backdrop, ${unsafeCSS(BACKDROP)});
    backdrop-filter: blur(2px);
  }

  .preview-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  /* The width switch in the middle, however wide the title and Close are. */
  .preview-header {
    align-items: center;
    border-bottom: 1px solid var(--mq-color-border);
    display: grid;
    gap: var(--mq-space-3);
    grid-template-columns: 1fr auto 1fr;
    padding: var(--mq-space-2) var(--mq-space-3) var(--mq-space-2)
      var(--mq-space-4);
  }

  .preview-header > .text-button {
    justify-self: end;
  }

  /* As tall as Close, so the header stays the height it was. */
  .preview-header .segments {
    padding: 2px;
  }

  .preview-header .segment {
    height: 24px;
  }

  /*
   * A dialog too narrow for the labels, as on a 320px phone, shows only the
   * icons, and the labels stay as the buttons' names.
   */
  @media (max-width: 380px) {
    .preview-header .segment > span {
      clip-path: inset(50%);
      height: 1px;
      overflow: hidden;
      position: absolute;
      white-space: nowrap;
      width: 1px;
    }
  }

  .preview-header h2 {
    font: inherit;
    font-size: var(--_mq-font-size-bar-title);
    font-weight: 600;
    margin: 0;
  }

  /* Where the email is, as wide as the dialog or as a phone. */
  .preview-stage {
    background: var(--mq-color-workspace);
    display: flex;
    flex: 1;
    justify-content: center;
    min-height: 0;
  }

  /* An iframe is 300px wide by default, so without min-width it overflows. */
  .preview-stage > iframe {
    background: var(--mq-color-workspace);
    border: 0;
    flex: 1;
    min-width: 0;
  }

  .preview-stage.phone {
    padding-block: var(--mq-space-4);
  }

  /* Narrower only in a dialog narrower than a phone. */
  .preview-stage.phone > iframe {
    border-radius: var(--mq-radius);
    box-shadow: var(--mq-shadow);
    flex: 0 1 ${unsafeCSS(PHONE_WIDTH)}px;
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
    animation: preview-skeleton-in 200ms ease-out
      ${unsafeCSS(LOADING_SAID_AFTER_MS)}ms both;
    background: var(--mq-color-surface);
    border-radius: var(--mq-radius-small);
    box-shadow: var(--mq-shadow-small);
    display: flex;
    flex-direction: column;
    gap: var(--mq-space-3);
    margin-inline: auto;
    max-width: ${unsafeCSS(NEW_EMAIL_WIDTH)}px;
    padding: 32px;
  }

  .preview-loading.phone > .preview-skeleton {
    max-width: ${unsafeCSS(PHONE_WIDTH)}px;
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

/**
 * The width changes the frame and not what's in it, so the email isn't loaded
 * again and keeps its scroll.
 */
const renderPreviewContent = (
  { result }: Preview,
  width: PreviewWidth,
  text: Text
) => {
  const phone = width === "phone" ? "phone" : "";
  if (!result) {
    return html`
      <div class="preview-loading ${phone}">${previewSkeleton}</div>
    `;
  }
  return "html" in result
    ? html`
        <div class="preview-stage ${phone}">
          <iframe
            sandbox="allow-same-origin"
            srcdoc=${result.html}
            title=${text("preview.frame")}
            @load=${guardEmail}
          ></iframe>
        </div>
      `
    : html`
        <p role="alert">
          ${text("preview.failed", { reason: result.failure })}
        </p>
      `;
};

interface PreviewEvents {
  /** The Close button was pressed. */
  onClose: () => void;
  /** The dialog closed, however it was closed. */
  onClosed: () => void;
  /** Desktop or Phone was pressed. */
  onWidth: (width: PreviewWidth) => void;
}

const renderWidthSwitch = (
  current: PreviewWidth,
  onWidth: PreviewEvents["onWidth"],
  text: Text
) => html`
  <div aria-label=${text("preview.width")} class="segments" role="group">
    ${WIDTHS.map(
      ({ icon, label, width }) => html`
        <button
          aria-pressed=${width === current ? "true" : "false"}
          class="segment"
          type="button"
          @click=${() => onWidth(width)}
        >
          ${icon}<span>${text(label)}</span>
        </button>
      `
    )}
  </div>
`;

/**
 * The dialog stays rendered so that closing it, not removing it, returns focus.
 * The `sandbox` gives the email no scripts, forms, popups or top-level
 * navigation. Its origin is the host page's, only so the editor can refuse a
 * file dropped on it, and keep Alt+← from going back a page. Never add
 * `allow-scripts` with it: together they let the email remove its own sandbox.
 * Escape closes it and goes no further, so a modal of the host's around the
 * editor stays open. Close has `autofocus`, so opening still moves focus to it
 * past the width switch.
 */
export const renderPreview = (
  preview: Preview | undefined,
  width: PreviewWidth,
  { onClose, onClosed, onWidth }: PreviewEvents,
  text: Text
) => html`
  <dialog
    aria-labelledby="preview-title"
    class="preview"
    data-place=${place("preview")}
    lang=${text("language")}
    @close=${onClosed}
  >
    <div class="ui preview-panel">
      <div class="preview-header">
        <h2 id="preview-title">${text("preview.title")}</h2>
        ${renderWidthSwitch(width, onWidth, text)}
        <button autofocus class="text-button" type="button" @click=${onClose}>
          ${text("preview.close")}
        </button>
      </div>
      <p class="visually-hidden" role="status">
        ${
          preview?.saysLoading && !preview.result ? text("preview.loading") : ""
        }
      </p>
      ${preview ? renderPreviewContent(preview, width, text) : nothing}
    </div>
  </dialog>
`;

interface PreviewHost {
  dialog: () => HTMLDialogElement | null;
  exportHtml: () => Promise<string>;
  requestUpdate: () => void;
}

/**
 * The Preview's state: the opening on screen, if any, the current document's
 * HTML once it has been rendered, and the width, which stays from one opening
 * to the next.
 */
export const createPreview = ({
  dialog,
  exportHtml,
  requestUpdate,
}: PreviewHost) => {
  let shown: Preview | undefined;
  let rendered: string | undefined;
  /** Counts each `forget`, so a render that was on its way then isn't kept. */
  let forgotten = 0;
  let width: PreviewWidth = "desktop";

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
    onWidth: (chosen) => {
      width = chosen;
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
      forgotten += 1;
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

      const rendering = forgotten;
      try {
        const email = await exportHtml();
        preview.result = { html: email };
        // Closed in the meantime, so the document may have changed since, or
        // what it's rendered with changed while it rendered.
        if (shown === preview && rendering === forgotten) {
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
    get width() {
      return width;
    },
  };
};
