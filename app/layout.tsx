import type { Metadata } from "next";
import "./globals.css";
import PwaRegistration from "./pwa-registration";

export const metadata: Metadata = {
  title: "Commitkeep — Repository workspace",
  description: "Daily repository updates, saved work, and a clear history of every change.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "CommitKeep" },
};

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
