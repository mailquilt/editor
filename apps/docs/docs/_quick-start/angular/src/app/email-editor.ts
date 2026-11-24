import { Component, CUSTOM_ELEMENTS_SCHEMA, signal } from "@angular/core";
import "@mailquilt/editor";
import type { BlocksDocument, MailQuilt } from "@mailquilt/editor";

import { starterEmail } from "./starter-email";

/** The email saved in this browser, or the starter email if there's none. */
const savedEmail = (): BlocksDocument => {
  try {
    const saved = localStorage.getItem("email");
    return saved ? JSON.parse(saved) : starterEmail;
  } catch {
    // Storage is blocked, or what's saved isn't JSON.
    return starterEmail;
  }
};

@Component({
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  selector: "app-email-editor",
  template: `
    <main>
      <mail-quilt
        #editor
        [value]="email()"
        (mq-change)="save($event.detail.document)"
        (mq-error)="loadError.set($event.detail.reason)"
      ></mail-quilt>
      <button (click)="exportHtml(editor)" type="button">Export HTML</button>
      <output id="exported-html">{{ html() }}</output>
      <output id="load-error">{{ loadError() }}</output>
    </main>
  `,
})
export class EmailEditor {
  protected readonly email = signal(savedEmail());
  protected readonly html = signal("");
  protected readonly loadError = signal("");

  protected save(email: BlocksDocument) {
    this.email.set(email);
    localStorage.setItem("email", JSON.stringify(email));
  }

  protected async exportHtml(editor: MailQuilt) {
    this.html.set(await editor.exportHtml());
  }
}
