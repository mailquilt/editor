import { createEmail } from "./create-email.js";
import { createId, DOCUMENT_VERSION } from "./document.js";
import type { Block, Row } from "./document.js";
import { loadDocument } from "./load-document.js";

/**
 * What a copy of a Block or Row carries on the clipboard, as JSON, with the
 * format version (ADR 0018). A paste checks it as untrusted, as any email from
 * outside is.
 */
type Copied = { block: Block } | { row: Row };

/**
 * Why a paste is refused, for the editor to say in its own words: it isn't a
 * copy of one Block or Row, it's from a newer version of the format, or what
 * it holds isn't valid. `reason` says which part, in English, for developers.
 */
export type PasteRefusalCode = "notCopied" | "newerVersion" | "invalid";

export type PastedResult =
  | ({ ok: true } & Copied)
  | { ok: false; code: PasteRefusalCode; reason: string };

const notCopied = (reason: string) => ({
  code: "notCopied" as const,
  ok: false as const,
  reason,
});

const NOT_COPIED = "Copied content holds one Block or one Row";

/** The JSON that a copy of a Block or Row carries. */
export const copiedJson = (copied: Copied) =>
  JSON.stringify({ ...copied, version: DOCUMENT_VERSION });

/**
 * Reads what a copy carried, checked as a saved email is: an older version is
 * migrated, and a newer one is refused with the reason `loadDocument` gives.
 * The IDs are the copy's, so the Commands that insert it make new ones.
 */
export const loadCopied = (json: string): PastedResult => {
  let input: unknown;
  try {
    input = JSON.parse(json);
  } catch {
    return notCopied("The copied content isn't JSON");
  }
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return notCopied(NOT_COPIED);
  }
  const { block, row, version, ...rest } = input as Record<string, unknown>;
  // A newer format may add keys of its own, so its version is looked at first.
  const newer =
    typeof version === "number" &&
    Number.isInteger(version) &&
    version > DOCUMENT_VERSION;
  if (
    !newer &&
    (Object.keys(rest).length > 0 ||
      (block === undefined) === (row === undefined))
  ) {
    return notCopied(NOT_COPIED);
  }
  // In an email of its own, which is checked and migrated as a whole.
  const holder =
    row === undefined
      ? {
          columns: [{ blocks: [block], id: createId(), props: {}, width: 100 }],
          id: createId(),
          props: {},
        }
      : row;
  const loaded = loadDocument({
    kind: "blocks",
    rows: [holder],
    settings: createEmail().settings,
    version,
  });
  if (!loaded.ok) {
    return {
      code: newer ? "newerVersion" : "invalid",
      ok: false,
      // Named as what was copied, not the email it was checked in.
      reason:
        row === undefined
          ? loaded.reason.replaceAll("rows.0.columns.0.blocks.0", "block")
          : loaded.reason.replaceAll("rows.0", "row"),
    };
  }
  const [loadedRow] = loaded.document.rows as [Row];
  return row === undefined
    ? { block: loadedRow.columns[0]?.blocks[0] as Block, ok: true }
    : { ok: true, row: loadedRow };
};
