import type { Metadata } from "next";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ServiceWorkerRegistration } from "@/features/pwa/ServiceWorkerRegistration";
import { GlobalTooltip } from "@/features/ui/GlobalTooltip";
import "./globals.css";

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
      <body>
        <AuthProvider>
          <ServiceWorkerRegistration />
          {children}
          <GlobalTooltip />
          <footer className="app-footer">© 2026 Bamboosatov1.0.0</footer>
        </AuthProvider>
      </body>
    </html>
  );
}
