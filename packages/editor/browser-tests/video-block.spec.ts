import type { BlockProps } from "@mailquilt/core/internal";
import { expect } from "@playwright/test";
import type { BrowserContext, Page } from "@playwright/test";

import type { MailQuilt } from "../src/index.js";
import {
  addBlock,
  blockGroup,
  blockProps,
  canvas,
  change,
  checkPanel,
  openCheck,
  openPopover,
  selectionBar,
  serveImages,
  setValue,
  test,
  violations,
} from "./helpers.js";
import { emailWith } from "./host/email.js";

/** A thumbnail whose site lets the editor read it, as YouTube's does. */
const READABLE = "https://thumbs.example/cup.png";
/**
 * A thumbnail whose site doesn't. A page shows it, but the editor's own read
 * of it fails, as CORS makes it, which a routed response doesn't.
 */
const UNREADABLE = "https://unreadable.example/cup.png";
const LINK = "https://video.example/watch/1";

/** A 2×2 PNG, so the copy has a middle to draw in. */
const PICTURE = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGNocFAAIgYIBQAaDgOBnA45xwAAAABJRU5ErkJggg==",
  "base64"
);

/** Serves thumbs.example with the CORS header YouTube's thumbnails have. */
const serveReadable = (context: BrowserContext) =>
  context.route("https://thumbs.example/**", (route) =>
    route.fulfill({
      body: PICTURE,
      contentType: "image/png",
      headers: { "access-control-allow-origin": "*" },
    })
  );

test.beforeEach(async ({ context }) => {
  await serveImages(context);
  await serveReadable(context);
  await context.route("https://unreadable.example/**", (route) =>
    route.request().resourceType() === "fetch"
      ? route.abort()
      : route.fulfill({ body: PICTURE, contentType: "image/png" })
  );
});

declare global {
  interface Window {
    /** Each call to the test's `uploadImage`, which waits for the test. */
    videoUploads: {
      type: string;
      resolve: (result: { url: string }) => void;
    }[];
  }
}

/** An email of one Video with these props, with an `uploadImage` that waits for the test. */
const openVideo = async (
  page: Page,
  props: BlockProps["video"],
  { uploads = true } = {}
) => {
  const email = emailWith([[[]]]);
  email.rows[0]?.columns[0]?.blocks.push({
    id: "video-1",
    props,
    type: "video",
  });
  await page.goto("/");
  await setValue(page, email);
  if (uploads) {
    await canvas(page).evaluate((element) => {
      window.videoUploads = [];
      (element as MailQuilt).uploadImage = (file) =>
        // oxlint-disable-next-line promise/avoid-new -- The test settles each upload.
        new Promise((resolve) => {
          window.videoUploads.push({ resolve, type: file.type });
        });
    });
  }
  await video(page).click();
};

const video = (page: Page) => blockGroup(page, "Video");

const playButton = (page: Page) =>
  selectionBar(page).getByRole("button", { name: /^Play button: /u });

const choice = (page: Page, name: string) =>
  canvas(page).getByRole("radio", { name });

test("a new Video says what goes in it, and its thumbnail waits for the link", async ({
  page,
}) => {
  await page.goto("/");
  await addBlock(page, "Video");

  await expect(video(page)).toContainText("Add a video");
  const thumbnail = selectionBar(page).getByRole("button", {
    name: "Add a thumbnail",
  });
  await expect(thumbnail).toHaveAttribute("aria-disabled", "true");
  await expect(thumbnail).toHaveAccessibleDescription(
    "Paste the video's link first"
  );
  expect(await violations(page)).toStrictEqual([]);
});

test("a YouTube link fills in its thumbnail, the one every video has when it has no large one", async ({
  context,
  page,
}) => {
  // As YouTube sends for a video without the large thumbnail: a small placeholder.
  await context.route("https://i.ytimg.com/**", (route) =>
    route.fulfill({ body: PICTURE, contentType: "image/png" })
  );
  await openVideo(page, {});

  await change(
    selectionBar(page).getByRole("textbox", { name: "Video link" }),
    "https://youtu.be/q8Ln2kXa_-9"
  );

  await expect
    .poll(() => blockProps(page))
    .toStrictEqual({
      thumbnail: "https://i.ytimg.com/vi/q8Ln2kXa_-9/hqdefault.jpg",
      url: "https://youtu.be/q8Ln2kXa_-9",
    });
  await expect(video(page).getByTestId("video-line")).toHaveText(
    /Watch the video/u
  );
});

test("On the picture draws the play button on a copy, uploads it and shows it, and Below goes back to the thumbnail", async ({
  page,
}) => {
  await openVideo(page, { thumbnail: READABLE, url: LINK });

  await openPopover(page, /^Play button: /u);
  await expect(choice(page, "Below the picture")).toBeFocused();
  await choice(page, "On the picture").check();

  await expect(video(page).getByTestId("adding-play")).toHaveText(
    "Adding the play button…"
  );
  await expect
    .poll(() =>
      page.evaluate(() => window.videoUploads.map(({ type }) => type))
    )
    .toStrictEqual(["image/png"]);
  await page.evaluate(() =>
    window.videoUploads[0]?.resolve({ url: "https://cdn.example/played.png" })
  );

  await expect
    .poll(() => blockProps(page))
    .toMatchObject({
      play: "on",
      playThumbnail: "https://cdn.example/played.png",
      thumbnail: READABLE,
    });
  await expect(video(page).locator("img")).toHaveAttribute(
    "src",
    "https://cdn.example/played.png"
  );
  await expect(video(page).getByTestId("video-line")).toHaveCount(0);

  await choice(page, "Below the picture").check();
  await expect(video(page).locator("img")).toHaveAttribute("src", READABLE);
  expect(await blockProps(page)).toMatchObject({ play: "below" });
});

test("a thumbnail whose site doesn't let the editor draw on it says so, with a way to upload one", async ({
  page,
}) => {
  await openVideo(page, { thumbnail: UNREADABLE, url: LINK });

  await openPopover(page, /^Play button: /u);
  // Clicked, as it's chosen only once the copy is uploaded, which this fails.
  await choice(page, "On the picture").click();
  await page.keyboard.press("Escape");

  const failed = selectionBar(page).getByTestId("play-failed");
  await expect(failed).toContainText("The play button couldn't be added");
  await expect(failed).toContainText(
    "unreadable.example doesn't let the editor draw"
  );
  await expect(
    failed.getByRole("button", { name: "Upload a thumbnail" })
  ).toBeVisible();
  await expect(playButton(page)).toHaveAccessibleName(
    "Play button: Below the picture"
  );
  expect(await blockProps(page)).toStrictEqual({
    thumbnail: UNREADABLE,
    url: LINK,
  });

  // The person kept the line, so a new thumbnail isn't drawn on.
  await openPopover(page, /^Thumbnail/u);
  await change(
    canvas(page).getByRole("textbox", { name: "Thumbnail URL" }),
    READABLE
  );
  await expect(video(page).locator("img")).toHaveAttribute("src", READABLE);
  await expect(video(page).getByTestId("adding-play")).toHaveCount(0);
  expect(await page.evaluate(() => window.videoUploads.length)).toBe(0);
});

test("going past On the picture with the arrow keys draws nothing", async ({
  page,
}) => {
  await openVideo(page, { thumbnail: READABLE, url: LINK });
  await playButton(page).focus();

  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown");
  // As a person reads the choice before going on.
  await page.waitForTimeout(250);
  await page.keyboard.press("ArrowDown");

  await expect(choice(page, "None")).toBeFocused();
  expect(await blockProps(page)).toMatchObject({ play: "none" });
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => window.videoUploads.length)).toBe(0);
});

test("without the Host app's uploadImage, On the picture is off and says why", async ({
  page,
}) => {
  await openVideo(page, { thumbnail: READABLE, url: LINK }, { uploads: false });

  await openPopover(page, /^Play button: /u);

  await expect(choice(page, "On the picture")).toBeDisabled();
  await expect(choice(page, "On the picture")).toHaveAccessibleDescription(
    "Needs image uploads, which this app doesn't offer."
  );
  expect(await violations(page)).toStrictEqual([]);
});

test("without uploadImage, a copy already drawn can still be chosen, and its choice takes focus", async ({
  page,
}) => {
  await openVideo(
    page,
    {
      play: "on",
      playThumbnail: "https://cdn.example/played.png",
      thumbnail: READABLE,
      url: LINK,
    },
    { uploads: false }
  );

  await openPopover(page, /^Play button: /u);

  await expect(choice(page, "On the picture")).toBeEnabled();
  await expect(choice(page, "On the picture")).toBeFocused();
});

test("without uploadImage, a Video set on the picture with no copy drawn opens its choices with focus on one that can be chosen", async ({
  page,
}) => {
  await openVideo(
    page,
    { play: "on", thumbnail: READABLE, url: LINK },
    { uploads: false }
  );

  await openPopover(page, /^Play button: /u);

  await expect(choice(page, "On the picture")).toBeDisabled();
  await expect(choice(page, "Below the picture")).toBeFocused();
});

test("the play button's choices open at the one chosen, are chosen with the arrow keys, and Escape goes back to the button", async ({
  page,
}) => {
  await openVideo(page, {
    play: "on",
    playThumbnail: "https://cdn.example/played.png",
    thumbnail: READABLE,
    url: LINK,
  });
  await playButton(page).focus();

  await page.keyboard.press("Enter");
  await expect(choice(page, "On the picture")).toBeFocused();
  await page.keyboard.press("ArrowDown");

  await expect(choice(page, "None")).toBeFocused();
  expect(await blockProps(page)).toMatchObject({ play: "none" });
  await page.keyboard.press("Escape");
  await expect(playButton(page)).toBeFocused();
  await expect(playButton(page)).toHaveAccessibleName("Play button: None");
});

test("Check's fix for a Video with no thumbnail opens the Thumbnail popover at its field", async ({
  page,
}) => {
  await openVideo(page, { url: LINK });
  await openCheck(page);

  await checkPanel(page)
    .getByRole("button", { name: "Add a thumbnail" })
    .click();

  await expect(
    canvas(page).getByRole("textbox", { name: "Thumbnail URL" })
  ).toBeFocused();
});
