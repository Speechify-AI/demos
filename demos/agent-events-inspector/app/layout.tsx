import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Voice agent events inspector",
  description:
    "Replay a sample realtime event stream or inspect a live Speechify Voice Agent conversation in a debug timeline.",
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
