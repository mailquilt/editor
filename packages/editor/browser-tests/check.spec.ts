import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import type { MailQuilt } from "../src/index.js";
import {
  announcement,
  canvas,
  checkPanel,
  checkTab,
  emailWith,
  emailWithLink,
  exportHtml,
  focusStartOfTextBlock,
  holdMjml,
  hostEvents,
  inboxEmail,
  inboxFrame,
  openBlocks,
  openCheck,
  openEmail,
  openTestPage,
  serveImages,
  setValue,
  stopClock,
  test,
  textBlock,
  undoButton,
  violations,
} from "./helpers.js";

/** Counts the times `exportHtml` runs, which is what Check renders with. */
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

/** Gives the element what a Host app would, as properties. */
const giveHost = (page: Page, properties: Partial<MailQuilt>) =>
  canvas(page).evaluate((element, given) => {
    Object.assign(element, given);
  }, properties);

const editTab = (page: Page) =>
  canvas(page).getByRole("tab", { exact: true, name: "Edit" });

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
  await openTestPage(page);
});

test("a slow MJML says it's checking, then shows the email at both widths and announces the count", async ({
  page,
}) => {
  const release = await holdMjml(page);
  await stopClock(page);

  await openCheck(page);
  await expect(checkPanel(page)).toContainText("Checking the email…");
  await page.clock.runFor(200);
  await expect(canvas(page).getByText("Loading preview…")).toHaveCount(2);

  await release();
  await expect(inboxEmail(page)).toContainText("Hello");
  await expect(
    canvas(page)
      .getByTitle("The email on a phone")
      .contentFrame()
      .locator("body")
  ).toContainText("Hello");
  // The test email has no preheader and no language.
  await expect(announcement(page)).toHaveText("2 things to fix.");
  await expect(checkTab(page)).toHaveAccessibleName("Check 2 to fix");
});

test("an email with no Problems says so, and that it's ready", async ({
  page,
}) => {
  const email = emailWith([[["Hello"]]]);
  email.settings.preheader = "This week's news";
  email.settings.language = "en";
  await setValue(page, email);

  await openCheck(page);

  await expect(announcement(page)).toHaveText("8 checks passed.");
  await expect(checkPanel(page)).toContainText("Ready to export");
  await expect(checkPanel(page).getByRole("listitem")).toHaveCount(8);
  await expect(checkTab(page)).toHaveAccessibleName("Check");
});

test("MJML failing to load shows the reason, Edit keeps working, and coming back to Check retries", async ({
  page,
}) => {
  await page.route("**/*mjml-browser*", (route) => route.abort());

  await openCheck(page);

  await expect(canvas(page).getByRole("alert").first()).toContainText(
    "The preview couldn't be loaded:"
  );
  await expect(announcement(page)).toHaveText("The email couldn't be checked.");
  await editTab(page).click();
  await focusStartOfTextBlock(page);
  await page.keyboard.type("a");
  await expect(textBlock(page)).toHaveText("aHello");
  await openCheck(page);
  await expect(canvas(page).getByRole("alert").first()).toBeVisible();
  await editTab(page).click();

  // With no change to the email since, as the Preview tried again.
  await page.unroute("**/*mjml-browser*");
  await openCheck(page);

  await expect(inboxEmail(page)).toContainText("aHello");
  await expect(canvas(page).getByRole("alert")).toHaveCount(0);
});

test.describe("reflecting the latest edits", () => {
  test("an unchanged email isn't rendered again, and any change is, undo in Check too", async ({
    page,
  }) => {
    await countExports(page);

    await openCheck(page);
    await expect(inboxEmail(page)).toContainText("Hello");
    await editTab(page).click();
    await openCheck(page);
    await expect(inboxEmail(page)).toContainText("Hello");
    expect(await exportCount(page)).toBe("1");

    await editTab(page).click();
    await focusStartOfTextBlock(page);
    await page.keyboard.type("x");
    // The count was for the email before the change.
    await expect(checkTab(page)).toHaveAccessibleName("Check");
    await openCheck(page);
    await expect(inboxEmail(page)).toContainText("xHello");
    expect(await exportCount(page)).toBe("2");

    await undoButton(page).click();

    await expect(inboxEmail(page)).not.toContainText("xHello");
    await expect(inboxEmail(page)).toContainText("Hello");
    expect(await exportCount(page)).toBe("3");
  });

  test("leaving during a render, editing and coming back shows the edit", async ({
    page,
  }) => {
    const release = await holdMjml(page);
    await openCheck(page);
    await editTab(page).click();

    await focusStartOfTextBlock(page);
    await page.keyboard.type("x");
    await openCheck(page);
    await release();

    await expect(inboxEmail(page)).toContainText("xHello");
    expect(await inboxFrame(page).getAttribute("srcdoc")).toBe(
      await exportHtml(page)
    );
  });

  test("a different document from the host is checked in its place", async ({
    page,
  }) => {
    await openCheck(page);
    await expect(inboxEmail(page)).toContainText("Hello");

    await setValue(page, emailWith([[["Another email"]]]));

    await expect(inboxEmail(page)).toContainText("Another email");
  });

  test("moving the element keeps Check working", async ({ page }) => {
    await openCheck(page);
    await expect(inboxEmail(page)).toContainText("Hello");

    await canvas(page).evaluate((element) => {
      document.body.append(element);
    });

    await expect(inboxEmail(page)).toContainText("Hello");
  });
});

// WebKit types into a Block's selection even with focus outside the text.
test("the email can't be typed into behind Check", async ({ page }) => {
  await focusStartOfTextBlock(page);
  await openCheck(page);
  await expect(inboxEmail(page)).toContainText("Hello");

  await page.keyboard.type("x");

  await editTab(page).click();
  await expect(textBlock(page)).toHaveText("Hello");
});

test.describe("the sandbox", () => {
  test("scripts in the email can't run or reach the host page", async ({
    page,
  }) => {
    const posted = await hostEvents(page, "message", ["data"]);
    await openCheck(page);
    await expect(inboxEmail(page)).toContainText("Hello");

    await inboxFrame(page).evaluate((frame, email) => {
      (frame as HTMLIFrameElement).srcdoc = email;
    }, hostileEmail("check"));
    await expect(inboxEmail(page)).toContainText("check loaded");

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
    // A message arrives a task after it's sent, and the email's would have
    // been sent first, so once the control's is here, any from the email is.
    const messages = async () => {
      const heard = await posted();
      return heard.map(({ data }) => data);
    };
    await expect.poll(messages).toContain("control");
    expect(await messages()).not.toContain("check");
    await expect(page.locator("html")).not.toHaveAttribute("data-check");
  });

  test("a link in the email opens nothing and leaves the host page", async ({
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

    await openCheck(page);
    await inboxEmail(page).getByRole("link", { name: "Go there" }).click();

    // The same email outside Check opens the link. Check's click came
    // first, so once this one has loaded, any from it would have too.
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
      await inboxFrame(page).evaluate((frame) => [
        ...(frame as HTMLIFrameElement).sandbox,
      ])
    ).toEqual(["allow-same-origin"]);
    expect(page.url()).toBe(url);
    await expect(inboxEmail(page)).toContainText("Go there");
  });
});

test("a fix button reaches its field from the Phone view too, where fields keep their names", async ({
  context,
  page,
}) => {
  await serveImages(context);
  await openBlocks(page, ["image"]);
  await canvas(page)
    .getByRole("group", { name: "View" })
    .getByRole("button", { name: "Phone" })
    .click();
  await openCheck(page);

  await checkPanel(page)
    .getByRole("listitem")
    .filter({ hasText: "Image has no alt text" })
    .getByRole("button", { name: "Add alt text" })
    .click();

  await expect(
    canvas(page).getByRole("textbox", { name: "Alt text" })
  ).toBeFocused();
});

test("a fix button opens Edit with focus in the field to fix, and the Problem under it", async ({
  context,
  page,
}) => {
  await serveImages(context);
  // An Image with an image and no alt text.
  await openBlocks(page, ["image"]);
  await openCheck(page);
  await expect(checkPanel(page)).toContainText("3 things to fix.");
  expect(await violations(page, "mail-quilt", { excludeIframe: true })).toEqual(
    []
  );
  const problem = checkPanel(page).getByRole("listitem").filter({
    hasText: "Image has no alt text",
  });
  await expect(problem).toContainText("Row 1");

  await problem.getByRole("button", { name: "Add alt text" }).click();

  await expect(editTab(page)).toHaveAttribute("aria-selected", "true");
  await expect(
    canvas(page).getByRole("textbox", { name: "Alt text" })
  ).toBeFocused();
  await expect(
    canvas(page).getByText("Image has no alt text", { exact: true })
  ).toBeVisible();
  await expect(announcement(page)).toContainText(
    "Image has no alt text. If images are blocked"
  );

  await page.keyboard.type("A cup of coffee");
  await page.keyboard.press("Enter");
  await openCheck(page);
  await expect(checkPanel(page)).toContainText("Every Image has alt text");
});

test("the button below the email opens Check from the keyboard, with focus on Check's tab", async ({
  page,
}) => {
  const button = canvas(page).getByRole("button", {
    exact: true,
    name: "Check the email",
  });
  await button.focus();

  await page.keyboard.press("Enter");

  await expect(checkPanel(page)).toBeVisible();
  await expect(checkTab(page)).toBeFocused();
});

test.describe("Merge Tags", () => {
  test("Show sample values fills each tag with its sample, and off shows it as written", async ({
    page,
  }) => {
    await setValue(page, emailWith([[["Hi {{first_name}}, {{city}}"]]]));
    await giveHost(page, {
      mergeTags: [{ name: "first_name", sample: "Ana" }, { name: "city" }],
    });
    await openCheck(page);
    const samples = canvas(page).getByRole("switch", {
      name: "Show sample values",
    });

    await expect(samples).toBeChecked();
    await expect(inboxEmail(page)).toContainText("Hi Ana, {{city}}");

    await samples.click();

    await expect(inboxEmail(page)).toContainText("Hi {{first_name}}, {{city}}");
  });

  test("with no samples, there's no switch and the email shows tags as written", async ({
    page,
  }) => {
    await setValue(page, emailWith([[["Hi {{first_name}}"]]]));
    await giveHost(page, { mergeTags: [{ name: "first_name" }] });

    await openCheck(page);

    await expect(inboxEmail(page)).toContainText("Hi {{first_name}}");
    await expect(canvas(page).getByRole("switch")).toHaveCount(0);
  });

  test("a sample with HTML in it shows as text", async ({ page }) => {
    await setValue(page, emailWith([[["Hi {{first_name}}"]]]));
    await giveHost(page, {
      mergeTags: [{ name: "first_name", sample: "<b>Ana</b>" }],
    });

    await openCheck(page);

    await expect(inboxEmail(page)).toContainText("Hi <b>Ana</b>");
    await expect(inboxEmail(page).locator("b")).toHaveCount(0);
  });

  // The export writes the tag's & as &amp;, as it does any text's.
  test("a tag whose name has an & in it gets its sample", async ({ page }) => {
    await setValue(page, emailWith([[["Hi {{a&b}}"]]]));
    await giveHost(page, { mergeTags: [{ name: "a&b", sample: "Ana" }] });

    await openCheck(page);

    await expect(inboxEmail(page)).toContainText("Hi Ana");
  });

  // Without a list, tags aren't checked; an empty one has none of them.
  test("an empty list of tags is checked, and no list again isn't", async ({
    page,
  }) => {
    await setValue(page, emailWith([[["Hi {{first_name}}"]]]));
    await openCheck(page);
    await expect(checkPanel(page)).not.toContainText("Merge Tag");

    await giveHost(page, { mergeTags: [] });

    await expect(checkPanel(page)).toContainText(
      "first_name isn't one of your Merge Tags"
    );

    await giveHost(page, { mergeTags: undefined });

    await expect(checkPanel(page)).not.toContainText("Merge Tag");
  });
});

test("the inbox shows the host's sender and subject, or else the preheader alone", async ({
  page,
}) => {
  const email = emailWith([[["Hello"]]]);
  email.settings.preheader = "This week's news";
  await setValue(page, email);
  await openCheck(page);
  await expect(canvas(page).getByText("This week's news")).toBeVisible();
  await expect(canvas(page).getByText("—")).toHaveCount(0);

  await giveHost(page, { sender: "Northbound", subject: "Spring roast" });

  await expect(canvas(page).getByText("Northbound")).toBeVisible();
  await expect(
    canvas(page).getByText("Spring roast — This week's news")
  ).toBeVisible();
});

test("a Problem's words are the host's, through strings", async ({ page }) => {
  await giveHost(page, {
    strings: {
      "problem.preheader": "Pas de pré-en-tête",
      "problem.preheaderWhy": "Les boîtes montrent « {words} ».",
    },
  });

  await openCheck(page);

  await expect(checkPanel(page)).toContainText("Pas de pré-en-tête");
  await expect(checkPanel(page)).toContainText(
    "Les boîtes montrent « Hello »."
  );
});

test("Check's email is the email at both widths: Columns side by side, and stacked on a phone", async ({
  page,
}) => {
  await openEmail(page, [[["Left"], ["Right"]]]);
  await openCheck(page);
  const phone = canvas(page)
    .getByTitle("The email on a phone")
    .contentFrame()
    .locator("body");
  const rightBelowLeft = async (email: typeof phone) => {
    const left = await email.getByText("Left").boundingBox();
    const right = await email.getByText("Right").boundingBox();
    return (right?.y ?? 0) - (left?.y ?? 0);
  };

  await expect.poll(() => rightBelowLeft(inboxEmail(page))).toBe(0);
  await expect.poll(() => rightBelowLeft(phone)).toBeGreaterThan(0);
});

const viewTab = (page: Page, name: string) =>
  canvas(page).getByRole("tab", { exact: true, name });

/** What Check's tab `name` shows. */
const shown = (page: Page, name: string) =>
  canvas(page).getByRole("tabpanel", { exact: true, name });

/**
 * Keeps what the next copy puts on the clipboard as text, read as the copy
 * event leaves the page, so the system's clipboard isn't used.
 */
const keepNextCopy = (page: Page) =>
  page.evaluate(() => {
    window.addEventListener(
      "copy",
      (event) => {
        document.documentElement.dataset.copied =
          event.clipboardData?.getData("text/plain") ?? "";
      },
      { once: true }
    );
  });

const copiedText = (page: Page) =>
  page.evaluate(() => document.documentElement.dataset.copied);

test.describe("the Plain text and HTML tabs", () => {
  test("Plain text shows exportText() with sample values, and Copy text copies it with its Merge Tags and says so", async ({
    page,
  }) => {
    await setValue(page, emailWith([[["Hi {{first_name}}"]]]));
    await giveHost(page, {
      mergeTags: [{ name: "first_name", sample: "Ana" }],
    });
    await openCheck(page);

    await viewTab(page, "Plain text").click();

    await expect(shown(page, "Plain text")).toHaveText("Hi Ana");
    expect(
      await violations(page, "mail-quilt", { excludeIframe: true })
    ).toEqual([]);

    // As it's sent, so a sample never goes to every reader.
    await keepNextCopy(page);
    await canvas(page).getByRole("button", { name: "Copy text" }).click();

    expect(await copiedText(page)).toBe("Hi {{first_name}}");
    await expect(announcement(page)).toHaveText("Plain text copied.");
    await expect(
      canvas(page).getByRole("button", { exact: true, name: "Copied" })
    ).toBeVisible();

    await canvas(page)
      .getByRole("switch", { name: "Show sample values" })
      .click();
    await expect(shown(page, "Plain text")).toHaveText(
      await canvas(page).evaluate((element) =>
        (element as MailQuilt).exportText()
      )
    );
    await expect(shown(page, "Plain text")).toHaveText("Hi {{first_name}}");
  });

  test("a copy the browser doesn't make is said, and the button doesn't say Copied", async ({
    page,
  }) => {
    await openCheck(page);
    await viewTab(page, "Plain text").click();
    // As a browser that refuses the copy fires no copy event.
    await page.evaluate(() => {
      document.execCommand = () => false;
    });

    await canvas(page).getByRole("button", { name: "Copy text" }).click();

    await expect(announcement(page)).toHaveText(
      "Couldn't copy. Select the text and copy it instead."
    );
    await expect(
      canvas(page).getByRole("button", { name: "Copy text" })
    ).toBeVisible();
  });

  test("HTML shows the export read-only with its size, without sample values, and Copy HTML copies the export", async ({
    page,
  }) => {
    await setValue(page, emailWith([[["Hi {{first_name}}"]]]));
    await giveHost(page, {
      mergeTags: [{ name: "first_name", sample: "Ana" }],
    });
    await openCheck(page);
    const html = await exportHtml(page);

    await viewTab(page, "HTML").click();

    await expect(shown(page, "HTML")).toContainText("Hi {{first_name}}");
    await expect(canvas(page)).toContainText(
      `${Math.round(new TextEncoder().encode(html).length / 1024)} KB · read only`
    );
    await expect(
      canvas(page).getByRole("switch", { name: "Show sample values" })
    ).toHaveCount(0);
    expect(
      await violations(page, "mail-quilt", { excludeIframe: true })
    ).toEqual([]);

    await keepNextCopy(page);
    await canvas(page).getByRole("button", { name: "Copy HTML" }).click();

    expect(await copiedText(page)).toBe(html);
    await expect(announcement(page)).toHaveText("HTML copied.");
  });

  test("the tabs are one Tab stop, chosen as the arrow keys reach them, with the text's box after them", async ({
    page,
  }) => {
    await openCheck(page);
    await viewTab(page, "Inbox").focus();

    await page.keyboard.press("ArrowRight");

    await expect(viewTab(page, "Plain text")).toBeFocused();
    await expect(viewTab(page, "Plain text")).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await page.keyboard.press("Tab");
    await expect(
      canvas(page).getByRole("button", { name: "Copy text" })
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(shown(page, "Plain text")).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Shift+Tab");
    await expect(viewTab(page, "Plain text")).toBeFocused();
  });
});

const sendTestButton = (page: Page) =>
  checkPanel(page).getByRole("button", { name: "Send a test" });

/**
 * Gives the element a `sendTest` that keeps what it's given and waits for
 * `settleTest`, which resolves it, or rejects it with `rejection`.
 */
const giveSendTest = (page: Page) =>
  canvas(page).evaluate((element) => {
    const held = window as unknown as {
      sent: unknown[];
      settleTest: (rejection?: unknown) => void;
    };
    held.sent = [];
    (element as MailQuilt).sendTest = (email) => {
      held.sent.push(email);
      // oxlint-disable-next-line promise/avoid-new -- The test settles each send.
      return new Promise((resolve, reject) => {
        held.settleTest = (rejection) => {
          if (rejection === undefined) {
            resolve(undefined);
          } else {
            reject(rejection);
          }
        };
      });
    };
  });

const settleTest = (page: Page, rejection?: string | object) =>
  page.evaluate((given) => {
    const held = window as unknown as {
      settleTest: (rejection?: unknown) => void;
    };
    held.settleTest(
      typeof given === "string" ? new Error(given) : (given ?? undefined)
    );
  }, rejection ?? null);

test.describe("Send a test", () => {
  test("without sendTest there's no button", async ({ page }) => {
    await openCheck(page);
    await expect(checkPanel(page)).toContainText("things to fix.");

    await expect(sendTestButton(page)).toHaveCount(0);
  });

  test("it's off until the check ends, then sends the export, the plain text and the subject, and says it's sent", async ({
    page,
  }) => {
    const release = await holdMjml(page);
    await giveSendTest(page);
    await giveHost(page, { subject: "Spring roast" });
    await openCheck(page);
    await expect(sendTestButton(page)).toHaveAttribute("aria-disabled", "true");
    await sendTestButton(page).press("Enter");
    await release();
    await expect(sendTestButton(page)).not.toHaveAttribute("aria-disabled");

    // From the keyboard, as a press doesn't focus a button in Safari.
    await sendTestButton(page).press("Enter");

    const sending = checkPanel(page).getByRole("button", { name: "Sending…" });
    await expect(sending).toBeFocused();
    await expect(sending).toHaveAttribute("aria-disabled", "true");
    await sending.press("Enter");
    await settleTest(page);
    await expect(checkPanel(page)).toContainText("Test sent.");
    await expect(announcement(page)).toHaveText("Test sent.");
    await expect(sendTestButton(page)).toBeFocused();
    const text = await canvas(page).evaluate((element) =>
      (element as MailQuilt).exportText()
    );
    expect(
      await page.evaluate(() => (window as unknown as { sent: unknown[] }).sent)
    ).toEqual([
      { html: await exportHtml(page), subject: "Spring roast", text },
    ]);
  });

  test("a change to the email while a test sends keeps the button off until it ends, and its result is said but not shown", async ({
    page,
  }) => {
    await giveSendTest(page);
    await openCheck(page);
    await expect(checkPanel(page)).toContainText("things to fix.");
    await sendTestButton(page).press("Enter");

    await setValue(page, emailWith([[["Changed"]]]));
    await expect(inboxEmail(page)).toContainText("Changed");
    const sending = checkPanel(page).getByRole("button", { name: "Sending…" });
    await expect(sending).toHaveAttribute("aria-disabled", "true");
    await sending.press("Enter");
    await settleTest(page);

    await expect(announcement(page)).toHaveText("Test sent.");
    await expect(sendTestButton(page)).not.toHaveAttribute("aria-disabled");
    await expect(checkPanel(page)).not.toContainText("Test sent.");
    expect(
      await page.evaluate(
        () => (window as unknown as { sent: unknown[] }).sent.length
      )
    ).toBe(1);
  });

  test("a rejection shows the host's message, or the default without one, and says it", async ({
    page,
  }) => {
    await giveSendTest(page);
    await openCheck(page);
    await expect(checkPanel(page)).toContainText("things to fix.");

    await sendTestButton(page).click();
    await settleTest(page, "Your plan sends 10 tests a day.");
    await expect(checkPanel(page)).toContainText(
      "Your plan sends 10 tests a day."
    );
    await expect(announcement(page)).toHaveText(
      "Your plan sends 10 tests a day."
    );

    await sendTestButton(page).click();
    await expect(checkPanel(page)).not.toContainText("Your plan");
    await settleTest(page, { reason: "not an Error" });
    await expect(checkPanel(page)).toContainText(
      "The test wasn't sent. Try again."
    );
    await expect(announcement(page)).toHaveText(
      "The test wasn't sent. Try again."
    );
  });
});
