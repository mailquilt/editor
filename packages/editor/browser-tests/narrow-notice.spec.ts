import { expect } from "@playwright/test";

import {
  canvas,
  hostEvents,
  NARROW_VIEWPORT,
  narrowNotice,
  previewEmail,
  previewEmailButton,
  test,
  textBlock,
} from "./helpers.js";

test.describe("on a screen too narrow to edit in", () => {
  test.use({ viewport: NARROW_VIEWPORT });

  test("says so instead of the editor, and still previews the email", async ({
    page,
  }) => {
    await page.goto("/");
    await page.addStyleTag({
      content:
        "main { padding: 0 !important } * { font-size: 16px !important }",
    });

    await expect(narrowNotice(page)).toBeVisible();
    await expect(canvas(page).getByRole("tab")).toHaveCount(0);
    await expect(textBlock(page)).toBeHidden();

    await previewEmailButton(page).click();
    await expect(previewEmail(page)).toContainText("Hello");
  });

  test("stays out of sight with a size the host gives the frame", async ({
    page,
  }) => {
    await page.goto("/");
    await page.addStyleTag({
      content:
        "mail-quilt::part(frame) { flex-grow: 1; height: 700px; min-height: 700px }",
    });
    await expect(narrowNotice(page)).toBeVisible();

    await expect(
      canvas(page)
        .getByTestId("editor")
        .evaluate((editor) => editor.getBoundingClientRect().height)
    ).resolves.toBe(0);
  });

  test("gives the editor back, with the same email, once there's room", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(narrowNotice(page)).toBeVisible();

    await page.setViewportSize({ height: 800, width: 1280 });

    await expect(narrowNotice(page)).toHaveCount(0);
    await expect(textBlock(page)).toHaveText("Hello");
  });

  test("gives the editor back in a host sized to fit its content", async ({
    page,
  }) => {
    await page.goto("/");
    // Reported only to the page's error listeners, not as an uncaught error or
    // a console message.
    const reported = await hostEvents(page, "error", ["message"]);
    // As a flex item that isn't stretched takes the width of what's inside, up
    // to the width there is.
    await page.addStyleTag({
      content:
        "mail-quilt { align-self: flex-start !important; max-width: 100% !important }",
    });
    await expect(narrowNotice(page)).toBeVisible();

    await page.setViewportSize({ height: 800, width: 1280 });

    await expect(narrowNotice(page)).toHaveCount(0);
    await expect(textBlock(page)).toHaveText("Hello");
    expect(await reported()).toStrictEqual([]);
  });
});
