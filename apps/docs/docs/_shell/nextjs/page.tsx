import { MailQuiltShell } from "@mailquilt/react";

import { starterEmail } from "../starter-email";

// A Server Component, as the Shell needs no callbacks to save the email.
const Page = () => (
  <div style={{ height: "100dvh" }}>
    <MailQuiltShell saveKey="my-app:email" value={starterEmail} />
  </div>
);

export default Page;
