// What React 18's server does with the wrapper, in development, where it warns
// of a layout effect, without a framework to hide it.
import { MailQuilt, MailQuiltShell } from "@mailquilt/react";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

const html = renderToString(createElement(MailQuilt));
const shellHtml = renderToString(createElement(MailQuiltShell));
console.log(JSON.stringify({ html, shellHtml }));
