// No page imports this. It's copied into each project with TypeScript, whose
// build type-checks it, so each package's published types are read here as an
// app's own TypeScript reads them.
import type { Command } from "@mailquilt/core";
import { isAllowedLinkHref } from "@mailquilt/core/internal";
import type {
  MailQuilt,
  MailQuiltChangeEvent,
  MailQuiltErrorEvent,
  MailQuiltShell,
} from "@mailquilt/editor";
import type { MailQuiltProps, MailQuiltShellProps } from "@mailquilt/react";
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

export const elementProps: MailQuiltProps = {
  "aria-label": "Newsletter",
  className: "editor",
  onKeyDown: (event) => event.key,
};

// @ts-expect-error A form field's prop means nothing on the editor.
export const formFieldProps: MailQuiltProps = { defaultValue: "Hello" };

/** A Host app's upload, which both elements and both components take. */
const uploadImage = async (file: File, { signal }: { signal: AbortSignal }) => {
  const response = await fetch("/uploads", {
    body: file,
    method: "PUT",
    signal,
  });
  return { url: response.url };
};

export const giveUploadImage = (editor: MailQuilt, shell: MailQuiltShell) => {
  editor.uploadImage = uploadImage;
  shell.uploadImage = uploadImage;
};

export const uploadProps: [MailQuiltProps, MailQuiltShellProps] = [
  { uploadImage },
  { uploadImage },
];

export const bareUrl: MailQuiltProps = {
  // @ts-expect-error The URL comes in an object, so fields can be added later.
  uploadImage: () => Promise.resolve("https://cdn.example/photo.png"),
};

/** A Host app's Merge Tags, with and without a label. */
const mergeTags = [
  { label: "First name", name: "first_name" },
  { name: "company" },
] as const;

export const giveMergeTags = (editor: MailQuilt, shell: MailQuiltShell) => {
  editor.mergeTags = mergeTags;
  shell.mergeTags = mergeTags;
};

export const mergeTagProps: [MailQuiltProps, MailQuiltShellProps] = [
  { mergeTags },
  { mergeTags },
];

export const unnamedTag: MailQuiltProps = {
  // @ts-expect-error A tag needs the name that goes between its braces.
  mergeTags: [{ label: "First name" }],
};

/** JSON from a database is `unknown` until the renderer has checked it. */
export const htmlFor = (saved: unknown): Promise<string> => renderEmail(saved);
