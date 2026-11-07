import type { ReactNode } from "react";

export const metadata = { title: "Mail Quilt React install check" };

const Layout = ({ children }: { children: ReactNode }) => (
  <html lang="en">
    <body>{children}</body>
  </html>
);

export default Layout;
