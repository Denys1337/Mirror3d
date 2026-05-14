import type { ReactNode } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "./jtl-bootstrap-compat.css";
import "./globals.css";

export const metadata = {
  title: "Mirror 3D Configurator",
  description: "3D mirror on wall with adjustable dimensions"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uk">
      <body>{children}</body>
    </html>
  );
}

