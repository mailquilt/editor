import "@mailquilt/editor";
import { starterEmail } from "../starter-email.js";

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
  saving = saving.then(() => sendAndReport(email));
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

// Open the saved email, or the starter email if there's none yet.
const response = await fetch(url);
editor.value = response.ok ? await response.json() : starterEmail;

// Save straight away when the person switches tabs or closes the page.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    save();
  }
});
// A save started as the page closes may not finish, so ask first.
addEventListener("beforeunload", (event) => {
  if (unsaved) {
    event.preventDefault();
  }
});
