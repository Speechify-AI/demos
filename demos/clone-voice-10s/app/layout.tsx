import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clone a voice from 10 seconds with Speechify",
  description:
    "Zero-shot voice cloning from a ~10 second sample, with an explicit consent gate, then synthesize with the clone and auto-delete it — using the Speechify API.",
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
