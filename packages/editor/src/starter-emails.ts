import { createEditor, createEmail, loadDocument } from "@mailquilt/core";
import type {
  ApplyResult,
  BlocksDocument,
  Command,
  Editor,
} from "@mailquilt/core";

import { copyRowCommand } from "./editing-actions.js";

/** A Starter email as the Host app gives it, its `email` not yet checked. */
export interface StarterEmail {
  /** What the start screen calls it, such as "Product launch". */
  name: string;
  /** A line under its name, such as "Hero, two products, quote". */
  description?: string | undefined;
  /** The email, as `value` takes one, such as JSON the Shell exported. */
  email: unknown;
}

/** A Starter email the editor can offer, its email checked and migrated. */
export interface OfferedStarter {
  name: string;
  description?: string | undefined;
  email: BlocksDocument;
}

/** Each pick's undo step has its own key, so no other Command joins it. */
let picks = 0;

/**
 * Makes an empty email the Starter email, in one undo step: its settings, then
 * each of its Rows, with new IDs, as a pasted Row is added. A Command refused
 * part way undoes those before it, and its refusal is returned.
 */
export const startFrom = (
  editor: Editor,
  starter: BlocksDocument
): ApplyResult => {
  picks += 1;
  const mergeKey = `starter-email:${picks}`;
  const current = editor.getDocument().settings;
  const commands: Command[] = [
    {
      // Whole, so nothing of the empty email's settings stays.
      settings: {
        ...Object.fromEntries(Object.keys(current).map((key) => [key, null])),
        ...starter.settings,
      },
      type: "updateEmailSettings",
    },
    // Every Row has one, as a Row has 1 to 4 Columns.
    ...starter.rows.flatMap((row, index) => copyRowCommand(row, index) ?? []),
  ];
  let applied = false;
  for (const command of commands) {
    const result = editor.apply(command, { mergeKey });
    if (result.ok) {
      applied = true;
    } else if (result.code !== "unchanged") {
      if (applied) {
        editor.undo();
      }
      return result;
    }
  }
  return { ok: true };
};

/** Why picking the email would be refused, from an empty one, or nothing. */
const tryPick = (email: BlocksDocument) => {
  const empty = createEditor({ document: { ...createEmail(), rows: [] } });
  const result = startFrom(empty, email);
  return result.ok ? undefined : result.reason;
};

/**
 * The Host app's Starter emails the editor can offer, in its order: each with
 * a name, an email `loadDocument` accepts, as `value` checks one, and a pick
 * core takes. Each other one is left out, and said on the console, so it's
 * called once for each list the Host app gives.
 */
export const usableStarters = (given: readonly StarterEmail[] | undefined) => {
  const usable: OfferedStarter[] = [];
  // Each as the host gives it, which from plain JavaScript may be `null`, or
  // an empty slot, which `for...of` gives as `undefined`.
  for (const each of given ?? []) {
    const { description, email, name }: Partial<StarterEmail> = each ?? {};
    const loaded = loadDocument(email);
    let reason = loaded.ok ? tryPick(loaded.document) : loaded.reason;
    if (!(description === undefined || typeof description === "string")) {
      reason = "its description isn't text";
    }
    const isNamed = typeof name === "string" && name.trim() !== "";
    if (!isNamed) {
      reason = "it has no name";
    }
    if (isNamed && reason === undefined && loaded.ok) {
      usable.push({
        ...(description === undefined ? {} : { description }),
        email: loaded.document,
        name,
      });
    } else {
      console.error(
        `<mail-quilt> left out a Starter email in starterEmails, "${String(name)}": ${reason}`
      );
    }
  }
  return usable;
};
