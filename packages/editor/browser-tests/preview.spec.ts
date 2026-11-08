import { expect, test } from "@playwright/test";
import type { Page, Route } from "@playwright/test";

import type { MailQuilt } from "../src/index.js";
import {
  canvas,
  exportHtml,
  focusStartOfTextBlock,
  setValue,
  textBlock,
} from "./helpers.js";
import { emailWith, emailWithInline } from "./host/email.js";

const previewButton = (page: Page) =>
  page.getByRole("button", { exact: true, name: "Preview" });
const previewDialog = (page: Page) =>
  page.getByRole("dialog", { name: "Preview" });
const previewFrame = (page: Page) => previewDialog(page).locator("iframe");
const previewEmail = (page: Page) =>
  page.frameLocator("iframe[title='Email preview']").locator("body");

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

const emailWithLink = (text: string, href: string) =>
  emailWithInline({
    marks: [{ attrs: { href }, type: "link" }],
    text,
    type: "text",
  });

/** Tries to reach the page around it, under the name it reports with. */
const hostileEmail = (name: string) => `<!doctype html>
  <body>
    <p>${name} loaded</p>
    <script>
      parent.postMessage("${name}", "*");
      parent.document.documentElement.dataset.${name} = "reached";
    </script>
  </body>`;

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(textBlock(page)).toHaveText("Hello");
});

test("Preview shows the real exported HTML", async ({ page }) => {
  await previewButton(page).click();

  await expect(previewDialog(page)).toBeVisible();
  await expect(previewEmail(page)).toContainText("Hello");
  expect(await previewFrame(page).getAttribute("srcdoc")).toBe(
    await exportHtml(page)
  );
});

test("opening the Preview doesn't change the document", async ({ page }) => {
  await previewButton(page).click();
  await expect(previewEmail(page)).toContainText("Hello");

  await expect(page.getByTestId("change-count")).toHaveText("0");
});

test("MJML loads when Preview opens, not with the editor", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.reload();
  await expect(textBlock(page)).toHaveText("Hello");
  expect(requests.filter((url) => url.includes("mjml-browser"))).toEqual([]);

  await previewButton(page).click();
  await expect(previewEmail(page)).toContainText("Hello");

  expect(requests.filter((url) => url.includes("mjml-browser"))).toHaveLength(
    1
  );
});

test("a slow MJML shows a loading message, then the email", async ({
  page,
}) => {
  const release = await holdMjml(page);

  await previewButton(page).click();
  await expect(previewDialog(page).getByRole("status")).toHaveText(
    "Loading preview…"
  );

  await release();
  await expect(previewEmail(page)).toContainText("Hello");
  await expect(previewDialog(page).getByRole("status")).toHaveCount(0);
});

test("MJML failing to load shows the reason, and the editor keeps working", async ({
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
});

test("opening the Preview again retries after MJML failed to load", async ({
  page,
}) => {
  await page.route("**/*mjml-browser*", (route) => route.abort());
  await previewButton(page).click();
  await expect(previewDialog(page).getByRole("alert")).toBeVisible();
  await closeButton(page).click();

  await page.unroute("**/*mjml-browser*");
  await previewButton(page).click();

  await expect(previewEmail(page)).toContainText("Hello");
  await expect(previewDialog(page).getByRole("alert")).toHaveCount(0);
});

test("a render that fails shows why, and doesn't promise a retry will help", async ({
  page,
}) => {
  await canvas(page).evaluate((element) => {
    (element as MailQuilt).exportHtml = () =>
      Promise.reject(new Error("Unknown Block type"));
  });

  await previewButton(page).click();

  await expect(previewDialog(page).getByRole("alert")).toHaveText(
    "The preview couldn't be loaded: Unknown Block type"
  );
});

test.describe("reflecting the latest edits", () => {
  test("Preview shows edits made since it last opened", async ({ page }) => {
    await previewButton(page).click();
    await expect(previewEmail(page)).toContainText("Hello");
    await closeButton(page).click();

    await focusStartOfTextBlock(page);
    await page.keyboard.type("Oh ");
    await previewButton(page).click();

    await expect(previewEmail(page)).toContainText("Oh Hello");
    expect(await previewFrame(page).getAttribute("srcdoc")).toBe(
      await exportHtml(page)
    );
  });

  test("Preview shows the text right after a keystroke", async ({ page }) => {
    await focusStartOfTextBlock(page);
    await page.keyboard.type("x");

    await previewButton(page).click();

    await expect(previewEmail(page)).toContainText("xHello");
  });

  test("Preview shows the result of undo", async ({ page }) => {
    await focusStartOfTextBlock(page);
    await page.keyboard.type("x");
    await expect(textBlock(page)).toHaveText("xHello");
    await page.keyboard.press("ControlOrMeta+z");
    await expect(textBlock(page)).toHaveText("Hello");

    await previewButton(page).click();

    await expect(previewEmail(page)).toContainText("Hello");
    await expect(previewEmail(page)).not.toContainText("xHello");
  });

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

    await page.keyboard.press("ControlOrMeta+z");
    await expect(textBlock(page)).toHaveText("Hello");
    await previewButton(page).click();
    await expect(previewEmail(page)).not.toContainText("xHello");
    await closeButton(page).click();
    expect(await exportCount(page)).toBe("3");

    await setValue(page, emailWith("From the host"));
    await expect(textBlock(page)).toHaveText("From the host");
    await openThenClose("From the host");
    expect(await exportCount(page)).toBe("4");
  });

  test("Preview shows a document the host set", async ({ page }) => {
    await setValue(page, emailWith("From the host"));
    await expect(textBlock(page)).toHaveText("From the host");

    await previewButton(page).click();

    await expect(previewEmail(page)).toContainText("From the host");
  });

  test("closing during a render, editing and reopening shows the edit", async ({
    page,
  }) => {
    const release = await holdMjml(page);
    await previewButton(page).click();
    await expect(previewDialog(page).getByRole("status")).toBeVisible();
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
    const messages = await page.evaluate(
      () => (window as unknown as { messages: unknown[] }).messages
    );
    expect(messages).toContain("control");
    expect(messages).not.toContain("preview");
    await expect(page.locator("html")).not.toHaveAttribute("data-preview");
  });

  test("the host page can't read into the Preview, because its origin is opaque", async ({
    page,
  }) => {
    await previewButton(page).click();
    await expect(previewEmail(page)).toContainText("Hello");

    expect(
      await previewFrame(page).evaluate(
        (frame) => (frame as HTMLIFrameElement).contentDocument
      )
    ).toBeNull();
  });

  test("HTML typed as text shows as text, not markup", async ({ page }) => {
    await setValue(page, emailWith('<img src="x" onerror="alert(1)">'));
    await expect(textBlock(page)).toHaveText(
      '<img src="x" onerror="alert(1)">'
    );

    await previewButton(page).click();

    await expect(previewEmail(page)).toContainText('<img src="x"');
    await expect(previewEmail(page).locator("img")).toHaveCount(0);
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
    // Nothing to wait for when nothing happens, so give a popup time to load.
    await page.waitForTimeout(500);

    expect(opened).toEqual([]);
    expect(page.url()).toBe(url);
    await expect(previewDialog(page)).toBeVisible();
    await expect(previewEmail(page)).toContainText("Go there");
  });
});

test.describe("closing", () => {
  test("Close and Escape both close the Preview", async ({ page }) => {
    await previewButton(page).click();
    await expect(previewEmail(page)).toContainText("Hello");
    await closeButton(page).click();
    await expect(previewDialog(page)).toBeHidden();

    await previewButton(page).click();
    await expect(previewEmail(page)).toContainText("Hello");
    await page.keyboard.press("Escape");
    await expect(previewDialog(page)).toBeHidden();
  });

  // A sandboxed frame keeps Escape to itself, so a person leaves by the keyboard.
  test("the keyboard can leave the email to reach Close", async ({ page }) => {
    await previewButton(page).click();
    await previewEmail(page).click();

    await page.keyboard.press("Shift+Tab");
    await expect(closeButton(page)).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(previewDialog(page)).toBeHidden();
  });

  test("focus goes to Close on opening, and back to Preview on closing", async ({
    page,
  }) => {
    await previewButton(page).focus();
    await page.keyboard.press("Enter");
    await expect(closeButton(page)).toBeFocused();

    await page.keyboard.press("Escape");

    await expect(previewButton(page)).toBeFocused();
  });

  test("the Block keeps its cursor and undo history after the Preview", async ({
    page,
  }) => {
    await focusStartOfTextBlock(page);
    await page.keyboard.type("a");
    await expect(textBlock(page)).toHaveText("aHello");

    await previewButton(page).click();
    await expect(previewEmail(page)).toContainText("aHello");
    await closeButton(page).click();
    await expect(textBlock(page)).toBeFocused();
    await page.keyboard.type("b");

    await expect(textBlock(page)).toHaveText("abHello");
    await page.keyboard.press("ControlOrMeta+z");
    await expect(textBlock(page)).toHaveText("aHello");
    await page.keyboard.press("ControlOrMeta+z");
    await expect(textBlock(page)).toHaveText("Hello");
  });

  test("Escape also gives the Block back its cursor", async ({ page }) => {
    await focusStartOfTextBlock(page);
    await page.keyboard.type("a");
    await expect(textBlock(page)).toHaveText("aHello");

    await previewButton(page).click();
    await expect(previewEmail(page)).toContainText("aHello");
    await page.keyboard.press("Escape");
    await expect(textBlock(page)).toBeFocused();
    await page.keyboard.type("b");

    await expect(textBlock(page)).toHaveText("abHello");
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
    const linkField = page.getByRole("textbox", { name: "Link URL" });
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
  test("typing doesn't reach the Block behind the Preview", async ({
    page,
  }) => {
    await focusStartOfTextBlock(page);
    await previewButton(page).focus();
    await page.keyboard.press("Enter");
    await expect(previewEmail(page)).toContainText("Hello");

    await page.keyboard.type("x");

    await expect(textBlock(page)).toHaveText("Hello");
    await expect(page.getByTestId("change-count")).toHaveText("0");
  });

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

    await setValue(
      page,
      JSON.parse(
        (await page.getByTestId("latest-document").textContent()) ?? ""
      )
    );

    await expect(previewEmail(page)).toContainText("Hello");
    await expect(previewDialog(page)).toBeVisible();
  });

  test("a different document closes the Preview, rather than leave it stale", async ({
    page,
  }) => {
    await previewButton(page).click();
    await expect(previewEmail(page)).toContainText("Hello");

    await setValue(page, emailWith("Another email"));

    await expect(textBlock(page)).toHaveText("Another email");
    await expect(previewDialog(page)).toBeHidden();
    await previewButton(page).click();
    await expect(previewEmail(page)).toContainText("Another email");
  });

  test("a different document during a render never shows the old email", async ({
    page,
  }) => {
    const release = await holdMjml(page);
    await previewButton(page).click();
    await expect(previewDialog(page).getByRole("status")).toBeVisible();

    await setValue(page, emailWith("Another email"));
    await previewButton(page).click();
    await release();

    await expect(previewEmail(page)).toContainText("Another email");
    await expect(previewEmail(page)).not.toContainText("Hello");
  });

  test("clearing value and loading a document leaves the Preview closed", async ({
    page,
  }) => {
    await previewButton(page).click();
    await expect(previewEmail(page)).toContainText("Hello");

    await setValue(page, undefined);
    await expect(page.locator("mail-quilt dialog")).toHaveCount(0);
    await setValue(page, emailWith("Back again"));

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

test("host CSS doesn't reach the Preview", async ({ page }) => {
  await previewButton(page).click();
  const email = previewEmail(page).getByText("Hello");
  await expect(email).toBeVisible();

  await expect(email).toHaveCSS("color", "rgb(0, 0, 0)");
  await expect(email).toHaveCSS("font-size", "16px");
  await expect(email).toHaveCSS("text-transform", "none");
  const heading = previewDialog(page).getByRole("heading", { name: "Preview" });
  await expect(heading).toHaveCSS("font-size", "14px");
  await expect(heading).toHaveCSS("color", "rgb(24, 24, 27)");
  await expect(heading).toHaveCSS("text-transform", "none");
  const { height, width } = (await previewFrame(page).boundingBox()) ?? {
    height: 0,
    width: 0,
  };
  expect(height).toBeGreaterThan(200);
  expect(width).toBeGreaterThan(600);
});
