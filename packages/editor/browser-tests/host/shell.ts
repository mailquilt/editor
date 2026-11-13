import "../../src/index.js";
import { emailWith } from "./email.js";

const params = new URLSearchParams(window.location.search);

/** A newer version than this editor can read, so it's refused. */
const refusedEmail = { ...emailWith([[["Refused"]]]), version: 999 };

const shell = document.createElement("mail-quilt-shell");
const actions = params.get("actions");
if (actions !== null) {
  shell.setAttribute("actions", actions);
}
const saveKey = params.get("save-key");
if (saveKey) {
  shell.setAttribute("save-key", saveKey);
}
const frame = document.querySelector<HTMLElement>("#frame");
// Narrower than the editor needs, as on a phone.
if (params.has("narrow")) {
  frame?.style.setProperty("width", "500px");
}
frame?.append(shell);

/** Many Rows, so the email is taller than the Shell and scrolls inside it. */
const longEmail = () => {
  const email = emailWith([[["Hello"]]]);
  const [row] = email.rows;
  if (row) {
    email.rows = Array.from({ length: 30 }, (_, index) => ({
      ...structuredClone(row),
      columns: row.columns.map((column) => ({
        ...structuredClone(column),
        blocks: column.blocks.map((block) => ({
          ...structuredClone(block),
          id: `block-${index}`,
        })),
        id: `column-${index}`,
      })),
      id: `row-${index}`,
    }));
  }
  return email;
};

const firstEmail = () => {
  if (params.has("refused-first")) {
    return refusedEmail;
  }
  return params.has("long") ? longEmail() : emailWith([[["Hello"]]]);
};

// The listener straight after `value`, as the quick start does. A host that
// sets `value` only later, as React does, leaves it out.
if (!params.has("late-value")) {
  shell.value = firstEmail();
}
shell.addEventListener("mq-error", ({ detail }) => {
  const errors = document.querySelector("#errors");
  if (errors) {
    errors.textContent += detail.reason;
  }
});

let changes = 0;
shell.addEventListener("mq-change", () => {
  changes += 1;
  const count = document.querySelector("#change-count");
  if (count) {
    count.textContent = String(changes);
  }
});
