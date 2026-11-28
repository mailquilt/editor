import type { BlockProps } from "@mailquilt/core/internal";
import { expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import {
  addBlock,
  announcement,
  blockGroup,
  blockProps,
  blocks,
  canvas,
  change,
  checkPanel,
  exportHtml,
  inboxEmail,
  openCheck,
  openPopover,
  selectionBar,
  setValue,
  test,
  violations,
} from "./helpers.js";
import { emailWith } from "./host/email.js";

const SHOP = { label: "Shop", url: "https://northbound.co/shop" } as const;
const JOURNAL = {
  label: "Journal",
  url: "https://northbound.co/journal",
} as const;

/** An email of one Menu Block with these props. */
const openMenu = async (page: Page, props: BlockProps["menu"]) => {
  const email = emailWith([[[]]]);
  email.rows[0]?.columns[0]?.blocks.push({
    id: "menu-1",
    props,
    type: "menu",
  });
  await page.goto("/");
  await setValue(page, email);
};

const menu = (page: Page) => blockGroup(page, "Menu");

/** A field of a link in the Links popover, by its accessible name. */
const linkField = (page: Page, name: string) =>
  canvas(page).getByRole("textbox", { exact: true, name });

/** A button on a link's toolbar, or the popover's Add link. */
const button = (page: Page, name: string) =>
  canvas(page).getByRole("button", { exact: true, name });

/** Selects the Menu, and opens its Links from the Selection bar. */
const openLinks = async (page: Page) => {
  await menu(page).click();
  await openPopover(page, /^Links/u);
};

test("a new Menu says what goes in it, and the bar's Add link adds a link whose label takes focus", async ({
  page,
}) => {
  await page.goto("/");
  await addBlock(page, "Menu");
  await expect(menu(page)).toContainText("Add the links this menu shows");
  expect(await violations(page)).toStrictEqual([]);

  await selectionBar(page)
    .getByRole("button", { exact: true, name: "Add link" })
    .click();

  const all = await blocks(page);
  expect(all.find(({ type }) => type === "menu")?.props).toStrictEqual({
    links: [{}],
  });
  await expect(linkField(page, "Link 1 Label")).toBeFocused();
  await expect(announcement(page)).toHaveText("Link 1 added, position 1 of 1.");
  // Until it has a label and a URL, it shows its name, faded.
  await expect(menu(page).getByText("Link 1")).toHaveCSS("opacity", "0.35");
});

test("draws each link's label as the export writes it, with a link without a URL faded and left out", async ({
  page,
}) => {
  await openMenu(page, {
    links: [SHOP, { label: "Journal" }],
  });

  await expect(menu(page).getByText("Shop")).toHaveCSS("opacity", "1");
  await expect(menu(page).getByText("Journal")).toHaveCSS("opacity", "0.35");
  const html = await exportHtml(page);
  expect(html).toContain('href="https://northbound.co/shop"');
  expect(html).not.toContain("Journal");
});

/** Where each link starts and ends, from the start of what holds it, in px. */
const edges = async (links: Locator, holder: Locator) => {
  const holderBox = await holder.boundingBox();
  const start = holderBox?.x ?? 0;
  const each = await links.all();
  const boxes = await Promise.all(each.map((link) => link.boundingBox()));
  return boxes.map((box) => [
    Math.round((box?.x ?? 0) - start),
    Math.round((box?.x ?? 0) + (box?.width ?? 0) - start),
  ]);
};

test("the links and the gap between them sit where the export puts them", async ({
  page,
}) => {
  await openMenu(page, { align: "right", gap: 40, links: [SHOP, JOURNAL] });
  const drawn = await edges(menu(page).getByTestId("menu-link"), menu(page));

  await openCheck(page);
  const exported = inboxEmail(page).getByRole("link");
  await expect(exported).toHaveCount(2);

  // The Row's own table, the outermost around the links.
  expect(
    await edges(
      exported,
      exported.first().locator("xpath=ancestor::table[last()]")
    )
  ).toStrictEqual(drawn);
});

test("the space between links is set in the Selection bar", async ({
  page,
}) => {
  await openMenu(page, { links: [SHOP] });
  await menu(page).click();

  await change(
    selectionBar(page).getByRole("spinbutton", {
      name: "Space between links",
    }),
    "30"
  );

  expect(await blockProps(page)).toMatchObject({ gap: 30 });
});

test("Check's fix for a link that says too little opens the Links with focus in that link's label, of those the email shows", async ({
  page,
}) => {
  await openMenu(page, {
    links: [
      { label: "Learn more" },
      SHOP,
      { label: "Learn more", url: "https://northbound.co/about" },
    ],
  });
  await openCheck(page);

  await checkPanel(page)
    .getByRole("listitem")
    .filter({ hasText: "“Learn more” doesn't say where it goes" })
    .getByRole("button", { name: "Change the text" })
    .click();

  await expect(linkField(page, "Learn more Label").nth(1)).toBeFocused();
});

test("Check's fix for the links' color goes to the color, not a link without a label", async ({
  page,
}) => {
  await openMenu(page, { color: "#999999", links: [{}, SHOP] });
  await openCheck(page);

  await checkPanel(page)
    .getByRole("listitem")
    .filter({ hasText: "Links are hard to read" })
    .getByRole("button", { name: "Change the color" })
    .click();

  await expect(linkField(page, "Link 1 Label")).toHaveCount(0);
  await expect(
    canvas(page).getByRole("textbox", { exact: true, name: "Text color" })
  ).toBeFocused();
});

test.describe("the links in the Links popover", () => {
  test("a link's label and URL are typed in, and a refused URL shows its message and stays with its link as it moves", async ({
    page,
  }) => {
    await openMenu(page, { links: [SHOP, {}] });
    await openLinks(page);

    await change(linkField(page, "Link 2 Label"), "Journal");
    const url = linkField(page, "Journal Link");
    await change(url, "northbound journal");
    await expect(url).toHaveAccessibleDescription(
      /isn’t a web address/u
    );

    await button(page, "Move Journal up").click();

    expect(await blockProps(page)).toStrictEqual({
      links: [{ label: "Journal" }, SHOP],
    });
    // The first link's field now, as an item's key is its position.
    await expect(linkField(page, "Journal Link")).toHaveValue(
      "northbound journal"
    );
    await expect(linkField(page, "Journal Link")).toHaveAttribute(
      "aria-invalid",
      "true"
    );
    await expect(linkField(page, "Shop Link")).toHaveAttribute(
      "aria-invalid",
      "false"
    );
    expect(await violations(page)).toStrictEqual([]);
  });

  test("from the keyboard, a link's label, its URL and then its toolbar are each a Tab stop, and focus goes with what changed", async ({
    page,
  }) => {
    await openMenu(page, { links: [SHOP, JOURNAL] });
    await openLinks(page);
    await linkField(page, "Shop Label").focus();

    await page.keyboard.press("Tab");
    await expect(linkField(page, "Shop Link")).toBeFocused();
    // The first link can't move up, so the toolbar's stop is Move down.
    await page.keyboard.press("Tab");
    await expect(button(page, "Move Shop down")).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(button(page, "Move Shop down")).toBeDisabled();
    await expect(button(page, "Move Shop up")).toBeFocused();
    await expect(announcement(page)).toHaveText(
      "Shop moved to position 2 of 2."
    );
    // Move down is off, so the arrow skips it.
    await page.keyboard.press("ArrowRight");
    await expect(button(page, "Remove Shop")).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(button(page, "Remove Journal")).toBeFocused();
    await expect(announcement(page)).toHaveText("Shop removed.");
    await page.keyboard.press("Enter");

    // With none left, the way to add one.
    await expect(button(page, "Add link")).toBeFocused();
    expect(await blockProps(page)).toStrictEqual({ links: [] });
    await page.keyboard.press("Enter");
    await expect(linkField(page, "Link 1 Label")).toBeFocused();
  });
});
