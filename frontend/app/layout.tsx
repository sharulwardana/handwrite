import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "HandWrite AI — Text to Handwriting",
    description: "Converter teks menjadi tulisan tangan di atas folio. Powered by Python & Pillow.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="id">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link
                    href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;600&family=Dancing+Script:wght@400;600&family=Indie+Flower&family=Patrick+Hand&family=Kalam:wght@300;400&family=Reenie+Beanie&family=Dekko&family=Nanum+Pen+Script&family=Sriracha&display=swap"
                    rel="stylesheet"
                />
            </head>
            <body>{children}</body>
        </html>
    );
}