"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  Upload, FileText, Download, Settings, Sparkles, Image as ImageIcon,
  Moon, Sun, ZoomIn, ZoomOut, ChevronDown, Package, RefreshCw, X,
  AlignJustify, PanelLeftClose, PanelLeftOpen, Maximize2, FileDown,
  Clock, Trash2, Eye, CheckCircle2, Loader2, PenTool, Save
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from 'framer-motion';

/* ─── TYPES ─────────────────────────────────────────── */
interface Font { name: string; file: string; style: string }
interface Folio { id: string; name: string; preview: string }
interface GeneratedPage { page: number; image: string }
interface HistoryItem {
  id: string;
  timestamp: number;
  pages: GeneratedPage[];
  fontName: string;
  folioName: string;
  pageCount: number;
  textPreview: string;
}
interface SavedPreset {
  id: string;
  name: string;
  config: typeof DEFAULT_CONFIG;
  fontId: string;
  folioId: string;
  savedAt: number;
}

/* ─── CONSTANTS ──────────────────────────────────────── */
const FONT_FAMILY_MAP: Record<string, string> = {
  "Indie Flower": "'Indie Flower', cursive",
  "Dancing Script": "'Dancing Script', cursive",
  "Caveat": "'Caveat', cursive",
  "Patrick Hand": "'Patrick Hand', cursive",
  "Kalam": "'Kalam', cursive",
  "Reenie Beanie": "'Reenie Beanie', cursive",
  "Dekko": "'Dekko', cursive",
  "Nanum Pen Script": "'Nanum Pen Script', cursive",
  "Sriracha": "'Sriracha', cursive",
};

const INK_PRESETS = [
  { label: "Hitam", color: "#1a1a1a" },
  { label: "Biru Tua", color: "#1a3a7c" },
  { label: "Biru", color: "#2563eb" },
  { label: "Hijau", color: "#166534" },
  { label: "Merah", color: "#991b1b" },
  { label: "Pensil", color: "#6b6b6b" },
];

const DEFAULT_CONFIG = {
  startX: 100, startY: 130, lineHeight: 84,
  maxWidth: 2500, pageBottom: 4500,
  fontSize: 60, color: "#1a1a1a", wordSpacing: 8,
};

/* ─── MAIN ───────────────────────────────────────────── */
export default function Home() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  const [text, setText] = useState("");
  const [selectedFont, setSelectedFont] = useState("indie_flower");
  const [selectedFolio, setSelectedFolio] = useState("");
  const [fonts, setFonts] = useState<Record<string, Font>>({});
  const [folios, setFolios] = useState<Folio[]>([]);
  const [generatedPages, setGeneratedPages] = useState<GeneratedPage[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [presets, setPresets] = useState<SavedPreset[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateProgress, setGenerateProgress] = useState(0);
  const [showConfig, setShowConfig] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isLoadingFonts, setIsLoadingFonts] = useState(true);
  const [isLoadingFolios, setIsLoadingFolios] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [fontDropdownOpen, setFontDropdownOpen] = useState(false);
  const [fullscreenPage, setFullscreenPage] = useState<GeneratedPage | null>(null);
  const [activeTab, setActiveTab] = useState<"result" | "history" | "presets">("result");
  const [presetName, setPresetName] = useState("");
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [seed, setSeed] = useState(Date.now());

  const fontDropdownRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // Konfigurasi Dropzone
  const onDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { toast.error("File max 50MB!"); return; }

    const formData = new FormData();
    formData.append("folio", file);
    const tid = toast.loading("Uploading folio ke Cloud...");
    try {
      const res = await fetch(`${API_URL}/api/folio/upload`, { method: "POST", body: formData });
      const data = await res.json();
      if (data.success) {
        toast.success("Folio tersimpan di Cloud! ✨", { id: tid });
        await loadFolios();
        handleFolioChange(data.filename);
      } else throw new Error(data.error);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Upload gagal", { id: tid });
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/jpeg': ['.jpeg', '.jpg'], 'image/png': ['.png'] },
    onDrop
  });

  /* ── Load from localStorage on mount ── */
  useEffect(() => {
    // Load saved theme preference
    const savedTheme = localStorage.getItem("hw_theme");
    if (savedTheme) setIsDark(savedTheme === "dark");

    // Load history
    try {
      const h = localStorage.getItem("hw_history");
      if (h) setHistory(JSON.parse(h));
    } catch { }

    // Load presets
    try {
      const p = localStorage.getItem("hw_presets");
      if (p) setPresets(JSON.parse(p));
    } catch { }

    // Load last used config
    try {
      const cfg = localStorage.getItem("hw_config");
      if (cfg) setConfig(JSON.parse(cfg));
    } catch { }

    // Load last used font & folio
    const lastFont = localStorage.getItem("hw_lastFont");
    if (lastFont) setSelectedFont(lastFont);
  }, []);

  useEffect(() => {
    loadFonts();
    loadFolios();
  }, []);

  // Auto-save config setiap kali berubah
  useEffect(() => {
    localStorage.setItem("hw_config", JSON.stringify(config));
  }, [config]);

  // Auto-save font preference
  useEffect(() => {
    localStorage.setItem("hw_lastFont", selectedFont);
  }, [selectedFont]);

  // Auto-save theme
  useEffect(() => {
    localStorage.setItem("hw_theme", isDark ? "dark" : "light");
  }, [isDark]);

  // Close dropdown on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (fontDropdownRef.current && !fontDropdownRef.current.contains(e.target as Node))
        setFontDropdownOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // ESC untuk tutup fullscreen
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setFullscreenPage(null); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // Trigger class 'dark' di elemen <html>
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDark) root.classList.add("dark");
    else root.classList.remove("dark");
  }, [isDark]);

  /* ── computed ── */
  const estimatedLines = text.split("\n").reduce((acc, line) => {
    const cpl = Math.floor((config.maxWidth - config.startX) / (config.fontSize * 0.55));
    return acc + Math.max(1, Math.ceil((line.length || 1) / cpl));
  }, 0);
  const linesPerPage = Math.floor((config.pageBottom - config.startY) / config.lineHeight);
  const estimatedPages = Math.max(1, Math.ceil(estimatedLines / linesPerPage));
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const currentFont = fonts[selectedFont];
  const currentFolio = folios.find(f => f.id === selectedFolio);

  /* ── API ── */
  const loadFonts = async () => {
    setIsLoadingFonts(true);
    try {
      const res = await fetch(`${API_URL}/api/fonts`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setFonts(data.fonts);
    } catch {
      toast.error("Backend tidak terhubung. Jalankan python app.py dulu.");
    } finally { setIsLoadingFonts(false); }
  };

  const loadFolios = async () => {
    setIsLoadingFolios(true);
    try {
      const res = await fetch(`${API_URL}/api/folios`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setFolios(data.folios);
      // Restore last used folio
      const lastFolio = localStorage.getItem("hw_lastFolio");
      if (lastFolio && data.folios.find((f: Folio) => f.id === lastFolio)) {
        setSelectedFolio(lastFolio);
      } else if (data.folios.length > 0) {
        setSelectedFolio(data.folios[0].id);
      }
    } catch { } finally { setIsLoadingFolios(false); }
  };

  // Auto-save folio preference saat berubah
  const handleFolioChange = (id: string) => {
    setSelectedFolio(id);
    localStorage.setItem("hw_lastFolio", id);
  };

  /* ── Generate ── */
  const handleGenerate = async () => {
    if (!text.trim()) { toast.error("Masukkan teks dulu!"); return; }
    if (!selectedFolio) { toast.error("Pilih folio dulu!"); return; }

    setIsGenerating(true);
    setGeneratedPages([]);
    setGenerateProgress(0);
    setActiveTab("result");

    const progressInterval = setInterval(() => {
      setGenerateProgress(p => p < 88 ? p + Math.random() * 10 : p);
    }, 350);

    const tid = toast.loading("Menulis tulisan tangan...");
    try {
      const res = await fetch(`${API_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, folioId: selectedFolio, fontId: selectedFont, config, seed }), // <-- Tambahkan seed di sini
      });
      const data = await res.json();
      if (data.success) {
        setGenerateProgress(100);
        setGeneratedPages(data.pages);
        toast.success(`✨ ${data.totalPages} halaman selesai!`, { id: tid, duration: 3000 });

        const item: HistoryItem = {
          id: Date.now().toString(),
          timestamp: Date.now(),
          pages: data.pages,
          fontName: currentFont?.name || selectedFont,
          folioName: currentFolio?.name || selectedFolio,
          pageCount: data.totalPages,
          textPreview: text.slice(0, 80) + (text.length > 80 ? "..." : ""),
        };
        const newHistory = [item, ...history].slice(0, 10);
        setHistory(newHistory);
        localStorage.setItem("hw_history", JSON.stringify(newHistory));

        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
      } else {
        throw new Error(data.error || "Generation failed");
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal generate", { id: tid, duration: 4000 });
    } finally {
      clearInterval(progressInterval);
      setIsGenerating(false);
      setTimeout(() => setGenerateProgress(0), 1200);
    }
  };

  /* ── Downloads ── */
  const handleDownloadSingle = (page: GeneratedPage) => {
    const a = document.createElement("a");
    a.href = page.image; a.download = `tugas_halaman_${page.page}.jpg`; a.click();
    toast.success(`Halaman ${page.page} didownload!`);
  };

  const handleDownloadZip = async () => {
    if (!generatedPages.length) return;
    setIsDownloadingZip(true);
    const tid = toast.loading("Membuat ZIP di browser...");

    try {
      const zip = new JSZip();

      // Masukkan gambar satu per satu ke dalam memori ZIP
      generatedPages.forEach((page) => {
        // Hapus prefix "data:image/jpeg;base64," agar tersisa data mentahnya saja
        const base64Data = page.image.split(",")[1];
        zip.file(`halaman_${page.page}.jpg`, base64Data, { base64: true });
      });

      // Generate file ZIP dan auto-download
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, "Tugas_Handwriting.zip");

      toast.success("ZIP berhasil didownload!", { id: tid });
    } catch {
      toast.error("Gagal membuat ZIP", { id: tid });
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const handleExportPdf = async () => {
    if (!generatedPages.length) return;
    setIsExportingPdf(true);
    const tid = toast.loading("Membuat PDF di server...");

    try {
      const res = await fetch(`${API_URL}/api/download/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pages: generatedPages }),
      });

      if (!res.ok) throw new Error();

      // Auto download PDF
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "Tugas_Handwriting.pdf"; a.click();
      URL.revokeObjectURL(url);

      toast.success("PDF berhasil didownload!", { id: tid });
    } catch {
      toast.error("Gagal membuat PDF", { id: tid });
    } finally {
      setIsExportingPdf(false);
    }
  };

  /* ── Upload Folio ── */
  const handleUploadFolio = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.match(/image\/(jpeg|jpg|png)/)) { toast.error("Hanya JPG/PNG!"); return; }
    if (file.size > 50 * 1024 * 1024) { toast.error("File max 50MB!"); return; }
    const formData = new FormData();
    formData.append("folio", file);
    const tid = toast.loading("Uploading folio...");
    try {
      const res = await fetch(`${API_URL}/api/folio/upload`, { method: "POST", body: formData });
      const data = await res.json();
      if (data.success) {
        toast.success("Folio uploaded! ✨", { id: tid });
        await loadFolios();
        // Auto-select folio baru
        handleFolioChange(data.filename);
      } else throw new Error(data.error);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Upload gagal", { id: tid });
    }
    e.target.value = "";
  };

  /* ── Preset management ── */
  const savePreset = () => {
    const name = presetName.trim() || `Preset ${presets.length + 1}`;
    const newPreset: SavedPreset = {
      id: Date.now().toString(),
      name,
      config: { ...config },
      fontId: selectedFont,
      folioId: selectedFolio,
      savedAt: Date.now(),
    };
    const newPresets = [newPreset, ...presets].slice(0, 10);
    setPresets(newPresets);
    localStorage.setItem("hw_presets", JSON.stringify(newPresets));
    setPresetName("");
    toast.success(`Preset "${name}" disimpan!`);
  };

  const loadPreset = (preset: SavedPreset) => {
    setConfig(preset.config);
    setSelectedFont(preset.fontId);
    if (folios.find(f => f.id === preset.folioId)) {
      handleFolioChange(preset.folioId);
    }
    toast.success(`Preset "${preset.name}" dimuat!`);
    setActiveTab("result");
  };

  const deletePreset = (id: string) => {
    const newP = presets.filter(p => p.id !== id);
    setPresets(newP);
    localStorage.setItem("hw_presets", JSON.stringify(newP));
  };

  const deleteHistory = (id: string) => {
    const newH = history.filter(h => h.id !== id);
    setHistory(newH);
    localStorage.setItem("hw_history", JSON.stringify(newH));
  };

  const restoreHistory = (item: HistoryItem) => {
    setGeneratedPages(item.pages);
    setActiveTab("result");
    toast.success("History dipulihkan!");
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 200);
  };

  /* ── Theme system — FIXED light mode borders ── */
  const D = isDark;

  // Objek c sekarang murni menggunakan standar Tailwind (tanpa ternary D ? :)
  const c = {
    page: "bg-[#f1f2f6] dark:bg-[#0a0a0f]",
    header: "bg-white/95 border-[#d1d5db] dark:bg-[#0d0d14]/90 dark:border-[#ffffff0d]",
    card: "bg-white border-[#d1d5db] dark:bg-[#13131e] dark:border-[#ffffff0f]",
    cardHover: "hover:border-[#9ca3af] dark:hover:border-[#ffffff1a]",
    input: "bg-white border-[#c5c8d0] text-gray-900 placeholder-gray-400 focus:border-violet-400 dark:bg-[#1a1a28] dark:border-[#ffffff14] dark:text-white dark:placeholder-white/25 dark:focus:border-violet-500/60",
    tp: "text-gray-900 dark:text-white",
    ts: "text-gray-400 dark:text-white/38",
    tm: "text-gray-600 dark:text-white/60",
    badge: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-white/6 dark:text-white/50 dark:border-white/8",
    pill: "bg-gray-100 dark:bg-white/6",
    pillBorder: "border-[#d1d5db] dark:border-[#ffffff0f]",
    divider: "border-[#e5e7eb] dark:border-[#ffffff08]",
    btn: "bg-white hover:bg-gray-50 text-gray-600 border border-[#d1d5db] shadow-sm dark:bg-white/6 dark:hover:bg-white/10 dark:text-white/65 dark:border-[#ffffff08]",
    btnActive: "bg-gray-900 text-white border border-gray-900 dark:bg-white/14 dark:text-white dark:border-[#ffffff14]",
    rowHover: "hover:bg-gray-50 dark:hover:bg-white/4",
    sidebar: "border-[#e5e7eb] dark:border-[#ffffff08]",
    dropdown: "bg-white border-[#d1d5db] shadow-xl dark:bg-[#1a1a28] dark:border-[#ffffff12]",
    accent: "from-violet-600 to-indigo-500",
    glow: "shadow-violet-500/20 dark:shadow-violet-500/25",
    label: "text-[#6b7280] dark:text-[#ffffff38]",
    folioRing: "ring-2 ring-violet-500 shadow-lg shadow-violet-200 dark:ring-violet-500/70 dark:shadow-violet-500/15",
    folioUnsel: "ring-1 ring-[#d1d5db] hover:ring-[#9ca3af] hover:shadow-md dark:ring-[#ffffff0a] dark:hover:ring-[#ffffff18]",
    sliderAccent: "accent-sky-600 dark:accent-sky-400",
    tag: "bg-gray-100 border border-gray-200 text-gray-500 dark:bg-[#ffffff08] dark:border-[#ffffff10] dark:text-white/50",
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }) + " " +
      d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className={`min-h-screen ${c.page} transition-colors duration-300`} style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <Toaster position="top-right" toastOptions={{
        duration: 3000,
        style: {
          background: D ? "#1a1a28" : "#1f2937",
          color: "#fff", padding: "12px 16px", borderRadius: "12px",
          fontSize: "13.5px", fontWeight: "500",
          border: D ? "1px solid rgba(255,255,255,0.08)" : "none",
          boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
        },
      }} />

      {/* ── FULLSCREEN ── */}
      {fullscreenPage && (
        <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setFullscreenPage(null)}>
          <button className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all"
            onClick={() => setFullscreenPage(null)}>
            <X className="w-5 h-5" />
          </button>
          <div className="text-center" onClick={e => e.stopPropagation()}>
            <p className="text-white/35 text-[11px] mb-3 tracking-widest uppercase">Halaman {fullscreenPage.page} · ESC untuk tutup</p>
            <img src={fullscreenPage.image} alt="" className="max-h-[88vh] max-w-[92vw] rounded-xl shadow-2xl object-contain" />
            <div className="flex justify-center gap-3 mt-4">
              <button onClick={() => handleDownloadSingle(fullscreenPage)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-all">
                <Download className="w-4 h-4" />Download
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <header className={`${c.header} backdrop-blur-xl border-b sticky top-0 z-50 transition-colors duration-200`}>
        {isGenerating && (
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-violet-500/10">
            <div className="h-full bg-gradient-to-r from-violet-500 to-indigo-400 transition-all duration-500"
              style={{ width: `${generateProgress}%` }} />
          </div>
        )}
        <div className="max-w-[1400px] mx-auto px-4 sm:px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button onClick={() => setSidebarOpen(!sidebarOpen)}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${c.btn}`}>
              {sidebarOpen ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeftOpen className="w-3.5 h-3.5" />}
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-violet-500/30">
                <PenTool className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className={`text-[15px] font-semibold tracking-tight ${c.tp}`}>HandWrite</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-gradient-to-r from-violet-600 to-indigo-500 text-white leading-none">AI</span>
              </div>
            </div>
          </div>

          {/* Status indicator */}
          <div className="hidden md:flex">
            {isGenerating ? (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${D ? "bg-violet-500/10 border border-violet-500/20" : "bg-violet-50 border border-violet-200"}`}>
                <Loader2 className="w-3.5 h-3.5 text-violet-500 animate-spin" />
                <span className={`text-xs font-medium ${D ? "text-violet-400" : "text-violet-700"}`}>Generating {Math.round(generateProgress)}%</span>
              </div>
            ) : generatedPages.length > 0 ? (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${D ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-emerald-50 border border-emerald-200"}`}>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span className={`text-xs font-medium ${D ? "text-emerald-400" : "text-emerald-700"}`}>{generatedPages.length} halaman siap</span>
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-1.5">
            <button onClick={() => setShowConfig(!showConfig)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${showConfig ? c.btnActive : c.btn}`}>
              <Settings className="w-3.5 h-3.5" /><span className="hidden sm:inline">Config</span>
            </button>
            <button onClick={() => setIsDark(!isDark)}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${c.btn}`}>
              {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </header>

      {/* ── BODY ── */}
      <div className="max-w-[1400px] mx-auto flex" style={{ height: "calc(100vh - 56px)" }}>

        {/* ══ SIDEBAR ══ */}
        <aside className={`flex-shrink-0 transition-all duration-300 overflow-hidden ${sidebarOpen ? "w-[288px]" : "w-0"}`}>
          <div className={`w-[288px] h-full overflow-y-auto border-r ${c.sidebar} py-3 px-3 space-y-2.5`}>

            {/* ─ FONT ─ */}
            <div className={`rounded-xl border ${c.card} p-3.5 transition-all ${c.cardHover}`}>
              <p className={`text-[10.5px] font-semibold uppercase tracking-widest mb-2.5 ${c.label}`}>Font Tulisan</p>
              <div ref={fontDropdownRef} className="relative">
                <button
                  onClick={() => setFontDropdownOpen(!fontDropdownOpen)}
                  disabled={isLoadingFonts}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border transition-all ${fontDropdownOpen
                    ? D ? "border-violet-500/50 bg-violet-500/8" : "border-violet-400 bg-violet-50"
                    : D ? "border-[#ffffff0f] bg-[#ffffff06] hover:border-[#ffffff18]"
                      : "border-[#d1d5db] bg-gray-50 hover:border-[#9ca3af]"
                    }`}
                >
                  {isLoadingFonts ? (
                    <div className={`h-4 w-28 rounded animate-pulse ${D ? "bg-white/8" : "bg-gray-200"}`} />
                  ) : currentFont ? (
                    <span className={`text-[15px] font-medium truncate ${c.tp}`}
                      style={{ fontFamily: FONT_FAMILY_MAP[currentFont.name] || currentFont.name }}>
                      {currentFont.name}
                    </span>
                  ) : <span className={c.ts}>Pilih font...</span>}
                  <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 ${c.ts} transition-transform ${fontDropdownOpen ? "rotate-180" : ""}`} />
                </button>

                {fontDropdownOpen && Object.keys(fonts).length > 0 && (
                  <div className={`absolute top-full left-0 right-0 mt-1 rounded-xl border z-50 overflow-hidden ${c.dropdown}`}>
                    <div className="max-h-52 overflow-y-auto py-1">
                      {Object.entries(fonts).map(([key, font]) => (
                        <button key={key}
                          onClick={() => { setSelectedFont(key); setFontDropdownOpen(false); }}
                          className={`w-full flex items-center justify-between px-3 py-2.5 transition-colors ${c.rowHover} ${selectedFont === key ? D ? "bg-violet-500/12" : "bg-violet-50" : ""
                            }`}
                        >
                          <span className={`text-[14px] ${c.tp}`}
                            style={{ fontFamily: FONT_FAMILY_MAP[font.name] || font.name }}>
                            {font.name}
                          </span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className={`text-[10px] capitalize ${c.ts}`}>{font.style}</span>
                            {selectedFont === key && (
                              <div className="w-3.5 h-3.5 rounded-full bg-violet-500 flex items-center justify-center">
                                <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {currentFont && (
                <div className={`mt-2.5 px-3 py-2.5 rounded-lg border ${c.pillBorder} ${c.pill}`}>
                  <p className={`text-[10px] mb-1 ${c.ts}`}>PREVIEW</p>
                  <p className={`text-lg leading-snug ${c.tp}`}
                    style={{ fontFamily: FONT_FAMILY_MAP[currentFont.name] || currentFont.name }}>
                    Tulisan tangan nyata
                  </p>
                </div>
              )}
            </div>

            {/* ─ SPASI KATA ─ */}
            <div className={`rounded-xl border ${c.card} p-3.5 transition-all ${c.cardHover}`}>
              <div className="flex items-center justify-between mb-2.5">
                <p className={`text-[10.5px] font-semibold uppercase tracking-widest ${c.label}`}>Spasi Kata</p>
                <span className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-lg border ${D ? "bg-sky-500/15 text-sky-400 border-sky-500/20" : "bg-sky-50 text-sky-700 border-sky-200"
                  }`}>
                  {config.wordSpacing >= 0 ? `+${config.wordSpacing}` : config.wordSpacing}px
                </span>
              </div>

              {/* Custom styled slider */}
              <div className="relative mb-2">
                <input type="range" min="-10" max="40" step="1"
                  value={config.wordSpacing}
                  onChange={(e) => setConfig({ ...config, wordSpacing: Number(e.target.value) })}
                  className={`w-full cursor-pointer ${c.sliderAccent}`}
                  style={{
                    WebkitAppearance: "none", height: "5px",
                    borderRadius: "99px",
                    background: `linear-gradient(to right, ${D ? "#38bdf8" : "#0ea5e9"} 0%, ${D ? "#38bdf8" : "#0ea5e9"} ${((config.wordSpacing + 10) / 50) * 100}%, ${D ? "rgba(255,255,255,0.12)" : "#d1d5db"} ${((config.wordSpacing + 10) / 50) * 100}%, ${D ? "rgba(255,255,255,0.12)" : "#d1d5db"} 100%)`
                  }}
                />
              </div>

              <div className={`flex justify-between text-[10px] mb-2 ${c.ts}`}>
                <span>← Rapat</span>
                <span className={config.wordSpacing === 8 ? "text-sky-500 font-medium" : c.ts}>Normal</span>
                <span>Renggang →</span>
              </div>

              <div className="grid grid-cols-3 gap-1">
                {[{ l: "Rapat", v: -5 }, { l: "Normal", v: 8 }, { l: "Lebar", v: 25 }].map(p => (
                  <button key={p.v} onClick={() => setConfig({ ...config, wordSpacing: p.v })}
                    className={`py-1.5 rounded-lg text-[11px] font-medium transition-all border ${config.wordSpacing === p.v
                      ? D ? "bg-sky-500/20 text-sky-400 border-sky-500/30" : "bg-sky-600 text-white border-sky-600"
                      : D ? "bg-white/4 text-white/50 border-[#ffffff08] hover:border-[#ffffff15]"
                        : "bg-white text-gray-600 border-[#d1d5db] hover:bg-gray-50"
                      }`}>
                    {p.l}
                  </button>
                ))}
              </div>
            </div>

            {/* ─ WARNA TINTA ─ */}
            <div className={`rounded-xl border ${c.card} p-3.5 transition-all ${c.cardHover}`}>
              <p className={`text-[10.5px] font-semibold uppercase tracking-widest mb-2.5 ${c.label}`}>Warna Tinta</p>
              <div className="grid grid-cols-3 gap-1.5 mb-2.5">
                {INK_PRESETS.map((p) => (
                  <button key={p.color} onClick={() => setConfig({ ...config, color: p.color })}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border-2 transition-all text-[11px] font-medium ${config.color === p.color
                      ? D ? "border-violet-500/70 bg-violet-500/12 text-white" : "border-violet-500 bg-violet-50 text-violet-700"
                      : D ? "border-[#ffffff08] text-white/55 hover:border-[#ffffff18]"
                        : "border-[#d1d5db] text-gray-600 hover:border-[#9ca3af] hover:bg-gray-50"
                      }`}>
                    <div className="w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-black/10" style={{ backgroundColor: p.color }} />
                    <span className="truncate">{p.label}</span>
                  </button>
                ))}
              </div>
              <div className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border ${c.pillBorder} ${c.pill}`}>
                <input type="color" value={config.color}
                  onChange={(e) => setConfig({ ...config, color: e.target.value })}
                  className="w-8 h-8 rounded-lg cursor-pointer flex-shrink-0" />
                <div>
                  <p className={`text-[11px] font-medium ${c.tm}`}>Custom warna</p>
                  <p className={`text-[10px] font-mono ${c.ts}`}>{config.color.toUpperCase()}</p>
                </div>
              </div>
            </div>

            {/* ─ FOLIO ─ */}
            <div className={`rounded-xl border ${c.card} p-3.5 transition-all ${c.cardHover}`}>
              <div className="flex items-center justify-between mb-2.5">
                <p className={`text-[10.5px] font-semibold uppercase tracking-widest ${c.label}`}>Template Folio</p>
              </div>

              {/* AREA DROPZONE BARU */}
              <div {...getRootProps()}
                className={`mb-3 p-4 border-2 border-dashed rounded-xl text-center cursor-pointer transition-all ${isDragActive ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/10' : D ? 'border-[#ffffff1a] hover:border-[#ffffff33]' : 'border-gray-300 hover:border-gray-400'}`}>
                <input {...getInputProps()} />
                <ImageIcon className={`w-5 h-5 mx-auto mb-1 ${c.ts}`} />
                <p className={`text-[10px] ${c.tm}`}>Klik atau tarik folio ke sini</p>
              </div>

              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-0.5">
                {isLoadingFolios ? (
                  [1, 2].map(i => <div key={i} className={`h-24 rounded-xl animate-pulse ${D ? "bg-white/5" : "bg-gray-100"}`} />)
                ) : folios.length === 0 ? (
                  <div className={`py-8 rounded-xl border-2 border-dashed text-center ${D ? "border-[#ffffff0a] text-white/25" : "border-[#d1d5db] text-gray-400"}`}>
                    <ImageIcon className="w-6 h-6 mx-auto mb-1.5 opacity-40" />
                    <p className="text-xs">Upload folio dulu</p>
                  </div>
                ) : (
                  folios.map((folio) => (
                    <label key={folio.id} className={`cursor-pointer block rounded-xl overflow-hidden transition-all duration-200 ${selectedFolio === folio.id ? c.folioRing : c.folioUnsel
                      }`}>
                      <input type="radio" name="folio" value={folio.id}
                        checked={selectedFolio === folio.id}
                        onChange={(e) => handleFolioChange(e.target.value)}
                        className="hidden" />
                      <img src={folio.preview.startsWith('http') ? folio.preview : `${API_URL}${folio.preview}`} alt={folio.name} className="w-full h-24 object-cover" />
                      <div className={`px-2.5 py-1.5 flex items-center justify-between ${D ? "bg-[#ffffff06]" : "bg-gray-50"}`}>
                        <p className={`text-[11px] font-medium truncate ${c.tm}`}>{folio.name}</p>
                        {selectedFolio === folio.id && <CheckCircle2 className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />}
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>

            {/* ─ ADVANCED CONFIG ─ */}
            {showConfig && (
              <div className={`rounded-xl border ${c.card} p-3.5 animate-fadeIn`}>
                <div className="flex items-center justify-between mb-2.5">
                  <p className={`text-[10.5px] font-semibold uppercase tracking-widest ${c.label}`}>Advanced Config</p>
                  <button onClick={() => setConfig(DEFAULT_CONFIG)}
                    className={`flex items-center gap-1 text-[10.5px] px-2 py-1 rounded-lg transition-all ${c.btn}`}>
                    <RefreshCw className="w-3 h-3" />Reset
                  </button>
                </div>
                <div className="space-y-2">
                  {(["startX", "startY", "lineHeight", "maxWidth", "pageBottom", "fontSize"] as const).map(key => (
                    <div key={key}>
                      <label className={`block text-[10px] font-medium mb-1 ${c.ts}`}>
                        {key.replace(/([A-Z])/g, " $1").trim()}
                      </label>
                      <input type="number" value={config[key]}
                        onChange={(e) => setConfig({ ...config, [key]: Number(e.target.value) })}
                        className={`w-full px-2.5 py-1.5 text-xs border rounded-lg transition-colors ${c.input}`}
                      />
                    </div>
                  ))}
                </div>
                {/* Auto-save indicator */}
                <p className={`text-[10px] mt-2.5 flex items-center gap-1 ${c.ts}`}>
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  Config tersimpan otomatis
                </p>
              </div>
            )}

          </div>
        </aside>

        {/* ══ MAIN AREA ══ */}
        <main className="flex-1 overflow-y-auto min-w-0">
          <div className="max-w-2xl mx-auto p-4 space-y-3">

            {/* ─ TEXT INPUT ─ */}
            <div className={`rounded-xl border ${c.card} p-4 transition-all`}>
              <div className="flex items-center justify-between mb-2.5">
                <p className={`text-[10.5px] font-semibold uppercase tracking-widest ${c.label}`}>Teks</p>
                <div className="flex items-center gap-3">
                  <span className={`text-[11px] ${c.ts}`}>
                    <span className={`font-semibold tabular-nums ${text.length === 0 ? c.ts : text.length > 40000 ? "text-red-400" : D ? "text-emerald-400" : "text-emerald-600"
                      }`}>{text.length.toLocaleString()}</span>
                    <span className={c.ts}>/50k</span>
                  </span>
                  <span className={`text-[11px] ${c.ts}`}>
                    <span className={`font-semibold tabular-nums ${D ? "text-indigo-400" : "text-indigo-600"}`}>{wordCount.toLocaleString()}</span> kata
                  </span>
                  <span className={`text-[11px] ${c.ts}`}>
                    <span className={`font-semibold tabular-nums ${D ? "text-violet-400" : "text-violet-600"}`}>~{estimatedPages}</span> hal
                  </span>
                </div>
              </div>

              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Ketik atau paste teks di sini..."
                className={`w-full h-48 p-3.5 border rounded-xl resize-none text-sm leading-relaxed transition-colors font-mono ${c.input}`}
              />

              {text.length > 0 && (
                <div className={`mt-1.5 h-1 rounded-full overflow-hidden ${D ? "bg-[#ffffff08]" : "bg-gray-200"}`}>
                  <div className={`h-full rounded-full transition-all duration-500 ${text.length > 45000 ? "bg-red-500" : text.length > 30000 ? "bg-amber-500" : D ? "bg-emerald-500" : "bg-emerald-600"
                    }`} style={{ width: `${Math.min(100, (text.length / 50000) * 100)}%` }} />
                </div>
              )}

              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  {currentFont && (
                    <span className={`text-[11px] px-2 py-1 rounded-lg border ${c.tag}`}
                      style={{ fontFamily: FONT_FAMILY_MAP[currentFont.name] || currentFont.name }}>
                      {currentFont.name}
                    </span>
                  )}
                  {currentFolio && (
                    <span className={`text-[11px] px-2 py-1 rounded-lg border ${c.tag}`}>📄 {currentFolio.name}</span>
                  )}
                </div>

                <div className="flex gap-2">
                  <button onClick={() => setSeed(Date.now())} title="Acak Gaya Tulisan"
                    className={`flex items-center justify-center p-2.5 rounded-xl border transition-all ${c.btn}`}>
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating || !text.trim() || !selectedFolio}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 flex-shrink-0 ${isGenerating || !text.trim() || !selectedFolio
                      ? D ? "bg-white/4 text-white/20 cursor-not-allowed border border-[#ffffff06]"
                        : "bg-gray-100 text-gray-300 cursor-not-allowed border border-gray-200"
                      : `bg-gradient-to-r ${c.accent} text-white shadow-lg ${c.glow} hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]`
                      }`}
                  >
                    {isGenerating
                      ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Generating...</span></>
                      : <><Sparkles className="w-4 h-4" /><span>Generate</span></>
                    }
                  </button>
                </div>
              </div>
            </div>

            {/* ─ TABS ─ */}
            <div className="flex items-center gap-1.5">
              {([
                { id: "result", icon: <Eye className="w-3.5 h-3.5" />, label: "Hasil", count: generatedPages.length },
                { id: "history", icon: <Clock className="w-3.5 h-3.5" />, label: "History", count: history.length },
                { id: "presets", icon: <Save className="w-3.5 h-3.5" />, label: "Preset", count: presets.length },
              ] as const).map(tab => (
                <button key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${activeTab === tab.id ? c.btnActive : c.btn
                    }`}
                >
                  {tab.icon}{tab.label}
                  {tab.count > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === tab.id
                      ? D ? "bg-white/15" : "bg-white/25"
                      : D ? "bg-white/8 text-white/40" : "bg-gray-200 text-gray-500"
                      }`}>{tab.count}</span>
                  )}
                </button>
              ))}
            </div>

            {/* ─ KONTEN TABS BERALIH DENGAN ANIMASI ─ */}
            <AnimatePresence mode="wait">

              {/* ─ TAB: HASIL ─ */}
              {activeTab === "result" && (
                <motion.div
                  key="tab-result"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                >
                  <div ref={resultRef}>
                    {generatedPages.length > 0 ? (
                      <div className={`rounded-xl border ${c.card} p-4`}>
                        <div className={`flex items-center justify-between mb-4 pb-3.5 border-b ${c.divider}`}>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            <span className={`text-sm font-semibold ${c.tp}`}>{generatedPages.length} halaman</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {/* Zoom */}
                            <div className={`flex items-center gap-0.5 rounded-lg p-1 border ${c.pillBorder} ${c.pill}`}>
                              <button onClick={() => setZoomLevel(Math.max(40, zoomLevel - 20))}
                                className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${c.rowHover} ${c.tm}`}>
                                <ZoomOut className="w-3 h-3" />
                              </button>
                              <span className={`text-[11px] font-mono w-9 text-center ${c.ts}`}>{zoomLevel}%</span>
                              <button onClick={() => setZoomLevel(Math.min(200, zoomLevel + 20))}
                                className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${c.rowHover} ${c.tm}`}>
                                <ZoomIn className="w-3 h-3" />
                              </button>
                            </div>
                            {/* PDF */}
                            <button onClick={handleExportPdf} disabled={isExportingPdf}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${D ? "bg-amber-500/12 text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
                                : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                                } ${isExportingPdf ? "opacity-50" : ""}`}>
                              {isExportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
                              PDF
                            </button>
                            {/* ZIP */}
                            <button onClick={handleDownloadZip} disabled={isDownloadingZip}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${isDownloadingZip ? `${c.btn} opacity-50` : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
                                }`}>
                              {isDownloadingZip ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Package className="w-3.5 h-3.5" />}
                              ZIP All
                            </button>
                            <button onClick={() => setGeneratedPages([])}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${c.btn}`}>
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-4">
                          {generatedPages.map((page) => (
                            <div key={page.page} className={`rounded-xl overflow-hidden border ${D ? "border-[#ffffff08]" : "border-[#e5e7eb]"} shadow-lg`}>
                              <div className={`px-4 py-2 flex items-center justify-between ${D ? "bg-[#ffffff04]" : "bg-gray-50"} border-b ${c.divider}`}>
                                <span className={`text-[11px] font-semibold ${c.ts}`}>Halaman {page.page}</span>
                                <div className="flex items-center gap-1.5">
                                  <button onClick={() => setFullscreenPage(page)}
                                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${c.btn}`}>
                                    <Maximize2 className="w-3 h-3" />Fullscreen
                                  </button>
                                  <button onClick={() => handleDownloadSingle(page)}
                                    className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[11px] font-medium transition-all">
                                    <Download className="w-3 h-3" />Download
                                  </button>
                                </div>
                              </div>
                              <div className={D ? "bg-[#080810]" : "bg-gray-100"}>
                                <img src={page.image} alt={`Halaman ${page.page}`}
                                  style={{ width: `${zoomLevel}%`, minWidth: zoomLevel < 100 ? `${zoomLevel}%` : "100%" }}
                                  className="block mx-auto transition-all duration-300 cursor-zoom-in"
                                  onClick={() => setFullscreenPage(page)}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : isGenerating ? (
                      <div className={`rounded-xl border ${c.card} py-14 text-center`}>
                        <Loader2 className="w-8 h-8 animate-spin text-violet-500 mx-auto mb-3" />
                        <p className={`text-sm font-medium ${c.tm}`}>Sedang menulis...</p>
                        <p className={`text-xs mt-1 mb-5 ${c.ts}`}>{Math.round(generateProgress)}% selesai</p>
                        <div className={`w-48 h-1 rounded-full mx-auto overflow-hidden ${D ? "bg-[#ffffff08]" : "bg-gray-200"}`}>
                          <div className="h-full bg-gradient-to-r from-violet-500 to-indigo-400 rounded-full transition-all duration-500"
                            style={{ width: `${generateProgress}%` }} />
                        </div>
                      </div>
                    ) : (
                      <div className={`rounded-xl border-2 border-dashed py-14 text-center ${D ? "border-[#ffffff08]" : "border-[#d1d5db]"}`}>
                        <div className={`w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center ${D ? "bg-[#ffffff06]" : "bg-gray-100"}`}>
                          <PenTool className={`w-6 h-6 ${D ? "text-white/15" : "text-gray-300"}`} />
                        </div>
                        <p className={`text-sm font-medium ${c.tm}`}>Hasil generate muncul di sini</p>
                        <p className={`text-xs mt-1.5 ${c.ts}`}>Masukkan teks lalu klik Generate</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* ─ TAB: HISTORY ─ */}
              {activeTab === "history" && (
                <motion.div
                  key="tab-history"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  className={`rounded-xl border ${c.card} p-4`}
                >
                  <div className={`flex items-center justify-between mb-3.5 pb-3.5 border-b ${c.divider}`}>
                    <div className="flex items-center gap-2">
                      <Clock className={`w-4 h-4 ${c.ts}`} />
                      <span className={`text-sm font-semibold ${c.tp}`}>Riwayat Generate</span>
                    </div>
                    {history.length > 0 && (
                      <button onClick={() => { setHistory([]); localStorage.removeItem("hw_history"); }}
                        className={`text-[11px] flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all ${D ? "text-red-400/70 hover:bg-red-500/10 border border-[#ffffff08]"
                          : "text-red-500 hover:bg-red-50 border border-red-200"
                          }`}>
                        <Trash2 className="w-3 h-3" />Hapus semua
                      </button>
                    )}
                  </div>

                  {history.length === 0 ? (
                    <div className="py-10 text-center">
                      <Clock className={`w-7 h-7 mx-auto mb-2.5 ${c.ts}`} />
                      <p className={`text-sm ${c.tm}`}>Belum ada riwayat</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {history.map((item) => (
                        <div key={item.id} className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${c.pillBorder} ${c.rowHover}`}>
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${D ? "bg-violet-500/12" : "bg-violet-100"}`}>
                            <FileText className="w-4 h-4 text-violet-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-medium truncate ${c.tm}`}>{item.textPreview}</p>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <span className={`text-[10px] ${c.ts}`}>{formatTime(item.timestamp)}</span>
                              <span className={c.ts}>·</span>
                              <span className={`text-[10px] ${c.ts}`}>{item.fontName}</span>
                              <span className={c.ts}>·</span>
                              <span className={`text-[10px] ${c.ts}`}>{item.pageCount} hal</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button onClick={() => restoreHistory(item)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border ${D ? "bg-indigo-500/12 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/20"
                                : "bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100"
                                }`}>Pulihkan</button>
                            <button onClick={() => deleteHistory(item.id)}
                              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${D ? "text-white/20 hover:bg-red-500/10 hover:text-red-400" : "text-gray-300 hover:bg-red-50 hover:text-red-500"
                                }`}>
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* ─ TAB: PRESETS ─ */}
              {activeTab === "presets" && (
                <motion.div
                  key="tab-presets"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  className={`rounded-xl border ${c.card} p-4`}
                >
                  <div className={`flex items-center gap-2 mb-3.5 pb-3.5 border-b ${c.divider}`}>
                    <Save className={`w-4 h-4 ${c.ts}`} />
                    <span className={`text-sm font-semibold ${c.tp}`}>Preset Tersimpan</span>
                  </div>

                  {/* Save current as preset */}
                  <div className={`flex gap-2 mb-4 p-3 rounded-xl border ${c.pillBorder} ${c.pill}`}>
                    <input
                      type="text"
                      placeholder="Nama preset..."
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && savePreset()}
                      className={`flex-1 px-3 py-1.5 text-xs border rounded-lg transition-colors ${c.input}`}
                    />
                    <button onClick={savePreset}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all bg-gradient-to-r ${c.accent} text-white hover:opacity-90`}>
                      <Save className="w-3.5 h-3.5" />Simpan
                    </button>
                  </div>

                  <p className={`text-[10px] mb-3 ${c.ts}`}>
                    Preset menyimpan: font, folio, warna tinta, spasi kata, dan semua config.
                  </p>

                  {presets.length === 0 ? (
                    <div className="py-8 text-center">
                      <Save className={`w-7 h-7 mx-auto mb-2.5 ${c.ts}`} />
                      <p className={`text-sm ${c.tm}`}>Belum ada preset</p>
                      <p className={`text-xs mt-1 ${c.ts}`}>Simpan konfigurasi favoritmu</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {presets.map((preset) => (
                        <div key={preset.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${c.pillBorder} ${c.rowHover}`}>
                          <div className="w-7 h-7 rounded-lg flex-shrink-0 ring-1 ring-black/10" style={{ backgroundColor: preset.config.color }} />
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-semibold ${c.tp}`}>{preset.name}</p>
                            <p className={`text-[10px] mt-0.5 ${c.ts}`}>
                              {fonts[preset.fontId]?.name || preset.fontId} · {formatTime(preset.savedAt)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button onClick={() => loadPreset(preset)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border ${D ? "bg-violet-500/12 text-violet-400 border-violet-500/20 hover:bg-violet-500/20"
                                : "bg-violet-50 text-violet-600 border-violet-200 hover:bg-violet-100"
                                }`}>Muat</button>
                            <button onClick={() => deletePreset(preset.id)}
                              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${D ? "text-white/20 hover:bg-red-500/10 hover:text-red-400" : "text-gray-300 hover:bg-red-50 hover:text-red-500"
                                }`}>
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

            </AnimatePresence>

          </div>
        </main>
      </div>
    </div>
  );
}