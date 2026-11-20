// The editor's sizes and default accent, which the site states and lays its
// pages out by. The editor doesn't export them, so a browser test checks each
// one against the editor itself.

/** Narrower than this, `<mail-quilt>` shows a notice in place of the canvas. */
export const EDITOR_MIN_WIDTH = 640;

/** The least height `<mail-quilt>` takes, however short the email. */
export const EDITOR_MIN_HEIGHT = 600;

/** The least height of the Shell's header, above its editor. */
export const SHELL_HEADER_MIN_HEIGHT = 48;

/** What the editor's accent tokens are when the host sets none. */
export const DEFAULT_ACCENT = { accent: "#3355ff", strong: "#2340d6" };

/**
 * The four accent tokens for an accent and its pressed shade, as the site's
 * own editors set them. The two tints are mixed from the accent.
 */
export const accentTokens = (accent: string, strong: string) => {
  const tint = (percent: number) =>
    `color-mix(in srgb, ${accent} ${percent}%, transparent)`;
  return {
    "--mq-color-accent": accent,
    "--mq-color-accent-soft": tint(10),
    "--mq-color-accent-strong": strong,
    "--mq-color-outline-hover": tint(45),
  };
};
