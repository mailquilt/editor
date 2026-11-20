import { describe, expect, it } from "vitest";

import page from "../../../apps/docs/docs/keyboard.mdx?raw";
import { HEARD_FIRST, KEY_MAP, TEXT_KEYS } from "../src/key-map.js";

/** The page's names for keys, as the key map writes them. */
const MAP_NAMES: Record<string, string> = {
  Down: "ArrowDown",
  Left: "ArrowLeft",
  Right: "ArrowRight",
  Up: "ArrowUp",
};

/** In the one order names are compared in. */
const MODIFIERS = ["Alt", "Ctrl", "Mod", "Shift"];

/** A key's name with its modifiers in one order, and a letter in lower case. */
const sameOrder = (name: string) => {
  const modifiers = name.split("-");
  const key = modifiers.pop() ?? "";
  return [
    ...MODIFIERS.filter((modifier) => modifiers.includes(modifier)),
    key.length === 1 ? key.toLowerCase() : key,
  ].join("-");
};

/**
 * The keys one run of `<kbd>`s names, such as `<kbd>Alt</kbd> + <kbd>Up</kbd>
 * <kbd>Down</kbd>`: + joins a modifier to a key, and a space or "or" gives
 * another key in its place. A run of modifiers alone names no key.
 */
const keysIn = (run: string) => {
  const groups = run
    .split(/\s*\+\s*/u)
    .map((group) =>
      [...group.matchAll(/<kbd>(?<key>[^<]+)<\/kbd>/gu)].map(
        ({ groups: { key = "" } = {} }) => MAP_NAMES[key] ?? key
      )
    )
    // "Ctrl or ⌘" is the map's Mod. Ctrl alone is Ctrl, as on Windows and Linux.
    .map((group) =>
      group.includes("Ctrl") && group.includes("⌘") ? ["Mod"] : group
    );
  let names = groups.pop() ?? [];
  if (names.every((key) => key === "⌘" || MODIFIERS.includes(key))) {
    return [];
  }
  for (const modifiers of groups) {
    names = names.flatMap((name) =>
      modifiers.map((modifier) => `${modifier}-${name}`)
    );
  }
  return names.map(sameOrder);
};

const onPage = new Set(
  [
    ...page.matchAll(
      /<kbd>[^<]+<\/kbd>(?:\s*(?:\+|or)?\s*<kbd>[^<]+<\/kbd>)*/gu
    ),
  ].flatMap(([run]) => keysIn(run))
);

const entries = [
  ...Object.values(KEY_MAP).flat(),
  ...Object.values(HEARD_FIRST).flat(),
];
/**
 * Every key the key map names, and the text's keys that work too without being
 * named in tooltips, such as Shift+Ctrl+B. Mod in a key only for Windows and
 * Linux is Ctrl.
 */
const named = new Set(
  [
    ...entries.flatMap(({ keys, platform }) =>
      keys === "any"
        ? []
        : keys.map((key) =>
            platform === "other" ? key.replace("Mod", "Ctrl") : key
          )
    ),
    ...TEXT_KEYS.flatMap(({ aliases = [], keys }) => [...keys, ...aliases]),
  ].map(sameOrder)
);
/** Keys that act with any modifiers held, such as Tab, so Shift+Tab too. */
const withAnyModifiers = new Set(
  entries.flatMap(({ anyModifiers, keys }) =>
    anyModifiers && keys !== "any" ? keys : []
  )
);
const isKnown = (key: string) =>
  named.has(key) || withAnyModifiers.has(key.split("-").at(-1) ?? "");

describe("the keyboard page", () => {
  it("names every key the key map names", () => {
    expect([...named].filter((key) => !onPage.has(key))).toStrictEqual([]);
  });

  it("names no key the key map doesn't have", () => {
    expect(onPage.size).toBeGreaterThan(0);
    expect([...onPage].filter((key) => !isKnown(key))).toStrictEqual([]);
  });
});
