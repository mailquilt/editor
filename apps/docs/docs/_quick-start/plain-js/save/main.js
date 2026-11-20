import "@mailquilt/editor";
import { starterEmail } from "./starter-email.js";

/** Where your server keeps this email. */
const url = "/api/emails/welcome";
/** How long to wait after the last change before saving. */
const SAVE_AFTER_MS = 1000;

const editor = document.querySelector("mail-quilt");
const status = document.querySelector("#save-status");

/** The newest email that isn't saved yet, if there is one. */
let unsaved;
let timer;
/** Each save waits for the one before, so an older email can't land last. */
let saving = Promise.resolve();
/** How many saves are on their way, or waiting for the one before. */
let sending = 0;

const send = async (email) => {
  const response = await fetch(url, {
    body: JSON.stringify(email),
    headers: { "Content-Type": "application/json" },
    method: "PUT",
  });
  if (!response.ok) {
    throw new Error(`The server answered ${response.status}`);
  }
};

const sendAndReport = async (email) => {
  try {
    await send(email);
    status.textContent = unsaved ? "" : "Saved";
  } catch (error) {
    // Keep it, unless a newer email is waiting, so the next save sends it.
    unsaved ??= email;
    status.textContent = `Not saved: ${error.message}`;
  }
};

const save = () => {
  clearTimeout(timer);
  const email = unsaved;
  if (!email) {
    return;
  }
  unsaved = undefined;
  sending += 1;
  saving = saving
    .then(() => sendAndReport(email))
    .finally(() => {
      sending -= 1;
    });
};

editor.addEventListener("mq-change", (event) => {
  unsaved = event.detail.document;
  status.textContent = "";
  clearTimeout(timer);
  timer = setTimeout(save, SAVE_AFTER_MS);
});
editor.addEventListener("mq-error", (event) => {
  document.querySelector("#load-error").textContent = event.detail.reason;
});

const load = async () => {
  const response = await fetch(url);
  // Only when nothing is saved. After any other failure, the person's first
  // change would save the starter email over theirs.
  if (response.status === 404) {
    return starterEmail;
  }
  if (!response.ok) {
    throw new Error(`The server answered ${response.status}`);
  }
  return await response.json();
};

// Open the saved email, or the starter email if there's none yet. If it can't
// be opened, the editor stays empty, so nothing is saved over it.
try {
  editor.value = await load();
} catch (error) {
  document.querySelector("#load-error").textContent =
    `Not opened: ${error.message}`;
}

// Save straight away when the person switches tabs or closes the page.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    save();
  }
});
// A save started as the page closes, or still on its way, may not finish, so
// ask first.
addEventListener("beforeunload", (event) => {
  if (unsaved || sending > 0) {
    event.preventDefault();
  }
});
