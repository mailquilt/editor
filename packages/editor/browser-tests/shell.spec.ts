import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import type { MailQuiltShell } from "../src/index.js";
import {
  boxOf,
  canvas,
  emailWith,
  emailWithLink,
  focusStartOfTextBlock,
  selectRowButton,
  textBlock,
  violations,
} from "./helpers.js";

const shell = (page: Page) => page.locator("mail-quilt-shell");

/** Clicks an export button and returns the file it gives the person. */
const exportFile = async (page: Page, button: string) => {
  const downloading = page.waitForEvent("download");
  await shell(page).getByRole("button", { name: button }).click();
  const download = await downloading;
  return {
    name: download.suggestedFilename(),
    text: await readFile(await download.path(), "utf-8"),
  };
};

const importFile = async (page: Page, text: string) => {
  const choosing = page.waitForEvent("filechooser");
  await shell(page).getByRole("button", { name: "Import JSON" }).click();
  const chooser = await choosing;
  await chooser.setFiles({
    buffer: Buffer.from(text),
    mimeType: "application/json",
    name: "email.json",
  });
};

// Playwright stops intercepting file choosers when its last listener goes, and
// Firefox can then miss the chooser of a later import in the same test.
test.beforeEach(({ page }) => {
  page.on("filechooser", () => null);
});

const header = (page: Page) => shell(page).locator('[part="header"]');

/** An element's box, with where it starts and ends going down. */
const box = async (target: Locator) => {
  const found = await boxOf(target);
  return { ...found, bottom: found.y + found.height, top: found.y };
};

const setShellValue = (page: Page, email: unknown) =>
  shell(page).evaluate((element, next) => {
    (element as MailQuiltShell).value = next as MailQuiltShell["value"];
  }, email);

const openShell = async (page: Page, query = "") => {
  await page.goto(`/shell.html${query}`);
  await expect(textBlock(page)).toHaveText("Hello");
};

test("a heading the host sets is in the page's language, and Email is in English", async ({
  page,
}) => {
  await openShell(page);
  const heading = header(page).getByRole("heading");

  await shell(page).evaluate((element) => {
    element.setAttribute("heading", "Welcome email");
  });
  await expect(heading).toHaveText("Welcome email");
  await expect(heading).not.toHaveAttribute("lang");

  await shell(page).evaluate((element) => {
    element.removeAttribute("heading");
  });
  await expect(heading).toHaveText("Email");
  await expect(heading).toHaveAttribute("lang", "en");
});

test.describe("choosing the buttons with actions", () => {
  test("shows only the ones it names, in the Shell's own order", async ({
    page,
  }) => {
    await openShell(page, "?actions=export-html%20import-json");

    await expect(header(page).getByRole("button")).toHaveText([
      "Import JSON",
      "Export HTML",
    ]);
  });

  test("shows none when empty, and ignores names it doesn't know", async ({
    page,
  }) => {
    await openShell(page, "?actions=");
    await expect(header(page).getByRole("button")).toHaveCount(0);
    await expect(header(page)).toContainText("Email");

    await shell(page).evaluate((element) =>
      element.setAttribute("actions", "export-json send-test")
    );

    await expect(header(page).getByRole("button")).toHaveText(["Export JSON"]);
  });

  test("is a property too", async ({ page }) => {
    await openShell(page);

    await shell(page).evaluate((element) => {
      (element as MailQuiltShell).actions = "export-html";
    });

    await expect(shell(page)).toHaveAttribute("actions", "export-html");
    await expect(header(page).getByRole("button")).toHaveText(["Export HTML"]);
  });

  test("the can't-save message only suggests Export JSON when it shows", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException("Full", "QuotaExceededError");
      };
    });
    await openShell(page, "?actions=export-html&save-key=test:email");

    await focusStartOfTextBlock(page);
    await page.keyboard.type("Unsaved ");

    await expect(shell(page).getByRole("alert")).toHaveText(
      "This browser can't save your email here."
    );
  });
});

test.describe("moving an email with JSON", () => {
  test("an exported email comes back when imported", async ({ page }) => {
    await openShell(page);
    await focusStartOfTextBlock(page);
    await page.keyboard.type("Exported ");
    const { name, text } = await exportFile(page, "Export JSON");
    expect(name).toBe("email.json");
    // Formatted, so a person can read it.
    expect(text).toContain('\n  "kind": "blocks"');
    await focusStartOfTextBlock(page);
    await page.keyboard.type("Later ");
    await expect(textBlock(page)).toHaveText("Later Exported Hello");
    const changesBefore = Number(
      await page.locator("#change-count").textContent()
    );

    await importFile(page, text);

    await expect(textBlock(page)).toHaveText("Exported Hello");
    // The host hears an import, as it would any other change.
    await expect(page.locator("#change-count")).toHaveText(
      String(changesBefore + 1)
    );
  });

  test("an import with a link that isn't allowed is refused, and keeps the current email", async ({
    page,
  }) => {
    await openShell(page);

    await importFile(
      page,
      // oxlint-disable-next-line eslint/no-script-url -- This is what's refused.
      JSON.stringify(emailWithLink("Click", "javascript:alert(1)"))
    );

    await expect(shell(page).getByRole("alert")).toContainText(
      "couldn't be imported"
    );
    await expect(shell(page).getByRole("alert")).toContainText(
      "A link must start with http:"
    );
    await expect(textBlock(page)).toHaveText("Hello");
  });

  test("a file that can't be read is refused, and says so", async ({
    page,
  }) => {
    await openShell(page);
    await page.evaluate(() => {
      Blob.prototype.text = () =>
        Promise.reject(new DOMException("Gone", "NotReadableError"));
    });

    await importFile(page, JSON.stringify(emailWith([[["Imported"]]])));

    await expect(shell(page).getByRole("alert")).toHaveText(
      "That file couldn't be imported: The file couldn't be read"
    );
    await expect(textBlock(page)).toHaveText("Hello");
  });

  test("the same reason again is a new alert, read out again", async ({
    page,
  }) => {
    await openShell(page);
    await importFile(page, "{not json");
    const alert = shell(page).getByRole("alert");
    await alert.evaluate((element) => {
      element.dataset.seen = "true";
    });

    await importFile(page, "{not json");

    await expect(alert).toContainText("valid JSON");
    await expect(alert).not.toHaveAttribute("data-seen");
  });

  test("the same file, once fixed, can be chosen again", async ({ page }) => {
    await openShell(page);
    await importFile(page, "{not json");
    await expect(shell(page).getByRole("alert")).toContainText("valid JSON");

    // A browser only reports a choice that differs from the input's value.
    await expect(shell(page).locator("input[type=file]")).toHaveValue("");
  });

  test("a reason goes away with the next edit or good file", async ({
    page,
  }) => {
    await openShell(page);
    const { text } = await exportFile(page, "Export JSON");

    await importFile(page, "{not json");
    await expect(shell(page).getByRole("alert")).toBeVisible();
    await importFile(page, text);
    await expect(shell(page).getByRole("alert")).toHaveCount(0);

    await importFile(page, "{not json");
    await expect(shell(page).getByRole("alert")).toBeVisible();
    await focusStartOfTextBlock(page);
    await page.keyboard.type("Edited ");
    await expect(shell(page).getByRole("alert")).toHaveCount(0);
  });

  test("with no email, the exports say so and download nothing", async ({
    page,
  }) => {
    let downloads = 0;
    page.on("download", () => {
      downloads += 1;
    });

    for (const name of ["Export JSON", "Export HTML"]) {
      // oxlint-disable-next-line no-await-in-loop -- Each starts afresh, so its own reason shows.
      await page.goto("/shell.html?refused-first");
      // oxlint-disable-next-line no-await-in-loop -- See above.
      await expect(shell(page).getByRole("alert")).toContainText("newer");
      // oxlint-disable-next-line no-await-in-loop -- See above.
      await shell(page).getByRole("button", { name }).click();
      // oxlint-disable-next-line no-await-in-loop -- See above.
      await expect(shell(page).getByRole("alert")).toHaveText(
        "There's no email to export."
      );
    }
    expect(downloads).toBe(0);
  });
});

test.describe("the editor's API", () => {
  test("value, mq-change and exportHtml() behave as on <mail-quilt>", async ({
    page,
  }) => {
    await openShell(page);
    await focusStartOfTextBlock(page);

    await page.keyboard.type("Oh ");

    await expect(page.locator("#change-count")).toHaveText("3");
    const { html, value } = await shell(page).evaluate(async (element) => {
      const host = element as MailQuiltShell;
      return { html: await host.exportHtml(), value: host.value };
    });
    expect(JSON.stringify(value)).toContain("Oh Hello");
    expect(html).toMatch(/<!doctype html>/iu);
    expect(html).toContain("Oh Hello");
  });

  test("exportHtml() works straight after the Shell is added", async ({
    page,
  }) => {
    await page.goto("/shell.html");
    const html = await page.evaluate(
      async (email) => {
        const added = document.createElement(
          "mail-quilt-shell"
        ) as MailQuiltShell;
        added.value = email;
        document.body.append(added);
        return await added.exportHtml();
      },
      emailWith([[["Straight away"]]])
    );

    expect(html).toContain("Straight away");
  });

  test("a value set before the element is defined still opens", async ({
    page,
  }) => {
    await page.goto("/shell.html");
    const html = await page.evaluate(
      async (email) => {
        const late = document.createElement(
          "mail-quilt-shell-late"
        ) as MailQuiltShell;
        late.value = email;
        document.body.append(late);
        const defined = customElements.get(
          "mail-quilt-shell"
        ) as typeof MailQuiltShell;
        customElements.define(
          "mail-quilt-shell-late",
          class extends defined {}
        );
        await late.updateComplete;
        return await late.exportHtml();
      },
      emailWith([[["Early"]]])
    );

    expect(html).toContain("Early");
  });

  test("a refused first email fires mq-error and shows its reason", async ({
    page,
  }) => {
    await page.goto("/shell.html?refused-first");

    await expect(page.locator("#errors")).toContainText("newer");
    await expect(shell(page).getByRole("alert")).toContainText("newer");
    await expect(textBlock(page)).toHaveCount(0);
  });

  test("a refused later email keeps the current one", async ({ page }) => {
    await openShell(page);

    await shell(page).evaluate((element) => {
      (element as MailQuiltShell).value = {
        kind: "blocks",
        rows: [],
        version: 2,
      } as unknown as MailQuiltShell["value"];
    });

    await expect(page.locator("#errors")).toContainText(/version 2 is newer/iu);
    await expect(shell(page).getByRole("alert")).toBeVisible();
    await expect(textBlock(page)).toHaveText("Hello");
  });

  test("a failed export says so, until email.html downloads", async ({
    page,
  }) => {
    await openShell(page);
    // MJML loads on first export, so this is when that request can fail.
    await page.route("**/*.js", (route) => route.abort());

    await shell(page).getByRole("button", { name: "Export HTML" }).click();

    await expect(shell(page).getByRole("alert")).toContainText(
      "couldn't be exported"
    );
    await page.unrouteAll();
    const { name, text } = await exportFile(page, "Export HTML");
    expect(name).toBe("email.html");
    expect(text).toContain("Hello");
    await expect(shell(page).getByRole("alert")).toHaveCount(0);
  });
});

test.describe("saving in the browser", () => {
  const key = "test:email";
  const saved = (page: Page) =>
    page.evaluate((each) => localStorage.getItem(each), key);

  test("a reload reopens the last email", async ({ page }) => {
    await openShell(page, `?save-key=${key}`);
    await focusStartOfTextBlock(page);
    await page.keyboard.type("Saved ");
    await expect.poll(() => saved(page)).toContain("Saved Hello");

    await page.reload();

    await expect(textBlock(page)).toHaveText("Saved Hello");
  });

  test("a reload reopens an imported email", async ({ page }) => {
    await openShell(page, `?save-key=${key}`);
    await importFile(page, JSON.stringify(emailWith([[["Imported"]]])));
    await expect(textBlock(page)).toHaveText("Imported");

    await page.reload();

    await expect(textBlock(page)).toHaveText("Imported");
  });

  test("a damaged saved email shows why, and is kept apart from the next save", async ({
    page,
  }) => {
    await page.addInitScript(
      (each) => localStorage.setItem(each, "{not json"),
      key
    );
    await openShell(page, `?save-key=${key}`);

    await expect(shell(page).getByRole("alert")).toContainText(
      "saved email couldn't be opened"
    );
    expect(await saved(page)).toBe("{not json");

    await focusStartOfTextBlock(page);
    await page.keyboard.type("New ");

    await expect.poll(() => saved(page)).toContain("New Hello");
    await expect(shell(page).getByRole("alert")).toHaveCount(0);
    expect(
      await page.evaluate(
        (each) => localStorage.getItem(`${each}:unopened`),
        key
      )
    ).toBe("{not json");
  });

  for (const { name, script } of [
    {
      name: "blocked",
      script: () => {
        Object.defineProperty(window, "localStorage", {
          get() {
            throw new DOMException("Blocked", "SecurityError");
          },
        });
      },
    },
    {
      name: "full",
      script: () => {
        Storage.prototype.setItem = () => {
          throw new DOMException("Full", "QuotaExceededError");
        };
      },
    },
  ]) {
    test(`says it can't save when storage is ${name}`, async ({ page }) => {
      await page.addInitScript(script);
      await openShell(page, `?save-key=${key}`);

      await focusStartOfTextBlock(page);
      await page.keyboard.type("Unsaved ");

      await expect(shell(page).getByRole("alert")).toContainText("can't save");
      await expect(shell(page).getByRole("alert")).toContainText(
        "Export it as JSON"
      );
      await expect(textBlock(page)).toHaveText("Unsaved Hello");
    });
  }

  test("keeps saying it can't save while showing another reason", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new DOMException("Blocked", "SecurityError");
        },
      });
    });
    await openShell(page, `?save-key=${key}`);

    await importFile(page, "{not json");

    const alerts = shell(page).getByRole("alert");
    await expect(alerts.filter({ hasText: "valid JSON" })).toBeVisible();
    await expect(alerts.filter({ hasText: "can't save" })).toBeVisible();
  });

  test("stops saying it can't save once save-key is removed", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new DOMException("Blocked", "SecurityError");
        },
      });
    });
    await openShell(page, `?save-key=${key}`);
    await expect(shell(page).getByRole("alert")).toContainText("can't save");

    await shell(page).evaluate((element) =>
      element.removeAttribute("save-key")
    );

    await expect(shell(page).getByRole("alert")).toHaveCount(0);
  });

  test("without a save key, nothing is stored", async ({ page }) => {
    await page.addInitScript(() => {
      const touched: string[] = [];
      (window as unknown as { touched: string[] }).touched = touched;
      const { getItem: realGetItem, setItem: realSetItem } = Storage.prototype;
      Storage.prototype.getItem = function getItem(name) {
        touched.push(`get ${name}`);
        return realGetItem.call(this, name);
      };
      Storage.prototype.setItem = function setItem(name, value) {
        touched.push(`set ${name}`);
        realSetItem.call(this, name, value);
      };
    });
    await openShell(page);

    await focusStartOfTextBlock(page);
    await page.keyboard.type("Oh ");
    await expect(page.locator("#change-count")).toHaveText("3");

    expect(
      await page.evaluate(
        () => (window as unknown as { touched: string[] }).touched
      )
    ).toStrictEqual([]);
  });
});

test.describe("a saved email standing in for the host's", () => {
  const key = "test:email";
  const saveFirst = async (page: Page) => {
    await page.addInitScript(
      ({ each, email }) => localStorage.setItem(each, JSON.stringify(email)),
      { each: key, email: emailWith([[["Saved"]]]) }
    );
  };

  test("stays when the host passes its first email again", async ({ page }) => {
    await saveFirst(page);
    await page.goto(`/shell.html?save-key=${key}`);
    await expect(textBlock(page)).toHaveText("Saved");

    // A copy, as a re-render that builds the email again would pass.
    await setShellValue(page, emailWith([[["Hello"]]]));

    await expect(textBlock(page)).toHaveText("Saved");
  });

  test("stays when the host sets nothing before its first email", async ({
    page,
  }) => {
    await saveFirst(page);
    await page.goto(`/shell.html?save-key=${key}&late-value`);
    await expect(textBlock(page)).toHaveText("Saved");

    await setShellValue(page, undefined);
    await setShellValue(page, emailWith([[["Hello"]]]));

    await expect(textBlock(page)).toHaveText("Saved");
  });

  test("gives way to a different email from the host", async ({ page }) => {
    await saveFirst(page);
    await page.goto(`/shell.html?save-key=${key}`);
    await expect(textBlock(page)).toHaveText("Saved");

    await setShellValue(page, emailWith([[["Other"]]]));
    await expect(textBlock(page)).toHaveText("Other");
    // The host can go back to its first email once it has opened another.
    await setShellValue(page, emailWith([[["Hello"]]]));

    await expect(textBlock(page)).toHaveText("Hello");
  });
});

test("a new save-key opens the email saved under it", async ({ page }) => {
  await page.addInitScript(
    (email) => localStorage.setItem("test:second", JSON.stringify(email)),
    emailWith([[["Second"]]])
  );
  await openShell(page, "?save-key=test:first");

  await shell(page).evaluate((element) =>
    element.setAttribute("save-key", "test:second")
  );
  await expect(textBlock(page)).toHaveText("Second");
  await focusStartOfTextBlock(page);
  await page.keyboard.type("Oh ");

  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("test:second")))
    .toContain("Oh Second");
});

test("removing save-key stops saving", async ({ page }) => {
  await openShell(page, "?save-key=test:email");
  await shell(page).evaluate((element) => element.removeAttribute("save-key"));

  await focusStartOfTextBlock(page);
  await page.keyboard.type("Oh ");
  await expect(page.locator("#change-count")).toHaveText("3");

  expect(
    await page.evaluate(() => Object.keys({ ...localStorage }))
  ).toStrictEqual([]);
});

test.describe("look", () => {
  test("fills the space the host gives it, the editor below the header", async ({
    page,
  }) => {
    await openShell(page);

    const editor = shell(page).locator("mail-quilt");
    const boxes = {
      editor: await box(editor),
      frame: await box(page.locator("#frame")),
      header: await box(header(page)),
      // The editor itself stretches, so its side panel runs to the bottom.
      panel: await box(editor.locator(".side-panel")),
    };

    expect(boxes.header.top).toBe(boxes.frame.top);
    expect(boxes.header.width).toBe(boxes.frame.width);
    expect(boxes.editor.top).toBe(boxes.header.bottom);
    expect(boxes.editor.bottom).toBe(boxes.frame.bottom);
    expect(boxes.panel.bottom).toBe(boxes.frame.bottom);
  });

  test("a long email keeps the whole side panel in view", async ({ page }) => {
    await page.goto("/shell.html?long");
    await expect(textBlock(page).first()).toBeVisible();

    const panel = await box(
      shell(page).locator("mail-quilt").locator(".side-panel-inner")
    );
    const frameBox = await box(page.locator("#frame"));

    expect(panel.bottom).toBeLessThanOrEqual(frameBox.bottom);
  });

  // Moving it stops the observer that sizes the side panel, and starts it again.
  test("moved and put back, it still keeps the side panel in view", async ({
    page,
  }) => {
    await page.goto("/shell.html?long");
    await expect(textBlock(page).first()).toBeVisible();

    await shell(page).evaluate((element) => {
      const parent = element.parentElement;
      element.remove();
      parent?.append(element);
    });
    await expect(textBlock(page).first()).toBeVisible();
    // A smaller space after the move, which only a running observer sees.
    await page.locator("#frame").evaluate((frame) => {
      frame.style.height = "500px";
    });

    await expect
      .poll(async () => {
        const panel = await box(
          shell(page).locator("mail-quilt").locator(".side-panel-inner")
        );
        const frameBox = await box(page.locator("#frame"));
        return panel.bottom <= frameBox.bottom;
      })
      .toBe(true);
  });

  test("a tooltip follows its button as the Shell scrolls", async ({
    page,
  }) => {
    await page.goto("/shell.html?long");
    await expect(textBlock(page).first()).toBeVisible();
    await selectRowButton(page, 2).focus();
    // Browsers only show focus from a script after keyboard use.
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    const tooltip = canvas(page).getByRole("tooltip");
    await expect(tooltip).toBeVisible();
    const before = await box(tooltip);

    await shell(page).evaluate((element) => {
      const body = element.shadowRoot?.querySelector(".body");
      if (body) {
        body.scrollTop += 40;
      }
    });

    await expect
      .poll(async () => {
        const { top } = await box(tooltip);
        return Math.round(top);
      })
      .toBe(Math.round(before.top - 40));
  });

  test("a token set on the Shell restyles its header and the editor", async ({
    page,
  }) => {
    await openShell(page);
    await expect(header(page)).toHaveCSS(
      "background-color",
      "rgb(255, 255, 255)"
    );

    await shell(page).evaluate((element) => {
      (element as HTMLElement).style.setProperty(
        "--mq-color-surface",
        "rgb(1, 2, 3)"
      );
    });

    await expect(header(page)).toHaveCSS("background-color", "rgb(1, 2, 3)");
    await expect(
      shell(page).locator("mail-quilt").locator(".side-panel-inner")
    ).toHaveCSS("background-color", "rgb(1, 2, 3)");
  });

  test("keeps its own colors on a dark host page", async ({ page }) => {
    await openShell(page);
    await page.addStyleTag({
      content:
        "html, body, main { background: #000 !important; color: #fff !important; font-family: serif !important; }",
    });

    const style = await header(page).evaluate((element) => {
      const { backgroundColor, color, fontFamily } = getComputedStyle(element);
      return { backgroundColor, color, serif: fontFamily === "serif" };
    });

    expect(style).toStrictEqual({
      backgroundColor: "rgb(255, 255, 255)",
      color: "rgb(22, 24, 29)",
      serif: false,
    });
  });
});

test("shows the dragging cursor over the Shell during a drag", async ({
  page,
}) => {
  await openShell(page);
  const button = shell(page).getByRole("button", { name: "Export HTML" });
  const cursor = () =>
    button.evaluate((element) => getComputedStyle(element).cursor);
  const tile = await box(
    shell(page)
      .getByRole("group", { name: "Add content" })
      .getByRole("button", { exact: true, name: "Add Text Block" })
  );

  await page.mouse.move(tile.x + tile.width / 2, tile.y + tile.height / 2);
  await page.mouse.down();
  await page.mouse.move(tile.x, tile.y + tile.height + 20, { steps: 4 });
  await expect.poll(cursor).toBe("grabbing");
  await page.keyboard.press("Escape");
  await page.mouse.up();

  await expect.poll(cursor).toBe("pointer");
});

test.describe("accessibility", () => {
  test("the keyboard reaches every header control", async ({ page }) => {
    await openShell(page);
    await page.locator("body").click({ position: { x: 1, y: 1 } });

    const reached: string[] = [];
    for (let index = 0; index < 3; index += 1) {
      // oxlint-disable-next-line no-await-in-loop -- Each press moves focus on.
      await page.keyboard.press("Tab");
      // oxlint-disable-next-line no-await-in-loop -- See above.
      const name = await shell(page).evaluate(
        (element) =>
          element.shadowRoot?.activeElement?.textContent?.trim() ?? ""
      );
      reached.push(name);
    }

    expect(reached).toStrictEqual([
      "Import JSON",
      "Export JSON",
      "Export HTML",
    ]);
  });

  test("meets WCAG 2.2 AA, with a message showing", async ({ page }) => {
    await page.goto("/shell.html?refused-first");
    await expect(shell(page).getByRole("alert")).toBeVisible();

    expect(await violations(page, "mail-quilt-shell")).toStrictEqual([]);
  });
});

test.describe("too narrow to edit in", () => {
  test("the notice fills the space below the header, in the Shell's frame", async ({
    page,
  }) => {
    await page.goto("/shell.html?narrow");
    const notice = shell(page)
      .getByText("Editing needs more room")
      .locator("..");
    await expect(notice).toBeVisible();

    const noticeBox = await box(notice);
    const frameBox = await box(page.locator("#frame"));
    const headerBox = await box(header(page));

    expect(noticeBox.top).toBe(headerBox.bottom);
    expect(noticeBox.bottom).toBe(frameBox.bottom);
    await expect(notice).toHaveCSS("border-radius", "0px");
    await expect(notice).toHaveCSS("box-shadow", "none");
  });
});

test.describe("parts", () => {
  test("name each piece of the header and the messages", async ({ page }) => {
    await page.goto("/shell.html?refused-first");
    await expect(shell(page).getByRole("alert")).toBeVisible();

    const parts = await shell(page).evaluate((element) =>
      [...(element.shadowRoot?.querySelectorAll("[part]") ?? [])].map((each) =>
        each.getAttribute("part")
      )
    );

    expect(parts).toStrictEqual([
      "header",
      "heading",
      "actions",
      "import-json",
      "export-json",
      "export-html",
      "messages",
      "message",
    ]);
  });
});
