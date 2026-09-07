import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "台股選股儀表板",
  description: "依一年高低點中間值篩選台股",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
