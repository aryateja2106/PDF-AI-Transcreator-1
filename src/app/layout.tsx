import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Research Reader - Transform PDFs with Intelligent Transcreation",
  description:
    "Upload PDFs, get intelligent translations, and listen with natural voice narration. Make knowledge accessible in your preferred language.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased bg-white text-black">
        {children}
      </body>
    </html>
  );
}
