import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import type { MailQuilt } from "../src/index.js";
import {
  announcement,
  blockGroup,
  blockProps,
  canvas,
  change,
  changesSince,
  deleteBlock,
  field,
  openBlocks,
  serveImages,
  TALL_VIEWPORT,
  test,
  undo,
} from "./helpers.js";

const PHOTO = "https://cdn.example/photo.png";
const UPLOADED = "https://cdn.example/uploaded.png";

test.beforeEach(({ context, page }) => {
  // Playwright stops intercepting file choosers when its last listener goes,
  // and Firefox can then miss the chooser of a later pick in the same test.
  page.on("filechooser", () => null);
  return serveImages(context);
});

test.use({ viewport: TALL_VIEWPORT });

declare global {
  interface Window {
    /** Each call to the test's `uploadImage`, which waits for the test. */
    uploads: {
      name: string;
      type: string;
      signal: AbortSignal;
      resolve: (result: { url: string }) => void;
      reject: (reason?: unknown) => void;
    }[];
  }
}

/** Gives the editor an `uploadImage` that waits until the test settles it. */
const giveUploadImage = (page: Page) =>
  canvas(page).evaluate((element) => {
    window.uploads = [];
    (element as MailQuilt).uploadImage = (file, { signal }) =>
      // oxlint-disable-next-line promise/avoid-new -- The test settles each upload.
      new Promise((resolve, reject) => {
        window.uploads.push({
          name: file.name,
          reject,
          resolve,
          signal,
          type: file.type,
        });
      });
  });

const uploadButton = (page: Page) =>
  canvas(page).getByRole("button", { name: "Upload image" });

/** Picks a file with the Upload image button. */
const pickFile = async (
  page: Page,
  name = "photo.png",
  mimeType = "image/png"
) => {
  const choosing = page.waitForEvent("filechooser");
  await uploadButton(page).click();
  const chooser = await choosing;
  await chooser.setFiles({ buffer: Buffer.from("x"), mimeType, name });
};

/** The calls the Host app's `uploadImage` has had, by file name and type. */
const uploadCalls = (page: Page) =>
  page.evaluate(() =>
    (window.uploads ?? []).map(({ name, type }) => ({ name, type }))
  );

const image = (page: Page) => blockGroup(page, "Image").locator("img");

/** An Image Block, selected, with its settings showing. */
const openImage = async (page: Page) => {
  await openBlocks(page, ["image"]);
  await blockGroup(page, "Image").focus();
};

/** The error shown by the Image URL field, which describes the field. */
const uploadError = (page: Page) =>
  field(page, "Image URL").evaluate((element) => {
    const ids = element.getAttribute("aria-describedby")?.split(" ") ?? [];
    const root = element.getRootNode() as ShadowRoot;
    return ids
      .map((id) => root.querySelector(`#${id}`))
      .filter((each) => each?.classList.contains("error"))
      .map((each) => each?.textContent?.trim())
      .join(" ");
  });

test.describe("uploading an image from the Image settings", () => {
  test("isn't offered until the Host app gives uploadImage", async ({
    page,
  }) => {
    await openImage(page);

    await expect(field(page, "Image URL")).toBeVisible();
    await expect(uploadButton(page)).toHaveCount(0);

    await giveUploadImage(page);

    await expect(uploadButton(page)).toBeVisible();
  });

  test("calls the Host app's latest uploadImage, which a re-render may replace", async ({
    page,
  }) => {
    await openImage(page);
    await canvas(page).evaluate((element) => {
      (element as MailQuilt).uploadImage = () =>
        Promise.resolve({ url: "https://cdn.example/old.png" });
    });
    await expect(uploadButton(page)).toBeVisible();
    await giveUploadImage(page);

    await pickFile(page);

    await expect
      .poll(() => uploadCalls(page))
      .toEqual([{ name: "photo.png", type: "image/png" }]);
  });

  test("refuses a file that isn't a PNG, JPEG or GIF before the Host app has it", async ({
    page,
  }) => {
    await openImage(page);
    await giveUploadImage(page);

    await pickFile(page, "logo.svg", "image/svg+xml");

    await expect
      .poll(() => uploadError(page))
      .toBe("Use a PNG, JPEG or GIF image.");
    await expect(announcement(page)).toHaveText(
      "Use a PNG, JPEG or GIF image."
    );
    await expect(uploadCalls(page)).resolves.toEqual([]);
    await expect(image(page)).toHaveAttribute("src", PHOTO);
  });

  test("refusing a file leaves the upload already running", async ({
    page,
  }) => {
    await openImage(page);
    await giveUploadImage(page);
    await pickFile(page);

    await pickFile(page, "logo.svg", "image/svg+xml");
    await page.evaluate((url) => window.uploads[0]?.resolve({ url }), UPLOADED);

    await expect(image(page)).toHaveAttribute("src", UPLOADED);
    await expect.poll(() => uploadError(page)).toBe("");
  });

  test("says why the Host app's upload failed, until the URL changes", async ({
    page,
  }) => {
    await openImage(page);
    await giveUploadImage(page);
    const changes = await changesSince(page);

    await pickFile(page, "big.jpg", "image/jpeg");
    await page.evaluate(() =>
      window.uploads[0]?.reject(new Error("Images can be up to 5 MB."))
    );

    await expect
      .poll(() => uploadError(page))
      .toBe("Images can be up to 5 MB.");
    await expect(announcement(page)).toHaveText("Images can be up to 5 MB.");
    await expect(image(page)).toHaveAttribute("src", PHOTO);
    await changes(0);

    await change(field(page, "Image URL"), UPLOADED);

    await expect.poll(() => uploadError(page)).toBe("");
  });

  test("says the image couldn't be uploaded when the Host app gives no reason", async ({
    page,
  }) => {
    await openImage(page);
    await giveUploadImage(page);

    await pickFile(page);
    await page.evaluate(() => window.uploads[0]?.reject());

    await expect
      .poll(() => uploadError(page))
      .toBe("The image couldn't be uploaded.");
  });

  test("fails with a URL the Image URL refuses", async ({ page }) => {
    await openImage(page);
    await giveUploadImage(page);

    await pickFile(page);
    await page.evaluate(() =>
      // oxlint-disable-next-line no-script-url -- What's being refused.
      window.uploads[0]?.resolve({ url: "javascript:alert(1)" })
    );

    await expect
      .poll(() => uploadError(page))
      .toBe("The image couldn't be uploaded.");
    await expect(blockProps(page)).resolves.toEqual({ src: PHOTO });
  });

  test("shows the uploaded URL in place of a refused one typed before", async ({
    page,
  }) => {
    await openImage(page);
    await giveUploadImage(page);
    // oxlint-disable-next-line no-script-url -- What's being refused.
    await change(field(page, "Image URL"), "javascript:alert(1)");
    await expect(field(page, "Image URL")).toHaveAttribute(
      "aria-invalid",
      "true"
    );

    await pickFile(page);
    await page.evaluate((url) => window.uploads[0]?.resolve({ url }), UPLOADED);

    await expect(field(page, "Image URL")).toHaveValue(UPLOADED);
    await expect(field(page, "Image URL")).toHaveAttribute(
      "aria-invalid",
      "false"
    );
  });

  test("shows an image that couldn't load before, once it's uploaded to the same URL", async ({
    context,
    page,
  }) => {
    const missing = "https://cdn.example/missing.png";
    await context.route(missing, (route) => route.abort());
    await openImage(page);
    await giveUploadImage(page);
    await change(field(page, "Image URL"), missing);
    await expect(blockGroup(page, "Image")).toContainText(
      `Couldn't load ${missing}`
    );

    await context.unroute(missing);
    await pickFile(page);
    await page.evaluate((url) => window.uploads[0]?.resolve({ url }), missing);

    await expect(image(page)).toHaveAttribute("src", missing);
  });

  test("is aborted when its Block is deleted, and what it gives is dropped", async ({
    page,
  }) => {
    await openImage(page);
    await giveUploadImage(page);
    await pickFile(page);
    await expect.poll(() => uploadCalls(page)).toHaveLength(1);
    const changes = await changesSince(page);

    await deleteBlock(page).click();

    await expect
      .poll(() => page.evaluate(() => window.uploads[0]?.signal.aborted))
      .toBe(true);

    await page.evaluate((url) => window.uploads[0]?.resolve({ url }), UPLOADED);

    await expect(announcement(page)).toHaveText("Block deleted.");
    await changes(1);
  });

  test("sets the Block's image in one change and one undo step", async ({
    page,
  }) => {
    await openImage(page);
    await giveUploadImage(page);
    const changes = await changesSince(page);

    await pickFile(page);

    await expect
      .poll(() => uploadCalls(page))
      .toEqual([{ name: "photo.png", type: "image/png" }]);
    await expect(blockGroup(page, "Image")).toContainText("Uploading…");
    await expect(announcement(page)).toHaveText("Uploading image.");
    await expect(image(page)).toHaveCount(0);

    await page.evaluate((url) => window.uploads[0]?.resolve({ url }), UPLOADED);

    await expect(image(page)).toHaveAttribute("src", UPLOADED);
    await expect(announcement(page)).toHaveText("Image uploaded.");
    await expect(field(page, "Image URL")).toHaveValue(UPLOADED);
    await expect(field(page, "Image URL")).toBeEditable();
    await changes(1);

    await undo(page);

    await expect(blockProps(page)).resolves.toEqual({ src: PHOTO });
  });
});
