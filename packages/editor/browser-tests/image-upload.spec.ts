import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import type { MailQuilt } from "../src/index.js";
import {
  addBlock,
  announcement,
  blockGroup,
  blockProps,
  blockTypes,
  blockWith,
  bottomOf,
  boxOf,
  canvas,
  centerOf,
  change,
  changesSince,
  dropFileOn,
  dropFilesAt,
  dropIndicator,
  field,
  imageOf,
  selectionBar,
  setting,
  openBlocks,
  openEmail,
  openPopover,
  checkPanel,
  openCheck,
  redo,
  serveImages,
  settle,
  TALL_VIEWPORT,
  test,
  topOf,
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
    uploads?: {
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
    const uploads: NonNullable<Window["uploads"]> = [];
    window.uploads = uploads;
    (element as MailQuilt).uploadImage = (file, { signal }) =>
      // oxlint-disable-next-line promise/avoid-new -- The test settles each upload.
      new Promise((resolve, reject) => {
        uploads.push({
          name: file.name,
          reject,
          resolve,
          signal,
          type: file.type,
        });
      });
  });

/** The Selection bar's Upload, or Replace once the Image has one. */
const uploadButton = (page: Page) =>
  selectionBar(page).getByRole("button", { name: /^(?:Upload|Replace)$/u });

/** Picks a file with the Selection bar's Upload or Replace. */
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

/** An Image Block, selected, with its settings showing. */
const openImage = async (page: Page) => {
  await openBlocks(page, ["image"]);
  await blockGroup(page, "Image").focus();
};

/** Why the last upload failed, under the Selection bar's Upload, or else "". */
const uploadError = async (page: Page) => {
  const error = selectionBar(page).getByTestId("upload-error");
  if ((await error.count()) === 0) {
    return "";
  }
  const words = await error.textContent();
  return (words ?? "").trim();
};

test.describe("uploading an image from the Image settings", () => {
  test("isn't offered until the Host app gives uploadImage", async ({
    page,
  }) => {
    await openImage(page);

    await expect(await setting(page, "Image URL")).toBeVisible();
    await expect(uploadButton(page)).toHaveCount(0);

    await giveUploadImage(page);

    await expect(uploadButton(page)).toBeVisible();
  });

  test("with no image yet, the bar's Image URL says it's the other way, only after Upload", async ({
    page,
  }) => {
    await openEmail(page, [[["A"]]]);
    await addBlock(page, "Image");
    const url = field(page, "Image URL");
    await expect(url).toHaveAttribute("placeholder", "Paste an image URL");

    await giveUploadImage(page);

    await expect(url).toHaveAttribute("placeholder", "Or paste an image URL");
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
    await expect(imageOf(page)).toHaveAttribute("src", PHOTO);
  });

  test("says why the editor refused a file in the Host app's words, as strings changes", async ({
    page,
  }) => {
    await openImage(page);
    await giveUploadImage(page);
    await pickFile(page, "logo.svg", "image/svg+xml");
    await expect
      .poll(() => uploadError(page))
      .toBe("Use a PNG, JPEG or GIF image.");

    await canvas(page).evaluate((element) => {
      (element as MailQuilt).strings = {
        "upload.wrongType": "Utilisez une image PNG, JPEG ou GIF.",
      };
    });

    await expect
      .poll(() => uploadError(page))
      .toBe("Utilisez une image PNG, JPEG ou GIF.");
  });

  test("refusing a file leaves the upload already running", async ({
    page,
  }) => {
    await openImage(page);
    await giveUploadImage(page);
    await pickFile(page);

    await pickFile(page, "logo.svg", "image/svg+xml");
    await page.evaluate(
      (url) => window.uploads?.[0]?.resolve({ url }),
      UPLOADED
    );

    await expect(imageOf(page)).toHaveAttribute("src", UPLOADED);
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
      window.uploads?.[0]?.reject(new Error("Images can be up to 5 MB."))
    );

    await expect
      .poll(() => uploadError(page))
      .toBe("Images can be up to 5 MB.");
    await expect(announcement(page)).toHaveText("Images can be up to 5 MB.");
    await expect(imageOf(page)).toHaveAttribute("src", PHOTO);
    await changes(0);

    await change(await setting(page, "Image URL"), UPLOADED);

    await expect.poll(() => uploadError(page)).toBe("");
  });

  test("says the image couldn't be uploaded when the Host app gives no reason", async ({
    page,
  }) => {
    await openImage(page);
    await giveUploadImage(page);

    await pickFile(page);
    await page.evaluate(() => window.uploads?.[0]?.reject());

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
      window.uploads?.[0]?.resolve({ url: "javascript:alert(1)" })
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
    await change(await setting(page, "Image URL"), "javascript:alert(1)");
    await expect(await setting(page, "Image URL")).toHaveAttribute(
      "aria-invalid",
      "true"
    );

    await pickFile(page);
    await page.evaluate(
      (url) => window.uploads?.[0]?.resolve({ url }),
      UPLOADED
    );

    await expect(await setting(page, "Image URL")).toHaveValue(UPLOADED);
    await expect(await setting(page, "Image URL")).toHaveAttribute(
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
    await change(await setting(page, "Image URL"), missing);
    await expect(blockGroup(page, "Image")).toContainText(
      `Couldn't load ${missing}`
    );

    await context.unroute(missing);
    await pickFile(page);
    await page.evaluate(
      (url) => window.uploads?.[0]?.resolve({ url }),
      missing
    );

    await expect(imageOf(page)).toHaveAttribute("src", missing);
  });

  test("is aborted when its Block is deleted, and what it gives is dropped", async ({
    page,
  }) => {
    await openImage(page);
    await giveUploadImage(page);
    await pickFile(page);
    await expect.poll(() => uploadCalls(page)).toHaveLength(1);
    const changes = await changesSince(page);

    await blockGroup(page, "Image").focus();
    await page.keyboard.press("Delete");

    await expect
      .poll(() => page.evaluate(() => window.uploads?.[0]?.signal.aborted))
      .toBe(true);

    await page.evaluate(
      (url) => window.uploads?.[0]?.resolve({ url }),
      UPLOADED
    );
    await settle(page);

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
    await expect(imageOf(page)).toHaveCount(0);

    await page.evaluate(
      (url) => window.uploads?.[0]?.resolve({ url }),
      UPLOADED
    );

    await expect(imageOf(page)).toHaveAttribute("src", UPLOADED);
    await expect(announcement(page)).toHaveText("Image uploaded.");
    await expect(await setting(page, "Image URL")).toHaveValue(UPLOADED);
    await expect(await setting(page, "Image URL")).toBeEditable();
    await changes(1);

    await undo(page);

    await expect(blockProps(page)).resolves.toEqual({ src: PHOTO });
  });
});

test.describe("dropping image files", () => {
  test("a PNG dropped on an Image Block uploads and sets its image, and other files are refused by name", async ({
    page,
  }) => {
    await openBlocks(page, ["text", "image"]);
    await giveUploadImage(page);

    await expect(
      dropFilesAt(page, await centerOf(blockGroup(page, "Image")), [
        { name: "notes.pdf", type: "application/pdf" },
        { name: "photo.png", type: "image/png" },
      ])
    ).resolves.toBe("taken");

    await expect
      .poll(() => uploadCalls(page))
      .toEqual([{ name: "photo.png", type: "image/png" }]);
    await expect(blockGroup(page, "Image")).toContainText("Uploading…");
    await expect(blockGroup(page, "Image")).toHaveAttribute(
      "aria-current",
      "true"
    );

    await expect(announcement(page)).toContainText(
      "notes.pdf: Use a PNG, JPEG or GIF image."
    );

    await page.evaluate(
      (url) => window.uploads?.[0]?.resolve({ url }),
      UPLOADED
    );

    await expect(imageOf(page)).toHaveAttribute("src", UPLOADED);
    await expect(blockTypes(page)).resolves.toEqual(["text", "image"]);

    // Alone, the file is refused by the Block, and still by its name.
    await dropFilesAt(page, await centerOf(blockGroup(page, "Image")), [
      { name: "logo.svg", type: "image/svg+xml" },
    ]);

    await expect(announcement(page)).toHaveText(
      "logo.svg: Use a PNG, JPEG or GIF image."
    );
    await expect
      .poll(() => uploadError(page))
      .toBe("Use a PNG, JPEG or GIF image.");
  });

  test("files dropped in a Column each add an Image Block where they land, in order, and the last is selected", async ({
    page,
  }) => {
    await openEmail(page, [[["One", "Two"]]]);
    await giveUploadImage(page);
    const two = await boxOf(blockWith(page, "Two"));
    const point = await topOf(blockWith(page, "Two"));
    const files = [
      { name: "first.png", type: "image/png" },
      { name: "second.gif", type: "image/gif" },
    ];

    await expect(
      dropFilesAt(page, point, files, { drop: false })
    ).resolves.toBe("allowed");

    await expect(dropIndicator(page)).toBeVisible();
    const line = await boxOf(dropIndicator(page));
    expect(line.y + line.height / 2).toBeCloseTo(two.y, 0);

    await expect(dropFilesAt(page, point, files)).resolves.toBe("taken");

    await expect(dropIndicator(page)).toBeHidden();
    await expect(blockTypes(page)).resolves.toEqual([
      "text",
      "image",
      "image",
      "text",
    ]);
    await expect
      .poll(() => uploadCalls(page))
      .toEqual([
        { name: "first.png", type: "image/png" },
        { name: "second.gif", type: "image/gif" },
      ]);
    const first = blockGroup(page, "Image").first();
    const second = blockGroup(page, "Image").nth(1);
    await expect(second).toHaveAttribute("aria-current", "true");

    // Each uploads on its own.
    await page.evaluate(
      (url) => window.uploads?.[1]?.resolve({ url }),
      UPLOADED
    );

    await expect(second.locator("img")).toHaveAttribute("src", UPLOADED);
    await expect(first).toContainText("Uploading…");
  });

  test("files dropped on a popover from the Selection bar add nothing behind it", async ({
    page,
  }) => {
    await openEmail(page, [[["One", "Two", "Three"]]]);
    await giveUploadImage(page);
    await blockWith(page, "One").focus();
    const popover = await openPopover(page, /^Color:/u);
    const { height, width, x, y } = await boxOf(popover);
    // Its lower part, over the email.
    const point = { x: x + width / 2, y: y + height - 8 };
    const email = await boxOf(canvas(page).getByTestId("email"));
    expect(point.y).toBeGreaterThan(email.y);

    await dropFilesAt(page, point);

    await expect(blockTypes(page)).resolves.toEqual(["text", "text", "text"]);
  });

  test("files dropped outside any Column add their Image Blocks in a new Row", async ({
    page,
  }) => {
    await openEmail(page, [[["One"]]]);
    await giveUploadImage(page);
    const email = await boxOf(canvas(page).getByTestId("email"));

    await dropFilesAt(
      page,
      { x: email.x + email.width / 2, y: email.y + email.height + 20 },
      [
        { name: "first.png", type: "image/png" },
        { name: "second.jpg", type: "image/jpeg" },
      ]
    );

    await expect(blockTypes(page, 1)).resolves.toEqual(["image", "image"]);
    await expect(blockTypes(page, 0)).resolves.toEqual(["text"]);
  });

  test("new Image Blocks whose uploads fail stay, empty, and each failure is heard with its file's name", async ({
    page,
  }) => {
    await openEmail(page, [[["One"]]]);
    await giveUploadImage(page);

    await dropFilesAt(page, await bottomOf(blockWith(page, "One")), [
      { name: "big.png", type: "image/png" },
      // A name that ends another one.
      { name: "g.png", type: "image/png" },
    ]);
    await expect.poll(() => uploadCalls(page)).toHaveLength(2);
    // At once, as a Host app that checks each file's size itself fails them.
    await page.evaluate(() => {
      for (const upload of window.uploads ?? []) {
        upload.reject(new Error("Images can be up to 5 MB."));
      }
    });

    await expect(announcement(page)).toHaveText(
      "big.png: Images can be up to 5 MB. g.png: Images can be up to 5 MB."
    );
    await expect(blockGroup(page, "Image").nth(1)).toHaveAttribute(
      "aria-current",
      "true"
    );
    await expect(imageOf(page)).toHaveCount(0);
    await expect
      .poll(() => uploadError(page))
      .toBe("Images can be up to 5 MB.");
  });

  test("a file of another type dropped on the canvas adds no Block, and is refused by its name", async ({
    page,
  }) => {
    await openEmail(page, [[["One"]]]);
    await giveUploadImage(page);

    await dropFilesAt(page, await bottomOf(blockWith(page, "One")), [
      { name: "photo.png", type: "image/png" },
      { name: "logo.svg", type: "image/svg+xml" },
      { name: "other.png", type: "image/png" },
    ]);

    // Each upload starting is said once.
    await expect(announcement(page)).toHaveText(
      "Uploading image. logo.svg: Use a PNG, JPEG or GIF image."
    );
    await expect(blockTypes(page)).resolves.toEqual(["text", "image", "image"]);
    await expect
      .poll(() => uploadCalls(page))
      .toEqual([
        { name: "photo.png", type: "image/png" },
        { name: "other.png", type: "image/png" },
      ]);
  });

  test("redo after undoing a new Image Block puts it back empty, without uploading again", async ({
    page,
  }) => {
    await openEmail(page, [[["One"]]]);
    await giveUploadImage(page);
    await dropFilesAt(page, await bottomOf(blockWith(page, "One")));
    await expect.poll(() => uploadCalls(page)).toHaveLength(1);

    await undo(page);

    await expect(blockTypes(page)).resolves.toEqual(["text"]);
    await expect
      .poll(() => page.evaluate(() => window.uploads?.[0]?.signal.aborted))
      .toBe(true);

    await redo(page);

    await expect(blockTypes(page)).resolves.toEqual(["text", "image"]);
    await expect(blockGroup(page, "Image")).not.toContainText("Uploading…");
    await expect(uploadCalls(page)).resolves.toHaveLength(1);
  });

  test("a file dropped on Check is still refused", async ({ page }) => {
    await openEmail(page, [[["One"]]]);
    await giveUploadImage(page);
    await openCheck(page);

    await expect(
      dropFileOn(checkPanel(page), await centerOf(checkPanel(page)))
    ).resolves.toBe("refused");
  });
});
