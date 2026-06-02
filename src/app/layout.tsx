import type { Metadata } from "next";
import { AuthProvider } from "@/features/auth/AuthProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "RSVP Hub",
  description: "イベント参加者調整App",
  icons: {
    icon: [
      {
        url: "/icons/rsvp-hub-icon.svg",
        type: "image/svg+xml"
      }
    ],
    shortcut: "/icons/rsvp-hub-icon.svg"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
