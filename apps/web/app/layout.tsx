import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MOTN AI",
  description: "Turn a raw talking-head video into a viral visual edit",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <a href="/" className="brand">
            MOTN<span className="brand-accent"> AI</span>
          </a>
          <span className="tagline">the AI motion designer for your talking head</span>
        </header>
        <main className="main">{children}</main>
      </body>
    </html>
  );
}
