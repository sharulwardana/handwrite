import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "HandWrite AI – Text to Handwriting",
    description: "Converter teks menjadi tulisan tangan realistis di atas folio. Powered by Python & Pillow.",
    keywords: ["handwriting", "tulisan tangan", "folio", "AI", "converter"],
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
        <html lang="id" suppressHydrationWarning>
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link
                    href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=Caveat:wght@400;600&family=Dancing+Script:wght@400;600&family=Indie+Flower&family=Patrick+Hand&family=Kalam:wght@300;400&family=Reenie+Beanie&family=Dekko&family=Nanum+Pen+Script&family=Sriracha&display=swap"
                    rel="stylesheet"
                />
                <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
            </head>
            <body className="antialiased">{children}</body>
        </html>
    );
}