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
    --mq-font-size: 14px;
    --mq-font-size-small: 12px;

    --mq-color-workspace: #eef0f3;
    --mq-color-surface: #ffffff;
    --mq-color-surface-hover: #f4f4f5;
    --mq-color-text: #18181b;
    --mq-color-text-muted: #52525b;
    --mq-color-border: #e4e4e7;
    --mq-color-border-strong: #71717a;
    --mq-color-accent: #2563eb;
    --mq-color-accent-strong: #1d4ed8;
    --mq-color-accent-soft: rgb(37 99 235 / 10%);
    --mq-color-outline-hover: rgb(37 99 235 / 45%);
    --mq-color-on-accent: #ffffff;
    --mq-color-danger: #b91c1c;
    --mq-color-tooltip: #18181b;
    --mq-color-on-tooltip: #fafafa;

    --mq-space-1: 4px;
    --mq-space-2: 8px;
    --mq-space-3: 12px;
    --mq-space-4: 16px;
    --mq-space-5: 24px;

    --mq-radius-small: 4px;
    --mq-radius: 8px;
    --mq-shadow: 0 1px 2px rgb(24 24 27 / 8%), 0 4px 12px rgb(24 24 27 / 8%);
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
    cursor: pointer;
    display: inline-flex;
    flex: none;
    height: 28px;
    justify-content: center;
    padding: 0;
    width: 28px;
  }

  .icon-button:hover:not(:disabled) {
    background: var(--mq-color-surface-hover);
  }

  .icon-button[aria-pressed="true"],
  .icon-button[aria-expanded="true"] {
    background: var(--mq-color-accent-soft);
    color: var(--mq-color-accent-strong);
  }

  .icon-button:disabled {
    color: var(--mq-color-border-strong);
    cursor: default;
  }

  .icon-button.danger:hover {
    color: var(--mq-color-danger);
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
    padding: 2px;
  }

  .bar .separator {
    align-self: stretch;
    background: var(--mq-color-border);
    flex: none;
    margin: 4px 2px;
    width: 1px;
  }

  .tooltip {
    background: var(--mq-color-tooltip);
    border-radius: var(--mq-radius-small);
    color: var(--mq-color-on-tooltip);
    font-size: var(--mq-font-size-small);
    left: 0;
    max-width: 240px;
    padding: 4px 8px;
    /* So it never covers a control that's pressed. See tooltips.ts. */
    pointer-events: none;
    position: fixed;
    top: 0;
    white-space: nowrap;
    z-index: 20;
  }
`;
