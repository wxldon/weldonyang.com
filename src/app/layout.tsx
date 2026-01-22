import type { Metadata } from "next";
import { Agdasima } from "next/font/google";
import "./globals.css";

const agdasima = Agdasima({
  variable: "--font-agdasima",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Weldon Yang",
  description: "Personal website of Weldon Yang",
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
  openGraph: {
    title: "Weldon Yang",
    description: "Personal website of Weldon Yang",
    url: "https://weldonyang.com",
    siteName: "Weldon Yang",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Weldon Yang",
    description: "Personal website of Weldon Yang",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${agdasima.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
