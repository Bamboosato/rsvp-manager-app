import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RSVP Manager",
  description: "イベント参加者調整App"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
