// The props that reach the element as attributes, which React 18 writes as
// they're given: `className` as `classname`, and `false` as the text "false".
import { MailQuilt } from "@mailquilt/react";
import { createRoot } from "react-dom/client";

import { starterEmail } from "../src/starter-email";

const root = document.querySelector("#root");
if (root) {
  createRoot(root).render(
    <MailQuilt
      className="editor"
      hidden={false}
      inert={false}
      value={starterEmail}
    />
  );
}
