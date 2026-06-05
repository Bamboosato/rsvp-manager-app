import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { LegalFooter } from "@/features/legal/LegalFooter";
import { ServiceWorkerRegistration } from "@/features/pwa/ServiceWorkerRegistration";
import { GlobalTooltip } from "@/features/ui/GlobalTooltip";
import "./globals.css";

const notoSansJp = Noto_Sans_JP({
  display: "swap",
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"]
});

export const metadata: Metadata = {
  title: "RSVP Hub",
  description: "イベント参加者調整App",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      {
        url: "/icons/rsvp-hub-icon.svg",
        type: "image/svg+xml"
      }
    ],
    shortcut: "/icons/rsvp-hub-icon.svg",
    apple: "/icons/rsvp-hub-icon-192.png"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={notoSansJp.className}>
        <AuthProvider>
          <ServiceWorkerRegistration />
          {children}
          <GlobalTooltip />
          <LegalFooter />
        </AuthProvider>
      </body>
    </html>
  );
}
