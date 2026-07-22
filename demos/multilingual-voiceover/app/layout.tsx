import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Multilingual voiceover with Speechify",
  description:
    "Generate the same line in six languages with the Speechify TTS API and the simba-3.0 model, key held server-side in Next.js.",
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
