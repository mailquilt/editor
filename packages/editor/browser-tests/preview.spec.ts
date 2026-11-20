import { expect, test } from "@playwright/test";
import type { Page, Route } from "@playwright/test";

import type { MailQuilt } from "../src/index.js";
import {
  canvas,
  countHostEscapes,
  emailWith,
  emailWithLink,
  exportHtml,
  focusStartOfTextBlock,
  latestDocument,
  linkUrlField,
  previewButton,
  previewDialog,
  previewEmail,
  setValue,
  stopClock,
  textBlock,
  undoByKey,
} from "./helpers.js";

const previewFrame = (page: Page) => page.getByTitle("Email preview");

const closeButton = (page: Page) =>
  previewDialog(page).getByRole("button", { name: "Close" });

/** Stops MJML loading until the returned function is called. */
const holdMjml = async (page: Page) => {
  const held: Route[] = [];
  let released = false;
  await page.route("**/*mjml-browser*", async (route) => {
    // The request can arrive after the page shows its loading message.
    if (released) {
      await route.continue();
    } else {
      held.push(route);
    }
  });
  return async () => {
    released = true;
    await Promise.all(held.map((route) => route.continue()));
  };
};

/** Counts the times `exportHtml` runs, which is what the Preview renders with. */
const countExports = (page: Page) =>
  canvas(page).evaluate((element) => {
    const mailQuilt = element as MailQuilt;
    const original = mailQuilt.exportHtml.bind(mailQuilt);
    window.document.documentElement.dataset.exports = "0";
    mailQuilt.exportHtml = () => {
      const { dataset } = window.document.documentElement;
      dataset.exports = String(Number(dataset.exports) + 1);
      return original();
    };
  });

const exportCount = (page: Page) =>
  page.evaluate(() => window.document.documentElement.dataset.exports);

/**
 * Tries to reach the page around it, under the name it reports with. Its text
 * comes after the script, so once it shows, the script has had its turn.
 */
const hostileEmail = (name: string) => `<!doctype html>
  <body>
    <script>
      parent.postMessage("${name}", "*");
      parent.document.documentElement.dataset.${name} = "reached";
    </script>
    <p>${name} loaded</p>
  </body>`;

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(textBlock(page)).toHaveText("Hello");
});

test("a slow MJML shows a loading message, then the email", async ({
  page,
}) => {
  const release = await holdMjml(page);
  await stopClock(page);
  const status = previewDialog(page).getByRole("status");

  await previewButton(page).click();
  // Already there, and empty, so a screen reader hears the message arrive.
  await expect(status).toBeEmpty();
  await page.clock.runFor(200);
  await expect(status).toHaveText("Loading preview…");

  await release();
  await expect(previewEmail(page)).toContainText("Hello");
  await expect(status).toBeEmpty();
});

test("MJML failing to load shows the reason, the editor keeps working, and opening again retries", async ({
  page,
}) => {
  await page.route("**/*mjml-browser*", (route) => route.abort());

  await previewButton(page).click();

  await expect(previewDialog(page).getByRole("alert")).toContainText(
    "The preview couldn't be loaded:"
  );
  await closeButton(page).click();
  await expect(previewDialog(page)).toBeHidden();
  await focusStartOfTextBlock(page);
  await page.keyboard.type("a");
  await expect(textBlock(page)).toHaveText("aHello");

  await page.unroute("**/*mjml-browser*");
  await previewButton(page).click();

  await expect(previewEmail(page)).toContainText("aHello");
  await expect(previewDialog(page).getByRole("alert")).toHaveCount(0);
});

test.describe("reflecting the latest edits", () => {
  test("an unchanged email isn't compiled again, and any change is", async ({
    page,
  }) => {
    await countExports(page);
    const openThenClose = async (text: string) => {
      await previewButton(page).click();
      await expect(previewEmail(page)).toContainText(text);
      await closeButton(page).click();
      await expect(previewDialog(page)).toBeHidden();
    };

    await openThenClose("Hello");
    await openThenClose("Hello");
    expect(await exportCount(page)).toBe("1");

    await focusStartOfTextBlock(page);
    await page.keyboard.type("x");
    await openThenClose("xHello");
    expect(await exportCount(page)).toBe("2");

    await undoByKey(page);
    await expect(textBlock(page)).toHaveText("Hello");
    await previewButton(page).click();
    await expect(previewEmail(page)).toContainText("Hello");
    await expect(previewEmail(page)).not.toContainText("xHello");
    await closeButton(page).click();
    expect(await exportCount(page)).toBe("3");

    await setValue(page, emailWith([[["From the host"]]]));
    await expect(textBlock(page)).toHaveText("From the host");
    await openThenClose("From the host");
    expect(await exportCount(page)).toBe("4");
  });

  test("closing during a render, editing and reopening shows the edit", async ({
    page,
  }) => {
    const release = await holdMjml(page);
    await previewButton(page).click();
    await expect(previewDialog(page).getByRole("status")).toHaveText(
      "Loading preview…"
    );
    await closeButton(page).click();

    await focusStartOfTextBlock(page);
    await page.keyboard.type("x");
    await previewButton(page).click();
    await release();

    await expect(previewEmail(page)).toContainText("xHello");
    expect(await previewFrame(page).getAttribute("srcdoc")).toBe(
      await exportHtml(page)
    );
  });
});

test.describe("the sandbox", () => {
  test("scripts in the Preview can't run or reach the host page", async ({
    page,
  }) => {
    await page.evaluate(() => {
      const messages: unknown[] = [];
      Object.assign(window, { messages });
      window.addEventListener("message", ({ data }) => messages.push(data));
    });
    await previewButton(page).click();
    await expect(previewEmail(page)).toContainText("Hello");

    await previewFrame(page).evaluate((frame, email) => {
      (frame as HTMLIFrameElement).srcdoc = email;
    }, hostileEmail("preview"));
    await expect(previewEmail(page)).toContainText("preview loaded");

    // The same script in an ordinary frame proves it would have been caught.
    await page.evaluate((email) => {
      const control = document.createElement("iframe");
      control.srcdoc = email;
      document.body.append(control);
    }, hostileEmail("control"));
    await expect(page.locator("html")).toHaveAttribute(
      "data-control",
      "reached"
    );
    // A message arrives a task after it's sent, and the Preview's would have
    // been sent first, so once the control's is here, any from the Preview is.
    const messages = () =>
      page.evaluate(
        () => (window as unknown as { messages: unknown[] }).messages
      );
    await expect.poll(messages).toContain("control");
    expect(await messages()).not.toContain("preview");
    await expect(page.locator("html")).not.toHaveAttribute("data-preview");
  });

  test("a link in the Preview opens nothing and leaves the host page", async ({
    context,
    page,
  }) => {
    const opened: string[] = [];
    await context.route("https://example.com/**", async (route) => {
      opened.push(route.request().url());
      await route.fulfill({ body: "Opened" });
    });
    const url = page.url();
    await setValue(page, emailWithLink("Go there", "https://example.com/"));
    await expect(textBlock(page)).toHaveText("Go there");

    await previewButton(page).click();
    await previewEmail(page).getByRole("link", { name: "Go there" }).click();

    // The same email outside the Preview opens the link. The Preview's click
    // came first, so once this one has loaded, any from it would have too.
    const control = await context.newPage();
    await control.setContent(await exportHtml(page));
    const popup = control.waitForEvent("popup");
    await control.getByRole("link", { name: "Go there" }).click();
    const opening = await popup;
    await opening.waitForLoadState();
    expect(opened).toEqual(["https://example.com/"]);
    // No token lets the frame run a script, open a popup or move the page. Its
    // origin is the host page's only so the editor can refuse a file dropped
    // on it, and keep Alt+← from going back a page.
    expect(
      await previewFrame(page).evaluate((frame) => [
        ...(frame as HTMLIFrameElement).sandbox,
      ])
    ).toEqual(["allow-same-origin"]);
    expect(page.url()).toBe(url);
    await expect(previewDialog(page)).toBeVisible();
    await expect(previewEmail(page)).toContainText("Go there");
  });
});

test.describe("closing", () => {
  test("the keyboard can leave the email to reach Close", async ({ page }) => {
    await previewButton(page).click();
    await previewEmail(page).click();

    await page.keyboard.press("Shift+Tab");
    await expect(closeButton(page)).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(previewDialog(page)).toBeHidden();
  });

  test("Escape closes it and goes no further, so a host's dialog stays open", async ({
    page,
  }) => {
    const hostEscapes = await countHostEscapes(page);
    await previewButton(page).click();
    await expect(previewEmail(page)).toContainText("Hello");

    await page.keyboard.press("Escape");

    await expect(previewDialog(page)).toBeHidden();
    await expect(hostEscapes()).resolves.toBe(0);
  });

  test("Escape in the email closes it too, and focus goes back", async ({
    browserName,
    page,
  }) => {
    test.skip(
      browserName === "webkit",
      "WebKit runs no listener in a document whose scripts are off"
    );
    await previewButton(page).focus();
    await page.keyboard.press("Enter");
    await previewEmail(page).click();

    await page.keyboard.press("Escape");

    await expect(previewDialog(page)).toBeHidden();
    await expect(previewButton(page)).toBeFocused();
  });

  test("the Block keeps its cursor and undo history after the Preview", async ({
    page,
  }) => {
    await focusStartOfTextBlock(page);
    // So that only leaving the Block for the Preview can make "b" a new step.
    await stopClock(page);
    await page.keyboard.type("a");
    await expect(textBlock(page)).toHaveText("aHello");

    await previewButton(page).click();
    await expect(previewEmail(page)).toContainText("aHello");
    await closeButton(page).click();
    await expect(textBlock(page)).toBeFocused();
    await page.keyboard.type("b");

    await expect(textBlock(page)).toHaveText("abHello");
    await undoByKey(page);
    await expect(textBlock(page)).toHaveText("aHello");
    await undoByKey(page);
    await expect(textBlock(page)).toHaveText("Hello");
  });

  test("opening with the mouse and no Block focused returns focus to Preview", async ({
    page,
  }) => {
    await previewButton(page).click();
    await expect(closeButton(page)).toBeFocused();

    await page.keyboard.press("Escape");

    await expect(previewButton(page)).toBeFocused();
  });

  test("opening from the link field returns focus to that field", async ({
    page,
  }) => {
    await textBlock(page).click();
    await page.getByRole("button", { exact: true, name: "Link" }).click();
    const linkField = linkUrlField(page);
    await expect(linkField).toBeFocused();

    await previewButton(page).click();
    await expect(closeButton(page)).toBeFocused();
    await page.keyboard.press("Escape");

    await expect(linkField).toBeFocused();
  });

  test("Close then Preview in one task still shows the email", async ({
    page,
  }) => {
    await previewButton(page).click();
    await expect(previewEmail(page)).toContainText("Hello");

    await canvas(page).evaluate((element) => {
      const buttons = [
        ...(element.shadowRoot?.querySelectorAll("button") ?? []),
      ];
      const named = (name: string) =>
        buttons.find(
          (button) =>
            (button.getAttribute("aria-label") ??
              button.textContent?.trim()) === name
        );
      named("Close")?.click();
      named("Preview")?.click();
    });

    await expect(previewEmail(page)).toContainText("Hello");
    await expect(previewDialog(page)).toBeVisible();
  });

  test("the canvas can't be edited behind the Preview", async ({ page }) => {
    await focusStartOfTextBlock(page);
    await previewButton(page).click();
    await expect(previewEmail(page)).toContainText("Hello");

    await page.keyboard.type("x");

    await expect(textBlock(page)).toHaveText("Hello");
  });
});

test.describe("opening with focus on a toolbar button", () => {
  test("the Block keeps its cursor for when focus comes back", async ({
    page,
  }) => {
    await focusStartOfTextBlock(page);
    await page.keyboard.type("a");
    await expect(textBlock(page)).toHaveText("aHello");
    await previewButton(page).focus();
    await page.keyboard.press("Enter");
    await expect(previewEmail(page)).toContainText("aHello");
    await page.keyboard.press("Escape");
    await expect(previewButton(page)).toBeFocused();

    await textBlock(page).focus();
    await expect(textBlock(page)).toBeFocused();
    await page.keyboard.type("b");

    await expect(textBlock(page)).toHaveText("abHello");
  });
});

test.describe("the host changing things while the Preview is open", () => {
  test("the same document passed back leaves the Preview open", async ({
    page,
  }) => {
    await previewButton(page).click();
    await expect(previewEmail(page)).toContainText("Hello");

    await setValue(page, await latestDocument(page));

    await expect(previewEmail(page)).toContainText("Hello");
    await expect(previewDialog(page)).toBeVisible();
  });

  test("a different document closes the Preview, rather than leave it stale", async ({
    page,
  }) => {
    await previewButton(page).click();
    await expect(previewEmail(page)).toContainText("Hello");

    await setValue(page, emailWith([[["Another email"]]]));

    await expect(textBlock(page)).toHaveText("Another email");
    await expect(previewDialog(page)).toBeHidden();
    await previewButton(page).click();
    await expect(previewEmail(page)).toContainText("Another email");
  });

  test("clearing value and loading a document leaves the Preview closed", async ({
    page,
  }) => {
    await previewButton(page).click();
    await expect(previewEmail(page)).toContainText("Hello");

    await setValue(page, undefined);
    await expect(
      canvas(page).getByRole("dialog", { includeHidden: true })
    ).toHaveCount(0);
    await setValue(page, emailWith([[["Back again"]]]));

    await expect(textBlock(page)).toHaveText("Back again");
    await expect(previewDialog(page)).toBeHidden();
  });

  test("moving the element closes the Preview, and it opens again after", async ({
    page,
  }) => {
    await previewButton(page).click();
    await expect(previewEmail(page)).toContainText("Hello");

    await canvas(page).evaluate((element) => {
      document.body.append(element);
    });

    await expect(textBlock(page)).toHaveText("Hello");
    await expect(previewDialog(page)).toBeHidden();
    await previewButton(page).click();
    await expect(previewEmail(page)).toContainText("Hello");
  });
});
