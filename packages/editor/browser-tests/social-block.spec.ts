import { fileURLToPath } from "node:url";

import type { BlockProps } from "@mailquilt/core/internal";
import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import type { MailQuilt } from "../src/index.js";
import {
  blockGroup,
  blockProps,
  canvas,
  exportHtml,
  field,
  palette,
  previewButton,
  previewDialog,
  previewEmail,
  setValue,
  test,
} from "./helpers.js";
import { emailWith } from "./host/email.js";

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

  await palette(page, "Social").click();

  await expect(blockGroup(page, "Social")).toContainText("No social links yet");
  await expect(icons(page)).toHaveCount(0);
});

test("the icons take the size chosen in the Side panel", async ({ page }) => {
  await openSocial(page, [
    { network: "facebook", url: "https://facebook.com/shop" },
  ]);
  await blockGroup(page, "Social").click();

  await field(page, "Icon size").selectOption({ label: "48px" });

  expect(await blockProps(page)).toMatchObject({ iconSize: 48 });
  await expect(icons(page)).toHaveJSProperty("width", 48);
});

test("the Preview loads the icons from the folder the Host app gives now, not the one it rendered with", async ({
  page,
}) => {
  await openSocial(page, [{ network: "x", url: "https://x.com/shop" }]);
  await previewButton(page).click();
  await expect(previewEmail(page).getByRole("img")).toHaveAttribute(
    "src",
    `${ICONS}x-color.png`
  );
  await page.keyboard.press("Escape");
  await expect(previewDialog(page)).toBeHidden();

  await canvas(page).evaluate((element) => {
    (element as MailQuilt).socialIconsUrl = "https://icons.example/other/";
  });
  await previewButton(page).click();

  await expect(previewEmail(page).getByRole("img")).toHaveAttribute(
    "src",
    "https://icons.example/other/x-color.png"
  );
});
