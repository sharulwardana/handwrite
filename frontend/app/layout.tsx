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

// Font pendukung - preload: false agar tidak menghambat LCP (Largest Contentful Paint)
const kalam = Kalam({ subsets: ["latin"], weight: ["400"], display: "swap", variable: "--font-kalam", preload: false });
const patrickHand = Patrick_Hand({ subsets: ["latin"], weight: ["400"], display: "swap", variable: "--font-patrick-hand", preload: false });
const indieFlower = Indie_Flower({ subsets: ["latin"], weight: ["400"], display: "swap", variable: "--font-indie-flower", preload: false });
const architectsDaughter = Architects_Daughter({ subsets: ["latin"], weight: ["400"], display: "swap", variable: "--font-architects-daughter", preload: false });
const gochiHand = Gochi_Hand({ subsets: ["latin"], weight: ["400"], display: "swap", variable: "--font-gochi-hand", preload: false });

const virgil = localFont({
    src: "../public/fonts/Virgil.ttf",
    variable: "--font-virgil",
    display: "swap",
});

export const metadata: Metadata = {
    title: "HandWrite AI – Text to Handwriting | By Adam",
    description: "Converter teks menjadi tulisan tangan realistis di atas folio. Designed & Engineered by Mohammad Adam Mahfud.",
    keywords: ["handwriting", "tulisan tangan", "folio", "AI", "converter", "Mohammad Adam Mahfud"],
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
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"} />
            </head>
            <body className={`${dmSans.className} antialiased`}>{children}</body>
        </html>
    );
}