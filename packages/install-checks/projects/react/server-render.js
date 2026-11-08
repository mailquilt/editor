// What a server does with the wrapper, without a framework to hide it.
import { MailQuilt, MailQuiltShell } from "@mailquilt/react";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

const html = renderToString(createElement(MailQuilt));
const shellHtml = renderToString(
  createElement(MailQuiltShell, {
    saveKey: "my-app:email",
    variant: "advanced",
  })
);
console.log(
  JSON.stringify({ customElements: typeof customElements, html, shellHtml })
);
