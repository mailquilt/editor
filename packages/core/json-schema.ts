// The format's JSON Schema, made from the schema `loadDocument` checks with, so
// the two can't disagree. Any rule the conversion can't carry fails the build,
// unless it's one of the rules below that compare values with each other.
import { writeFileSync } from "node:fs";

import { toJsonSchema } from "@valibot/to-json-schema";
import type * as v from "valibot";

import packageJson from "./package.json" with { type: "json" };
import type * as Core from "./src/internal.js";

/**
 * Rules JSON Schema can't express. The document format page lists each one,
 * beside those `loadDocument` checks across the whole email, and the schema's
 * description links there.
 */
const ACROSS_VALUES = new Set([
  "A Social Block can link each network only once",
  "A decorative Image can't have alt text or a link",
  "A linked Image needs alt text",
  "An email can have each web font only once",
  "Text can't have the same mark twice",
]);

/** Writes the schema into `outDir`, from core's build there. */
export const writeJsonSchema = async (outDir: URL) => {
  // The build, as Node can't follow src's imports to its .ts files.
  const { DOCUMENT_VERSION, documentSchema }: typeof Core = await import(
    String(new URL("internal.js", outDir))
  );

  const { $schema, ...schema } = toJsonSchema(documentSchema, {
    overrideAction: ({ jsonSchema, valibotAction }) => {
      if (valibotAction.type === "regex") {
        const { requirement } = valibotAction as v.RegexAction<string, string>;
        // JSON Schema's patterns are always read as Unicode, as u reads them.
        const isUnicode =
          requirement.flags === "u" &&
          jsonSchema.pattern === requirement.source;
        return isUnicode ? jsonSchema : null;
      }
      if (valibotAction.type === "check") {
        const { message } = valibotAction as v.CheckAction<unknown, string>;
        return ACROSS_VALUES.has(message) ? jsonSchema : null;
      }
      return null;
    },
    target: "draft-2020-12",
    // A saved document's props are checked as objects first, which JSON's
    // objects always are, so only the schema each pipe ends with is kept.
    typeMode: "output",
  });

  const published = {
    $id: `${packageJson.homepage}/schema/v${DOCUMENT_VERSION}.json`,
    $schema,
    description: `An email as Mail Quilt saves it. A few rules that compare one value with another, such as every ID being different, only the editor checks: ${packageJson.homepage}/docs/document-format#json-schema`,
    title: `Mail Quilt email, format version ${DOCUMENT_VERSION}`,
    ...schema,
    properties: {
      ...schema.properties,
      // Older versions load too, once upgraded, but this schema is for this one.
      version: { const: DOCUMENT_VERSION },
    },
  };
  writeFileSync(
    new URL("schema.json", outDir),
    `${JSON.stringify(published, null, 2)}\n`
  );
};
