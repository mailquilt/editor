// What a server does with the wrapper, without a framework to hide it.
import { MailQuilt } from "@mailquilt/react";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

const html = renderToString(createElement(MailQuilt));
console.log(JSON.stringify({ customElements: typeof customElements, html }));
