import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({ subsets: ["latin"], weight: ["300", "400", "500", "600"], display: "swap" });

export const metadata: Metadata = {
    title: "HandWrite AI – Text to Handwriting | By Adam",
    description: "Converter teks menjadi tulisan tangan realistis di atas folio. Designed & Engineered by Mohammad Adam Mahfud.",
    keywords: ["handwriting", "tulisan tangan", "folio", "AI", "converter", "Mohammad Adam Mahfud"],
    authors: [{ name: "Mohammad Adam Mahfud" }],
    icons: {
        icon: [
            { url: "/favicon.ico", sizes: "any" },
            { url: "/favicon_32.png", sizes: "32x32", type: "image/png" },
            { url: "/favicon_16.png", sizes: "16x16", type: "image/png" },
            { url: "/icon.svg", type: "image/svg+xml" },
        ],
        apple: [
            { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
        ],
        shortcut: "/favicon.ico",
    },
    manifest: "/site.webmanifest",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="id" suppressHydrationWarning className={dmSans.className}>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
            </head>
            <body className="antialiased">{children}</body>
        </html>
    );
}