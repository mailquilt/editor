import { MailQuiltShell } from "@mailquilt/react";

import { starterEmail } from "./starter-email";

/** A whole editor page. With saveKey, the Shell saves the email in the browser. */
export const EmailPage = () => (
  <div style={{ height: "100dvh" }}>
    <MailQuiltShell saveKey="my-app:email" value={starterEmail} />
  </div>
);
