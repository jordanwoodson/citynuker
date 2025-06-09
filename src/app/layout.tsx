import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next"
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "City Nuker - Nuclear Blast Simulator",
  description: "Simulate nuclear blast effects on any city. Visualize blast radius, thermal radiation, and fallout patterns with our interactive nuclear weapon effects calculator.",
  keywords: "nuclear blast simulator, nuclear weapon effects, blast radius calculator, fallout map, thermal radiation, overpressure calculator",
  authors: [{ name: "Nukr Team" }],
  creator: "Nukr",
  publisher: "Nukr",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://nukr.app'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: "City Nuker - Nuclear Blast Simulator",
    description: "Simulate nuclear blast effects on any city. Visualize blast radius, thermal radiation, and fallout patterns with our interactive nuclear weapon effects calculator.",
    url: 'https://nukr.app',
    siteName: 'City Nuker',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'City Nuker - Nuclear Blast Simulator',
      }
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "City Nuker - Nuclear Blast Simulator",
    description: "Simulate nuclear blast effects on any city. Visualize blast radius, thermal radiation, and fallout patterns.",
    images: ['/og-image.png'],
    creator: '@nukr',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/icon.svg',
    shortcut: '/favicon.ico',
    apple: '/apple-icon.png',
  },
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
