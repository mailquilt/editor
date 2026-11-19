// No page imports this. `next build` type-checks it, so each package's published
// types are read here as an app's own TypeScript reads them.
import type { Command } from "@mailquilt/core";
import { isAllowedLinkHref } from "@mailquilt/core/internal";
import type {
  MailQuiltChangeEvent,
  MailQuiltErrorEvent,
} from "@mailquilt/editor";
import { renderEmail } from "@mailquilt/renderer";

export const command: Command = {
  blockId: "block-1",
  props: { color: "#ff0000" },
  type: "updateBlockProps",
};

export const changedRows = ({ detail }: MailQuiltChangeEvent) =>
  detail.document.rows.length;

export const reason = ({ detail }: MailQuiltErrorEvent) => detail.reason;

// A type that fell back to `any` would make this line pass, and the build fail.
// @ts-expect-error An email isn't a number.
export const notANumber: number = ({} as MailQuiltChangeEvent).detail.document;

// The same for core's second entry, which the editor and renderer import from.
// @ts-expect-error A link check gives a boolean, not text.
export const notText: string = isAllowedLinkHref("https://example.com");

/** JSON from a database is `unknown` until the renderer has checked it. */
export const htmlFor = (saved: unknown): Promise<string> => renderEmail(saved);
