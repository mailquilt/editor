import "@mailquilt/editor";
import { starterEmail } from "./starter-email.js";

const editor = document.querySelector("mail-quilt");
const saved = localStorage.getItem("email");

editor.addEventListener("mq-change", (event) => {
  localStorage.setItem("email", JSON.stringify(event.detail.document));
});
editor.value = saved ? JSON.parse(saved) : starterEmail;

document.querySelector("#export").addEventListener("click", async () => {
  document.querySelector("output").textContent = await editor.exportHtml();
});
