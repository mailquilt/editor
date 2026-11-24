// Starts the Angular page's editor, as an Angular app's own main.ts does.
import { bootstrapApplication } from "@angular/platform-browser";

import { EmailEditor } from "./app/email-editor";

await bootstrapApplication(EmailEditor);
