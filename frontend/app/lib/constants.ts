/* ─── CONSTANTS ──────────────────────────────────────── */

export const FONT_FAMILY_MAP: Record<string, string> = {
    // --- FONT BARU (Super Rapi & Support Angka/Simbol) ---
    "Virgil": "var(--font-virgil), cursive",
    "Architects Daughter": "var(--font-architects-daughter), cursive",
    "Gochi Hand": "var(--font-gochi-hand), cursive",

    // --- FONT LAMA (Yang paling bagus dan dipertahankan) ---
    "Patrick Hand": "var(--font-patrick-hand), cursive",
    "Kalam": "var(--font-kalam), cursive",
    "Indie Flower": "var(--font-indie-flower), cursive",
    "Caveat": "var(--font-caveat), cursive",
};

export const INK_PRESETS = [
    { label: "Hitam", color: "#1a1a1a" },
    { label: "Biru Tua", color: "#1a3a7c" },
    { label: "Biru", color: "#2563eb" },
    { label: "Hijau", color: "#166534" },
    { label: "Merah", color: "#991b1b" },
    { label: "Pensil", color: "#6b6b6b" },
];

export const DEMO_TEXT = `Pendidikan adalah senjata paling ampuh yang bisa kamu gunakan untuk mengubah dunia. Setiap huruf yang kamu tulis adalah bukti bahwa kamu peduli pada ilmu dan masa depanmu.

Belajar bukan hanya soal nilai di atas kertas, melainkan tentang karakter yang terbentuk dari setiap usaha dan kerja keras yang kamu lakukan setiap harinya.

Teruslah menulis, teruslah belajar, dan jangan pernah menyerah pada prosesmu.`;

export const DEFAULT_CONFIG = {
    startX: 70, startY: 65, lineHeight: 38,
    maxWidth: 1100, pageBottom: 1520,
    fontSize: 25, color: "#1a1a1a", wordSpacing: 8,
    marginJitter: 6,
    enableDropCap: false,
    paperTexture: false,
};

/* ─── SIDEBAR SECTION COLORS ─────────────────────── */
export const SECTION_COLORS: Record<string, {
    light: { bg: string; border: string; header: string; label: string; icon: string };
    dark: { bg: string; border: string; header: string; label: string; icon: string };
}> = {
    "Dari Tulisan Tanganmu": {
        light: { bg: "bg-pink-100/95", border: "border-pink-300", header: "hover:bg-pink-200/60", label: "text-pink-600", icon: "🖐️" },
        dark: { bg: "bg-[#1a0a12]", border: "border-pink-900/40", header: "hover:bg-pink-950/30", label: "text-pink-400", icon: "🖐️" },
    },
    "Font Tulisan": {
        light: { bg: "bg-indigo-100/60", border: "border-indigo-300", header: "hover:bg-indigo-200/60", label: "text-indigo-600", icon: "✍️" },
        dark: { bg: "bg-[#0a0a1a]", border: "border-indigo-900/40", header: "hover:bg-indigo-950/30", label: "text-indigo-400", icon: "✍️" },
    },
    "Gaya Tulisan": {
        light: { bg: "bg-violet-100/95", border: "border-violet-300", header: "hover:bg-violet-200/60", label: "text-violet-600", icon: "🎨" },
        dark: { bg: "bg-[#0f0a1a]", border: "border-violet-900/40", header: "hover:bg-violet-950/30", label: "text-violet-400", icon: "🎨" },
    },
    "Efek Realistis": {
        light: { bg: "bg-purple-100/95", border: "border-purple-300", header: "hover:bg-purple-200/60", label: "text-purple-600", icon: "✨" },
        dark: { bg: "bg-[#120a1a]", border: "border-purple-900/40", header: "hover:bg-purple-950/30", label: "text-purple-400", icon: "✨" },
    },
    "Watermark": {
        light: { bg: "bg-sky-100/95", border: "border-sky-300", header: "hover:bg-sky-200/60", label: "text-sky-600", icon: "💧" },
        dark: { bg: "bg-[#050f1a]", border: "border-sky-900/40", header: "hover:bg-sky-950/30", label: "text-sky-400", icon: "💧" },
    },
    "Spasi & Warna": {
        light: { bg: "bg-emerald-100/95", border: "border-emerald-300", header: "hover:bg-emerald-200/60", label: "text-emerald-700", icon: "🎨" },
        dark: { bg: "bg-[#051210]", border: "border-emerald-900/40", header: "hover:bg-emerald-950/30", label: "text-emerald-400", icon: "🎨" },
    },
    "Template Folio": {
        light: { bg: "bg-amber-100/95", border: "border-amber-300", header: "hover:bg-amber-200/60", label: "text-amber-700", icon: "📄" },
        dark: { bg: "bg-[#1a1005]", border: "border-amber-900/40", header: "hover:bg-amber-950/30", label: "text-amber-400", icon: "📄" },
    },
};
