import { fileURLToPath } from "node:url";

import { SOCIAL_NETWORKS } from "@mailquilt/core/internal";
import type { BlockProps } from "@mailquilt/core/internal";
import { expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import type { MailQuilt } from "../src/index.js";
import {
  addBlock,
  announcement,
  blockGroup,
  blockProps,
  canvas,
  choose,
  change,
  emailWith,
  exportHtml,
  setting,
  holdMjml,
  openPopover,
  inboxEmail,
  openCheck,
  setValue,
  test,
  violations,
} from "./helpers.js";

/** Where this Host app serves the Social icons itself. */
const ICONS = "https://icons.example/mail/";

/** The renderer's own icons, as a Host app copies them. */
const ICONS_DIR = fileURLToPath(
  new URL("../../renderer/icons/", import.meta.url)
);

test.beforeEach(({ context }) =>
  context.route(`${ICONS}*`, (route) =>
    route.fulfill({
      path: `${ICONS_DIR}${new URL(route.request().url()).pathname.split("/").pop()}`,
    })
  )
);

const icons = (page: Page) => blockGroup(page, "Social").getByRole("img");

/** Each alignment's name, as its button in the Selection bar has it. */
const ALIGN_LABELS = {
  center: "Center",
  left: "Left",
  right: "Right",
} as const;

/** An email of one Social Block, with the Host app's icons. */
const openSocial = async (page: Page, links: BlockProps["social"]["links"]) => {
  const email = emailWith([[[]]]);
  const column = email.rows[0]?.columns[0];
  column?.blocks.push({
    id: "social-1",
    props: { links },
    type: "social",
  });
  await page.goto("/");
  await canvas(page).evaluate((element, url) => {
    (element as MailQuilt).socialIconsUrl = url;
  }, ICONS);
  await setValue(page, email);
  for (const icon of await icons(page).all()) {
    await expect(icon).toHaveJSProperty("complete", true);
  }
};

test("draws each link's icon from the Host app's folder, as the export does, with a link without a URL faded", async ({
  page,
}) => {
  await openSocial(page, [
    { network: "facebook", url: "https://facebook.com/shop" },
    { network: "instagram" },
    { network: "x", url: "https://x.com/shop" },
  ]);

  const drawn = await icons(page).evaluateAll((images) =>
    images.map((image) => ({
      alt: image.getAttribute("alt"),
      loaded: (image as HTMLImageElement).naturalWidth > 0,
      opacity: getComputedStyle(image).opacity,
      src: (image as HTMLImageElement).src,
    }))
  );
  const html = await exportHtml(page);

  expect(drawn).toStrictEqual([
    {
      alt: "Facebook",
      loaded: true,
      opacity: "1",
      src: `${ICONS}facebook-color.png`,
    },
    {
      alt: "Instagram, no URL yet",
      loaded: true,
      opacity: "0.35",
      src: `${ICONS}instagram-color.png`,
    },
    { alt: "X", loaded: true, opacity: "1", src: `${ICONS}x-color.png` },
  ]);
  expect(html).toContain(`src="${ICONS}facebook-color.png"`);
  expect(html).toContain(`src="${ICONS}x-color.png"`);
  expect(html).not.toContain("instagram");
});

test("a new Social Block says it has no links, as the email shows nothing", async ({
  page,
}) => {
  await page.goto("/");

  await addBlock(page, "Social");

  await expect(blockGroup(page, "Social")).toContainText("No social links yet");
  await expect(icons(page)).toHaveCount(0);
  expect(await exportHtml(page)).not.toContain("<img");
});

test("the icons take the size chosen in the Selection bar", async ({
  page,
}) => {
  await openSocial(page, [
    { network: "facebook", url: "https://facebook.com/shop" },
  ]);
  await blockGroup(page, "Social").click();

  await choose(page, "Icon size", "48");

  expect(await blockProps(page)).toMatchObject({ iconSize: 48 });
  await expect(icons(page)).toHaveJSProperty("width", 48);
});

/** A link for every Social network. */
const ALL_LINKS = (
  Object.keys(SOCIAL_NETWORKS) as (keyof typeof SOCIAL_NETWORKS)[]
).map((network) => ({ network, url: `https://${network}.example/shop` }));

/** The space between the first line of icons and the second, in px. */
const spaceBetweenLines = async (images: Locator) => {
  const all = await images.all();
  const found = await Promise.all(all.map((image) => image.boundingBox()));
  const boxes = found.filter((box) => box !== null);
  const firstTop = Math.min(...boxes.map(({ y }) => y));
  const firstLine = boxes.filter(
    ({ y }) => Math.round(y) === Math.round(firstTop)
  );
  const below = boxes.filter(({ y }) => Math.round(y) > Math.round(firstTop));
  return (
    Math.min(...below.map(({ y }) => y)) -
    Math.max(...firstLine.map(({ height, y }) => y + height))
  );
};

/** The space above and below the icon, inside what holds the Block. */
const around = async (icon: Locator, holder: Locator) => {
  const [image, box] = await Promise.all([
    icon.boundingBox(),
    holder.boundingBox(),
  ]);
  const top = (image?.y ?? 0) - (box?.y ?? 0);
  const bottom =
    (box?.y ?? 0) + (box?.height ?? 0) - (image?.y ?? 0) - (image?.height ?? 0);
  return { bottom, top };
};

test("icons that wrap have the gap between icons between their lines too, on the canvas and in the export", async ({
  page,
}) => {
  await openSocial(page, ALL_LINKS);
  await blockGroup(page, "Social").click();
  await choose(page, "Icon size", "48");
  await expect(icons(page).first()).toHaveJSProperty("width", 48);

  // Every network's 48px icon and the 24px gaps are wider than the email.
  expect(await spaceBetweenLines(icons(page))).toBeCloseTo(24, 0);
  await openCheck(page);
  const exported = inboxEmail(page).getByRole("img");
  await expect(exported).toHaveCount(ALL_LINKS.length);
  for (const icon of await exported.all()) {
    await expect(icon).toHaveJSProperty("complete", true);
  }
  expect(await spaceBetweenLines(exported)).toBeCloseTo(24, 0);
});

/** Where each line of icons starts and ends, from the top line down, in px. */
const lineEdges = async (images: Locator) => {
  const all = await images.all();
  const found = await Promise.all(all.map((image) => image.boundingBox()));
  const lines = new Map<number, { end: number; start: number }>();
  for (const box of found.filter((each) => each !== null)) {
    const top = Math.round(box.y);
    const line = lines.get(top) ?? { end: -Infinity, start: Infinity };
    lines.set(top, {
      end: Math.max(line.end, box.x + box.width),
      start: Math.min(line.start, box.x),
    });
  }
  return [...lines.entries()]
    .toSorted(([top], [other]) => top - other)
    .map(([, edges]) => edges);
};

for (const align of ["right", "center"] as const) {
  test(`icons that wrap, aligned ${align}, line up the same on every line, on the canvas and in the export`, async ({
    page,
  }) => {
    await openSocial(page, ALL_LINKS);
    await blockGroup(page, "Social").click();
    await choose(page, "Icon size", "48");
    await choose(page, "Alignment", ALIGN_LABELS[align]);
    await expect(icons(page).first()).toHaveJSProperty("width", 48);
    /** The end of each line for right, and its middle for center. */
    const placeOf = ({ end, start }: { end: number; start: number }) =>
      Math.round(align === "right" ? end : (start + end) / 2);
    const places = async (images: Locator) => {
      const lines = await lineEdges(images);
      return new Set(lines.map(placeOf)).size;
    };

    expect(await lineEdges(icons(page))).toHaveLength(2);
    expect(await places(icons(page))).toBe(1);
    await openCheck(page);
    const exported = inboxEmail(page).getByRole("img");
    await expect(exported).toHaveCount(ALL_LINKS.length);
    for (const icon of await exported.all()) {
      await expect(icon).toHaveJSProperty("complete", true);
    }
    expect(await places(exported)).toBe(1);
  });
}

test("one line of icons is no taller than the icons and the Block's padding, on the canvas and in the export", async ({
  page,
}) => {
  await openSocial(page, [
    { network: "facebook", url: "https://facebook.com/shop" },
  ]);
  expect(await around(icons(page), blockGroup(page, "Social"))).toEqual({
    bottom: 16,
    top: 16,
  });
  await openCheck(page);
  // Reaching for the image while its frame first loads crashed Firefox's page
  // here, which the email showing first doesn't.
  await expect(inboxEmail(page)).toBeVisible();
  const exported = inboxEmail(page).getByRole("img");
  await expect(exported).toHaveJSProperty("complete", true);
  // The Row's own table, the outermost around the icon.
  expect(
    await around(exported, exported.locator("xpath=ancestor::table[last()]"))
  ).toEqual({ bottom: 16, top: 16 });
});

test("Check loads the icons from the folder the Host app gives now, not the one it rendered with", async ({
  page,
}) => {
  await openSocial(page, [{ network: "x", url: "https://x.com/shop" }]);
  await openCheck(page);
  await expect(inboxEmail(page).getByRole("img")).toHaveAttribute(
    "src",
    `${ICONS}x-color.png`
  );

  await canvas(page).evaluate((element) => {
    (element as MailQuilt).socialIconsUrl = "https://icons.example/other/";
  });

  await expect(inboxEmail(page).getByRole("img")).toHaveAttribute(
    "src",
    "https://icons.example/other/x-color.png"
  );
});

test("a check rendered with the old folder isn't kept once the folder changes during it", async ({
  page,
}) => {
  await openSocial(page, [{ network: "x", url: "https://x.com/shop" }]);
  const release = await holdMjml(page);
  await openCheck(page);
  await canvas(page).evaluate((element) => {
    (element as MailQuilt).socialIconsUrl = "https://icons.example/other/";
  });

  await release();

  await expect(inboxEmail(page).getByRole("img")).toHaveAttribute(
    "src",
    "https://icons.example/other/x-color.png"
  );
});

const addChoice = (page: Page) => setting(page, "Choose a network");

/** A button on a link's toolbar in the Links popover. */
const tool = (page: Page, name: string) =>
  canvas(page).getByRole("button", { exact: true, name });

/** Selects the Social Block, and opens its Links from the Selection bar. */
const selectSocial = async (page: Page) => {
  await blockGroup(page, "Social").click();
  await openPopover(page, /^Links/u);
};

test.describe("the links in the Links popover", () => {
  const FACEBOOK = {
    network: "facebook",
    url: "https://facebook.com/shop",
  } as const;
  const X = { network: "x", url: "https://x.com/shop" } as const;

  test("adds a network not yet used, which shows faded at once, and its URL takes focus", async ({
    page,
  }) => {
    await openSocial(page, [FACEBOOK]);
    await selectSocial(page);
    const choice = await addChoice(page);
    await expect(choice.getByRole("option")).not.toContainText(["Facebook"]);

    await choice.selectOption({ label: "Instagram" });
    await page.getByRole("button", { exact: true, name: "Add" }).click();

    expect(await blockProps(page)).toMatchObject({
      links: [FACEBOOK, { network: "instagram" }],
    });
    await expect(await setting(page, "Instagram URL")).toBeFocused();
    await expect(icons(page).nth(1)).toHaveAttribute(
      "alt",
      "Instagram, no URL yet"
    );
    await expect(announcement(page)).toHaveText(
      "Instagram added, position 2 of 2."
    );
  });

  test("a refused URL shows its message by its link, and stays through a move and a removal of another", async ({
    page,
  }) => {
    await openSocial(page, [FACEBOOK, { network: "instagram" }, X]);
    await selectSocial(page);
    const instagram = await setting(page, "Instagram URL");

    await change(instagram, "instagram shop");
    await expect(instagram).toHaveAccessibleDescription(/isn't a web address/u);
    // A pressed button takes focus, which goes with its link as it moves to
    // the top, where Move up turns off, or after a removal to the next Remove.
    await tool(page, "Move Instagram up").click();
    await expect(tool(page, "Move Instagram down")).toBeFocused();
    await tool(page, "Remove Facebook").click();
    await expect(tool(page, "Remove X")).toBeFocused();

    expect(await blockProps(page)).toMatchObject({
      links: [{ network: "instagram" }, X],
    });
    await expect(instagram).toHaveValue("instagram shop");
    await expect(instagram).toHaveAttribute("aria-invalid", "true");
    expect(await violations(page)).toStrictEqual([]);
  });

  test("clearing a URL leaves the link without one", async ({ page }) => {
    await openSocial(page, [FACEBOOK, X]);
    await selectSocial(page);

    await change(await setting(page, "Facebook URL"), "");

    expect(await blockProps(page)).toStrictEqual({
      links: [{ network: "facebook" }, X],
    });
  });

  // So a translation can put the network's name where its language needs it.
  test("a link's URL field is named by one text, with the network's name in it", async ({
    page,
  }) => {
    await openSocial(page, [FACEBOOK]);
    await canvas(page).evaluate((element) => {
      (element as MailQuilt).strings = {
        "settings.listItem": "{label} de {name}",
      };
    });
    await selectSocial(page);

    await expect(await setting(page, "URL de Facebook")).toHaveValue(
      "https://facebook.com/shop"
    );
  });

  test("from the keyboard, a link's toolbar is one Tab stop, and focus stays with what it moved or goes to the next link's Remove", async ({
    page,
  }) => {
    await openSocial(page, [FACEBOOK, { network: "instagram" }, X]);
    await selectSocial(page);
    const facebook = await setting(page, "Facebook URL");
    await facebook.focus();

    // Its toolbar comes before its URL. The first link can't move up, so the
    // toolbar's stop is Move down.
    await page.keyboard.press("Shift+Tab");
    await expect(tool(page, "Move Facebook down")).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(tool(page, "Move Facebook down")).toBeFocused();
    await expect(announcement(page)).toHaveText(
      "Facebook moved to position 2 of 3."
    );
    await page.keyboard.press("ArrowRight");
    await expect(tool(page, "Remove Facebook")).toBeFocused();
    await page.keyboard.press("Space");

    await expect(tool(page, "Remove X")).toBeFocused();
    await expect(announcement(page)).toHaveText("Facebook removed.");
    expect(await blockProps(page)).toMatchObject({
      links: [{ network: "instagram" }, X],
    });
    // Tab leaves the toolbar, to its link's URL.
    await page.keyboard.press("Tab");
    await expect(await setting(page, "X URL")).toBeFocused();
  });

  test("an undo that turns off the focused button leaves focus on its link's toolbar", async ({
    page,
  }) => {
    await openSocial(page, [FACEBOOK, X]);
    await selectSocial(page);
    await tool(page, "Move X up").focus();
    await page.keyboard.press("Enter");
    await expect(tool(page, "Move X down")).toBeFocused();

    await page.keyboard.press("ControlOrMeta+z");

    expect(await blockProps(page)).toMatchObject({ links: [FACEBOOK, X] });
    await expect(tool(page, "Move X up")).toBeFocused();
  });

  test("a URL opens the Merge Tag list on {{", async ({ page }) => {
    await openSocial(page, [{ network: "x" }]);
    await canvas(page).evaluate((element) => {
      (element as MailQuilt).mergeTags = [{ name: "x_url" }];
    });
    await selectSocial(page);
    const url = await setting(page, "X URL");

    await url.click();
    await page.keyboard.type("{{");
    await expect(
      canvas(page).getByRole("option", { name: "x_url" })
    ).toBeVisible();
    expect(await violations(page)).toStrictEqual([]);
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");

    expect(await blockProps(page)).toMatchObject({
      links: [{ network: "x", url: "{{x_url}}" }],
    });
  });
});
