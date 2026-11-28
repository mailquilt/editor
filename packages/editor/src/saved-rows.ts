import type { Row } from "@mailquilt/core";
import { loadCopied } from "@mailquilt/core/internal";

/** A Saved Row as the Host app gives it, its `row` not yet checked. */
export interface SavedRow {
  /** What the editor calls it where Rows are added, such as "Footer". */
  name: string;
  /** The Row, with its Columns and Blocks, as an email's `rows` holds one. */
  row: unknown;
  /** The `version` of the email the Row is from, so an older one is migrated. */
  version: number;
}

/** A Saved Row the editor can offer, its Row checked and migrated. */
export interface OfferedSavedRow {
  name: string;
  row: Row;
}

/** What a paste would bring from the Row, or why it would be refused. */
const load = (row: unknown, version: unknown) => {
  let json: string;
  try {
    json = JSON.stringify({ row, version });
  } catch (error) {
    return { ok: false as const, reason: String(error) };
  }
  return loadCopied(json);
};

/** What the console says of a Saved Row the editor leaves out. */
const leftOut = (name: unknown, reason: string) =>
  `<mail-quilt> left out a Saved Row in savedRows, "${String(name)}": ${reason}`;

/**
 * The Host app's Saved Rows the editor can offer, in its order: each with a
 * name and a Row a paste would take, checked as any email from outside is and
 * migrated from its `version`. Each other one is left out, and said on the
 * console, so it's called once for each list the Host app gives.
 */
export const usableSavedRows = (given: readonly SavedRow[] | undefined) => {
  const usable: OfferedSavedRow[] = [];
  // Each as the host gives it, which from plain JavaScript may be `null`, or
  // an empty slot, which `for...of` gives as `undefined`.
  for (const each of given ?? []) {
    const { name, row, version }: Partial<SavedRow> = each ?? {};
    const loaded = load(row, version);
    if (!(typeof name === "string" && name.trim())) {
      console.error(leftOut(name, "it has no name"));
    } else if (!loaded.ok) {
      console.error(leftOut(name, loaded.reason));
    } else if ("row" in loaded) {
      usable.push({ name, row: loaded.row });
    }
  }
  return usable;
};
