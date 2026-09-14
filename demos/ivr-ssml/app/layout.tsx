import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "IVR pronunciation with SSML on Speechify",
  description:
    "A phone-system playground for getting names, account numbers, and product terms right with SSML. Hear plain vs SSML side by side, edit the markup, and re-synthesize.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Script src="/turnstile.js" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}
