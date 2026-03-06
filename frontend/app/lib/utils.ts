/* ─── UTILS (di luar komponen agar tidak re-create tiap render) ─── */
import toast from "react-hot-toast";
import type { HistoryItem } from "./types";

export const compressThumbnail = (base64: string, maxWidth = 120, quality = 0.4): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const ratio = maxWidth / img.width;
            const canvas = document.createElement("canvas");
            canvas.width = maxWidth;
            canvas.height = Math.round(img.height * ratio);
            const ctx = canvas.getContext("2d");
            if (!ctx) { resolve(""); return; }
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.onerror = () => resolve("");
        img.src = base64;
    });
};

export const formatTime = (ts: number): string => {
    const d = new Date(ts);
    return (
        d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }) +
        " " +
        d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
    );
};

export const safeSetHistory = (
    items: HistoryItem[],
    setter: (items: HistoryItem[]) => void
) => {
    const trySet = (data: HistoryItem[]) => {
        try { localStorage.setItem("hw_history", JSON.stringify(data)); return true; }
        catch { return false; }
    };
    if (trySet(items)) return;
    let stripped = items.map((item, i) => i === items.length - 1 ? { ...item, thumbnail: "" } : item);
    if (trySet(stripped)) return;
    stripped = items.map((item) => ({ ...item, thumbnail: "" }));
    if (trySet(stripped)) return;
    const fewer = stripped.slice(0, Math.floor(stripped.length / 2));
    if (trySet(fewer)) return;
    localStorage.removeItem("hw_history");
    toast("History direset karena storage penuh.", { icon: "⚠️" });
};
