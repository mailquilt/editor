/**
 * Compares content, not identity or key order, because a host may clone a
 * document or get it back from a store that reorders keys. A field set to
 * undefined counts as missing, because JSON drops it. List entries always count.
 * Two values that each hold a cycle, which JSON can't, overflow the stack.
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
  // Own keys only, as `object.__proto__` reads the prototype when the object
  // has no key of that name.
  return Object.keys({ ...first, ...second }).every((key) =>
    isSameDocument(
      Object.hasOwn(first, key) ? first[key] : undefined,
      Object.hasOwn(second, key) ? second[key] : undefined
    )
  );
};
