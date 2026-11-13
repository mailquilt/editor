import * as v from "valibot";

import { describeIssues, validateProps } from "./blocks.js";
import { DOCUMENT_VERSION } from "./create-email.js";
import type { BlocksDocument } from "./document.js";
import { emailSettingsSchema, rowPropsSchema } from "./settings.js";

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

// The object schemas let an array through, and would load `[]` as `{}`.
const notAList = v.check(
  (input: unknown) => !Array.isArray(input),
  "Expected an object, not a list"
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
            blocks: v.array(
              v.strictObject({
                id: idSchema,
                // Checked by validateProps, because v.record would silently drop
                // a key such as "constructor".
                props: v.pipe(v.unknown(), notAList),
                type: v.string(),
              })
            ),
            id: idSchema,
            props: v.pipe(v.unknown(), notAList, v.strictObject({})),
            width: v.pipe(v.number(), v.minValue(1), v.maxValue(100)),
          })
        ),
        v.minLength(1),
        v.maxLength(4)
      ),
      id: idSchema,
      props: v.pipe(v.unknown(), notAList, rowPropsSchema),
    })
  ),
  settings: emailSettingsSchema,
  version: v.pipe(v.number(), v.integer()),
});

type ParsedDocument = v.InferOutput<typeof documentSchema>;

/** What the schema can't see: Block props, and rules across several items. */
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
        const validated = validateProps(block, block.props);
        if (!validated.valid) {
          return validated.reason;
        }
        // The schema passes props through, so this also stops them being shared
        // with the document the host passed in.
        block.props = validated.props;
      }
    }
  }
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
        ...migration(structuredClone(document) as Record<string, unknown>),
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
      : { document: parsed.output as BlocksDocument, ok: true };
  };

/**
 * Checks a saved email and migrates it if it's an older version, without
 * changing what was passed in. It never repairs a document, so a host's
 * auto-save can't overwrite the original with a damaged copy. Never throws.
 */
export const loadDocument = createDocumentLoader(DOCUMENT_VERSION, {});

/**
 * Compares content, not identity or key order, because a host may clone a
 * document or get it back from a store that reorders keys. A field set to
 * undefined counts as missing, because JSON drops it. List entries always count.
 */
export const isSameDocument = (a: unknown, b: unknown): boolean => {
  if (a === b) {
    return true;
  }
  if (
    typeof a !== "object" ||
    typeof b !== "object" ||
    a === null ||
    b === null ||
    Array.isArray(a) !== Array.isArray(b)
  ) {
    return false;
  }
  if (Array.isArray(a) && a.length !== (b as unknown[]).length) {
    return false;
  }
  const first = a as Record<string, unknown>;
  const second = b as Record<string, unknown>;
  return Object.keys({ ...first, ...second }).every((key) =>
    isSameDocument(first[key], second[key])
  );
};
