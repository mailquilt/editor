import * as v from "valibot";

export const describeIssues = (issues: readonly v.BaseIssue<unknown>[]) =>
  issues
    .map((issue) => {
      const path = v.getDotPath(issue);
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");

/** Checks what `owner`'s properties would become. */
export const parseProps = (
  schema: v.GenericSchema<unknown, Record<string, unknown>>,
  props: unknown,
  owner: string
) => {
  const result = v.safeParse(schema, props);
  return result.success
    ? { ok: true as const, props: result.output }
    : {
        ok: false as const,
        reason: `Invalid props for ${owner}: ${describeIssues(result.issues)}`,
      };
};
