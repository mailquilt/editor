import * as v from "valibot";

import { blockDefinitions } from "./blocks.js";
import { DOCUMENT_VERSION } from "./document.js";
import type { BlocksDocument } from "./document.js";
import { emailSettingsSchema } from "./email-settings.js";
import { MERGE_TAG } from "./rich-text.js";
import { rowPropsSchema } from "./row-settings.js";
import { describeIssues } from "./validation.js";

export type LoadResult =
  | { ok: true; document: BlocksDocument }
  | { ok: false; reason: string };

/**
 * Each entry turns a document of the version it's keyed by into the next
 * version. The document it receives is its own copy.
 */
type Migrations = Record<
  number,
  (document: Record<string, unknown>) => Record<string, unknown>
>;

/** Room for floating-point noise only, as in 33.33 + 33.33 + 33.34. */
const COLUMN_WIDTH_TOLERANCE = 1e-6;

const idSchema = v.pipe(v.string(), v.nonEmpty());

/**
 * An object JSON can hold, so not a list, a Date or a Map. A Proxy of one, as
 * Vue's reactive() makes, is one too.
 */
const isPlainObject = (value: unknown) =>
  Object.prototype.toString.call(value) === "[object Object]";

// The object schemas let any object through, so props whose keys are all
// optional would load a list, a Date or a Map as `{}`. Anything that isn't an
// object is left for them to refuse.
const plainObject = v.check(
  (input: unknown) =>
    typeof input !== "object" || input === null || isPlainObject(input),
  "Expected an object, not a list or another kind of object"
);

// Each type of Block's props are checked by its own schema, found by its type.
const blockSchema = v.variant(
  "type",
  [...blockDefinitions].map(([type, { schema }]) =>
    v.strictObject({
      id: idSchema,
      props: v.pipe(v.unknown(), plainObject, schema),
      type: v.literal(type),
    })
  )
);

// Strict at every level, so a field this version doesn't know is refused rather
// than dropped, which would lose it at the host's next save.
const documentSchema = v.strictObject({
  kind: v.literal("blocks"),
  rows: v.array(
    v.strictObject({
      columns: v.pipe(
        v.array(
          v.strictObject({
            blocks: v.array(blockSchema),
            id: idSchema,
            props: v.pipe(v.unknown(), plainObject, v.strictObject({})),
            width: v.pipe(v.number(), v.minValue(1), v.maxValue(100)),
          })
        ),
        v.minLength(1),
        v.maxLength(4)
      ),
      id: idSchema,
      props: v.pipe(v.unknown(), plainObject, rowPropsSchema),
    })
  ),
  settings: emailSettingsSchema,
  version: v.pipe(v.number(), v.integer()),
});

type ParsedDocument = v.InferOutput<typeof documentSchema>;

/** What the schema can't see: rules across several items. */
const findProblem = ({ rows }: ParsedDocument) => {
  const ids = new Set<string>();
  const isRepeat = (id: string) => {
    const seen = ids.has(id);
    ids.add(id);
    return seen;
  };

  for (const row of rows) {
    if (isRepeat(row.id)) {
      return `Duplicate ID "${row.id}"`;
    }
    const totalWidth = row.columns.reduce((sum, { width }) => sum + width, 0);
    if (Math.abs(totalWidth - 100) > COLUMN_WIDTH_TOLERANCE) {
      return `Column widths in Row "${row.id}" add up to ${totalWidth}, not 100`;
    }
    for (const column of row.columns) {
      if (isRepeat(column.id)) {
        return `Duplicate ID "${column.id}"`;
      }
      for (const block of column.blocks) {
        if (isRepeat(block.id)) {
          return `Duplicate ID "${block.id}"`;
        }
      }
    }
  }
};

/**
 * A copy of a document, read through any Proxy, as Vue's reactive() makes,
 * which structuredClone would refuse. Lists and plain objects are copied. Any
 * other object, such as a Date that JSON couldn't have saved, or a function,
 * stays as it is, for the schema to refuse.
 */
const copyData = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => copyData(item));
  }
  return isPlainObject(value)
    ? Object.fromEntries(
        Object.entries(value as object).map(([key, item]) => [
          key,
          copyData(item),
        ])
      )
    : value;
};

const migrate = (
  input: object,
  savedVersion: number,
  currentVersion: number,
  migrations: Migrations
) => {
  let document = input;
  for (let version = savedVersion; version < currentVersion; version += 1) {
    const migration = migrations[version];
    if (!migration) {
      return {
        migrated: false as const,
        reason: `No migration from version ${version}`,
      };
    }
    try {
      document = {
        // A copy, so that a migration can't change the host's document.
        ...migration(copyData(document) as Record<string, unknown>),
        version: version + 1,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        migrated: false as const,
        reason: `Can't migrate from version ${version}: ${message}`,
      };
    }
  }
  return { document, migrated: true as const };
};

export const createDocumentLoader =
  (currentVersion: number, migrations: Migrations) =>
  (input: unknown): LoadResult => {
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      return { ok: false, reason: "A document must be an object" };
    }

    let document = input;
    const { version } = input as { version?: unknown };
    if (typeof version === "number" && Number.isInteger(version)) {
      if (version > currentVersion) {
        return {
          ok: false,
          reason: `Version ${version} is newer than the supported version ${currentVersion}`,
        };
      }
      const result = migrate(input, version, currentVersion, migrations);
      if (!result.migrated) {
        return { ok: false, reason: result.reason };
      }
      ({ document } = result);
    }

    const parsed = v.safeParse(documentSchema, document);
    if (!parsed.success) {
      return { ok: false, reason: describeIssues(parsed.issues) };
    }
    const problem = findProblem(parsed.output);
    return problem
      ? { ok: false, reason: problem }
      : {
          // Safe: each Block's props were checked by its own type's schema,
          // which the variant's type doesn't tie to the Block's type.
          document: parsed.output as BlocksDocument,
          ok: true,
        };
  };

/**
 * Version 1, which 0.1.0 saved, let a color have any one space after a comma,
 * such as a tab, and an http link or image URL have ſ for its s. They're found
 * by their keys, which hold nothing else in version 1, and written as the
 * current checks take them. Anything else is left for the schema to refuse.
 */
const fromVersion1 = (document: Record<string, unknown>) => {
  const upgrade = (value: unknown) => {
    if (typeof value !== "object" || value === null) {
      return;
    }
    const object = value as Record<string, unknown>;
    for (const [key, item] of Object.entries(object)) {
      if (typeof item !== "string") {
        upgrade(item);
      } else if (key === "backgroundColor" || key === "color") {
        object[key] = item.replaceAll(/,\s/gu, ", ");
      } else if (key === "href" || key === "src") {
        object[key] = item.replace(
          /^(?<http>[Hh][Tt][Tt][Pp])ſ:/u,
          "$<http>s:"
        );
      }
    }
  };
  upgrade(document);
  return document;
};

const MERGE_TAGS = new RegExp(MERGE_TAG.source, "gu");

/**
 * A run of text as version 3 has it: each Merge Tag in it a node with the run's
 * marks, and the text around them as runs of their own. Any other field stays
 * on each, for the schema to refuse.
 */
const withMergeTags = (run: Record<string, unknown> & { text: string }) => {
  const { text, type: _type, ...rest } = run;
  if (!MERGE_TAG.test(text)) {
    return [run];
  }
  const nodes: Record<string, unknown>[] = [];
  const addText = (from: number, to: number) => {
    if (to > from) {
      nodes.push({ ...rest, text: text.slice(from, to), type: "text" });
    }
  };
  let from = 0;
  for (const { 0: tag, index } of text.matchAll(MERGE_TAGS)) {
    addText(from, index);
    nodes.push({
      ...rest,
      attrs: { name: tag.slice(2, -2) },
      type: "mergeTag",
    });
    from = index + tag.length;
  }
  addText(from, text.length);
  return nodes;
};

/**
 * Version 2 kept a Merge Tag in text as the text `{{name}}`. Version 3 makes
 * each one that sits whole in one run of text a node (ADR 0017). A tag split
 * across runs with different marks stays text, and still exports the same.
 * Rich text is found by its `content` key, which holds nothing else in
 * version 2, and its runs by their type.
 */
const fromVersion2 = (document: Record<string, unknown>) => {
  const upgrade = (value: unknown) => {
    if (typeof value !== "object" || value === null) {
      return;
    }
    const object = value as Record<string, unknown>;
    for (const [key, item] of Object.entries(object)) {
      if (key === "content" && Array.isArray(item)) {
        object[key] = item.flatMap((node: unknown) => {
          const run = node as Record<string, unknown> | null;
          if (run?.type === "text" && typeof run.text === "string") {
            return withMergeTags(
              run as Record<string, unknown> & { text: string }
            );
          }
          upgrade(node);
          return [node];
        });
      } else {
        upgrade(item);
      }
    }
  };
  upgrade(document);
  return document;
};

/**
 * Checks a saved email and migrates it if it's an older version, without
 * changing what was passed in. It never repairs a document, so a host's
 * auto-save can't overwrite the original with a damaged copy. It gives a reason,
 * rather than throwing, for anything that isn't an email it accepts. Only
 * reading the value can throw, as a getter or a Proxy can.
 */
export const loadDocument = createDocumentLoader(DOCUMENT_VERSION, {
  1: fromVersion1,
  2: fromVersion2,
});
