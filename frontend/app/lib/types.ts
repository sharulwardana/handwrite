/* ─── TYPES ─────────────────────────────────────────── */
import { DEFAULT_CONFIG } from "./constants";

export interface Font {
    name: string;
    file: string;
    style: string;
}

export interface Folio {
    id: string;
    name: string;
    preview: string;
}

export interface GeneratedPage {
    page: number;
    image: string;
}

export interface HistoryItem {
    id: string;
    timestamp: number;
    text: string;
    fontId: string;
    folioId: string;
    config: typeof DEFAULT_CONFIG;
    fontName: string;
    folioName: string;
    pageCount: number;
    textPreview: string;
    thumbnail?: string;
}

export interface SavedPreset {
    id: string;
    name: string;
    config: typeof DEFAULT_CONFIG;
    fontId: string;
    folioId: string;
    savedAt: number;
}
