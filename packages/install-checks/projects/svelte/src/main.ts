// Mounts the Svelte page's editor, as a Vite Svelte app's own main.ts does.
import { mount } from "svelte";

import EmailEditor from "./email-editor.svelte";

const target = document.querySelector("#app");
if (target) {
  mount(EmailEditor, { target });
}
