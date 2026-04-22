import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@saldacargo/ui";

const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter" });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "SaldaCargo | Driver",
  description: "Приложение для водителей",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={`${inter.variable} font-sans antialiased overflow-x-hidden pt-safe pb-safe`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
