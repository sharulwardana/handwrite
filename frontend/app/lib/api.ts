/* ─── API HELPER ───────────────────────────────────── */

// Perbaikan: Memastikan API_URL selalu memiliki protokol yang benar
export const getApiUrl = () => {
    const url = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
    if (url && !url.startsWith('http')) {
        return `https://${url}`;
    }
    return url.replace(/\/$/, "");
};
