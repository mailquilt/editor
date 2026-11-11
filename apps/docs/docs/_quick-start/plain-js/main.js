import "@mailquilt/editor";
import { starterEmail } from "./starter-email.js";

const editor = document.querySelector("mail-quilt");

/** The saved email, or the starter email if none can be read. */
const savedEmail = () => {
  try {
    const saved = localStorage.getItem("email");
    return saved ? JSON.parse(saved) : starterEmail;
  } catch {
    // Storage is blocked, or what's saved isn't JSON.
    return starterEmail;
  }
};

editor.addEventListener("mq-change", (event) => {
  localStorage.setItem("email", JSON.stringify(event.detail.document));
});
editor.addEventListener("mq-error", (event) => {
  document.querySelector("#load-error").textContent = event.detail.reason;
});
editor.value = savedEmail();

document.querySelector("#export").addEventListener("click", async () => {
  document.querySelector("#exported-html").textContent =
    await editor.exportHtml();
});
