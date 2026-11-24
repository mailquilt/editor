// Mounts the Vue page's editor, as a Vite Vue app's own main.ts does.
import { createApp } from "vue";

import EmailEditor from "./email-editor.vue";

createApp(EmailEditor).mount("#app");
