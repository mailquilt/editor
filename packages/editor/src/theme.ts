import { css } from "lit";

/**
 * The editor's theme tokens: one light theme. A host overrides any of them on
 * the element itself, which wins over `:host`. The email card doesn't use them,
 * because it shows the email's own settings.
 */
export const themeTokens = css`
  :host {
    --mq-font-family:
      system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
    --mq-font-size: 13px;
    --mq-font-size-small: 12px;

    --mq-color-workspace: #eeeff1;
    --mq-color-surface: #ffffff;
    --mq-color-surface-muted: #f5f6f7;
    --mq-color-surface-hover: #eceef0;
    --mq-color-text: #16181d;
    --mq-color-text-muted: #5f6570;
    --mq-color-border: #e4e6ea;
    --mq-color-border-strong: #8b919b;
    --mq-color-accent: #3355ff;
    --mq-color-accent-strong: #2340d6;
    --mq-color-accent-soft: rgb(51 85 255 / 10%);
    --mq-color-outline-hover: rgb(51 85 255 / 45%);
    --mq-color-on-accent: #ffffff;
    --mq-color-danger: #c42b1c;
    --mq-color-tooltip: #16181d;
    --mq-color-on-tooltip: #f7f7f8;

    --mq-space-1: 4px;
    --mq-space-2: 8px;
    --mq-space-3: 12px;
    --mq-space-4: 16px;
    --mq-space-5: 24px;

    --mq-radius-small: 6px;
    --mq-radius: 10px;
    --mq-shadow-small: 0 1px 2px rgb(22 24 29 / 8%);
    --mq-shadow:
      0 0 0 1px rgb(22 24 29 / 4%), 0 2px 4px rgb(22 24 29 / 4%),
      0 12px 32px -8px rgb(22 24 29 / 14%);
  }
`;

/** What every surface of the editor's own shares. */
export const uiStyles = css`
  /* Author styles below can set display, which would otherwise show these. */
  [hidden] {
    display: none !important;
  }

  /*
   * Inherited properties cross the Shadow DOM boundary, and the email's own
   * settings reach the controls on the canvas, so each surface starts again here.
   */
  .ui {
    all: initial;
    -webkit-font-smoothing: antialiased;
    box-sizing: border-box;
    color: var(--mq-color-text);
    font-family: var(--mq-font-family);
    font-size: var(--mq-font-size);
    line-height: 1.5;
  }

  .ui *,
  .ui *::before,
  .ui *::after {
    box-sizing: border-box;
  }

  .ui button,
  .ui input,
  .ui select {
    color: inherit;
    font: inherit;
  }

  .visually-hidden {
    clip-path: inset(50%);
    height: 1px;
    overflow: hidden;
    position: absolute;
    white-space: nowrap;
    width: 1px;
  }

  .icon {
    display: block;
    flex: none;
    height: 16px;
    width: 16px;
  }

  .icon-button {
    align-items: center;
    background: transparent;
    border: 0;
    border-radius: var(--mq-radius-small);
    color: var(--mq-color-text-muted);
    cursor: pointer;
    display: inline-flex;
    flex: none;
    height: 28px;
    justify-content: center;
    padding: 0;
    transition:
      background-color 120ms,
      color 120ms;
    width: 28px;
  }

  .icon-button:hover:not(:disabled) {
    background: var(--mq-color-surface-hover);
    color: var(--mq-color-text);
  }

  .icon-button[aria-pressed="true"],
  .icon-button[aria-expanded="true"] {
    background: var(--mq-color-accent-soft);
    color: var(--mq-color-accent-strong);
  }

  .icon-button:disabled {
    cursor: default;
    opacity: 0.45;
  }

  .icon-button.danger:hover {
    color: var(--mq-color-danger);
  }

  /* A button with words on it, which need no tooltip. */
  .text-button {
    background: var(--mq-color-surface);
    border: 1px solid var(--mq-color-border);
    border-radius: var(--mq-radius-small);
    box-shadow: var(--mq-shadow-small);
    cursor: pointer;
    font-weight: 500;
    height: 28px;
    padding: 0 var(--mq-space-3);
    transition: background-color 120ms;
  }

  .text-button:hover {
    background: var(--mq-color-surface-hover);
  }

  .text-button.primary {
    background: var(--mq-color-accent);
    border-color: var(--mq-color-accent);
    color: var(--mq-color-on-accent);
  }

  .text-button.primary:hover {
    background: var(--mq-color-accent-strong);
  }

  .ui button:focus-visible,
  .ui input:focus-visible {
    outline: 2px solid var(--mq-color-accent);
    outline-offset: 1px;
  }

  /* A raised bar of tools, on the canvas or above it. */
  .bar {
    align-items: center;
    background: var(--mq-color-surface);
    border: 1px solid var(--mq-color-border);
    border-radius: var(--mq-radius);
    box-shadow: var(--mq-shadow);
    display: flex;
    gap: 2px;
    padding: 3px;
  }

  .bar .separator {
    align-self: stretch;
    background: var(--mq-color-border);
    flex: none;
    margin: 4px 2px;
    width: 1px;
  }

  /* Over a popover's own styles too. See tooltips.ts. */
  .tooltip {
    background: var(--mq-color-tooltip);
    border: 0;
    border-radius: var(--mq-radius-small);
    box-shadow: var(--mq-shadow);
    color: var(--mq-color-on-tooltip);
    font-size: var(--mq-font-size-small);
    font-weight: 500;
    inset: 0 auto auto 0;
    margin: 0;
    max-width: 240px;
    overflow: visible;
    padding: 5px 8px;
    /* So it never covers a control that's pressed. See tooltips.ts. */
    pointer-events: none;
    position: fixed;
    white-space: nowrap;
    z-index: 20;
  }
`;
