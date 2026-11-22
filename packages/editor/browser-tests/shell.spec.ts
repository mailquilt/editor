import { readFile } from "node:fs/promises";

import { expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import type { MailQuiltShell } from "../src/index.js";
import {
  boxOf,
  canvas,
  changeCount,
  changesSince,
  dropFileOn,
  emailWith,
  emailWithLink,
  focusStartOfTextBlock,
  palette,
  selectRowButton,
  test,
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
const boxWithEdges = async (target: Locator) => {
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

test("a heading the host sets is in the page's language and its own text's direction, and Email is in English", async ({
  page,
}) => {
  await openShell(page);
  await page.evaluate(() =>
    document.documentElement.setAttribute("dir", "rtl")
  );
  const heading = header(page).getByRole("heading");

  await shell(page).evaluate((element) => {
    element.setAttribute("heading", "בריכה");
  });
  await expect(heading).toHaveCSS("direction", "rtl");

  await shell(page).evaluate((element) => {
    element.setAttribute("heading", "Welcome email");
  });
  await expect(heading).toHaveText("Welcome email");
  await expect(heading).not.toHaveAttribute("lang");
  await expect(heading).toHaveCSS("direction", "ltr");

  await shell(page).evaluate((element) => {
    element.removeAttribute("heading");
  });
  await expect(heading).toHaveText("Email");
  await expect(heading).toHaveAttribute("lang", "en");
  await expect(heading).toHaveCSS("direction", "ltr");

  await shell(page).evaluate((element) => {
    element.setAttribute("heading", "");
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

    await shell(page).evaluate((element) =>
      element.setAttribute("actions", "export-json")
    );

    await expect(shell(page).getByRole("alert")).toHaveText(
      "This browser can't save your email here. Export it as JSON to keep it."
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
    const expectChanges = await changesSince(page);
    await shell(page).evaluate((element) => {
      (element as MailQuiltShell).addEventListener(
        "mq-change",
        ({ detail }) => {
          (window as unknown as { changed: unknown }).changed = detail.document;
        }
      );
    });

    await importFile(page, text);

    await expect(textBlock(page)).toHaveText("Exported Hello");
    // The host hears an import, as it would any other change, with the email.
    await expectChanges(1);
    expect(
      await page.evaluate(
        () => (window as unknown as { changed: unknown }).changed
      )
    ).toStrictEqual(JSON.parse(text));
  });

  test("importing the open email isn't a change", async ({ page }) => {
    await openShell(page);
    const { text } = await exportFile(page, "Export JSON");
    await importFile(page, text);

    // One that is a change, so the one before it would be counted too.
    await importFile(page, JSON.stringify(emailWith([[["Imported"]]])));

    await expect(textBlock(page)).toHaveText("Imported");
    await expect(changeCount(page)).toHaveText("1");
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
    // mq-error is for an email the host sets, not one the person imports.
    expect(await page.getByTestId("errors").textContent()).toBe("");
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

  test("a refused file is cleared from the file input, so it can be chosen again", async ({
    page,
  }) => {
    await openShell(page);
    await importFile(page, "{not json");
    await expect(shell(page).getByRole("alert")).toContainText("valid JSON");

    // A browser only reports a choice that differs from the input's value.
    await expect(shell(page).getByTestId("file-input")).toHaveValue("");
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
      await page.goto("/shell.html?refused-first");
      await expect(shell(page).getByRole("alert")).toContainText("newer");
      await shell(page).getByRole("button", { name }).click();
      await expect(
        shell(page)
          .getByRole("alert")
          .filter({ hasText: "There's no email to export." })
      ).toBeVisible();
    }
    await expect(
      shell(page).evaluate((element) =>
        (element as MailQuiltShell).exportHtml()
      )
    ).rejects.toThrow("<mail-quilt-shell> has no document to export");

    // A download is reported a moment after it starts, so one that does start
    // afterwards shows whether any started before it.
    await openShell(page);
    const download = page.waitForEvent("download");
    await shell(page).getByRole("button", { name: "Export JSON" }).click();
    await download;
    expect(downloads).toBe(1);
  });
});

test.describe("the editor's API", () => {
  test("value, mq-change and exportHtml() behave as on <mail-quilt>", async ({
    page,
  }) => {
    await openShell(page);
    await focusStartOfTextBlock(page);

    await page.keyboard.type("Oh ");

    await expect(changeCount(page)).toHaveText("3");
    const { html, value } = await shell(page).evaluate(async (element) => {
      const host = element as MailQuiltShell;
      return { html: await host.exportHtml(), value: host.value };
    });
    expect(JSON.stringify(value)).toContain("Oh Hello");
    expect(html).toMatch(/<!doctype html>/iu);
    expect(html).toContain("Oh Hello");
  });

  test("uploadImage reaches the editor, and can be taken away", async ({
    page,
  }) => {
    const uploaded = "https://cdn.example/uploaded.png";
    await page
      .context()
      .route("https://cdn.example/**", (route) =>
        route.fulfill({ body: "", contentType: "image/png" })
      );
    await openShell(page);
    await shell(page).evaluate((element, url) => {
      (element as MailQuiltShell).uploadImage = () => Promise.resolve({ url });
    }, uploaded);
    await palette(page, "Image").click();

    const choosing = page.waitForEvent("filechooser");
    await shell(page).getByRole("button", { name: "Upload image" }).click();
    const chooser = await choosing;
    await chooser.setFiles({
      buffer: Buffer.from("x"),
      mimeType: "image/png",
      name: "photo.png",
    });

    await expect(
      shell(page).getByRole("textbox", { name: "Image URL" })
    ).toHaveValue(uploaded);

    await shell(page).evaluate((element) => {
      (element as MailQuiltShell).uploadImage = undefined;
    });

    await expect(
      shell(page).getByRole("button", { name: "Upload image" })
    ).toHaveCount(0);
  });

  test("mergeTags reaches the editor, and can be taken away", async ({
    page,
  }) => {
    await openShell(page);
    await shell(page).evaluate((element) => {
      (element as MailQuiltShell).mergeTags = [{ name: "first_name" }];
    });
    await textBlock(page).click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("{{");

    const picker = shell(page).getByRole("listbox", { name: "Merge Tags" });
    await expect(picker.getByRole("option")).toHaveText(["first_name"]);

    await shell(page).evaluate((element) => {
      (element as MailQuiltShell).mergeTags = undefined;
    });

    await expect(picker).toHaveCount(0);
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

  test("exportHtml() straight after socialIconsUrl is set uses its folder", async ({
    page,
  }) => {
    await page.goto("/shell.html");
    const email = emailWith([[[]]]);
    email.rows[0]?.columns[0]?.blocks.push({
      id: "social",
      props: { links: [{ network: "x", url: "https://x.com/shop" }] },
      type: "social",
    });
    const html = await page.evaluate(async (value) => {
      const added = document.createElement(
        "mail-quilt-shell"
      ) as MailQuiltShell;
      added.socialIconsUrl = "https://icons.example/mail/";
      added.value = value;
      document.body.append(added);
      return await added.exportHtml();
    }, email);

    expect(html).toContain('src="https://icons.example/mail/x-color.png"');
  });

  test("before it starts, value is the email the editor opens", async ({
    page,
  }) => {
    await page.addInitScript(
      (email) => localStorage.setItem("test:saved", JSON.stringify(email)),
      emailWith([[["Saved"]]])
    );
    await page.goto("/shell.html");
    const email = emailWith([[["Early"]]]);

    const read = await page.evaluate((first) => {
      const unstarted = (saveKey?: string) => {
        const created = document.createElement(
          "mail-quilt-shell"
        ) as MailQuiltShell;
        if (saveKey) {
          created.setAttribute("save-key", saveKey);
        }
        created.value = first;
        return created.value;
      };
      return { plain: unstarted(), saved: unstarted("test:saved") };
    }, email);

    expect(read.plain).toStrictEqual(email);
    expect(JSON.stringify(read.saved)).toContain("Saved");
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

    await expect(page.getByTestId("errors")).toContainText("newer");
    await expect(shell(page).getByRole("alert")).toContainText("newer");
    await expect(textBlock(page)).toHaveCount(0);
  });

  test("a failed export says so until either export downloads, which leaves other reasons", async ({
    page,
  }) => {
    await openShell(page);
    // MJML loads on first export, so this is when that request can fail.
    await page.route("**/*.js", (route) => route.abort());

    await shell(page).getByRole("button", { name: "Export HTML" }).click();

    const alerts = shell(page).getByRole("alert");
    const failed = alerts.filter({ hasText: "couldn't be exported" });
    await expect(failed).toBeVisible();
    // The reason, without the name of the error it came in.
    await expect(failed).not.toContainText("TypeError");
    await page.unrouteAll();
    await importFile(page, "{not json");
    const refused = alerts.filter({ hasText: "valid JSON" });
    await expect(refused).toBeVisible();

    await exportFile(page, "Export JSON");
    await expect(failed).toHaveCount(0);
    const { name, text } = await exportFile(page, "Export HTML");
    expect(name).toBe("email.html");
    expect(text).toContain("Hello");
    await expect(refused).toBeVisible();
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

  test("on a first visit, typing stays when the host passes its first email again", async ({
    page,
  }) => {
    await openShell(page, `?save-key=${key}`);
    await focusStartOfTextBlock(page);
    await page.keyboard.type("Typed ");
    await expect(textBlock(page)).toHaveText("Typed Hello");

    // A copy, as a re-render that builds the email again would pass.
    await setShellValue(page, emailWith([[["Hello"]]]));

    await expect(textBlock(page)).toHaveText("Typed Hello");
    // A different email still opens, as on <mail-quilt>.
    await setShellValue(page, emailWith([[["Other"]]]));
    await expect(textBlock(page)).toHaveText("Other");
  });

  test("on a first visit, a first email set late opens, and typing stays when it's set again", async ({
    page,
  }) => {
    await page.goto(`/shell.html?save-key=${key}&late-value`);
    await setShellValue(page, emailWith([[["Hello"]]]));
    await expect(textBlock(page)).toHaveText("Hello");
    await focusStartOfTextBlock(page);
    await page.keyboard.type("Typed ");
    await expect(textBlock(page)).toHaveText("Typed Hello");

    await setShellValue(page, emailWith([[["Hello"]]]));

    await expect(textBlock(page)).toHaveText("Typed Hello");
  });

  test("on a first visit, a refused first email set again fires mq-error again", async ({
    page,
  }) => {
    await page.goto(`/shell.html?save-key=${key}&refused-first`);
    const errors = page.getByTestId("errors");
    await expect(errors).toContainText("newer");
    const reason = await errors.textContent();

    await setShellValue(page, {
      ...emailWith([[["Refused"]]]),
      version: 999,
    });

    await expect(errors).toHaveText(`${reason}${reason}`);
  });

  test("a reload reopens an imported email", async ({ page }) => {
    await openShell(page, `?save-key=${key}`);
    await importFile(page, JSON.stringify(emailWith([[["Imported"]]])));
    await expect(textBlock(page)).toHaveText("Imported");

    await page.reload();

    await expect(textBlock(page)).toHaveText("Imported");
  });

  test("on a first visit, an import stays when the host's first email arrives late", async ({
    page,
  }) => {
    await page.goto(`/shell.html?save-key=${key}&late-value`);
    await importFile(page, JSON.stringify(emailWith([[["Imported"]]])));
    await expect(textBlock(page)).toHaveText("Imported");

    await setShellValue(page, emailWith([[["Hello"]]]));

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

  test("a second damaged saved email is kept beside the first's copy, once", async ({
    page,
  }) => {
    await page.addInitScript((each) => {
      localStorage.setItem(each, "{second");
      localStorage.setItem(`${each}:unopened`, "{first");
    }, key);
    const copies = () =>
      page.evaluate(
        (each) =>
          ["", ":2", ":3"].map((suffix) =>
            localStorage.getItem(`${each}:unopened${suffix}`)
          ),
        key
      );
    await openShell(page, `?save-key=${key}`);
    expect(await copies()).toStrictEqual(["{first", "{second", null]);

    // The same one, opened again before any change.
    await page.reload();
    await expect(textBlock(page)).toHaveText("Hello");

    expect(await copies()).toStrictEqual(["{first", "{second", null]);
  });

  test("a refused email doesn't hide why the saved email couldn't be opened", async ({
    page,
  }) => {
    await page.addInitScript(
      (each) => localStorage.setItem(each, "{not json"),
      key
    );
    await openShell(page, `?save-key=${key}`);
    const alerts = shell(page).getByRole("alert");
    await expect(alerts).toContainText("saved email couldn't be opened");

    await setShellValue(page, { ...emailWith([[["Refused"]]]), version: 999 });

    await expect(alerts.filter({ hasText: "newer" })).toBeVisible();
    await expect(
      alerts.filter({ hasText: "saved email couldn't be opened" })
    ).toBeVisible();
  });

  test("a damaged saved email that can't be copied apart isn't saved over, and says so", async ({
    page,
  }) => {
    await page.addInitScript((each) => {
      localStorage.setItem(each, "{not json");
      const { setItem: realSetItem } = Storage.prototype;
      Storage.prototype.setItem = function setItem(name, value) {
        if (name === `${each}:unopened`) {
          throw new DOMException("Full", "QuotaExceededError");
        }
        realSetItem.call(this, name, value);
      };
    }, key);
    await openShell(page, `?save-key=${key}`);

    await focusStartOfTextBlock(page);
    await page.keyboard.type("New ");

    await expect(textBlock(page)).toHaveText("New Hello");
    await expect(shell(page).getByRole("alert")).toContainText("can't save");
    expect(await saved(page)).toBe("{not json");
  });

  test("a damaged saved email opened again is a new alert, read out again", async ({
    page,
  }) => {
    await page.addInitScript(
      (each) => localStorage.setItem(each, "{not json"),
      key
    );
    await openShell(page, `?save-key=${key}`);
    const alert = shell(page).getByRole("alert");
    await expect(alert).toContainText("saved email couldn't be opened");
    await alert.evaluate((element) => {
      element.dataset.seen = "true";
    });

    await shell(page).evaluate((element) =>
      element.setAttribute("save-key", "test:other")
    );
    await shell(page).evaluate(
      (element, each) => element.setAttribute("save-key", each),
      key
    );

    await expect(alert).toContainText("saved email couldn't be opened");
    await expect(alert).not.toHaveAttribute("data-seen");
  });

  test("says it can't save when storage is full, until it can again", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const { setItem } = Storage.prototype;
      Object.assign(window, {
        makeRoom: () => {
          Storage.prototype.setItem = setItem;
        },
      });
      Storage.prototype.setItem = () => {
        throw new DOMException("Full", "QuotaExceededError");
      };
    });
    await openShell(page, `?save-key=${key}`);

    await focusStartOfTextBlock(page);
    await page.keyboard.type("Unsaved ");

    await expect(shell(page).getByRole("alert")).toContainText("can't save");
    await expect(shell(page).getByRole("alert")).toContainText(
      "Export it as JSON"
    );
    await expect(textBlock(page)).toHaveText("Unsaved Hello");

    await page.evaluate(() =>
      (window as unknown as { makeRoom: () => void }).makeRoom()
    );
    await page.keyboard.type("Saved ");

    await expect.poll(() => saved(page)).toContain("Unsaved Saved Hello");
    await expect(shell(page).getByRole("alert")).toHaveCount(0);
  });

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

  test("stops saying it can't save when save-key changes or is removed", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException("Full", "QuotaExceededError");
      };
    });
    await openShell(page, `?save-key=${key}`);
    await focusStartOfTextBlock(page);
    await page.keyboard.type("Unsaved ");
    const alert = shell(page).getByRole("alert");
    await expect(alert).toContainText("can't save");

    await shell(page).evaluate((element) =>
      element.setAttribute("save-key", "test:other")
    );
    await expect(alert).toHaveCount(0);
    await page.keyboard.type("Again ");
    await expect(alert).toContainText("can't save");

    await shell(page).evaluate((element) =>
      element.removeAttribute("save-key")
    );
    await expect(alert).toHaveCount(0);
  });

  test("removing save-key stops the saving", async ({ page }) => {
    await openShell(page, `?save-key=${key}`);
    await focusStartOfTextBlock(page);
    await page.keyboard.type("Saved ");
    await expect.poll(() => saved(page)).toContain("Saved Hello");

    await shell(page).evaluate((element) =>
      element.removeAttribute("save-key")
    );
    await page.keyboard.type("Unsaved ");

    await expect(changeCount(page)).toHaveText("14");
    expect(await saved(page)).toContain("Saved Hello");
    expect(await saved(page)).not.toContain("Unsaved");
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
    await expect(changeCount(page)).toHaveText("3");

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

    // Null too, as JSON.parse gives for nothing saved.
    await setShellValue(page, null);
    await expect(textBlock(page)).toHaveText("Saved");
    await setShellValue(page, emailWith([[["Hello"]]]));

    await expect(textBlock(page)).toHaveText("Saved");
  });

  test("opens without firing mq-change", async ({ page }) => {
    await saveFirst(page);
    await page.goto(`/shell.html?save-key=${key}`);
    await expect(textBlock(page)).toHaveText("Saved");

    // One change of the person's own, so any before it would be counted too.
    await focusStartOfTextBlock(page);
    await page.keyboard.type("O");

    await expect(changeCount(page)).toHaveText("1");
  });

  test("stays when save-key is removed and the host passes its first email again", async ({
    page,
  }) => {
    await saveFirst(page);
    await page.goto(`/shell.html?save-key=${key}`);
    await expect(textBlock(page)).toHaveText("Saved");

    await shell(page).evaluate(async (element) => {
      element.removeAttribute("save-key");
      await (element as MailQuiltShell).updateComplete;
    });
    await setShellValue(page, emailWith([[["Hello"]]]));

    await expect(textBlock(page)).toHaveText("Saved");
  });

  test("gives way to a different email set straight after exportHtml()", async ({
    page,
  }) => {
    await saveFirst(page);
    await page.goto("/shell.html");
    const opened = await page.evaluate(
      async ({ each, first, other }) => {
        const added = document.createElement(
          "mail-quilt-shell"
        ) as MailQuiltShell;
        added.setAttribute("save-key", each);
        added.value = first;
        document.body.append(added);
        const exporting = added.exportHtml();
        added.value = other;
        await exporting;
        await added.updateComplete;
        return JSON.stringify(added.value);
      },
      {
        each: key,
        first: emailWith([[["Hello"]]]),
        other: emailWith([[["Other"]]]),
      }
    );

    expect(opened).toContain("Other");
  });

  test("opens when save-key is set after exportHtml() started the Shell", async ({
    page,
  }) => {
    await saveFirst(page);
    await page.goto("/shell.html");
    const opened = await page.evaluate(
      async ({ each, first }) => {
        const added = document.createElement(
          "mail-quilt-shell"
        ) as MailQuiltShell;
        added.value = first;
        document.body.append(added);
        const exporting = added.exportHtml();
        added.setAttribute("save-key", each);
        await exporting;
        await added.updateComplete;
        return JSON.stringify(added.value);
      },
      { each: key, first: emailWith([[["Hello"]]]) }
    );

    expect(opened).toContain("Saved");
  });

  test("stays when it opened from a new save-key and the host passes its email again", async ({
    page,
  }) => {
    await saveFirst(page);
    await openShell(page);
    await shell(page).evaluate(
      (element, each) => element.setAttribute("save-key", each),
      key
    );
    await expect(textBlock(page)).toHaveText("Saved");

    await setShellValue(page, emailWith([[["Hello"]]]));

    await expect(textBlock(page)).toHaveText("Saved");
  });

  test("gives way to nothing from the host, which empties the editor", async ({
    page,
  }) => {
    await saveFirst(page);
    await page.goto(`/shell.html?save-key=${key}`);
    await expect(textBlock(page)).toHaveText("Saved");

    await setShellValue(page, undefined);

    await expect(textBlock(page)).toHaveCount(0);
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

test("a new save-key opens the email saved under it, or keeps the current one", async ({
  page,
}) => {
  await page.addInitScript(
    (email) => {
      localStorage.setItem("test:second", JSON.stringify(email));
      localStorage.setItem("test:damaged", "{not json");
    },
    emailWith([[["Second"]]])
  );
  await openShell(page, "?save-key=test:first");
  const savedUnder = (key: string) =>
    page.evaluate((each) => localStorage.getItem(each), key);
  const setSaveKey = (key: string) =>
    shell(page).evaluate(
      (element, each) => element.setAttribute("save-key", each),
      key
    );

  await setSaveKey("test:second");
  await expect(textBlock(page)).toHaveText("Second");
  await focusStartOfTextBlock(page);
  await page.keyboard.type("Oh ");
  await expect.poll(() => savedUnder("test:second")).toContain("Oh Second");

  // With nothing saved under it, the current email stays, and is saved there
  // from its next change.
  await setSaveKey("test:third");
  await expect(textBlock(page)).toHaveText("Oh Second");
  await focusStartOfTextBlock(page);
  await page.keyboard.type("Third ");
  await expect
    .poll(() => savedUnder("test:third"))
    .toContain("Third Oh Second");

  // A damaged one says so, and is kept apart from the next save.
  await setSaveKey("test:damaged");
  await expect(shell(page).getByRole("alert")).toContainText(
    "saved email couldn't be opened"
  );
  await expect(textBlock(page)).toHaveText("Third Oh Second");
  expect(await savedUnder("test:damaged:unopened")).toBe("{not json");

  // That message was about the key before.
  await setSaveKey("test:second");
  await expect(textBlock(page)).toHaveText("Oh Second");
  await expect(shell(page).getByRole("alert")).toHaveCount(0);
});

test.describe("look", () => {
  // On this page, as the editor's own test page loads Tailwind, whose reset
  // hides anything hidden whatever its own styles say.
  test("hidden hides it, and <mail-quilt> too", async ({ page }) => {
    await openShell(page);

    await page.evaluate(
      (email) => {
        const editor = document.createElement("mail-quilt");
        editor.dataset.testid = "alone";
        editor.value = email;
        document.body.append(editor);
        for (const element of [
          editor,
          document.querySelector("mail-quilt-shell"),
        ]) {
          element?.setAttribute("hidden", "");
        }
      },
      emailWith([[["Alone"]]])
    );

    await expect(shell(page)).toBeHidden();
    await expect(page.getByTestId("alone")).toBeHidden();
  });

  test("fills the space the host gives it, the editor below the header", async ({
    page,
  }) => {
    await openShell(page);

    const editor = shell(page).locator("mail-quilt");
    const boxes = {
      editor: await boxWithEdges(editor),
      frame: await boxWithEdges(page.getByTestId("frame")),
      header: await boxWithEdges(header(page)),
      // The editor itself stretches, so its side panel runs to the bottom.
      panel: await boxWithEdges(editor.getByTestId("side-panel")),
    };

    expect(boxes.header.top).toBe(boxes.frame.top);
    expect(boxes.header.width).toBe(boxes.frame.width);
    expect(boxes.editor.top).toBe(boxes.header.bottom);
    expect(boxes.editor.bottom).toBe(boxes.frame.bottom);
    expect(boxes.panel.bottom).toBe(boxes.frame.bottom);
  });

  test("with its bottom below the window, editing doesn't scroll the page", async ({
    page,
  }) => {
    // The 700px Shell's bottom, with the floating toolbar, is below the window.
    await page.setViewportSize({ height: 500, width: 1280 });
    await openShell(page);
    const editor = shell(page).locator("mail-quilt");
    const pageScroll = () => page.evaluate(() => window.scrollY);

    // A Block added from the side panel, whose button goes away with focus on it.
    await editor.getByRole("button", { name: "Add Text Block" }).click();
    await expect(textBlock(page)).toHaveCount(2);
    expect(await pageScroll()).toBe(0);

    // A click on the workspace, with the new Block selected.
    const area = await boxOf(editor.getByTestId("workspace"));
    await page.mouse.click(area.x + 10, area.y + 10);
    await expect(editor.locator('[aria-current="true"]')).toHaveCount(0);
    expect(await pageScroll()).toBe(0);
  });

  test("a long email keeps the whole side panel in view", async ({ page }) => {
    await page.goto("/shell.html?long");
    await expect(textBlock(page).first()).toBeVisible();

    const panel = await boxWithEdges(
      shell(page).locator("mail-quilt").getByTestId("side-panel-content")
    );
    const frameBox = await boxWithEdges(page.getByTestId("frame"));

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
    await page.getByTestId("frame").evaluate((frame) => {
      frame.style.height = "500px";
    });

    await expect
      .poll(async () => {
        const panel = await boxWithEdges(
          shell(page).locator("mail-quilt").getByTestId("side-panel-content")
        );
        const frameBox = await boxWithEdges(page.getByTestId("frame"));
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
    const before = await boxWithEdges(tooltip);

    await shell(page).evaluate((element) => {
      const body = element.shadowRoot?.querySelector('[data-testid="body"]');
      if (body) {
        body.scrollTop += 40;
      }
    });

    await expect
      .poll(async () => {
        const { top } = await boxWithEdges(tooltip);
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
      shell(page).locator("mail-quilt").getByTestId("side-panel-content")
    ).toHaveCSS("background-color", "rgb(1, 2, 3)");
  });
});

test("shows the dragging cursor over the Shell during a drag", async ({
  page,
}) => {
  await openShell(page);
  const button = shell(page).getByRole("button", { name: "Export HTML" });
  const cursor = () =>
    button.evaluate((element) => getComputedStyle(element).cursor);
  const usual = await cursor();
  const tile = await boxWithEdges(
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

  await expect.poll(cursor).toBe(usual);
});

test("a file dropped on the header doesn't open in the page, and one on the canvas is uploaded", async ({
  page,
}) => {
  await openShell(page);
  await shell(page).evaluate((element) => {
    (element as MailQuiltShell).uploadImage = () =>
      Promise.resolve({ url: "https://cdn.example/uploaded.png" });
  });

  await expect(dropFileOn(header(page))).resolves.toBe("refused");
  await expect(dropFileOn(shell(page).getByTestId("workspace"))).resolves.toBe(
    "taken"
  );
});

test.describe("accessibility", () => {
  test("meets WCAG 2.2 AA, with a message showing", async ({ page }) => {
    await page.goto("/shell.html?refused-first");
    await expect(shell(page).getByRole("alert")).toBeVisible();

    expect(await violations(page, "mail-quilt-shell")).toStrictEqual([]);
  });
});

test.describe("too narrow to edit in", () => {
  test("the notice fills the space below the header", async ({ page }) => {
    await page.goto("/shell.html?narrow");
    // The editor's frame, inside the Shell's.
    const notice = shell(page)
      .locator('[part="frame"]')
      .filter({
        hasNot: page.locator('[part="header"]'),
        hasText: "Editing needs more room",
      });
    await expect(notice).toBeVisible();

    const noticeBox = await boxWithEdges(notice);
    const frameBox = await boxWithEdges(page.getByTestId("frame"));
    const headerBox = await boxWithEdges(header(page));

    expect(noticeBox.top).toBe(headerBox.bottom);
    expect(noticeBox.bottom).toBe(frameBox.bottom);
  });
});

test.describe("parts", () => {
  test("name the frame and each piece of the header and the messages", async ({
    page,
  }) => {
    await page.goto("/shell.html?refused-first");
    await expect(shell(page).getByRole("alert")).toBeVisible();

    const parts = await shell(page).evaluate((element) =>
      [...(element.shadowRoot?.querySelectorAll("[part]") ?? [])].map((each) =>
        each.getAttribute("part")
      )
    );

    expect(parts).toStrictEqual([
      "frame",
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
