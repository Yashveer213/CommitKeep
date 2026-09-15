import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaRegistration from "./pwa-registration";

export const metadata: Metadata = {
  title: "Commit-Keep — Repository workspace",
  description: "Daily repository updates, saved work, and a clear history of every change.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Commit-Keep" },
};
export const viewport: Viewport = { themeColor: "#0b0b0c", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}<PwaRegistration /></body>
    </html>
  );
}
