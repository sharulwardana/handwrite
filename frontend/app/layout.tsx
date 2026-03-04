import type { Metadata } from "next";
import { DM_Sans, Kalam, Patrick_Hand, Indie_Flower, Architects_Daughter, Gochi_Hand } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

// Font UI utama - Preload Aktif (Default)
const dmSans = DM_Sans({
    subsets: ["latin"],
    weight: ["400", "500", "700"],
    display: "swap",
    variable: "--font-dm-sans",
});

// Caveat dipindahkan ke page.tsx (hanya dipakai di landing hero) agar tidak memblokir LCP di halaman lain

// Font pendukung - dihapus preload:false agar ter-load di mobile dropdown
const kalam = Kalam({ subsets: ["latin"], weight: ["400"], display: "swap", variable: "--font-kalam" });
const patrickHand = Patrick_Hand({ subsets: ["latin"], weight: ["400"], display: "swap", variable: "--font-patrick-hand" });
const indieFlower = Indie_Flower({ subsets: ["latin"], weight: ["400"], display: "swap", variable: "--font-indie-flower" });
const architectsDaughter = Architects_Daughter({ subsets: ["latin"], weight: ["400"], display: "swap", variable: "--font-architects-daughter" });
const gochiHand = Gochi_Hand({ subsets: ["latin"], weight: ["400"], display: "swap", variable: "--font-gochi-hand" });

const virgil = localFont({
    src: "../public/fonts/Virgil.ttf",
    variable: "--font-virgil",
    display: "swap",
});

export const metadata: Metadata = {
    title: "Mager Nulis – Text to Handwriting | By Adam",
    description: "Mager Nulis — Converter teks menjadi tulisan tangan realistis di atas folio. Designed & Engineered by Mohammad Adam Mahfud.",
    keywords: ["mager nulis", "handwriting", "tulisan tangan", "folio", "AI", "converter", "Mohammad Adam Mahfud"],
    authors: [{ name: "Mohammad Adam Mahfud" }],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html
            lang="id"
            suppressHydrationWarning
            className={`${dmSans.variable} ${kalam.variable} ${patrickHand.variable} ${indieFlower.variable} ${architectsDaughter.variable} ${gochiHand.variable} ${virgil.variable}`}
        >
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover" />
                <meta name="color-scheme" content="dark light" />
                {/* iOS 26 / Dynamic Island — full bleed ke poni & bawah */}
                <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#000000" />
                <meta name="theme-color" media="(prefers-color-scheme: light)" content="#f5f3ff" />
                {/* Apple PWA — hapus chrome browser agar konten mulai dari status bar */}
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
                <meta name="mobile-web-app-capable" content="yes" />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"} />
            </head>
            <body className={`${dmSans.className} antialiased`}>{children}</body>
        </html>
    );
}