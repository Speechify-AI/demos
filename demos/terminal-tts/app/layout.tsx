import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "TTS from your terminal",
  description:
    "A terminal-styled web playground for Speechify text-to-speech. Type a command, hit enter, hear it back.",
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
