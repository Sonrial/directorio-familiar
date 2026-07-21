import type { Metadata } from "next";
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
  metadataBase: new URL(
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000",
  ),
  title: "Directorio Familiar",
  description: "Contactos, empresas y credenciales de la familia, en un solo lugar seguro.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Directorio Familiar",
    description: "Contactos y datos protegidos.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Directorio Familiar" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Directorio Familiar",
    description: "Contactos y datos protegidos.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body>{children}</body>
    </html>
  );
}
