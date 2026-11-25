import { readFile } from "node:fs/promises";

import { BLOCK_TYPES, loadDocument } from "@mailquilt/core";
import schema from "@mailquilt/core/schema.json" with { type: "json" };
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  DEFAULT_ACCENT,
  EDITOR_MIN_HEIGHT,
  EDITOR_MIN_WIDTH,
} from "../site/editor-facts";
import { examples } from "../site/examples";

/** The first version of the format published with a JSON Schema. */
const FIRST_SCHEMA_VERSION = 4;

/** For tests of the site's content, which is the same in every browser. */
const SAME_IN_EVERY_BROWSER = "Checks content, so Chromium alone runs it.";

test("the landing page's editor is live, and shows the email it would save", async ({
  page,
}) => {
  await page.goto("/");
  const text = page.getByRole("textbox", { name: "Text Block" }).first();
  const json = page.getByLabel("The email as JSON");
  const html = page.getByLabel("The email as HTML");
  await expect(html).toContainText("{{first_name}}");

  await text.click();
  await page.keyboard.type("Typed on the landing page. ");

  await expect(json).toContainText("Typed on the landing page.");
  const exportAgain = page.getByRole("button", { name: "Export it again" });
  await exportAgain.focus();
  await page.keyboard.press("Enter");
  await expect(html).toContainText("Typed on the landing page.");
  // Focus stays where it was, and the result is said.
  await expect(exportAgain).toBeFocused();
  await expect(
    page.getByRole("status").filter({ hasText: "the email as it is now" })
  ).toBeVisible();
});

test("a keyboard user can skip past the landing page's editor", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("textbox", { name: "Text Block" }).first()
  ).toBeVisible();
  const skip = page.getByRole("link", { name: "Skip past the editor" });

  await skip.focus();
  await expect(skip).toBeVisible();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");

  await expect(
    page.getByRole("button", { name: "Orange, to match this site" })
  ).toBeFocused();
});

test("the landing page's editor stays inside its frame as the email grows", async ({
  page,
}) => {
  await page.goto("/");
  const editor = page.locator("mail-quilt");
  const frame = page.locator("[data-home-editor]");
  await expect(editor.getByRole("textbox").first()).toBeVisible();

  // Enough empty Rows to make the email taller than the editor starts out.
  await editor.evaluate((element) => {
    const mailQuilt = element as HTMLElement & {
      value: { rows: unknown[] } | undefined;
    };
    const email = mailQuilt.value;
    if (email) {
      for (let added = 0; added < 4; added += 1) {
        email.rows.push({
          columns: [
            { blocks: [], id: `grown-${added}`, props: {}, width: 100 },
          ],
          id: `grown-row-${added}`,
          props: {},
        });
      }
      mailQuilt.value = { ...email };
    }
  });

  // The editor lays out the new Rows after its update.
  await expect
    .poll(() => editor.evaluate((element) => element.clientHeight))
    .toBeGreaterThan(EDITOR_MIN_HEIGHT);
  const inner = await editor.boundingBox();
  const outer = await frame.boundingBox();
  // Firefox can lay the frame out a fraction of a pixel taller.
  expect(outer?.height).toBeCloseTo(inner?.height ?? 0, 0);
});

test("the landing page recolors its editor with the swatch chosen", async ({
  browserName,
  page,
}) => {
  test.skip(
    browserName !== "chromium",
    "Checks the page's own script, which is the same in every browser."
  );
  await page.goto("/");
  const editor = page.locator("mail-quilt");
  await expect(editor.getByRole("textbox").first()).toBeVisible();
  const swatch = (name: string) =>
    page
      .getByRole("group", { name: /recolored with theme tokens/u })
      .getByRole("button", { name });

  await swatch("Violet").click();

  await expect(swatch("Violet")).toHaveAttribute("aria-pressed", "true");
  await expect(swatch("Orange, to match this site")).toHaveAttribute(
    "aria-pressed",
    "false"
  );
  await expect
    .poll(() =>
      editor.evaluate((element) =>
        getComputedStyle(element).getPropertyValue("--mq-color-accent").trim()
      )
    )
    .toBe("#7c3aed");
});

test("each example shows its whole email, with nothing to scroll inside it", async ({
  page,
}) => {
  await page.goto("/examples");
  const frame = page.locator("iframe[data-example]").first();
  await frame.scrollIntoViewIfNeeded();

  await expect
    .poll(() =>
      frame.evaluate((element) => {
        const iframe = element as HTMLIFrameElement;
        const root = iframe.contentDocument?.documentElement;
        return root && iframe.contentDocument?.URL === "about:srcdoc"
          ? Math.abs(root.scrollHeight - iframe.clientHeight)
          : Number.POSITIVE_INFINITY;
      })
    )
    .toBeLessThanOrEqual(1);
});

test("the landing page's editor starts when arriving from another page", async ({
  page,
}) => {
  await page.goto("/why");

  // The logo links home, and Blume swaps the page in without a reload.
  await page
    .getByRole("banner")
    .getByRole("link", { exact: true, name: "Mail Quilt" })
    .click();

  await expect(
    page.getByRole("textbox", { name: "Text Block" }).first()
  ).toBeVisible();
});

test("in a narrow window, the landing page shows a picture of the editor", async ({
  browserName,
  page,
}) => {
  test.skip(browserName !== "chromium", SAME_IN_EVERY_BROWSER);
  await page.setViewportSize({ height: 800, width: 390 });
  await page.goto("/");
  // An editor the page started would arrive after an import, so the page has
  // to finish loading before anything can show it didn't start one.
  await page.waitForLoadState("networkidle");

  await expect(
    page.getByRole("img", { name: /Mail Quilt editor/u })
  ).toBeVisible();
  await expect(page.locator("mail-quilt")).toHaveCount(0);
  await expect(
    page.getByText(/^This is the editor, one of the \w+ packages/u)
  ).toBeHidden();
});

test("the landing page shows one package at a time, chosen by its tab", async ({
  browserName,
  page,
}) => {
  test.skip(browserName !== "chromium", SAME_IN_EVERY_BROWSER);
  await page.goto("/");
  // The code beside it has tabs of its own.
  const panels = page.getByRole("tabpanel", {
    name: /^(?:editor|react|core|renderer)$/u,
  });

  await expect(panels).toHaveCount(1);
  await expect(panels).toContainText("@mailquilt/editor");

  await page.getByRole("tab", { name: "core" }).click();
  await expect(panels).toContainText("@mailquilt/core");
  // On the bottom row, down goes nowhere.
  await page.keyboard.press("ArrowDown");
  await expect(panels).toContainText("@mailquilt/core");
  await page.keyboard.press("End");
  await expect(panels).toContainText("@mailquilt/renderer");
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the landing page still says what every package is for", async ({
    browserName,
    page,
  }) => {
    test.skip(browserName !== "chromium", SAME_IN_EVERY_BROWSER);
    await page.goto("/");

    for (const name of ["editor", "react", "core", "renderer"]) {
      await expect(
        page.getByRole("heading", { name: `@mailquilt/${name}` })
      ).toBeVisible();
    }
  });

  test("the landing page says its editor is only a picture", async ({
    browserName,
    page,
  }) => {
    test.skip(browserName !== "chromium", SAME_IN_EVERY_BROWSER);
    await page.goto("/");

    await expect(
      page.getByText("This is a picture of the editor", { exact: false })
    ).toBeVisible();
  });
});

test("the built site sets its security headers, beside Blume's own", async ({
  browserName,
}) => {
  test.skip(browserName !== "chromium", SAME_IN_EVERY_BROWSER);
  // Cloudflare reads these from the file. The server the tests use doesn't.
  const headers = await readFile(new URL("../dist/_headers", import.meta.url), {
    encoding: "utf-8",
  });

  expect(headers).toContain("Content-Type: text/markdown; charset=utf-8");
  for (const header of [
    "Strict-Transport-Security",
    "X-Content-Type-Options",
    "Referrer-Policy",
    "Content-Security-Policy: frame-ancestors",
  ]) {
    expect(headers).toMatch(
      new RegExp(`^/\\*\\n(?:  .+\\n)*  ${header}`, "mu")
    );
  }
});

test("the sitemap lists each example's own page", async ({
  browserName,
  request,
}) => {
  test.skip(browserName !== "chromium", SAME_IN_EVERY_BROWSER);
  const response = await request.get("/sitemap.xml");
  const sitemap = await response.text();

  for (const { slug } of examples) {
    expect(sitemap).toContain(`/examples/${slug}</loc>`);
  }
});

test("the document format reference's example is an email core loads", async ({
  browserName,
  page,
}) => {
  test.skip(browserName !== "chromium", SAME_IN_EVERY_BROWSER);
  await page.goto("/docs/document-format");
  const example = await page
    .getByTestId("example-email")
    .locator("pre code")
    .textContent();

  const loaded = loadDocument(JSON.parse(example ?? ""));

  expect(loaded).toMatchObject({ ok: true });
  const used = new Set(
    loaded.ok
      ? loaded.document.rows.flatMap(({ columns }) =>
          columns.flatMap(({ blocks }) => blocks.map(({ type }) => type))
        )
      : []
  );
  // So a new type of Block fails here until the example has one.
  expect(used).toStrictEqual(new Set(BLOCK_TYPES.map(({ type }) => type)));
});

test("the site serves the format's JSON Schema, and every older version's from 4 on", async ({
  browserName,
  request,
}) => {
  test.skip(browserName !== "chromium", SAME_IN_EVERY_BROWSER);
  const current = await request.get(new URL(schema.$id).pathname);

  expect(current.ok()).toBe(true);
  expect(await current.json()).toStrictEqual(schema);
  // An address a host's settings point at keeps working after a new version.
  const older = Array.from(
    { length: schema.properties.version.const - FIRST_SCHEMA_VERSION },
    (_, index) => `/schema/v${FIRST_SCHEMA_VERSION + index}.json`
  );
  const statuses = await Promise.all(
    older.map(async (path) => {
      const response = await request.get(path);
      return { path, status: response.status() };
    })
  );
  expect(statuses.filter(({ status }) => status >= 400)).toStrictEqual([]);
});

/** A path to a page rather than a file, without a trailing slash. */
const pagePath = (path: string) =>
  /\.\w+$/u.test(path) ? undefined : path.replace(/(?<=.)\/$/u, "");

/** How many tabs the link test keeps open at once. */
const TABS = 4;

/** Runs `each` on every item, `TABS` at a time, and keeps the results in order. */
const fewAtATime = async <Item, Result>(
  items: Item[],
  each: (item: Item) => Promise<Result>
) => {
  const results: Result[] = [];
  let next = 0;
  const work = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await each(items[index] as Item);
    }
  };
  await Promise.all(Array.from({ length: TABS }, work));
  return results;
};

test("every page's links and assets resolve", async ({
  baseURL,
  browserName,
  context,
  request,
}) => {
  test.skip(browserName !== "chromium", SAME_IN_EVERY_BROWSER);
  // It opens every page in a tab of its own, which ran past 30 seconds in CI.
  test.slow();
  const { origin } = new URL(baseURL as string);
  const failedAssets: string[] = [];
  context.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin === origin && response.status() >= 400) {
      failedAssets.push(`${response.status()} ${url.pathname}`);
    }
  });

  /** Every link to a place in a page, which has to be there. */
  const anchors = new Set<string>();

  /** Opens a page in a tab of its own, and returns the paths it links to on this site. */
  const linksFrom = async (path: string) => {
    const tab = await context.newPage();
    await tab.goto(path);
    const hrefs = await tab
      .locator("a[href]")
      .evaluateAll((links) =>
        links.map((link) => (link as HTMLAnchorElement).href)
      );
    await tab.close();
    const here = hrefs
      .map((href) => new URL(href))
      .filter((url) => url.origin === origin);
    for (const url of here) {
      if (url.hash) {
        anchors.add(`${url.pathname}${url.hash}`);
      }
    }
    return here.map((url) => url.pathname);
  };

  // From the landing page and the docs, every page each one links to is
  // opened in turn, until a round finds no page that hasn't been.
  const pages = new Set<string>();
  const linked = new Set<string>();
  let round = ["/", "/docs"];
  while (round.length > 0) {
    for (const path of round) {
      pages.add(path);
    }
    const fromRound = await fewAtATime(round, linksFrom);
    const found = fromRound.flat();
    for (const path of found) {
      linked.add(path);
    }
    round = [...new Set(found.flatMap((path) => pagePath(path) ?? []))].filter(
      (path) => !pages.has(path)
    );
  }
  const statuses = await Promise.all(
    [...linked].map(async (path) => {
      const response = await request.get(path);
      return { path, status: response.status() };
    })
  );

  expect(statuses.filter(({ status }) => status >= 400)).toStrictEqual([]);
  expect(failedAssets).toStrictEqual([]);
  const missingAnchors = await fewAtATime([...anchors], async (anchor) => {
    const tab = await context.newPage();
    await tab.goto(anchor);
    const id = decodeURIComponent(anchor.slice(anchor.indexOf("#") + 1));
    const found = await tab.evaluate(
      (each) => document.querySelector(`#${CSS.escape(each)}`) !== null,
      id
    );
    await tab.close();
    return found ? [] : [anchor];
  });
  expect(missingAnchors.flat()).toStrictEqual([]);
  expect(anchors.size).toBeGreaterThan(0);
  // So a crawl that finds nothing can't pass, or stops a page short.
  expect([...pages]).toStrictEqual(
    expect.arrayContaining([
      "/docs",
      "/docs/quick-start",
      "/docs/shell",
      "/docs/packages",
      "/docs/theme-tokens",
      "/docs/keyboard",
      "/docs/render-on-a-server",
      "/docs/change-emails-in-code",
      "/docs/document-format",
      "/docs/email-clients",
      "/playground",
      "/examples",
      "/examples/receipt",
      "/compare",
      "/compare/unlayer",
      "/why",
      "/roadmap",
    ])
  );
});

const collapse = (text: string) => text.replaceAll(/\s+/gu, " ").trim();

test("the theme tokens page lists every token, with its default", async ({
  browserName,
  page,
}) => {
  test.skip(browserName !== "chromium", SAME_IN_EVERY_BROWSER);
  await page.goto("/playground");
  await expect(page.getByRole("textbox", { name: "Text Block" })).toBeVisible();
  /** The editor's own tokens, from its stylesheet: name, then default. */
  const tokens = await page.locator("mail-quilt").evaluate((host) => {
    const root = host.shadowRoot as ShadowRoot;
    const sheets = [
      ...root.adoptedStyleSheets,
      ...[...root.querySelectorAll("style")].flatMap(({ sheet }) =>
        sheet ? [sheet] : []
      ),
    ];
    return sheets.flatMap((sheet) =>
      [...sheet.cssRules].flatMap((rule) =>
        rule instanceof CSSStyleRule && rule.selectorText === ":host"
          ? [...rule.style]
              .filter((name) => name.startsWith("--mq-"))
              .map((name) => [name, rule.style.getPropertyValue(name)])
          : []
      )
    );
  });

  await page.goto("/docs/theme-tokens");
  const rows = page.getByRole("main").getByRole("row");

  // So a stylesheet the test can't read can't pass.
  expect(tokens.length).toBeGreaterThan(20);
  for (const [name, value] of tokens) {
    const row = rows.filter({
      has: page.getByRole("cell", { exact: true, name }),
    });
    await expect(row).toHaveCount(1);
    expect(collapse((await row.textContent()) ?? "")).toContain(
      collapse(value ?? "")
    );
  }
  // And each table's header row.
  await expect(rows).toHaveCount(
    tokens.length + (await page.getByRole("main").getByRole("table").count())
  );
});

test("an address the site doesn't have gets its own not-found page", async ({
  browserName,
  page,
}) => {
  test.skip(browserName !== "chromium", SAME_IN_EVERY_BROWSER);
  const response = await page.goto("/no-such-page");

  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Nothing has been dropped here.",
    })
  ).toBeVisible();
});

test("an example's downloads are its email, as JSON core loads and as HTML", async ({
  browserName,
  page,
}) => {
  test.skip(browserName !== "chromium", SAME_IN_EVERY_BROWSER);
  await page.goto("/examples/receipt");
  const download = async (name: string) => {
    const [file] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name }).click(),
    ]);
    const text = await readFile(await file.path(), { encoding: "utf-8" });
    return { name: file.suggestedFilename(), text };
  };

  const json = await download("Download the JSON");
  const html = await download("Download the HTML");

  expect(json.name).toBe("receipt.json");
  expect(loadDocument(JSON.parse(json.text))).toMatchObject({ ok: true });
  expect(html.name).toBe("receipt.html");
  // The export itself, with its Merge Tags still to fill, not the preview.
  expect(html.text).toMatch(/^<!doctype html>/iu);
  expect(html.text).toContain("{{order_id}}");
});

/** Stands in for the system's clipboard, which tests running at once share. */
const stubClipboard = (page: Page, refuse: boolean) =>
  page.addInitScript((refusing) => {
    const copied: string[] = [];
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: (text: string) => {
          if (refusing) {
            return Promise.reject(new DOMException("", "NotAllowedError"));
          }
          copied.push(text);
          return Promise.resolve();
        },
      },
    });
    Object.defineProperty(window, "copied", { value: copied });
  }, refuse);

const copyButton = (page: Page) =>
  page
    .getByRole("tabpanel", { name: "editor" })
    .getByRole("button", { name: "Copy" });

test("the landing page copies a package's install command", async ({
  browserName,
  page,
}) => {
  test.skip(browserName !== "chromium", SAME_IN_EVERY_BROWSER);
  await stubClipboard(page, false);
  await page.goto("/");

  await copyButton(page).click();

  await expect(
    page.getByRole("tabpanel", { name: "editor" }).getByRole("button")
  ).toHaveText("Copied");
  const copied = await page.evaluate(
    () => (window as unknown as { copied: string[] }).copied
  );
  expect(copied).toStrictEqual(["npm install @mailquilt/editor"]);
});

test("the landing page says when the browser refuses to copy", async ({
  browserName,
  page,
}) => {
  test.skip(browserName !== "chromium", SAME_IN_EVERY_BROWSER);
  await stubClipboard(page, true);
  await page.goto("/");

  await copyButton(page).click();

  await expect(
    page.getByRole("tabpanel", { name: "editor" }).getByRole("button")
  ).toHaveText("Couldn't copy");
});

test("the landing page's Row takes the layout chosen beside it", async ({
  browserName,
  page,
}) => {
  test.skip(
    browserName !== "chromium",
    "Checks the page's own script, which is the same in every browser."
  );
  await page.goto("/");
  const picker = page.getByRole("group", { name: "Row layout" });
  const columns = page.getByTestId("row-demo-column");

  await picker.getByRole("button", { name: "25, 25, 25, 25 percent" }).click();

  await expect(
    picker.getByRole("button", { name: "25, 25, 25, 25 percent" })
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    picker.getByRole("button", { name: "33, 67 percent" })
  ).toHaveAttribute("aria-pressed", "false");
  await expect(columns).toHaveText(["25", "25", "25", "25"]);

  await picker
    .getByRole("button", { exact: true, name: "100 percent" })
    .click();

  await expect(columns.first()).toHaveText("100");
  // The others close to nothing.
  await expect(columns.nth(1)).toBeHidden();
});

test("in the dark theme, the footer shows the logo drawn for it", async ({
  browserName,
  page,
}) => {
  test.skip(browserName !== "chromium", SAME_IN_EVERY_BROWSER);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/why");
  const home = page.getByRole("link", { name: "Mail Quilt home" });

  await expect(home.getByTestId("logo-dark")).toBeVisible();
  await expect(home.getByTestId("logo-light")).toBeHidden();
});

test("the sizes and accent the site states are the editor's own", async ({
  browserName,
  page,
}) => {
  test.skip(browserName !== "chromium", SAME_IN_EVERY_BROWSER);
  await page.goto("/playground");
  const shell = page.locator("mail-quilt-shell");
  await expect(
    shell.getByRole("textbox", { name: "Text Block" })
  ).toBeVisible();
  // An editor of its own, without the Playground's theme, given its email.
  await page.evaluate(() => {
    type Editor = HTMLElement & { value: unknown };
    const bare = document.createElement("mail-quilt") as Editor;
    bare.dataset.testid = "bare-editor";
    bare.value = document.querySelector<Editor>("mail-quilt-shell")?.value;
    document.body.append(bare);
  });
  const bare = page.getByTestId("bare-editor");
  const notice = bare.locator('[part="frame"]', {
    hasText: "Editing needs more room",
  });
  const setWidth = (width: number) =>
    bare.evaluate((element, px) => {
      (element as HTMLElement).style.width = `${px}px`;
    }, width);

  await setWidth(EDITOR_MIN_WIDTH - 1);
  await expect(notice).toBeVisible();
  await setWidth(EDITOR_MIN_WIDTH);
  await expect(notice).toBeHidden();

  // Wide enough for the side panel beside the email, so nothing is below it.
  await setWidth(1200);
  await expect
    .poll(() => bare.evaluate((element) => element.clientHeight))
    .toBe(EDITOR_MIN_HEIGHT);
  const accent = await bare.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      accent: style.getPropertyValue("--mq-color-accent").trim(),
      strong: style.getPropertyValue("--mq-color-accent-strong").trim(),
    };
  });
  expect(accent).toStrictEqual(DEFAULT_ACCENT);
});
