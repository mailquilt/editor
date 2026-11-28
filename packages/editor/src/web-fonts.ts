import type { WebFont } from "@mailquilt/core";
import {
  fontFamilyNames,
  isFontFamily,
  isWebFont,
} from "@mailquilt/core/internal";

// The Host app's web fonts, which Style's font lists offer, and the loading of
// each into the page, so the Canvas and the lists draw in it.

/** A web font the Host app offers, as its `fonts` lists it. */
export interface HostFont {
  /** The font's family name, as its stylesheet declares it. */
  name: string;
  /** An `https:` stylesheet that declares the font, such as Google Fonts'. */
  url: string;
  /** The fonts a reader sees where it doesn't load, such as `Georgia, serif`. */
  fallback: string;
}

/** Font names are case-insensitive in CSS. */
const isSameName = (one: string, other: string) =>
  one.toLowerCase() === other.toLowerCase();

/**
 * The Host app's fonts the email can store, in its order: each with a name and
 * URL core takes, a fallback that's a font family, and a name no earlier one
 * has. Each other one is left out, and said on the console, so it's called
 * once for each list the Host app gives.
 */
export const usableFonts = (given: readonly HostFont[] | undefined) => {
  const usable: HostFont[] = [];
  for (const font of given ?? []) {
    if (
      // From plain JavaScript, it may be `null`, or an empty slot's `undefined`.
      font &&
      isWebFont(font) &&
      isFontFamily(font.fallback) &&
      !usable.some(({ name }) => isSameName(name, font.name))
    ) {
      usable.push(font);
    } else {
      console.error(
        `<mail-quilt> left out a font in fonts, as its name, https: URL or fallback isn't one it can use, or its name is taken: ${JSON.stringify(font)}`
      );
    }
  }
  return usable;
};

/** The font family a web font is picked as: its name, then its fallbacks. */
export const familyOf = ({ fallback, name }: HostFont) =>
  `'${name}', ${fallback}`;

/** The first of a font family's fallbacks, which a reader sees without it. */
export const fallbackOf = (family: string) => fontFamilyNames(family)[1];

/** The stored web font that a font family names first, if there's one. */
export const webFontOf = (
  family: string,
  fonts: readonly WebFont[] | undefined
) => {
  const [first = ""] = fontFamilyNames(family);
  return fonts?.find(({ name }) => isSameName(name, first));
};

/** The email's web fonts with `font` too, in place of one with its name. */
export const withWebFont = (
  fonts: readonly WebFont[] | undefined,
  { name, url }: WebFont
): WebFont[] => [
  ...(fonts ?? []).filter((font) => !isSameName(font.name, name)),
  { name, url },
];

export type FontLoad = "failed" | "loaded" | "loading";

/** Each stylesheet, added to the page once for every editor on it. */
const stylesheets = new Map<string, Promise<boolean>>();

const loadStylesheet = (url: string) => {
  const loading =
    stylesheets.get(url) ??
    // oxlint-disable-next-line promise/avoid-new -- A link's load and error events, which nothing turns into a promise for us.
    new Promise<boolean>((resolve) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = url;
      link.addEventListener("load", () => resolve(true), { once: true });
      link.addEventListener("error", () => resolve(false), { once: true });
      // The page's, as a font declared in a shadow root isn't used in it.
      document.head.append(link);
    });
  stylesheets.set(url, loading);
  return loading;
};

/** How each font has loaded, by its URL and name, for every editor on the page. */
const loads = new Map<string, { done: Promise<void>; state: FontLoad }>();
const keyOf = ({ name, url }: WebFont) => `${url} ${name}`;

/**
 * Whether the font loaded: its stylesheet did, and its regular face, which
 * load() asks for, didn't fail. A face asked for later, such as its bold, isn't
 * watched. A face for other letters only, such as a subset for one
 * script, isn't asked for until they're drawn, so it counts as loaded, and so
 * does a name the stylesheet doesn't declare, which shows the fallback.
 */
const loadFont = async (font: WebFont) => {
  if (!(await loadStylesheet(font.url))) {
    return false;
  }
  try {
    await document.fonts.load(`1em "${font.name}"`);
    return true;
  } catch {
    return false;
  }
};

/**
 * Loads web fonts into the page, and says how each has loaded, redrawing once
 * one has. A font loaded before, by this editor or another, is known at once.
 * Only a font the Host app offers, by its name and URL, is loaded, as its
 * stylesheet applies to the whole page: an email, such as one imported, can
 * name any URL.
 */
export const createWebFonts = ({
  offered,
  requestUpdate,
}: {
  offered: () => readonly HostFont[];
  requestUpdate: () => void;
}) => {
  /** The fonts this editor redraws for once they've loaded. */
  const waiting = new Set<string>();
  const redrawWhenDone = async (key: string, done: Promise<void>) => {
    await done;
    waiting.delete(key);
    requestUpdate();
  };
  return {
    /**
     * Starts loading `font` if nothing has, and says how it has loaded, or
     * nothing for a font the Host app doesn't offer, which isn't loaded.
     */
    load(font: WebFont): FontLoad | undefined {
      if (
        !offered().some(
          ({ name, url }) => isSameName(name, font.name) && url === font.url
        )
      ) {
        return;
      }
      const key = keyOf(font);
      let load = loads.get(key);
      if (!load) {
        const started = {
          done: Promise.resolve(),
          state: "loading" as FontLoad,
        };
        started.done = (async () => {
          started.state = (await loadFont(font)) ? "loaded" : "failed";
        })();
        load = started;
        loads.set(key, load);
      }
      if (load.state === "loading" && !waiting.has(key)) {
        waiting.add(key);
        redrawWhenDone(key, load.done);
      }
      return load.state;
    },
  };
};

export type WebFonts = ReturnType<typeof createWebFonts>;
