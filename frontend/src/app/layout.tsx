import type { Metadata } from "next";
import { DM_Serif_Display, Outfit } from "next/font/google";
import "./globals.css";

const dmSerif = DM_Serif_Display({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-dm-serif",
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "Lapor Kos - Manajemen Kos Pintar",
  description: "Platform manajemen kos pintar untuk efisiensi bisnis Anda.",
  icons: {
    icon: "/images/icon-lapor-kos.png",
    apple: "/images/icon-lapor-kos.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className={`${dmSerif.variable} ${outfit.variable} font-outfit antialiased`}>
        {children}
      </body>
    </html>
  );
}
