import type { BlocksDocument } from "@mailquilt/core";
import { expect } from "@playwright/test";
import type { Page, Route } from "@playwright/test";

import type { HostFont, MailQuilt } from "../src/index.js";
import {
  canvas,
  currentValue,
  openStyle,
  setValue,
  styleSetting,
  stylePanel,
  test,
  undo,
  violations,
} from "./helpers.js";
import { emailWith } from "./host/email.js";

/**
 * A stylesheet that declares `name` from a font on the computer, one of those
 * on a Mac, Windows and the Linux the tests run on in CI, so no font file is
 * fetched.
 */
const stylesheet = (name: string, unicodeRange = "U+0-10FFFF") =>
  `@font-face { font-family: "${name}"; src: local("Georgia"), local("Times New Roman"), local("DejaVu Serif"), local("Liberation Serif"); unicode-range: ${unicodeRange}; }`;

const BRAND = {
  fallback: "Georgia, 'Times New Roman', serif",
  name: "Brand Serif",
  url: "https://fonts.example/brand-serif.css",
} satisfies HostFont;
const FAILING = {
  fallback: "Georgia, serif",
  name: "Fraunces",
  url: "https://fonts.example/fraunces.css",
} satisfies HostFont;
const SLOW = {
  fallback: "Arial, sans-serif",
  name: "Inter",
  url: "https://fonts.example/inter.css",
} satisfies HostFont;

/** A font for Japanese kana only, which a space doesn't need. */
const KANA = {
  fallback: "'Hiragino Sans', sans-serif",
  name: "Kana Sans",
  url: "https://fonts.example/kana.css",
} satisfies HostFont;

/**
 * Serves the fonts' stylesheets: Brand Serif's and Kana Sans's, none for
 * Fraunces, and Inter's only once the returned function is called.
 */
const serveFonts = async (page: Page) => {
  let slow: Route | undefined;
  await page.route("https://fonts.example/**", async (route: Route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === "/brand-serif.css") {
      await route.fulfill({
        body: stylesheet(BRAND.name),
        contentType: "text/css",
      });
    } else if (pathname === "/kana.css") {
      await route.fulfill({
        body: stylesheet(KANA.name, "U+3040-30FF"),
        contentType: "text/css",
      });
    } else if (pathname === "/inter.css") {
      slow = route;
    } else {
      await route.fulfill({ status: 404 });
    }
  });
  return async () => {
    await expect.poll(() => slow).toBeDefined();
    await slow?.fulfill({
      body: stylesheet(SLOW.name),
      contentType: "text/css",
    });
  };
};

const openWithFonts = async (
  page: Page,
  fonts: HostFont[],
  email: BlocksDocument = emailWith([[["Hello"]]]),
  { style = true } = {}
) => {
  const finishSlow = await serveFonts(page);
  await page.goto("/");
  await canvas(page).evaluate((element, given) => {
    (element as MailQuilt).fonts = given;
  }, fonts);
  await setValue(page, email);
  if (style) {
    await openStyle(page);
  }
  return finishSlow;
};

/** Whether the page has loaded a face of the font, which the Canvas draws in. */
const hasLoaded = (page: Page, name: string) =>
  page.evaluate(
    (family) =>
      [...document.fonts].some(
        (face) =>
          face.family.replaceAll('"', "") === family && face.status === "loaded"
      ),
    name
  );

const pick = async (page: Page, setting: string, font: string) => {
  await styleSetting(page, setting).click();
  await stylePanel(page)
    .getByRole("option", { name: new RegExp(`^${font}`, "u") })
    .click();
};

/** An email saved with Brand Serif as its body font. */
const savedWithBrand = () => {
  const email = emailWith([[["Hello"]]]);
  email.settings.fontFamily = `'Brand Serif', ${BRAND.fallback}`;
  email.settings.fonts = [{ name: BRAND.name, url: BRAND.url }];
  return email;
};

const emailText = (page: Page) =>
  canvas(page).getByTestId("email").getByText("Hello", { exact: true });

test.describe("web fonts", () => {
  test("offers the Host app's fonts above the system fonts, each with its fallback", async ({
    page,
  }) => {
    await openWithFonts(page, [BRAND]);

    await styleSetting(page, "Body").click();

    const list = stylePanel(page).getByRole("listbox");
    await expect(list).toContainText(
      /^\s*Your fonts\s*Brand Serif\s*Falls back to Georgia\s*System fonts\s*Arial/u
    );
    expect(await violations(page)).toStrictEqual([]);
  });

  test("picks a web font, stored with its URL as one undo step, and the Canvas draws in it", async ({
    page,
  }) => {
    await openWithFonts(page, [BRAND]);
    const before = await currentValue(page);

    await pick(page, "Body", BRAND.name);

    const picked = await currentValue(page);
    expect(picked.settings).toMatchObject({
      fontFamily: `'Brand Serif', ${BRAND.fallback}`,
      fonts: [{ name: BRAND.name, url: BRAND.url }],
    });
    await expect(emailText(page)).toHaveCSS("font-family", /^"?'?Brand Serif/u);
    await expect.poll(() => hasLoaded(page, BRAND.name)).toBe(true);

    // The Headings' list takes the same font, kept once.
    await pick(page, "Headings", BRAND.name);
    const both = await currentValue(page);
    expect(both.settings).toMatchObject({
      fonts: [{ name: BRAND.name, url: BRAND.url }],
      style: { headingFontFamily: `'Brand Serif', ${BRAND.fallback}` },
    });

    await undo(page);
    await undo(page);
    expect(await currentValue(page)).toStrictEqual(before);
  });

  test("draws a saved email's web font in Edit", async ({ page }) => {
    await openWithFonts(page, [BRAND], savedWithBrand(), { style: false });

    await expect.poll(() => hasLoaded(page, BRAND.name)).toBe(true);
  });

  // Its stylesheet would apply to the whole page, and an imported email can
  // name any URL.
  test("doesn't load a saved email's web font the Host app doesn't offer, and lists it among yours", async ({
    page,
  }) => {
    await openWithFonts(page, [], savedWithBrand());

    await expect(canvas(page)).toBeVisible();
    expect(await page.locator(`head link[href="${BRAND.url}"]`).count()).toBe(
      0
    );
    await styleSetting(page, "Body").click();
    await expect(stylePanel(page).getByRole("listbox")).toContainText(
      /^\s*Your fonts\s*Brand Serif\s*Falls back to Georgia/u
    );
    await expect(
      stylePanel(page).getByRole("option", { selected: true })
    ).toContainText("Brand Serif");
  });

  test("says a web font is loading, and once it's failed, what readers may see", async ({
    page,
  }) => {
    const finishSlow = await openWithFonts(page, [FAILING, KANA, SLOW]);

    await pick(page, "Body", SLOW.name);
    await expect(styleSetting(page, "Body")).toHaveAccessibleDescription(
      "Loading Inter…"
    );
    await finishSlow();
    await expect(styleSetting(page, "Body")).not.toHaveAccessibleDescription(
      /./u
    );

    // Loaded, though nothing on the Canvas needs its letters yet.
    await pick(page, "Body", KANA.name);
    await expect(styleSetting(page, "Body")).not.toHaveAccessibleDescription(
      /./u
    );

    await pick(page, "Headings", FAILING.name);
    await expect(styleSetting(page, "Headings")).toHaveAccessibleDescription(
      "Fraunces couldn't be loaded, so you see Georgia, its fallback. Readers may see Georgia too."
    );
    for (const theme of ["light", "dark"]) {
      await canvas(page).evaluate((element, chosen) => {
        element.setAttribute("theme", chosen);
      }, theme);
      expect(await violations(page)).toStrictEqual([]);
    }
  });
});
