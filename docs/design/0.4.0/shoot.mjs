import { createRequire } from "node:module";
const { chromium } = createRequire(process.argv[2])("@playwright/test");
const [, , , file, out, only] = process.argv;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 2620, height: 1500 }, deviceScaleFactor: +(process.env.SCALE||2) });
p.on("console", (m) => console.log("console:", m.text()));
p.on("pageerror", (e) => console.log("error:", e.message));
await p.goto("file://" + file);
await p.waitForSelector("body[data-ready]", { state: "attached", timeout: 20000 });
for (const id of await p.$$eval("section.frame", (s) => s.map((e) => e.id))) {
  if (only && !only.split(",").some((o)=>id.startsWith(o))) continue;
  await p.locator(`[id="${id}"]`).screenshot({ path: `${out}/${id}.png` });
}
await b.close();
