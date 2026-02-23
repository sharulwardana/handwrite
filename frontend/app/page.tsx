"use client";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  FileText, Download, Settings, Sparkles, Image as ImageIcon,
  Moon, Sun, ZoomIn, ZoomOut, ChevronDown, Package, RefreshCw, X,
  PanelLeftClose, PanelLeftOpen, Maximize2, FileDown,
  Clock, Trash2, Eye, CheckCircle2, Loader2, PenTool, Save, Copy,
  Clipboard, Wifi, WifiOff, Menu, Bot, Mic, LogIn, LogOut, User // <-- Tambahkan Bot dan Mic
} from "lucide-react";
import { supabase, supabaseConfigured } from "./lib/supabase";
import toast, { Toaster } from "react-hot-toast";
import { saveAs } from "file-saver";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { jsPDF } from "jspdf";
import { Document, Packer, Paragraph, ImageRun } from "docx";
import ReactCrop, { type Crop, type PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import type { User as SupabaseUser } from "@supabase/supabase-js";

/* ─── TYPES ─────────────────────────────────────────── */
interface Font { name: string; file: string; style: string }
interface Folio { id: string; name: string; preview: string }
interface GeneratedPage { page: number; image: string }
interface HistoryItem {
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

const DEMO_TEXT = `Pendidikan adalah senjata paling ampuh yang bisa kamu gunakan untuk mengubah dunia. Setiap huruf yang kamu tulis adalah bukti bahwa kamu peduli pada ilmu dan masa depanmu.

Belajar bukan hanya soal nilai di atas kertas, melainkan tentang karakter yang terbentuk dari setiap usaha dan kerja keras yang kamu lakukan setiap harinya.

Teruslah menulis, teruslah belajar, dan jangan pernah menyerah pada prosesmu.`;

const DEFAULT_CONFIG = {
  startX: 70, startY: 65, lineHeight: 38,
  maxWidth: 1100, pageBottom: 1520,
  fontSize: 25, color: "#1a1a1a", wordSpacing: 8,
  marginJitter: 6,
  enableDropCap: false,
};

/* ─── SIDEBAR SECTION COMPONENT ─────────────────────── */
const SECTION_COLORS: Record<string, {
  light: { bg: string; border: string; header: string; label: string; icon: string };
  dark: { bg: string; border: string; header: string; label: string; icon: string };
}> = {
  "Dari Tulisan Tanganmu": {
    light: { bg: "bg-pink-100/95", border: "border-pink-300", header: "hover:bg-pink-200/60", label: "text-pink-600", icon: "🖐️" },
    dark: { bg: "bg-[#1a0a12]", border: "border-pink-900/40", header: "hover:bg-pink-950/30", label: "text-pink-400", icon: "🖐️" },
  },
  "Font Tulisan": {
    light: { bg: "bg-indigo-100/95", border: "border-indigo-300", header: "hover:bg-indigo-200/60", label: "text-indigo-600", icon: "✍️" },
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

function SidebarSection({
  title, children, defaultOpen = true, isDark, className = "", badge
}: {
  title: string; children: React.ReactNode; defaultOpen?: boolean; isDark: boolean; className?: string; badge?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const theme = SECTION_COLORS[title];
  const t = theme ? (isDark ? theme.dark : theme.light) : null;

  const bg = t ? t.bg : (isDark ? "bg-[#13131f]" : "bg-white/90");
  const border = t ? t.border : (isDark ? "border-[#ffffff0d]" : "border-violet-100");
  const headerHover = t ? t.header : (isDark ? "hover:bg-white/[0.03]" : "hover:bg-violet-50/80");
  const labelColor = t ? t.label : (isDark ? "text-[#52525b]" : "text-violet-400");
  const icon = t ? t.icon : "";
  const divider = t ? t.border : (isDark ? "border-[#ffffff08]" : "border-violet-100");

  return (
    <div className={`rounded-xl border backdrop-blur-sm overflow-hidden shadow-sm ${bg} ${border} ${className}`}>
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-t-xl transition-all duration-200 ${open ? `border-b ${divider}` : "rounded-b-xl"} ${headerHover} hover:ring-1 ${isDark ? "hover:ring-white/5" : "hover:ring-violet-200"}`}
      >
        <div className="flex items-center gap-2">
          {icon && <span className="text-sm">{icon}</span>}
          <span className={`text-[10px] font-bold uppercase tracking-[0.12em] ${labelColor}`}>{title}</span>
          {badge && (
            <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full ${isDark
              ? "bg-violet-500/20 text-violet-400 border border-violet-500/30"
              : "bg-violet-100 text-violet-600 border border-violet-200"
              }`}>
              {badge}
            </span>
          )}
        </div>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        >
          <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 ${labelColor}`} />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: "hidden" }}
          >
            <div className="p-3.5 space-y-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── TOGGLE SWITCH COMPONENT ────────────────────────── */
function ToggleSwitch({
  value, onChange, colorClass = "bg-violet-500 border-violet-400", isDark
}: {
  value: boolean; onChange: (v: boolean) => void; colorClass?: string; isDark: boolean;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative flex-shrink-0 w-11 h-6 rounded-full border-2 transition-all duration-300 ${value
        ? colorClass
        : isDark ? "bg-white/10 border-[#ffffff18]" : "bg-gray-200 border-gray-300"
        }`}
    >
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-md transition-all duration-300 ${value ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

/* ─── MAIN ───────────────────────────────────────────── */
// Perbaikan: Memastikan API_URL selalu memiliki protokol yang benar
const getApiUrl = () => {
  const url = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  // Jika URL tidak dimulai dengan http, tambahkan https:// secara otomatis
  if (url && !url.startsWith('http')) {
    return `https://${url}`;
  }
  // Hapus trailing slash jika ada agar tidak double slash saat dipanggil
  return url.replace(/\/$/, "");
};

const API_URL = getApiUrl();

export default function Home() {

  // ── State ──────────────────────────────────────────────────────────────────
  const [user, setUser] = useState<SupabaseUser | null>(null);

  // Cek apakah user sudah login saat web dibuka
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => { authListener.subscription.unsubscribe(); };
  }, []);

  // ── Ambil Riwayat dari Cloud ──
  useEffect(() => {
    if (!user) return; // Kalau belum login, jangan lakukan apa-apa

    const fetchCloudHistory = async () => {
      const { data, error } = await supabase
        .from('user_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (data && !error) {
        // Ubah format data dari Supabase agar cocok dengan UI kita
        const cloudHistory = data.map((d: any) => ({
          id: d.id,
          timestamp: new Date(d.created_at).getTime(),
          text: d.text_content,
          fontId: d.config.fontId || "indie_flower",
          folioId: d.config.folioId || "",
          config: d.config,
          fontName: d.config.fontName || d.config.fontId,
          folioName: d.config.folioName || d.config.folioId,
          pageCount: d.config.pageCount || 1,
          textPreview: d.text_content.slice(0, 80) + (d.text_content.length > 80 ? "..." : ""),
          thumbnail: "" // Kita kosongkan thumbnail di cloud agar database tidak penuh
        }));

        setHistory(cloudHistory);
      }
    };

    fetchCloudHistory();
  }, [user]);

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Berhasil logout");
  };
  const [inputText, setInputText] = useState("");
  const [text, setText] = useState("");
  const [selectedFont, setSelectedFont] = useState("indie_flower");

  // ── Mencegah Lag saat mengetik (Debounce) ──
  useEffect(() => {
    const timer = setTimeout(() => {
      setText(inputText);
    }, 300); // Update perhitungan berat 300ms setelah berhenti mengetik
    return () => clearTimeout(timer);
  }, [inputText]);
  const [selectedFolio, setSelectedFolio] = useState("");
  const [selectedFolioEven, setSelectedFolioEven] = useState("");
  const [useDoubleFolio, setUseDoubleFolio] = useState(false);
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
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [fontDropdownOpen, setFontDropdownOpen] = useState(false);
  const [fullscreenPage, setFullscreenPage] = useState<GeneratedPage | null>(null);
  const [activeTab, setActiveTab] = useState<"result" | "history" | "presets">("result");
  const [presetName, setPresetName] = useState("");
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [configHistory, setConfigHistory] = useState<typeof DEFAULT_CONFIG[]>([DEFAULT_CONFIG]);
  const [configHistoryIndex, setConfigHistoryIndex] = useState(0);
  const [seed, setSeed] = useState(0);
  const [leftHanded, setLeftHanded] = useState(false);
  const [writeSpeed, setWriteSpeed] = useState(0.5);
  const [enableTypo, setEnableTypo] = useState(true);
  const [slantAngle, setSlantAngle] = useState(0);
  const [tiredMode, setTiredMode] = useState(false);
  const [showPageNumber, setShowPageNumber] = useState(false);
  const [pageNumberFormat, setPageNumberFormat] = useState('- {n} -');
  const [watermarkText, setWatermarkText] = useState('');
  const [enableDropCap, setEnableDropCap] = useState(false);
  const [totalStreamPages, setTotalStreamPages] = useState(0);
  const [streamedPages, setStreamedPages] = useState<GeneratedPage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId] = useState(() => `hw_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const ONBOARDING_SPOTLIGHT = [
    { selector: null, description: "welcome" },                    // Step 0: welcome, tidak highlight apapun
    { selector: "sidebar-settings", description: "sidebar" },     // Step 1: highlight sidebar
    { selector: "editor-panel", description: "editor" },          // Step 2: highlight editor
    { selector: "generate-btn", description: "generate" },        // Step 3: highlight tombol generate
  ];
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [showSeedCopied, setShowSeedCopied] = useState(false);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);
  const exportBtnRef = useRef<HTMLButtonElement>(null);
  const [exportDropdownPos, setExportDropdownPos] = useState<{ top: number; left: number; height: number; width: number } | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isUploadingFolio, setIsUploadingFolio] = useState(false);
  const [isAnalyzingFolio, setIsAnalyzingFolio] = useState(false);
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState(false);
  const [pendingHwConfig, setPendingHwConfig] = useState<any>(null);
  const hwPhotoRef = useRef<HTMLInputElement>(null);
  // ── CROPPER STATES ──
  const [cropImgSrc, setCropImgSrc] = useState<string>("");
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [livePreviewUrl, setLivePreviewUrl] = useState<string>("");
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  // ── Fitur AI & Voice ──
  const [isListening, setIsListening] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isAiDrafting, setIsAiDrafting] = useState(false);
  const [aiDraftResult, setAiDraftResult] = useState("");
  const recognitionRef = useRef<any>(null);
  const previewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPreviewHashRef = useRef<string>("");
  const cropImgRef = useRef<HTMLImageElement>(null);
  const swipeStartXRef = useRef<number | null>(null);
  const swipeStartYRef = useRef<number | null>(null);
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef<number>(100);
  const [mobileZoom, setMobileZoom] = useState(100);

  // Fungsi untuk mengekstrak area yang di-crop menjadi file gambar baru
  const getCroppedImg = async (image: HTMLImageElement, crop: PixelCrop): Promise<File> => {
    const canvas = document.createElement("canvas");
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    canvas.width = crop.width;
    canvas.height = crop.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No 2d context");

    ctx.drawImage(
      image,
      crop.x * scaleX, crop.y * scaleY, crop.width * scaleX, crop.height * scaleY,
      0, 0, crop.width, crop.height
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) { reject(new Error("Canvas empty")); return; }
        resolve(new File([blob], "cropped_handwriting.jpg", { type: "image/jpeg" }));
      }, "image/jpeg", 0.95);
    });
  };

  const fontDropdownRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => { setSeed(Date.now()); }, []);

  useEffect(() => {
    if (!selectedFolio || !selectedFont) return;
    if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
    previewDebounceRef.current = setTimeout(async () => {
      // Skip request jika parameter sama persis dengan preview sebelumnya
      const previewHash = `${selectedFont}-${selectedFolio}-${config.color}-${config.fontSize}-${config.wordSpacing}-${slantAngle}-${writeSpeed}`;
      if (previewHash === lastPreviewHashRef.current) return;
      lastPreviewHashRef.current = previewHash;

      setIsLoadingPreview(true);
      try {
        const res = await fetch(`${API_URL}/api/preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fontId: selectedFont,
            folioId: selectedFolio,
            text: text.slice(0, 60) || "Contoh tulisan tangan...",
            fontSize: config.fontSize,
            color: config.color,
            wordSpacing: config.wordSpacing,
            slantAngle,
            writeSpeed,
          }),
        });
        const data = await res.json();
        if (data.image) setLivePreviewUrl(data.image);
      } catch { }
      finally { setIsLoadingPreview(false); }
    }, 800);
  }, [selectedFont, selectedFolio, config.color, config.fontSize, config.wordSpacing, slantAngle, writeSpeed]);

  useEffect(() => {
    const savedText = localStorage.getItem("hw_draft_text");
    if (savedText) {
      // Auto-trim draft jika terlalu panjang (> 30.000 karakter) agar localStorage tidak penuh
      if (savedText.length > 30000) {
        const trimmed = savedText.slice(0, 30000);
        localStorage.setItem("hw_draft_text", trimmed);
        setText(trimmed);
        setInputText(trimmed);
        toast("Draft terlalu panjang, dipotong otomatis di 30.000 karakter.", { icon: "⚠️", duration: 4000 });
      } else {
        setText(savedText);
        setInputText(savedText);
      }
    }

    // Cleanup: hapus key localStorage yang sudah tidak terpakai
    const keysToClean = Object.keys(localStorage).filter(k =>
      k.startsWith("hw_") && !["hw_draft_text", "hw_history", "hw_presets", "hw_config", "hw_lastFont", "hw_lastFolio", "hw_lastSession", "hw_theme", "hw_onboarded"].includes(k)
    );
    keysToClean.forEach(k => localStorage.removeItem(k));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem("hw_draft_text", text);
    }, 1000);
    return () => clearTimeout(timer);
  }, [text]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.max(160, textareaRef.current.scrollHeight)}px`;
    }
  }, [text]);

  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;
      if (w >= 1280) {
        setSidebarOpen(true);
      } else if (w >= 768) {
        setSidebarOpen(false); // tablet: sidebar collapse by default biar editor lebih luas
      } else {
        setSidebarOpen(false);
      }
      if (w >= 1024) setMobileSidebarOpen(false);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${API_URL}/api/health`, { signal: AbortSignal.timeout(3000) });
        setBackendOnline(res.ok);
      } catch { setBackendOnline(false); }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [API_URL]);

  useEffect(() => {
    const lastSession = localStorage.getItem("hw_lastSession");
    if (!lastSession) return;
    fetch(`${API_URL}/api/cache/load/${lastSession}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.found && data.pages?.length) {
          setGeneratedPages(data.pages);
          setActiveTab("result");
          toast.success("✨ Hasil sebelumnya dipulihkan!", { duration: 3000 });
        }
      })
      .catch(() => { });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!localStorage.getItem("hw_onboarded")) {
      setTimeout(() => setShowOnboarding(true), 800);
    }
  }, []);

  const loadFonts = useCallback(async () => {
    setIsLoadingFonts(true);
    try {
      const res = await fetch(`${API_URL}/api/fonts`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setFonts(data.fonts);
    } catch {
      toast.error("Backend tidak terhubung. Jalankan python app.py dulu.");
    } finally { setIsLoadingFonts(false); }
  }, [API_URL]);

  const loadFolios = useCallback(async () => {
    setIsLoadingFolios(true);
    try {
      const res = await fetch(`${API_URL}/api/folios`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setFolios(data.folios);
      const lastFolio = localStorage.getItem("hw_lastFolio");
      if (lastFolio && data.folios.find((f: Folio) => f.id === lastFolio)) {
        setSelectedFolio(lastFolio);
      } else if (data.folios.length > 0) {
        setSelectedFolio(data.folios[0].id);
      }
    } catch { } finally { setIsLoadingFolios(false); }
  }, [API_URL]);

  useEffect(() => { loadFonts(); loadFolios(); }, [loadFonts, loadFolios]);

  useEffect(() => {
    const savedTheme = localStorage.getItem("hw_theme");
    if (savedTheme) {
      setIsDark(savedTheme === "dark");
    } else {
      setIsDark(window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    try { const h = localStorage.getItem("hw_history"); if (h) setHistory(JSON.parse(h)); } catch { }
    try { const p = localStorage.getItem("hw_presets"); if (p) setPresets(JSON.parse(p)); } catch { }
    try { const cfg = localStorage.getItem("hw_config"); if (cfg) setConfig(JSON.parse(cfg)); } catch { }
    const lastFont = localStorage.getItem("hw_lastFont");
    if (lastFont) setSelectedFont(lastFont);
  }, []);

  useEffect(() => { localStorage.setItem("hw_config", JSON.stringify(config)); }, [config]);
  useEffect(() => { localStorage.setItem("hw_lastFont", selectedFont); }, [selectedFont]);
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = "id-ID"; // Bahasa Indonesia

        recognitionRef.current.onresult = (event: any) => {
          let finalTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript + " ";
            }
          }
          if (finalTranscript) {
            setInputText((prev) => {
              const updated = prev + finalTranscript;
              setText(updated);  // Set dari dalam setter agar konsisten
              return updated;
            });
          }
        };

        recognitionRef.current.onerror = () => setIsListening(false);
        recognitionRef.current.onend = () => setIsListening(false);
      }
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
      setIsListening(true);
      toast.success("Mikrofon aktif! Silakan mulai bicara.", { icon: "🎙️" });
    }
  };

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (fontDropdownRef.current && !fontDropdownRef.current.contains(e.target as Node))
        setFontDropdownOpen(false);

    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    isDark ? root.classList.add("dark") : root.classList.remove("dark");
    localStorage.setItem("hw_theme", isDark ? "dark" : "light");
  }, [isDark]);

  // ── Computed ────────────────────────────────────────────────────────────────
  const estimatedLines = text.split("\n").reduce((acc, line) => {
    if (!line.trim()) return acc + 1; // baris kosong tetap dihitung
    // Lebar efektif = maxWidth dikurangi startX, dengan margin jitter rata-rata
    const effectiveWidth = config.maxWidth - config.startX - (config.marginJitter ?? 6);
    // Estimasi lebar per karakter berdasarkan fontSize (empiris: ~0.52x fontSize)
    const charWidth = config.fontSize * 0.52;
    const charsPerLine = Math.max(1, Math.floor(effectiveWidth / charWidth));
    return acc + Math.max(1, Math.ceil((line.length || 1) / charsPerLine));
  }, 0);

  // Baris per halaman: dari startY ke pageBottom dibagi lineHeight
  const linesPerPage = Math.max(1, Math.floor(
    (config.pageBottom - config.startY) / config.lineHeight
  ));
  const estimatedPages = Math.max(1, Math.ceil(estimatedLines / linesPerPage));
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const currentFont = fonts[selectedFont];
  const currentFolio = folios.find((f) => f.id === selectedFolio);
  const estimatedSeconds = estimatedPages * Math.max(2, Math.min(8, Math.ceil(wordCount / estimatedPages / 20)));
  const estimatedTimeLabel = estimatedSeconds < 60
    ? `~${estimatedSeconds}s`
    : `~${Math.ceil(estimatedSeconds / 60)}m`;

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const compressThumbnail = (base64: string, maxWidth = 120, quality = 0.4): Promise<string> => {
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

  const safeSetHistory = (items: HistoryItem[]) => {
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

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }) + " " +
      d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  };

  // ── Generate ─────────────────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!text.trim()) { toast.error("Masukkan teks dulu!"); return; }
    if (!selectedFolio) { toast.error("Pilih folio dulu!"); return; }

    setIsGenerating(true);
    setIsStreaming(true);
    setGeneratedPages([]);

    setStreamedPages([]);
    setGenerateProgress(0);
    setActiveTab("result");
    setMobileSidebarOpen(false);

    const body = JSON.stringify({
      text, folioId: selectedFolio,
      folioEvenId: useDoubleFolio ? selectedFolioEven : '',
      fontId: selectedFont,
      config: { ...config, leftHanded, writeSpeed, enableTypo, slantAngle, tiredMode, showPageNumber, pageNumberFormat, marginJitter: config.marginJitter ?? 6, watermarkText, enableDropCap },
      seed
    });

    const tid = toast.loading("Menulis halaman pertama...");
    try {
      // Retry otomatis SSE — maksimal 3 kali jika koneksi terputus
      const MAX_RETRY = 3;
      let retryCount = 0;
      let res: Response | null = null;

      while (retryCount < MAX_RETRY) {
        try {
          res = await fetch(`${API_URL}/api/generate/stream`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
          });
          if (res.ok && res.body) break; // sukses, keluar dari loop
          throw new Error("Stream gagal");
        } catch (err) {
          retryCount++;
          if (retryCount >= MAX_RETRY) throw err;
          toast(`Koneksi terputus, mencoba ulang (${retryCount}/${MAX_RETRY})...`, { icon: "🔄", duration: 2000 });
          await new Promise(r => setTimeout(r, 1500 * retryCount)); // backoff
        }
      }

      if (!res || !res.body) throw new Error("Stream gagal setelah beberapa percobaan");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let totalPages = 0;
      const collectedPages: GeneratedPage[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const msg = JSON.parse(line.slice(6));
            if (msg.type === "total") {
              totalPages = msg.totalPages;
              setTotalStreamPages(msg.totalPages);
              toast.loading(`Menulis ${totalPages} halaman...`, { id: tid });
            }
            if (msg.type === "page") {
              const newPage: GeneratedPage = { page: msg.page, image: msg.image };
              collectedPages.push(newPage);
              setStreamedPages([...collectedPages]);
              setGenerateProgress(Math.round((msg.page / Math.max(1, totalPages)) * 100));
              if (msg.page === 1) {
                toast.success("✨ Halaman pertama selesai!", { id: tid, duration: 2000 });
                setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 200);
              }
            }
            if (msg.type === "done") {
              setGeneratedPages(collectedPages);
              setActivePageIndex(0);
              setStreamedPages([]);
              setGenerateProgress(100);
              toast.success(`✅ ${collectedPages.length} halaman selesai!`, { duration: 3000 });

              try {
                await fetch(`${API_URL}/api/cache/save`, {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ sessionId, pages: collectedPages }),
                });
                localStorage.setItem("hw_lastSession", sessionId);
              } catch { }
              const rawThumb = collectedPages[0]?.image || "";
              const thumbnail = rawThumb ? await compressThumbnail(rawThumb) : "";
              const item: HistoryItem = {
                id: Date.now().toString(), timestamp: Date.now(), text,
                fontId: selectedFont, folioId: selectedFolio, config: { ...config },
                fontName: currentFont?.name || selectedFont, folioName: currentFolio?.name || selectedFolio,
                pageCount: collectedPages.length, textPreview: text.slice(0, 80) + (text.length > 80 ? "..." : ""),
                thumbnail,
              };
              const newHistory = [item, ...history].slice(0, 10);
              setHistory(newHistory);
              safeSetHistory(newHistory);
              // TAHAP 2: SIMPAN KE CLOUD JIKA USER LOGIN
              if (user && supabaseConfigured) {
                try {
                  await supabase.from('user_history').insert([{
                    user_id: user.id,
                    text_content: text,
                    config: {
                      ...config,
                      fontId: selectedFont,
                      folioId: selectedFolio,
                      fontName: currentFont?.name || selectedFont,
                      folioName: currentFolio?.name || selectedFolio,
                      pageCount: collectedPages.length
                    }
                  }]);
                } catch (err) {
                  console.error("Gagal simpan ke cloud", err);
                }
              }
            }
          } catch (parseErr) {
            console.warn("[SSE] Parse error, skipping line:", line, parseErr);
          }
        }
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal generate", { id: tid, duration: 4000 });
    } finally {
      setIsGenerating(false);
      setIsStreaming(false);

      setTimeout(() => setGenerateProgress(0), 1500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, selectedFolio, selectedFont, config, seed, useDoubleFolio, selectedFolioEven,
    leftHanded, writeSpeed, enableTypo, slantAngle, tiredMode, showPageNumber,
    pageNumberFormat, watermarkText, history, currentFont, currentFolio, sessionId, API_URL]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setFullscreenPage(null);
        setMobileSidebarOpen(false);
        return;
      }
      if (e.key === "ArrowRight" && !isGenerating && generatedPages.length > 0) {
        e.preventDefault();
        setActivePageIndex(i => Math.min(generatedPages.length - 1, i + 1));
        return;
      }
      if (e.key === "ArrowLeft" && !isGenerating && generatedPages.length > 0) {
        e.preventDefault();
        setActivePageIndex(i => Math.max(0, i - 1));
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (!isGenerating && text.trim() && selectedFolio) handleGenerate();
        return;
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [isGenerating, text, selectedFolio, handleGenerate]);

  // ── Downloads ────────────────────────────────────────────────────────────────
  const handleSharePage = async (page: GeneratedPage) => {
    if (!navigator.share || !navigator.canShare) {
      handleDownloadSingle(page);
      return;
    }
    try {
      const blob = await (await fetch(page.image)).blob();
      const file = new File([blob], `tulisan_hal_${page.page}.jpg`, { type: "image/jpeg" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Hasil Tulisan Tangan AI",
          text: "Dibuat dengan HandWrite AI",
        });
      } else {
        handleDownloadSingle(page);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error("Gagal membagikan gambar");
    }
  };

  const handleLoadDemo = () => {
    setInputText(DEMO_TEXT);
    setText(DEMO_TEXT);
    if (Object.keys(fonts).length > 0) {
      const preferredFont = ["kalam", "indie_flower", "caveat"].find(f => fonts[f]);
      if (preferredFont) setSelectedFont(preferredFont);
    }
    if (folios.length > 0 && !selectedFolio) {
      handleFolioChange(folios[0].id);
    }
    toast.success("Teks demo dimuat! Klik Generate untuk mulai.", { duration: 3000 });
  };

  const handleDownloadSingle = (page: GeneratedPage) => {
    const a = document.createElement("a");
    a.href = page.image; a.download = `tugas_halaman_${page.page}.jpg`; a.click();
    toast.success(`Halaman ${page.page} didownload!`);
  };

  const handleCopyImageToClipboard = async (page: GeneratedPage) => {
    try {
      const blob = await (await fetch(page.image)).blob();
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob })
      ]);
      toast.success(`Halaman ${page.page} dicopy ke clipboard!`);
    } catch {
      toast.error("Browser tidak support copy gambar langsung. Coba download dulu.");
    }
  };

  const handleDownloadAllPng = async () => {
    if (!generatedPages.length) return;
    toast.loading(`Mendownload ${generatedPages.length} halaman...`, { id: 'dl-all' });
    for (let i = 0; i < generatedPages.length; i++) {
      const page = generatedPages[i];
      await new Promise(resolve => setTimeout(resolve, 300));
      const a = document.createElement("a");
      a.href = page.image;
      a.download = `tugas_halaman_${page.page}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    toast.success(`${generatedPages.length} halaman berhasil didownload!`, { id: 'dl-all' });
  };

  const handleDownloadZip = async () => {
    if (!generatedPages.length) return;
    setIsDownloadingZip(true);
    const tid = toast.loading("Membuat ZIP di server...");
    try {
      const res = await fetch(`${API_URL}/api/download/zip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pages: generatedPages }),
      });
      if (!res.ok) throw new Error("Server gagal buat ZIP");
      const blob = await res.blob();
      saveAs(blob, "Tugas_Handwriting.zip");
      toast.success("ZIP berhasil didownload!", { id: tid });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal membuat ZIP", { id: tid });
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const handleExportPdf = async () => {
    if (!generatedPages.length) return;
    setIsExportingPdf(true);
    const tid = toast.loading("Merakit PDF...");
    try {
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      for (let i = 0; i < generatedPages.length; i++) {
        if (i > 0) pdf.addPage();
        pdf.addImage(generatedPages[i].image, "JPEG", 0, 0, pdfWidth, pdfHeight);
      }
      pdf.save("Tugas_Handwriting_AI.pdf");
      toast.success("PDF berhasil didownload!", { id: tid });
    } catch { toast.error("Gagal membuat PDF", { id: tid }); }
    finally { setIsExportingPdf(false); }
  };

  const handleExportDocx = async () => {
    if (!generatedPages.length) return;
    setIsExportingDocx(true);
    const tid = toast.loading("Membuat Word document...");
    try {
      const children = [];
      for (const page of generatedPages) {
        const base64 = page.image.split(",")[1];
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        children.push(new Paragraph({
          children: [new ImageRun({ data: bytes, transformation: { width: 595, height: 842 }, type: "jpg" })],
          spacing: { after: 0 },
        }));
      }
      saveAs(await Packer.toBlob(new Document({ sections: [{ children }] })), "Tugas_Handwriting_AI.docx");
      toast.success("Word berhasil didownload!", { id: tid });
    } catch (e) {
      console.error(e); toast.error("Gagal membuat Word", { id: tid });
    } finally { setIsExportingDocx(false); }
  };

  // ── Folio & Preset ────────────────────────────────────────────────────────────
  const handleFolioChange = (id: string) => { setSelectedFolio(id); localStorage.setItem("hw_lastFolio", id); };
  const handleFolioChangeWithAnalyze = async (id: string) => {
    handleFolioChange(id);
    setIsAnalyzingFolio(true);
    try {
      const res = await fetch(`${API_URL}/api/folio/analyze/${encodeURIComponent(id)}`);
      const data = await res.json();
      if (data.success && data.config) {
        setConfig(prev => ({ ...prev, ...data.config }));

        const meta = data.meta || {};
        const confidence = meta.confidence ?? 0;
        const lineColor: Record<string, string> = {
          red: "bergaris merah 🔴",
          blue: "bergaris biru 🔵",
          light: "garis tipis ⬜",
          gray: "bergaris abu-abu",
        };
        const paperType: Record<string, string> = {
          grid: "kertas grid",
          lined: "kertas bergaris",
        };

        const colorLabel = lineColor[meta.lineColor] || "garis terdeteksi";
        const paperLabel = paperType[meta.paperType] || "kertas";
        const linesLabel = meta.detectedLines ? `${meta.detectedLines} baris` : "";

        toast.success(
          `✨ Kalibrasi selesai! ${paperLabel} ${colorLabel} — ${linesLabel} — Akurasi ${confidence}%`,
          { duration: 4000 }
        );
      } else {
        toast("Garis folio tidak terdeteksi, gunakan Advanced Config manual.", {
          icon: "⚠️", duration: 3000
        });
      }
    } catch { } finally {
      setIsAnalyzingFolio(false);
    }
  };

  const savePreset = () => {
    const name = presetName.trim() || `Preset ${presets.length + 1}`;
    const newPreset: SavedPreset = { id: Date.now().toString(), name, config: { ...config }, fontId: selectedFont, folioId: selectedFolio, savedAt: Date.now() };
    const newPresets = [newPreset, ...presets].slice(0, 10);
    setPresets(newPresets);
    localStorage.setItem("hw_presets", JSON.stringify(newPresets));
    setPresetName("");
    toast.success(`Preset "${name}" disimpan!`);
  };

  const loadPreset = (preset: SavedPreset) => {
    setConfig(preset.config); setSelectedFont(preset.fontId);
    if (folios.find((f) => f.id === preset.folioId)) handleFolioChange(preset.folioId);
    toast.success(`Preset "${preset.name}" dimuat!`); setActiveTab("result");
  };

  const deletePreset = (id: string) => {
    const newP = presets.filter((p) => p.id !== id);
    setPresets(newP); localStorage.setItem("hw_presets", JSON.stringify(newP));
  };

  const deleteHistory = async (id: string) => {
    // 1. Hapus dari UI lokal
    const newH = history.filter((h) => h.id !== id);
    setHistory(newH);
    localStorage.setItem("hw_history", JSON.stringify(newH));

    // 2. Hapus dari Cloud Supabase (jika user sedang login)
    if (user) {
      try {
        await supabase.from('user_history').delete().eq('id', id);
      } catch (err) {
        console.error("Gagal hapus dari cloud", err);
      }
    }
  };

  const restoreHistory = (item: HistoryItem) => {
    setInputText(item.text); setText(item.text); setSelectedFont(item.fontId); handleFolioChange(item.folioId); setConfig(item.config);
    toast.success("Teks & Pengaturan dipulihkan! Silakan klik Generate.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const updateConfig = useCallback((newConfig: typeof DEFAULT_CONFIG) => {
    setConfig(newConfig);
    setConfigHistory(prev => {
      const trimmed = prev.slice(0, configHistoryIndex + 1);
      return [...trimmed, newConfig].slice(-20);
    });
    setConfigHistoryIndex(prev => Math.min(prev + 1, 19));
  }, [configHistoryIndex]);

  const undoConfig = useCallback(() => {
    if (configHistoryIndex <= 0) return;
    const newIndex = configHistoryIndex - 1;
    setConfigHistoryIndex(newIndex);
    setConfig(configHistory[newIndex]);
  }, [configHistoryIndex, configHistory]);

  const redoConfig = useCallback(() => {
    if (configHistoryIndex >= configHistory.length - 1) return;
    const newIndex = configHistoryIndex + 1;
    setConfigHistoryIndex(newIndex);
    setConfig(configHistory[newIndex]);
  }, [configHistoryIndex, configHistory]);

  const handleCopySeed = () => {
    navigator.clipboard.writeText(String(seed)).then(() => {
      setShowSeedCopied(true); setTimeout(() => setShowSeedCopied(false), 2000);
    });
  };

  const handleAnalyzeHandwriting = async (file: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File max 10MB!");
      return;
    }

    setIsAnalyzingPhoto(true);
    const tid = toast.loading("Menganalisis tulisan tanganmu...");

    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch(`${API_URL}/api/analyze-handwriting`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!data.success) throw new Error(data.error);

      setPendingHwConfig(data.config);
      toast.success("Analisis selesai!", { id: tid });
    } catch (e: unknown) {
      toast.error(
        e instanceof Error ? e.message : "Analisis gagal",
        { id: tid }
      );
    } finally {
      setIsAnalyzingPhoto(false);
    }
  };

  // ── Dropzone ─────────────────────────────────────────────────────────────────
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
        handleFolioChangeWithAnalyze(data.filename);
      } else throw new Error(data.error);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Upload gagal", { id: tid });
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "image/jpeg": [".jpeg", ".jpg"], "image/png": [".png"] },
    onDrop,
  });

  // ── Theme tokens ──────────────────────────────────────────────────────────────
  const D = isDark;
  const c = useMemo(() => ({
    page: D
      ? "bg-[#09090b]"
      : "bg-gradient-to-br from-violet-200 via-indigo-100 to-purple-200",

    header: D
      ? "bg-[#0d0d14]/90 border-[#ffffff0d] backdrop-blur-2xl shadow-[0_1px_0_rgba(255,255,255,0.04)]"
      : "bg-gradient-to-r from-violet-50/95 via-white/95 to-indigo-50/95 border-violet-300/80 backdrop-blur-2xl shadow-[0_1px_0_rgba(139,92,246,0.18)]",

    sidebar: D
      ? "bg-[#0d0d14]/85 border-[#ffffff0a] backdrop-blur-xl shadow-[4px_0_24px_rgba(139,92,246,0.08)]"
      : "bg-gradient-to-b from-violet-100 via-indigo-50 to-purple-100 border-violet-300/80 backdrop-blur-xl shadow-[4px_0_24px_rgba(139,92,246,0.12)]",

    card: D
      ? "bg-[#13131f] border-[#ffffff0d] shadow-[0_2px_16px_rgba(0,0,0,0.4)] backdrop-blur-sm transition-colors"
      : "bg-white/90 border-violet-200 shadow-[0_4px_20px_rgba(139,92,246,0.18)] backdrop-blur-sm transition-colors",

    cardHover: D
      ? "hover:border-violet-500/30 hover:shadow-[0_4px_24px_rgba(139,92,246,0.15)] transition-all duration-300"
      : "hover:border-violet-300 hover:shadow-[0_4px_24px_rgba(139,92,246,0.15)] transition-all duration-300",

    input: D
      ? "bg-[#0a0a12] border-[#ffffff0f] text-white placeholder-white/20 min-h-[40px] focus:ring-2 focus:ring-violet-500/25 focus:border-violet-500/60"
      : "bg-white border-violet-200 text-gray-900 placeholder-violet-300/70 min-h-[40px] focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400",

    tp: D ? "text-white" : "text-gray-900",
    ts: D ? "text-[#a1a1aa]" : "text-violet-500",
    tm: D ? "text-[#d4d4d8]" : "text-gray-700",

    pill: D
      ? "bg-[#ffffff06]"
      : "bg-violet-100/80",

    pillBorder: D
      ? "border-[#ffffff0a]"
      : "border-violet-300",

    divider: D
      ? "border-[#ffffff08]"
      : "border-violet-200/80",

    btn: D
      ? "bg-[#ffffff08] hover:bg-[#ffffff12] text-[#d4d4d8] border border-[#ffffff0f] shadow-sm hover:scale-[1.02] active:scale-95 transition-all duration-200"
      : "bg-white hover:bg-violet-50 text-violet-700 border border-violet-300 shadow-sm hover:border-violet-400 hover:scale-[1.02] active:scale-95 transition-all duration-200",

    btnActive: D
      ? "bg-white text-black shadow-md hover:scale-[1.02] active:scale-95 transition-all duration-200"
      : "bg-violet-600 text-white shadow-md shadow-violet-500/30 hover:scale-[1.02] active:scale-95 transition-all duration-200",

    rowHover: D
      ? "hover:bg-[#ffffff06]"
      : "hover:bg-violet-50",

    dropdown: D
      ? "bg-[#13131f]/95 border-[#ffffff12] shadow-2xl backdrop-blur-xl"
      : "bg-white/95 border-violet-200 shadow-2xl shadow-violet-500/10 backdrop-blur-xl",

    accent: "from-violet-600 to-indigo-500",

    glow: D
      ? "shadow-violet-500/20"
      : "shadow-violet-500/25",

    label: D ? "text-[#a1a1aa]" : "text-violet-600",

    folioRing: "ring-2 ring-violet-500 shadow-lg shadow-violet-500/25",

    folioUnsel: D
      ? "ring-1 ring-[#ffffff0f] hover:ring-[#ffffff1a]"
      : "ring-1 ring-violet-100 hover:ring-violet-300",

    tag: D
      ? "bg-[#ffffff08] border border-[#ffffff0f] text-[#a1a1aa] shadow-sm"
      : "bg-violet-50 border border-violet-200 text-violet-600 shadow-sm",
  }), [D]);

  // ── Sidebar content ─────────────────────────────────────────────────────────
  const renderSidebarContent = () => (
    <div className="py-3 px-3 space-y-2.5">

      <SidebarSection title="Dari Tulisan Tanganmu" isDark={D} defaultOpen={false} badge="BARU">
        <p className={`text-[11px] leading-relaxed ${c.ts}`}>
          Upload foto tulisan tanganmu, AI akan otomatis menyesuaikan ukuran huruf,
          spasi, dan kemiringan agar hasil lebih mirip tulisanmu.
        </p>

        <input
          ref={hwPhotoRef}
          type="file"
          accept="image/jpeg,image/png,image/jpg"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              // Baca file menjadi Data URL untuk ditampilkan di cropper
              const reader = new FileReader();
              reader.addEventListener("load", () => {
                setCropImgSrc(reader.result?.toString() || "");
                setIsCropping(true);
              });
              reader.readAsDataURL(file);
            }
            e.target.value = "";
          }}
        />

        <button
          onClick={() => hwPhotoRef.current?.click()}
          disabled={isAnalyzingPhoto}
          className={`w-full flex items-center justify-center gap-2 px-3 py-3 rounded-xl border-2 border-dashed text-sm font-medium transition-all ${isAnalyzingPhoto
            ? "opacity-50 cursor-not-allowed border-gray-300 dark:border-white/10"
            : D
              ? "border-violet-500/40 text-violet-400 hover:border-violet-500/70 hover:bg-violet-500/8"
              : "border-violet-400 text-violet-600 hover:border-violet-500 hover:bg-violet-50"
            }`}>
          {isAnalyzingPhoto
            ? <><Loader2 className="w-4 h-4 animate-spin" />Menganalisis...</>
            : <><ImageIcon className="w-4 h-4" />Upload Foto Tulisan Tangan</>
          }
        </button>

        <div className={`flex items-start gap-2 px-3 py-2.5 rounded-lg border ${c.pillBorder} ${c.pill}`}>
          <span className="text-base flex-shrink-0">💡</span>
          <p className={`text-[10px] leading-relaxed ${c.ts}`}>
            Tips: foto di tempat terang, tulisan di kertas putih polos,
            minimal 3-4 baris agar analisis lebih akurat.
          </p>
        </div>
      </SidebarSection>

      <SidebarSection title="Font Tulisan" isDark={D} className="relative z-[60] !overflow-visible">
        <div ref={fontDropdownRef} className="relative z-50">
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
            ) : (
              <span className={c.ts}>Pilih font...</span>
            )}
            <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 ${c.ts} transition-transform ${fontDropdownOpen ? "rotate-180" : ""}`} />
          </button>

          {fontDropdownOpen && Object.keys(fonts).length > 0 && (
            <div className={`absolute top-full left-0 right-0 mt-1 rounded-xl border z-50 overflow-hidden ${c.dropdown}`}>
              <div className="max-h-52 overflow-y-auto py-1">
                {Object.entries(fonts).map(([key, font]) => (
                  <button key={key}
                    onClick={() => { setSelectedFont(key); setFontDropdownOpen(false); }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 transition-colors ${c.rowHover} ${selectedFont === key ? D ? "bg-violet-500/12" : "bg-violet-50" : ""}`}
                  >
                    <div className="flex flex-col gap-0.5 text-left">
                      <span className={`text-[13px] font-medium ${c.tp}`} style={{ fontFamily: FONT_FAMILY_MAP[font.name] || font.name }}>
                        {font.name}
                      </span>
                      <span className={`text-[12px] ${c.ts}`} style={{ fontFamily: FONT_FAMILY_MAP[font.name] || font.name }}>
                        Halo, ini contoh tulisanku hari ini.
                      </span>
                    </div>
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
      </SidebarSection>

      <div className="flex items-center gap-2 px-1 pt-1">
        <div className={`flex-1 h-px ${D ? "bg-gradient-to-r from-transparent to-violet-900/40" : "bg-gradient-to-r from-transparent to-violet-200"}`} />
        <span className={`text-[9px] uppercase tracking-[0.15em] font-bold px-2 py-0.5 rounded-full ${D ? "bg-violet-950/50 text-violet-400/70 border border-violet-900/40" : "bg-violet-100 text-violet-400 border border-violet-200"}`}>Gaya</span>
        <div className={`flex-1 h-px ${D ? "bg-gradient-to-l from-transparent to-violet-900/40" : "bg-gradient-to-l from-transparent to-violet-200"}`} />
      </div>

      <SidebarSection title="Gaya Tulisan" isDark={D}>
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className={`text-[10.5px] font-semibold uppercase tracking-widest ${c.label}`}>Kecepatan</p>
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-lg border ${D ? "bg-orange-500/15 text-orange-400 border-orange-500/20" : "bg-orange-50 text-orange-700 border-orange-200"}`}>
              {writeSpeed < 0.35 ? "🐢 Lambat" : writeSpeed < 0.65 ? "✍️ Normal" : "⚡ Cepat"}
            </span>
          </div>
          <input type="range" min="0" max="1" step="0.05" value={writeSpeed}
            onChange={(e) => setWriteSpeed(Number(e.target.value))}
            className="w-full cursor-pointer"
            style={{
              WebkitAppearance: "none", height: "5px", borderRadius: "99px",
              background: `linear-gradient(to right, ${D ? "#fb923c" : "#ea580c"} 0%, ${D ? "#fb923c" : "#ea580c"} ${writeSpeed * 100}%, ${D ? "rgba(255,255,255,0.12)" : "#d1d5db"} ${writeSpeed * 100}%, ${D ? "rgba(255,255,255,0.12)" : "#d1d5db"} 100%)`
            }}
          />
          <div className={`flex justify-between text-[10px] mt-1.5 ${c.ts}`}>
            <span>🐢 Rapi</span><span>⚡ Cepat</span>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className={`text-[10.5px] font-semibold uppercase tracking-widest ${c.label}`}>Kemiringan</p>
            <span className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-lg border ${D ? "bg-indigo-500/15 text-indigo-400 border-indigo-500/20" : "bg-indigo-50 text-indigo-700 border-indigo-200"}`}>
              {slantAngle > 0 ? `+${slantAngle}°` : `${slantAngle}°`}
            </span>
          </div>
          <input type="range" min="-15" max="15" step="1" value={slantAngle}
            onChange={(e) => setSlantAngle(Number(e.target.value))}
            className="w-full cursor-pointer"
            style={{
              WebkitAppearance: "none", appearance: "none", height: "5px", borderRadius: "99px",
              background: `linear-gradient(to right, ${D ? "rgba(255,255,255,0.12)" : "#d1d5db"} 0%, ${D ? "rgba(255,255,255,0.12)" : "#d1d5db"} ${((slantAngle + 15) / 30) * 100}%, ${D ? "#818cf8" : "#6366f1"} ${((slantAngle + 15) / 30) * 100}%, ${D ? "#818cf8" : "#6366f1"} 100%)`
            }}
          />
          <div className={`flex justify-between text-[10px] mt-1.5 ${c.ts}`}>
            <span>← Kiri</span>
            <button onClick={() => setSlantAngle(0)} className={`text-[10px] px-1.5 rounded ${slantAngle === 0 ? "text-indigo-500 font-semibold" : c.ts}`}>Tegak</button>
            <span>Kanan →</span>
          </div>
        </div>

        <div>
          <p className={`text-[10.5px] font-semibold uppercase tracking-widest mb-2 ${c.label}`}>Mode Tangan</p>
          <div className="grid grid-cols-2 gap-2">
            {[{ label: "✍️ Kanan", val: false }, { label: "🤚 Kiri", val: true }].map((m) => (
              <button key={String(m.val)} onClick={() => setLeftHanded(m.val)}
                className={`py-2.5 rounded-xl border-2 text-[12px] font-medium transition-all ${leftHanded === m.val
                  ? D ? "border-violet-500/70 bg-violet-500/12 text-violet-300" : "border-violet-500 bg-violet-50 text-violet-700"
                  : D ? "border-[#ffffff08] text-white/50 hover:border-[#ffffff18]" : "border-[#d1d5db] text-gray-500 hover:border-[#9ca3af]"
                  }`}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </SidebarSection>

      <div className="flex items-center gap-2 px-1 pt-1">
        <div className={`flex-1 h-px ${D ? "bg-white/5" : "bg-gray-200"}`} />
        <span className={`text-[9px] uppercase tracking-widest font-semibold ${c.ts}`}>Efek</span>
        <div className={`flex-1 h-px ${D ? "bg-white/5" : "bg-gray-200"}`} />
      </div>

      <SidebarSection title="Efek Realistis" isDark={D}>
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className={`text-[10.5px] font-semibold uppercase tracking-widest ${c.label}`}>Margin Jitter</p>
            <span className={`text-[11px] font-mono px-2 py-0.5 rounded-lg border ${D ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
              {config.marginJitter ?? 6}px
            </span>
          </div>
          <input type="range" min="0" max="20" step="1"
            value={config.marginJitter ?? 6}
            onChange={(e) => updateConfig({ ...config, marginJitter: Number(e.target.value) })}
            className="w-full cursor-pointer" />
          <div className={`flex justify-between text-[10px] mt-1.5 ${c.ts}`}>
            <span>Rata kiri</span><span>Bergelombang</span>
          </div>
        </div>

        <div className="flex items-center justify-between mt-4">
          <div>
            <p className={`text-[10.5px] font-semibold uppercase tracking-widest ${c.label}`}>Efek Typo</p>
            <p className={`text-[10px] mt-0.5 ${c.ts}`}>{enableTypo ? "Salah + coretan sesekali" : "Bersih tanpa coretan"}</p>
          </div>
          <ToggleSwitch value={enableTypo} onChange={setEnableTypo}
            colorClass={D ? "bg-violet-500 border-violet-400" : "bg-violet-600 border-violet-500"} isDark={D} />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className={`text-[10.5px] font-semibold uppercase tracking-widest ${c.label}`}>Mode Lelah</p>
            <p className={`text-[10px] mt-0.5 ${c.ts}`}>{tiredMode ? "Makin acak di halaman akhir" : "Konsisten dari awal"}</p>
          </div>
          <ToggleSwitch value={tiredMode} onChange={setTiredMode}
            colorClass="bg-orange-500 border-orange-400" isDark={D} />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-[10.5px] font-semibold uppercase tracking-widest ${c.label}`}>Nomor Halaman</p>
              <p className={`text-[10px] mt-0.5 ${c.ts}`}>{showPageNumber ? "Aktif" : "Tidak ada nomor"}</p>
            </div>
            <ToggleSwitch value={showPageNumber} onChange={setShowPageNumber}
              colorClass="bg-emerald-500 border-emerald-400" isDark={D} />
          </div>
          {showPageNumber && (
            <div className="grid grid-cols-3 gap-1 mt-2">
              {[{ label: "- 1 -", val: "- {n} -" }, { label: "1", val: "{n}" }, { label: "Hal. 1", val: "Hal. {n}" }].map((f) => (
                <button key={f.val} onClick={() => setPageNumberFormat(f.val)}
                  className={`py-1.5 rounded-lg text-[11px] font-medium transition-all border ${pageNumberFormat === f.val
                    ? D ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-emerald-600 text-white border-emerald-600"
                    : D ? "bg-white/4 text-white/50 border-[#ffffff08] hover:border-[#ffffff15]" : "bg-white text-gray-600 border-[#d1d5db] hover:bg-gray-50"
                    }`}>
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Toggle Drop Cap — ditambahkan setelah Nomor Halaman */}
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-[10.5px] font-semibold uppercase tracking-widest ${c.label}`}>Drop Cap</p>
            <p className={`text-[10px] mt-0.5 ${c.ts}`}>{enableDropCap ? "Huruf pertama paragraf lebih besar" : "Ukuran huruf seragam"}</p>
          </div>
          <ToggleSwitch value={enableDropCap} onChange={setEnableDropCap}
            colorClass="bg-pink-500 border-pink-400" isDark={D} />
        </div>
      </SidebarSection>

      <SidebarSection title="Watermark" isDark={D} defaultOpen={false}>
        <p className={`text-[11px] leading-relaxed ${c.ts}`}>
          Teks watermark diagonal tipis di setiap halaman. Berguna untuk nama atau kelas.
        </p>
        <div className="relative">
          <input
            type="text"
            placeholder="Contoh: Nama Siswa · Kelas X"
            value={watermarkText}
            onChange={(e) => setWatermarkText(e.target.value)}
            maxLength={40}
            className={`w-full px-3 py-2.5 text-xs border rounded-xl transition-colors pr-10 ${c.input}`}
          />
          {watermarkText && (
            <button
              onClick={() => setWatermarkText('')}
              className={`absolute right-2.5 top-1/2 -translate-y-1/2 ${c.ts} hover:text-red-400 transition-colors`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {watermarkText && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${c.pillBorder} ${c.pill}`}>
            <span className="text-base flex-shrink-0">✅</span>
            <p className={`text-[10px] leading-relaxed ${c.ts}`}>
              Watermark aktif · Tampil sangat tipis di halaman
            </p>
          </div>
        )}
      </SidebarSection>

      <SidebarSection title="Spasi & Warna" isDark={D}>
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className={`text-[10.5px] font-semibold uppercase tracking-widest ${c.label}`}>Spasi Kata</p>
            <span className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-lg border ${D ? "bg-sky-500/15 text-sky-400 border-sky-500/20" : "bg-sky-50 text-sky-700 border-sky-200"}`}>
              {config.wordSpacing >= 0 ? `+${config.wordSpacing}` : config.wordSpacing}px
            </span>
          </div>
          <input type="range" min="-10" max="40" step="1" value={config.wordSpacing}
            onChange={(e) => updateConfig({ ...config, wordSpacing: Number(e.target.value) })}
            className="w-full cursor-pointer"
            style={{
              WebkitAppearance: "none", height: "5px", borderRadius: "99px",
              background: `linear-gradient(to right, ${D ? "#38bdf8" : "#0ea5e9"} 0%, ${D ? "#38bdf8" : "#0ea5e9"} ${((config.wordSpacing + 10) / 50) * 100}%, ${D ? "rgba(255,255,255,0.12)" : "#d1d5db"} ${((config.wordSpacing + 10) / 50) * 100}%, ${D ? "rgba(255,255,255,0.12)" : "#d1d5db"} 100%)`
            }}
          />
          <div className="grid grid-cols-3 gap-1 mt-2">
            {[{ l: "Rapat", v: -5 }, { l: "Normal", v: 8 }, { l: "Lebar", v: 25 }].map((p) => (
              <button key={p.v} onClick={() => updateConfig({ ...config, wordSpacing: p.v })}
                className={`py-1.5 rounded-lg text-[11px] font-medium transition-all border ${config.wordSpacing === p.v
                  ? D ? "bg-sky-500/20 text-sky-400 border-sky-500/30" : "bg-sky-600 text-white border-sky-600"
                  : D ? "bg-white/4 text-white/50 border-[#ffffff08] hover:border-[#ffffff15]" : "bg-white text-gray-600 border-[#d1d5db] hover:bg-gray-50"
                  }`}>
                {p.l}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className={`text-[10.5px] font-semibold uppercase tracking-widest mb-2 ${c.label}`}>Warna Tinta</p>
          <div className="grid grid-cols-3 gap-1.5 mb-2.5">
            {INK_PRESETS.map((p) => (
              <button key={p.color} onClick={() => updateConfig({ ...config, color: p.color })}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border-2 transition-all text-[11px] font-medium ${config.color === p.color
                  ? D ? "border-violet-500/70 bg-violet-500/12 text-white" : "border-violet-500 bg-violet-50 text-violet-700"
                  : D ? "border-[#ffffff08] text-white/55 hover:border-[#ffffff18]" : "border-[#d1d5db] text-gray-600 hover:border-[#9ca3af] hover:bg-gray-50"
                  }`}>
                <div className="w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-black/10" style={{ backgroundColor: p.color }} />
                <span className="truncate">{p.label}</span>
              </button>
            ))}
          </div>
          <div className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border ${c.pillBorder} ${c.pill}`}>
            <input type="color" value={config.color} onChange={(e) => updateConfig({ ...config, color: e.target.value })}
              className="w-8 h-8 rounded-lg cursor-pointer flex-shrink-0" />
            <div>
              <p className={`text-[11px] font-medium ${c.tm}`}>Custom warna</p>
              <p className={`text-[10px] font-mono ${c.ts}`}>{config.color.toUpperCase()}</p>
            </div>
          </div>
        </div>
      </SidebarSection>

      <div className="flex items-center gap-2 px-1 pt-1">
        <div className={`flex-1 h-px ${D ? "bg-white/5" : "bg-gray-200"}`} />
        <span className={`text-[9px] uppercase tracking-widest font-semibold ${c.ts}`}>Kertas</span>
        <div className={`flex-1 h-px ${D ? "bg-white/5" : "bg-gray-200"}`} />
      </div>

      <SidebarSection title="Template Folio" isDark={D}>
        <div {...getRootProps()}
          className={`p-4 border-2 border-dashed rounded-xl text-center cursor-pointer transition-all ${isAnalyzingFolio
            ? "border-indigo-500/50 bg-indigo-500/5 cursor-not-allowed"
            : isDragActive
              ? "border-violet-500 bg-violet-50 dark:bg-violet-500/10"
              : D ? "border-[#ffffff1a] hover:border-[#ffffff33]" : "border-gray-300 hover:border-gray-400"
            }`}>
          <input {...getInputProps()} disabled={isAnalyzingFolio} />
          {isAnalyzingFolio ? (
            <>
              <Loader2 className="w-5 h-5 mx-auto mb-1.5 text-indigo-400 animate-spin" />
              <p className="text-[10px] font-medium text-indigo-400">Menganalisis folio...</p>
            </>
          ) : (
            <>
              <ImageIcon className={`w-5 h-5 mx-auto mb-1 ${c.ts}`} />
              <p className={`text-[10px] ${c.tm}`}>Klik atau tarik folio ke sini</p>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
          {isLoadingFolios ? (
            <div className="grid grid-cols-2 gap-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className={`h-20 rounded-lg animate-pulse ${isDark ? "bg-white/5" : "bg-gray-100"}`} />
              ))}
            </div>
          ) : folios.length === 0 ? (
            <div className={`col-span-2 py-8 rounded-xl border-2 border-dashed text-center ${D ? "border-[#ffffff0a] text-white/25" : "border-[#d1d5db] text-gray-400"}`}>
              <ImageIcon className="w-6 h-6 mx-auto mb-1.5 opacity-40" />
              <p className="text-xs">Upload folio dulu</p>
            </div>
          ) : (
            folios.map((folio) => (
              <label key={folio.id} className={`cursor-pointer block rounded-xl overflow-hidden transition-all duration-200 ${selectedFolio === folio.id ? c.folioRing : c.folioUnsel}`}>
                <input type="radio" name="folio" value={folio.id} checked={selectedFolio === folio.id}
                  onChange={(e) => handleFolioChangeWithAnalyze(e.target.value)} className="hidden" />
                <div className="relative group">
                  <img src={folio.preview.startsWith("http") ? folio.preview : `${API_URL}${folio.preview}`}
                    alt={folio.name} className="w-full h-20 object-cover transition-transform duration-500 group-hover:scale-105" />
                  {selectedFolio === folio.id && (
                    <div className="absolute inset-0 bg-violet-500/20 flex items-center justify-center backdrop-blur-[1px] transition-all">
                      <div className="bg-violet-500 rounded-full p-1 shadow-lg transform scale-100 animate-in zoom-in duration-200">
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  )}
                </div>
                <div className={`px-2 py-1.5 flex items-center justify-between ${D ? "bg-[#ffffff06]" : "bg-gray-50"}`}>
                  <p className={`text-[10px] font-medium truncate ${c.tm}`} title={folio.name}>{folio.name}</p>
                </div>
              </label>
            ))
          )}
        </div>

        <button
          onClick={() => { setUseDoubleFolio(!useDoubleFolio); setSelectedFolioEven(""); }}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-medium transition-all ${useDoubleFolio
            ? D ? "border-violet-500/50 bg-violet-500/10 text-violet-400" : "border-violet-500 bg-violet-50 text-violet-700"
            : c.btn}`}>
          <span>📖 Folio Bolak-balik</span>
          <div className={`w-8 h-4 rounded-full transition-all ${useDoubleFolio ? "bg-violet-500" : D ? "bg-white/20" : "bg-gray-300"}`}>
            <div className={`w-3 h-3 rounded-full bg-white mt-0.5 transition-all ${useDoubleFolio ? "ml-4" : "ml-0.5"}`} />
          </div>
        </button>

        {useDoubleFolio && (
          <div>
            <p className={`text-[10px] mb-1.5 ${c.ts}`}>Folio halaman genap:</p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {folios.map((folio) => (
                <label key={folio.id} className={`cursor-pointer block rounded-xl overflow-hidden transition-all duration-200 ${selectedFolioEven === folio.id ? c.folioRing : c.folioUnsel}`}>
                  <input type="radio" name="folioEven" value={folio.id} checked={selectedFolioEven === folio.id}
                    onChange={(e) => setSelectedFolioEven(e.target.value)} className="hidden" />
                  <img src={folio.preview.startsWith("http") ? folio.preview : `${API_URL}${folio.preview}`}
                    alt={folio.name} className="w-full h-16 object-cover" />
                  <div className={`px-2 py-1 flex items-center justify-between ${D ? "bg-[#ffffff06]" : "bg-gray-50"}`}>
                    <p className={`text-[10px] font-medium truncate ${c.tm}`}>{folio.name}</p>
                    {selectedFolioEven === folio.id && <CheckCircle2 className="w-3 h-3 text-violet-400 flex-shrink-0" />}
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}
      </SidebarSection>

      <button onClick={() => setShowConfig(!showConfig)}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs font-medium transition-all ${showConfig ? c.btnActive : c.btn}`}>
        <div className="flex items-center gap-2"><Settings className="w-3.5 h-3.5" /><span>Advanced Config</span></div>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showConfig ? "rotate-180" : ""}`} />
      </button>

      {showConfig && (
        <div className={`rounded-xl border ${c.card} p-3.5 animate-fadeIn`}>
          <div className="flex items-center justify-between mb-2.5">
            <p className={`text-[10.5px] font-semibold uppercase tracking-widest ${c.label}`}>Advanced Config</p>
            <button onClick={() => updateConfig(DEFAULT_CONFIG)}
              className={`flex items-center gap-1 text-[10.5px] px-2 py-1 rounded-lg transition-all ${c.btn}`}>
              <RefreshCw className="w-3 h-3" />Reset
            </button>
          </div>
          <div className="space-y-2">
            {(["startX", "startY", "lineHeight", "maxWidth", "pageBottom", "fontSize"] as const).map((key) => (
              <div key={key}>
                <label className={`block text-[10px] font-medium mb-1 ${c.ts}`}>{key.replace(/([A-Z])/g, " $1").trim()}</label>
                <input type="number" value={config[key]} onChange={(e) => updateConfig({ ...config, [key]: Number(e.target.value) })}
                  className={`w-full px-2.5 py-1.5 text-xs border rounded-lg transition-colors ${c.input}`} />
              </div>
            ))}
          </div>
          <p className={`text-[10px] mt-2.5 flex items-center gap-1 ${c.ts}`}>
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />Config tersimpan otomatis
          </p>
        </div>
      )}
    </div>
  );

  // ──────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────────────────
  return (
    <div className={`min-h-screen ${c.page} transition-colors duration-300`} style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      <Toaster position="top-right" toastOptions={{
        duration: 3000,
        style: {
          background: D ? "#1a1a28" : "#1f2937", color: "#fff",
          padding: "12px 16px", borderRadius: "12px",
          fontSize: "13.5px", fontWeight: "500",
          border: D ? "1px solid rgba(255,255,255,0.08)" : "none",
          boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
        },
      }} />

      {/* ── MESH GRADIENT BACKGROUND ── */}
      <div className="fixed inset-0 pointer-events-none z-[-1]">
        {isDark ? (
          <div className="absolute inset-0"
            style={{
              background: "radial-gradient(ellipse 80% 50% at 20% 0%, #3b0764 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 80% 100%, #1e1b4b 0%, transparent 60%), radial-gradient(ellipse 50% 60% at 50% 50%, #0f0a1e 0%, #09090b 100%)"
            }} />
        ) : (
          <div className="absolute inset-0"
            style={{
              background: "radial-gradient(ellipse 80% 50% at 20% 0%, #a78bfa 0%, transparent 55%), radial-gradient(ellipse 60% 40% at 80% 100%, #818cf8 0%, transparent 55%), radial-gradient(ellipse 50% 60% at 50% 50%, #c4b5fd 0%, #ddd6fe 100%)"
            }} />
        )}
      </div>

      {/* ── MODAL CROPPER FOTO TULISAN TANGAN ── */}
      <AnimatePresence>
        {isCropping && cropImgSrc && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsCropping(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className={`relative w-full max-w-2xl rounded-2xl p-5 border shadow-2xl flex flex-col ${isDark ? "bg-[#18181b] border-[#ffffff14]" : "bg-white border-gray-200"}`} style={{ maxHeight: '90vh' }}>

              <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <div>
                  <h3 className={`font-bold text-lg ${c.tp}`}>Potong Area Tulisan</h3>
                  <p className={`text-xs ${c.ts}`}>Buang area meja/background agar AI fokus membaca tulisanmu.</p>
                </div>
                <button onClick={() => setIsCropping(false)} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${c.btn}`}>
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-auto rounded-xl border border-dashed border-gray-500/30 bg-black/10 flex items-center justify-center p-2">
                <ReactCrop crop={crop} onChange={(_, percentCrop) => setCrop(percentCrop)} onComplete={(c) => setCompletedCrop(c)}>
                  <img ref={cropImgRef} src={cropImgSrc} alt="Crop me" className="max-h-[55vh] w-auto object-contain rounded" />
                </ReactCrop>
              </div>

              <div className="flex justify-end gap-3 mt-5 flex-shrink-0">
                <button onClick={() => setIsCropping(false)} className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${c.btn}`}>
                  Batal
                </button>
                <button onClick={async () => {
                  if (cropImgRef.current && completedCrop?.width && completedCrop?.height) {
                    try {
                      // 1. Ekstrak gambar
                      const croppedFile = await getCroppedImg(cropImgRef.current, completedCrop);
                      // 2. Tutup Modal
                      setIsCropping(false);
                      setCropImgSrc("");
                      setCrop(undefined); // Reset state crop
                      // 3. Kirim ke Backend untuk dianalisis
                      handleAnalyzeHandwriting(croppedFile);
                    } catch (e) { toast.error("Gagal memotong gambar"); }
                  } else {
                    toast.error("Tarik kotak untuk memilih area tulisan!");
                  }
                }} className={`px-6 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r ${c.accent} text-white shadow-lg hover:scale-105 active:scale-95 transition-all`}>
                  <div className="flex items-center gap-2"><Sparkles className="w-4 h-4" /> Analisis AI</div>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL KONFIRMASI ANALISIS TULISAN TANGAN ── */}
      <AnimatePresence>
        {pendingHwConfig && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPendingHwConfig(null)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className={`relative w-full max-w-sm rounded-2xl p-5 border shadow-2xl ${isDark ? "bg-[#18181b] border-[#ffffff14]" : "bg-white border-gray-200"}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-violet-500" />
                </div>
                <div>
                  <h3 className={`font-semibold ${c.tp}`}>Hasil Analisis AI</h3>
                  <p className={`text-[11px] ${c.ts}`}>Karakter tulisanmu berhasil dideteksi.</p>
                </div>
              </div>

              <div className={`space-y-2.5 mb-5 p-3.5 rounded-xl border ${c.pillBorder} ${c.pill} shadow-inner`}>
                <div className="flex items-center justify-between text-xs">
                  <span className={c.ts}>Kemiringan:</span>
                  <span className={`font-mono font-bold ${c.tp}`}>{pendingHwConfig.slantAngle}°</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className={c.ts}>Spasi & Ukuran:</span>
                  <span className={`font-mono font-bold ${c.tp}`}>{pendingHwConfig.wordSpacing}px · {pendingHwConfig.fontSize}px</span>
                </div>

                {/* Menampilkan Warna Tinta Hasil Deteksi AI */}
                {pendingHwConfig.color && (
                  <div className={`pt-2 mt-2 border-t ${c.divider} flex items-center justify-between text-xs`}>
                    <span className={c.ts}>Warna Pulpen:</span>
                    <div className="flex items-center gap-2">
                      <span className={`font-mono font-semibold uppercase ${c.tp}`}>{pendingHwConfig.color}</span>
                      <div
                        className="w-5 h-5 rounded-full ring-2 ring-black/10 shadow-sm"
                        style={{ backgroundColor: pendingHwConfig.color, border: '1px solid rgba(255,255,255,0.2)' }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button onClick={() => setPendingHwConfig(null)} className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${c.btn}`}>
                  Batal
                </button>
                <button onClick={() => {
                  updateConfig({ ...config, ...pendingHwConfig });
                  if (pendingHwConfig.slantAngle !== undefined) setSlantAngle(pendingHwConfig.slantAngle);
                  setPendingHwConfig(null);
                  toast.success("Gaya tulisan tanganmu diterapkan!");
                }}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r ${c.accent} text-white shadow-lg`}>
                  Terapkan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL AI WRITER ── */}
      <AnimatePresence>
        {showAiModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isAiDrafting && setShowAiModal(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className={`relative w-full max-w-lg rounded-2xl p-5 border shadow-2xl ${isDark ? "bg-[#18181b] border-[#ffffff14]" : "bg-white border-gray-200"}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-indigo-500" />
                  </div>
                  <h3 className={`font-bold ${c.tp}`}>Asisten AI</h3>
                </div>
                <button onClick={() => { setShowAiModal(false); setAiDraftResult(""); }} className={c.ts}><X className="w-4 h-4" /></button>
              </div>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Contoh: Buatkan esai 3 paragraf tentang sejarah kemerdekaan Indonesia..."
                className={`w-full h-28 p-3 rounded-xl text-sm border focus:ring-2 focus:ring-indigo-500/50 resize-none ${c.input}`}
              />

              {/* Preview hasil AI sebelum dikirim ke editor */}
              {aiDraftResult && (
                <div className={`mt-3 rounded-xl border overflow-hidden ${D ? "border-[#ffffff10]" : "border-gray-200"}`}>
                  <div className={`flex items-center justify-between px-3 py-2 border-b ${D ? "bg-white/4 border-[#ffffff08]" : "bg-gray-50 border-gray-100"}`}>
                    <span className={`text-[11px] font-semibold ${c.ts}`}>Hasil AI</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(aiDraftResult);
                          toast.success("Teks AI disalin!");
                        }}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all border ${c.btn}`}>
                        <Copy className="w-3 h-3" />Salin
                      </button>
                      <button
                        onClick={() => setAiDraftResult("")}
                        className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${D ? "text-white/30 hover:text-white/60" : "text-gray-300 hover:text-gray-500"}`}>
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className={`p-3 max-h-40 overflow-y-auto scrollbar-thin text-xs leading-relaxed ${c.tm}`}>
                    {aiDraftResult}
                  </div>
                  <div className={`px-3 py-2 border-t ${D ? "border-[#ffffff08]" : "border-gray-100"}`}>
                    <button
                      onClick={() => {
                        const aiText = (text.length > 0 ? "\n\n" : "") + aiDraftResult.trim();
                        setInputText(prev => prev + aiText);
                        setText(prev => prev + aiText);
                        setAiDraftResult("");
                        setShowAiModal(false);
                        setAiPrompt("");
                        toast.success("Teks berhasil ditambahkan ke editor! ✨");
                      }}
                      className={`w-full py-2 rounded-xl text-xs font-bold bg-gradient-to-r ${c.accent} text-white hover:opacity-90 active:scale-95 transition-all`}>
                      Kirim ke Editor →
                    </button>
                  </div>
                </div>
              )}
              <button
                disabled={!aiPrompt.trim() || isAiDrafting}
                onClick={async () => {
                  setIsAiDrafting(true);
                  try {
                    const res = await fetch(`${API_URL}/api/ai-writer`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ prompt: aiPrompt })
                    });

                    const data = await res.json();

                    if (data.success) {
                      setAiDraftResult(data.text.trim());
                      toast.success("Teks AI siap! Cek preview di bawah. ✨");
                    } else {
                      throw new Error(data.error || "Gagal menghubungi AI");
                    }
                  } catch (e: unknown) {
                    const err = e as Error;
                    toast.error(err.message);
                  } finally {
                    setIsAiDrafting(false);
                  }
                }}
                className={`w-full mt-4 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r ${c.accent} text-white transition-all flex justify-center items-center gap-2 ${isAiDrafting ? "opacity-70" : "hover:scale-[1.02] active:scale-95"}`}>
                {isAiDrafting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {isAiDrafting ? "AI Sedang Menulis..." : "Buat Teks"}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MOBILE SIDEBAR OVERLAY ── */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <>
            <motion.div
              key="mob-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] lg:hidden"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <motion.aside
              key="mob-drawer"
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className={`fixed top-0 left-0 bottom-0 w-[300px] md:w-[320px] max-w-[85vw] z-[70] overflow-y-auto border-r ${c.sidebar}`}
            >
              <div className={`sticky top-0 flex items-center justify-between px-4 h-14 border-b ${c.divider} ${D ? "bg-[#121217]/90" : "bg-white/90"} backdrop-blur-md z-10`}>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg flex items-center justify-center">
                    <PenTool className="w-3 h-3 text-white" />
                  </div>
                  <span className={`text-[13px] font-semibold ${c.tp}`}>Pengaturan</span>
                </div>
                <button onClick={() => setMobileSidebarOpen(false)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.btn}`}>
                  <X className="w-4 h-4" />
                </button>
              </div>
              {renderSidebarContent()}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── ONBOARDING TOUR ── */}
      {showOnboarding && (
        <div className="fixed inset-0 z-[200] pointer-events-none">
          {/* Overlay gelap — lebih terang di step 0 (welcome) */}
          <motion.div
            className="absolute inset-0 pointer-events-auto"
            animate={{ backgroundColor: onboardingStep === 0 ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.55)" }}
            transition={{ duration: 0.3 }}
            onClick={() => { setShowOnboarding(false); localStorage.setItem("hw_onboarded", "1"); }}
          />

          {/* Spotlight ring — muncul di step 1, 2, 3 */}
          {onboardingStep > 0 && (() => {
            const targetId = ONBOARDING_SPOTLIGHT[onboardingStep]?.selector;
            const el = targetId ? document.getElementById(targetId) : null;
            const rect = el?.getBoundingClientRect();
            if (!rect) return null;
            return (
              <motion.div
                key={targetId}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="absolute pointer-events-none rounded-2xl"
                style={{
                  top: rect.top - 6,
                  left: rect.left - 6,
                  width: rect.width + 12,
                  height: rect.height + 12,
                  boxShadow: "0 0 0 4px #7C3AED, 0 0 0 9999px rgba(0,0,0,0.55)",
                  border: "2px solid rgba(139,92,246,0.8)",
                }}
              />
            );
          })()}

          <div className="absolute pointer-events-auto left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ maxWidth: "340px", width: "90vw" }}>
            <div className={`rounded-2xl border shadow-2xl p-5 ${isDark
              ? "bg-[#0d0d14] border-[#ffffff10] shadow-[0_24px_64px_rgba(0,0,0,0.8)]"
              : "bg-white border-violet-100 shadow-[0_24px_64px_rgba(139,92,246,0.15)]"}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex gap-1.5">
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === onboardingStep ? "w-6 bg-violet-500" : i < onboardingStep ? "w-3 bg-violet-300" : "w-3 bg-gray-300 dark:bg-white/10"}`} />
                  ))}
                </div>
                <button onClick={() => { setShowOnboarding(false); localStorage.setItem("hw_onboarded", "1"); }}
                  className={`text-[11px] px-2 py-1 rounded-lg transition-colors ${isDark ? "text-white/40 hover:text-white/70 hover:bg-white/5" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"}`}>
                  Skip
                </button>
              </div>
              <div className="text-3xl mb-2">{[["✍️"], ["🎨"], ["📝"], ["🚀"]][onboardingStep]}</div>
              <h3 className={`text-sm font-bold mb-1.5 ${isDark ? "text-white" : "text-gray-900"}`}>
                {["Selamat datang di HandWrite AI! 🎉", "Pilih & Atur Gaya Tulisan", "Ketik atau Tempel Teks", "Generate & Download"][onboardingStep]}
              </h3>
              <p className={`text-[12px] leading-relaxed mb-4 ${isDark ? "text-white/60" : "text-gray-500"}`}>
                {["Ubah teks apapun jadi tulisan tangan realistis di atas folio dalam hitungan detik.", "Di sidebar kiri, pilih font, kemiringan, warna tinta, efek typo, dan banyak lagi untuk tulisan yang benar-benar terasa manusiawi.", "Paste teks tugasmu di area utama. Bisa sampai 50.000 karakter! Gunakan Ctrl+Enter untuk langsung Generate.", "Klik Generate dan halaman muncul satu per satu secara real-time. Download sebagai JPG, ZIP, PDF, atau Word."][onboardingStep]}
              </p>
              <div className="flex gap-2">
                {onboardingStep > 0 && (
                  <button onClick={() => setOnboardingStep(s => s - 1)}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${isDark ? "border-white/10 text-white/60 hover:bg-white/5" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                    ← Kembali
                  </button>
                )}
                <button onClick={() => { if (onboardingStep < 3) setOnboardingStep(s => s + 1); else { setShowOnboarding(false); localStorage.setItem("hw_onboarded", "1"); } }}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:opacity-90 transition-all">
                  {onboardingStep < 3 ? "Lanjut →" : "Mulai Sekarang! 🚀"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── KEYBOARD SHORTCUT MODAL ── */}
      <AnimatePresence>
        {showShortcuts && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowShortcuts(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className={`relative w-full max-w-sm rounded-2xl p-5 border shadow-2xl ${D ? "bg-[#18181b] border-[#ffffff14]" : "bg-white border-gray-200"}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`font-bold text-base ${c.tp}`}>⌨️ Keyboard Shortcuts</h3>
                <button onClick={() => setShowShortcuts(false)}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center ${c.btn}`}>
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-1.5">
                {[
                  { keys: ["Ctrl", "Enter"], label: "Generate tulisan" },
                  { keys: ["←", "→"], label: "Navigasi halaman" },
                  { keys: ["Esc"], label: "Tutup modal / Fullscreen" },
                  { keys: ["Ctrl", "Z"], label: "Undo config" },
                ].map((s, i) => (
                  <div key={i} className={`flex items-center justify-between px-3 py-2.5 rounded-xl ${D ? "bg-white/4" : "bg-gray-50"}`}>
                    <span className={`text-xs ${c.tm}`}>{s.label}</span>
                    <div className="flex items-center gap-1">
                      {s.keys.map((k, ki) => (
                        <span key={ki}>
                          <kbd className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold border ${D ? "bg-[#09090b] border-[#ffffff15] text-violet-400" : "bg-white border-gray-200 text-violet-600 shadow-sm"}`}>
                            {k}
                          </kbd>
                          {ki < s.keys.length - 1 && (
                            <span className={`mx-0.5 text-[10px] ${c.ts}`}>+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => { setShowShortcuts(false); setShowOnboarding(true); setOnboardingStep(0); }}
                className={`w-full mt-4 py-2 rounded-xl text-xs font-medium border transition-all ${c.btn}`}>
                Lihat Tutorial Onboarding
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── FULLSCREEN ── */}
      {fullscreenPage && (
        <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setFullscreenPage(null)}>
          <button className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all"
            onClick={() => setFullscreenPage(null)}>
            <X className="w-5 h-5" />
          </button>
          <div className="text-center" onClick={(e) => e.stopPropagation()}>
            <p className="text-white/35 text-[11px] mb-3 tracking-widest uppercase">
              Halaman {fullscreenPage.page} · ESC untuk tutup
            </p>
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
      <header className={`${c.header} border-b sticky top-0 z-50 transition-colors duration-200`}>
        {isGenerating && (
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-violet-500/10">
            <div className="h-full bg-gradient-to-r from-violet-500 to-indigo-400 transition-all duration-500"
              style={{ width: `${generateProgress}%` }} />
          </div>
        )}
        <div className="w-full max-w-[1400px] 2xl:max-w-[1600px] 3xl:max-w-[2000px] 4xl:max-w-[2400px] mx-auto px-3 sm:px-4 lg:px-6 3xl:px-12 h-14 flex items-center justify-between gap-2">

          {/* LEFT: toggle + logo */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => setSidebarOpen(!sidebarOpen)}
              className={`hidden lg:flex w-8 h-8 rounded-lg items-center justify-center transition-all ${c.btn}`}>
              {sidebarOpen ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeftOpen className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => setMobileSidebarOpen(true)}
              className={`flex md:hidden w-8 h-8 rounded-lg items-center justify-center transition-all ${c.btn}`}>
              <Menu className="w-3.5 h-3.5" />
            </button>

            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-violet-500/30">
                <PenTool className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-bold text-sm bg-gradient-to-r from-violet-500 to-indigo-400 bg-clip-text text-transparent hidden xs:block">HandWrite AI</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-mono border ${D ? "border-violet-500/30 bg-violet-500/10 text-violet-400" : "border-violet-300 bg-violet-50 text-violet-600"}`}>v1.2</span>
              </div>
            </div>
          </div>

          {/* CENTER: status pill */}
          <div className="hidden sm:flex flex-1 justify-center">
            {isGenerating ? (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${D ? "bg-violet-500/10 border border-violet-500/20" : "bg-violet-50 border border-violet-200"}`}>
                <Loader2 className="w-3.5 h-3.5 text-violet-500 animate-spin" />
                <span className={`text-xs font-medium ${D ? "text-violet-400" : "text-violet-700"}`}>
                  Generating {Math.round(generateProgress)}%
                </span>
              </div>
            ) : generatedPages.length > 0 ? (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${D ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-emerald-50 border border-emerald-200"}`}>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span className={`text-xs font-medium ${D ? "text-emerald-400" : "text-emerald-700"}`}>
                  {generatedPages.length} halaman siap
                </span>
              </div>
            ) : text.trim() ? (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${D ? "bg-white/5 border-[#ffffff10]" : "bg-gray-50 border-gray-200"}`}>
                <Clock className={`w-3.5 h-3.5 ${c.ts}`} />
                <span className={`text-xs ${c.ts}`}>
                  ~{estimatedPages} hal · {estimatedTimeLabel}
                </span>
              </div>
            ) : null}
          </div>

          {/* RIGHT: backend status + help + dark mode */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* ── TOMBOL LOGIN CLOUD ── */}
            {user ? (
              <div className="hidden md:flex items-center gap-2 mr-2">
                <span className={`text-[11px] font-medium ${D ? "text-white/70" : "text-gray-600"}`}>
                  {user.user_metadata.full_name}
                </span>
                <button onClick={handleLogout} title="Logout" className="p-1.5 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-all">
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button onClick={handleLogin} className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-all text-[11px] font-medium mr-2">
                <LogIn className="w-3.5 h-3.5" />
                <span>Login Cloud</span>
              </button>
            )}
            <div title={backendOnline === null ? "Memeriksa..." : backendOnline ? "Backend terhubung" : "Backend offline"}
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-medium transition-all ${backendOnline === null
                ? D ? "border-[#ffffff10] text-white/30" : "border-gray-200 text-gray-400"
                : backendOnline
                  ? D ? "border-emerald-500/20 bg-emerald-500/8 text-emerald-400" : "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : D ? "border-red-500/20 bg-red-500/8 text-red-400" : "border-red-300 bg-red-50 text-red-600"
                }`}>
              {backendOnline === null ? <Loader2 className="w-3 h-3 animate-spin" /> : backendOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              <span className="hidden lg:inline">{backendOnline === null ? "..." : backendOnline ? "Online" : "Offline"}</span>
            </div>
            <button
              onClick={() => setShowShortcuts(true)}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all text-[13px] font-bold ${c.btn}`}
              title="Keyboard Shortcuts">
              ?
            </button>
            <button onClick={() => setIsDark(!isDark)}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${c.btn}`}>
              {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
          </div>

        </div>
      </header>


      {/* ── BODY: 3-PANEL LAYOUT ── */}
      <div className="w-full max-w-[1400px] 2xl:max-w-[1600px] 3xl:max-w-[2000px] 4xl:max-w-[2400px] mx-auto flex overflow-hidden" style={{ height: "calc(100dvh - 56px)" }}>

        {/* ══ PANEL 1: SIDEBAR SETTINGS — Desktop only ══ */}
        <motion.aside
          id="sidebar-settings"
          className={`hidden lg:flex flex-col flex-shrink-0 border-r overflow-hidden ${c.sidebar}`}
          animate={{ width: sidebarOpen ? 288 : 0 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          style={{ height: "calc(100dvh - 56px)" }}
        >
          <motion.div
            animate={{ opacity: sidebarOpen ? 1 : 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex-1 overflow-y-auto pb-8 scrollbar-thin w-[288px]"
          >
            {renderSidebarContent()}
          </motion.div>
        </motion.aside>

        {/* ══ PANEL 2: EDITOR + PREVIEW COLLAPSIBLE ══ */}
        <div id="editor-panel" className={`
hidden md:flex flex-col border-r flex-shrink-0
  ${c.sidebar}
  ${sidebarOpen
            ? "md:w-[280px] lg:w-[340px] xl:w-[400px] 2xl:w-[440px]"
            : "md:w-[300px] lg:w-[380px] xl:w-[440px] 2xl:w-[500px]"}
  transition-all duration-300
`} style={{ height: "calc(100dvh - 56px)" }}>

          {/* Editor header */}
          <div className={`flex-shrink-0 px-4 py-3 border-b ${c.divider} flex items-center justify-between ${D
            ? "bg-gradient-to-r from-[#13131f] to-[#0d0d14]"
            : "bg-gradient-to-r from-amber-50 via-violet-50 to-indigo-100"}`}>
            <div className="flex items-center gap-2">
              <div className={`w-5 h-5 rounded-md flex items-center justify-center ${D ? "bg-indigo-500/20" : "bg-indigo-100"}`}>
                <span className="text-[10px]">📝</span>
              </div>
              <span className={`text-[10.5px] font-bold uppercase tracking-widest ${c.label}`}>Editor</span>
              {currentFont && (
                <span className={`text-[11px] px-2 py-0.5 rounded-md border ${c.pillBorder} ${c.pill} ${c.tp}`}
                  style={{ fontFamily: FONT_FAMILY_MAP[currentFont.name] || currentFont.name }}>
                  {currentFont.name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] ${c.ts}`}>
                <span className={`font-semibold ${D ? "text-indigo-400" : "text-indigo-600"}`}>{wordCount.toLocaleString()}</span> kata
              </span>
              <button
                id="generate-btn"
                onClick={handleGenerate}
                disabled={isGenerating || !text.trim() || !selectedFolio}
                className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl font-semibold text-xs transition-all min-w-[100px] ${isGenerating || !text.trim() || !selectedFolio
                  ? D ? "bg-white/4 text-white/20 cursor-not-allowed border border-[#ffffff06]" : "bg-gray-100 text-gray-300 cursor-not-allowed border border-gray-200"
                  : `bg-gradient-to-r ${c.accent} text-white shadow-md hover:shadow-lg hover:scale-[1.02]`
                  }`}>
                {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>Generate</span>
                {!isGenerating && estimatedPages > 1 && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${D ? "bg-white/15" : "bg-white/25"}`}>{estimatedPages}</span>
                )}
              </button>
            </div>
          </div>

          {/* Textarea area - scrollable */}
          <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin">
            <div className="p-4 flex flex-col gap-3">

              {/* Toolbar — scrollable horizontal, rapi di semua ukuran */}
              <div className="flex flex-col gap-2">

                {/* Baris 1: Tombol aksi — scroll horizontal di layar sempit */}
                <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide -mx-1 px-1">
                  <div className="flex items-center gap-1.5 flex-nowrap min-w-max">

                    {/* Tempel */}
                    <button
                      onClick={async () => {
                        try {
                          const t = await navigator.clipboard.readText();
                          setInputText(t); setText(t); toast.success("Teks ditempel!");
                        } catch { toast.error("Tidak bisa akses clipboard"); }
                      }}
                      className={`flex items-center gap-1.5 text-[11px] px-3 py-2 rounded-xl border transition-all whitespace-nowrap flex-shrink-0 ${c.btn}`}>
                      <Clipboard className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>Tempel</span>
                    </button>

                    {/* Tulis dengan AI */}
                    <button
                      onClick={() => setShowAiModal(true)}
                      className={`flex items-center gap-1.5 text-[11px] px-3 py-2 rounded-xl border transition-all whitespace-nowrap flex-shrink-0 ${D
                        ? "bg-indigo-500/8 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/15 hover:border-indigo-500/35"
                        : "bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300"
                        }`}>
                      <Bot className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>Tulis AI</span>
                    </button>

                    {/* Dikte */}
                    <button
                      onClick={toggleListening}
                      title={isListening ? "Berhenti mendikte" : "Mulai mendikte"}
                      className={`flex items-center gap-1.5 text-[11px] px-3 py-2 rounded-xl border transition-all whitespace-nowrap flex-shrink-0 ${isListening
                        ? "bg-red-500/15 text-red-400 border-red-500/30 animate-pulse"
                        : c.btn
                        }`}>
                      <Mic className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{isListening ? "Dengerin..." : "Dikte"}</span>
                    </button>

                    {/* Hapus */}
                    <button
                      onClick={() => {
                        if (!text) return;
                        toast((t) => (
                          <div className="flex flex-row items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </div>
                            <div className="flex flex-col">
                              <p className={`text-xs font-bold mb-1 ${D ? "text-white" : "text-gray-900"}`}>Bersihkan Editor?</p>
                              <p className={`text-[10px] mb-2.5 ${D ? "text-white/60" : "text-gray-500"}`}>Semua teks akan hilang dan tidak bisa dikembalikan.</p>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => { setInputText(""); setText(""); toast.dismiss(t.id); toast.success("Teks berhasil dihapus!"); }}
                                  className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-[10px] font-bold transition-all hover:bg-red-600 hover:scale-105 active:scale-95 shadow-md shadow-red-500/20">
                                  Ya, Hapus
                                </button>
                                <button
                                  onClick={() => toast.dismiss(t.id)}
                                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all hover:scale-105 active:scale-95 ${D ? "bg-white/10 text-white hover:bg-white/20" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
                                  Batal
                                </button>
                              </div>
                            </div>
                          </div>
                        ), {
                          duration: 6000,
                          position: "top-center",
                          style: { padding: '14px', borderRadius: '16px', background: D ? '#18181b' : '#ffffff', border: D ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)' }
                        });
                      }}
                      disabled={!text}
                      className={`flex items-center gap-1.5 text-[11px] px-3 py-2 rounded-xl border transition-all whitespace-nowrap flex-shrink-0 ${!text
                        ? "opacity-35 cursor-not-allowed " + c.btn
                        : D
                          ? "hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/25 " + c.btn
                          : "hover:bg-red-50 hover:text-red-600 hover:border-red-200 " + c.btn
                        }`}>
                      <Trash2 className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>Hapus</span>
                    </button>

                    {/* Divider */}
                    {currentFolio && (
                      <div className={`w-px h-5 flex-shrink-0 mx-0.5 ${D ? "bg-white/10" : "bg-gray-200"}`} />
                    )}

                    {/* Badge Folio Aktif */}
                    {currentFolio && (
                      <div className={`flex items-center gap-1.5 text-[11px] px-3 py-2 rounded-xl border flex-shrink-0 whitespace-nowrap ${c.tag}`}>
                        <span className="text-xs">📄</span>
                        <span className="max-w-[80px] truncate font-medium">{currentFolio.name}</span>
                      </div>
                    )}

                  </div>
                </div>

                {/* Baris 2: Counter karakter + estimasi halaman */}
                <div className={`flex items-center justify-between px-1`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10.5px] ${c.ts}`}>
                      <span className={`font-semibold tabular-nums ${text.length > 40000 ? "text-red-400" : D ? "text-emerald-400" : "text-emerald-600"
                        }`}>
                        {text.length.toLocaleString()}
                      </span>
                      <span className={c.ts}>/50k karakter</span>
                    </span>
                    <span className={`text-[10px] ${D ? "text-white/15" : "text-gray-300"}`}>·</span>
                    <span className={`text-[10.5px] ${c.ts}`}>
                      {wordCount.toLocaleString()} kata
                    </span>
                  </div>
                  <span className={`text-[11px] font-bold tabular-nums px-2 py-0.5 rounded-lg border transition-all ${text.length > 45000
                    ? "bg-red-500/10 text-red-400 border-red-500/20"
                    : text.length > 30000
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      : D
                        ? "bg-violet-500/10 text-violet-400 border-violet-500/20"
                        : "bg-violet-50 text-violet-600 border-violet-200"
                    }`}>
                    ~{estimatedPages} hal
                  </span>
                </div>

              </div>

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file?.type === "text/plain") {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      if (typeof ev.target?.result === "string") {
                        setText(text + (text ? "\n" : "") + ev.target.result);
                        toast.success("File berhasil dimuat!");
                      }
                    };
                    reader.readAsText(file);
                  } else toast.error("Hanya file .txt");
                }}
                placeholder="Ketik atau paste teks di sini...&#10;&#10;Drag & drop file .txt ⚡"
                className={`light-textarea w-full resize-none rounded-2xl px-4 py-3.5 text-sm leading-relaxed transition-all duration-200 outline-none border-2 focus:ring-4 ${D
                  ? "bg-[#080810] border-[#ffffff0a] text-white placeholder-white/15 caret-violet-400 focus:border-violet-600/50 focus:ring-violet-500/10 focus:shadow-[0_0_0_4px_rgba(139,92,246,0.08)]"
                  : "bg-white border-violet-100 text-gray-900 placeholder-violet-300/50 caret-violet-500 focus:border-violet-400 focus:ring-violet-400/10 shadow-[inset_0_2px_8px_rgba(139,92,246,0.05)]"
                  } font-[inherit]`}
                style={{ minHeight: "200px", height: "auto" }}
              />

              {/* Char progress */}
              {text.length > 0 && (
                <div className={`h-1 rounded-full overflow-hidden ${D ? "bg-[#ffffff08]" : "bg-gray-200"}`}>
                  <div className={`h-full rounded-full transition-all duration-500 ${text.length > 45000 ? "bg-red-500" : text.length > 30000 ? "bg-amber-500" : D ? "bg-emerald-500" : "bg-emerald-600"
                    }`} style={{ width: `${Math.min(100, (text.length / 50000) * 100)}%` }} />
                </div>
              )}

              {/* Shortcut hints */}
              <div className={`flex items-center gap-3 text-[10px] ${c.ts}`}>
                <div className="flex items-center gap-1">
                  <kbd className={`px-1.5 py-0.5 rounded border font-mono text-[9px] ${D ? "bg-white/5 border-white/10" : "bg-gray-100 border-gray-200"}`}>Ctrl+Enter</kbd>
                  <span>Generate</span>
                </div>
                <div className={`w-px h-3 ${D ? "bg-white/10" : "bg-gray-200"}`} />
                <div className="flex items-center gap-1">
                  <span>Drag & drop</span>
                  <kbd className={`px-1.5 py-0.5 rounded border font-mono text-[9px] ${D ? "bg-white/5 border-white/10" : "bg-gray-100 border-gray-200"}`}>.txt</kbd>
                </div>
              </div>

              {estimatedPages > 1 && (
                <div className={`flex items-start gap-2 px-3 py-2 rounded-lg border ${D ? "bg-amber-500/10 border-amber-500/20" : "bg-amber-50 border-amber-200"}`}>
                  <span className="text-amber-500 text-sm mt-0.5 flex-shrink-0">⚠️</span>
                  <p className={`text-[11px] leading-relaxed ${D ? "text-amber-400" : "text-amber-700"}`}>
                    Teks akan menghasilkan <strong>{estimatedPages} halaman</strong>.
                  </p>
                </div>
              )}

              {/* Seed row */}
              <div className="flex items-center justify-end gap-2">
                <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[10px] ${c.pillBorder} ${c.pill}`}>
                  <span className={c.ts}>Seed:</span>
                  <span className={`font-mono font-semibold ${D ? "text-violet-400" : "text-violet-600"}`}>{String(seed).slice(-6)}</span>
                  <button onClick={handleCopySeed} className={`ml-0.5 transition-colors ${showSeedCopied ? "text-emerald-500" : c.ts}`}>
                    {showSeedCopied ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !generatedPages.length}
                  title="Regenerate dengan seed yang sama"
                  className={`p-2.5 rounded-xl border transition-all ${c.btn}`}
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button onClick={() => setSeed(Date.now())} className={`p-2.5 rounded-xl border transition-all ${c.btn}`}>
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* STATS BAR — pinned di bawah editor */}
          <div className={`flex-shrink-0 border-t ${c.divider} px-4 py-3 ${D
            ? "bg-gradient-to-b from-[#0d0d14] to-[#080810]"
            : "bg-gradient-to-b from-violet-50 to-indigo-100/80"}`}>
            <div className="grid grid-cols-2 gap-2">
              {/* Estimasi halaman */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${c.pillBorder} ${c.pill}`}>
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${D ? "bg-violet-500/15" : "bg-violet-100"}`}>
                  <FileText className="w-3.5 h-3.5 text-violet-500" />
                </div>
                <div>
                  <p className={`text-[9px] uppercase tracking-widest font-semibold ${c.ts}`}>Halaman</p>
                  <p className={`text-sm font-bold tabular-nums ${D ? "text-violet-400" : "text-violet-600"}`}>~{estimatedPages}</p>
                </div>
              </div>
              {/* Estimasi waktu */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${c.pillBorder} ${c.pill}`}>
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${D ? "bg-amber-500/15" : "bg-amber-100"}`}>
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                </div>
                <div>
                  <p className={`text-[9px] uppercase tracking-widest font-semibold ${c.ts}`}>Estimasi</p>
                  <p className={`text-sm font-bold ${D ? "text-amber-400" : "text-amber-600"}`}>{estimatedTimeLabel}</p>
                </div>
              </div>
              {/* Font aktif */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${c.pillBorder} ${c.pill}`}>
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${D ? "bg-indigo-500/15" : "bg-indigo-100"}`}>
                  <PenTool className="w-3.5 h-3.5 text-indigo-500" />
                </div>
                <div className="min-w-0">
                  <p className={`text-[9px] uppercase tracking-widest font-semibold ${c.ts}`}>Font</p>
                  <p className={`text-[11px] font-semibold truncate ${c.tp}`}
                    style={{ fontFamily: FONT_FAMILY_MAP[currentFont?.name || ''] || 'cursive' }}>
                    {currentFont?.name || "—"}
                  </p>
                </div>
              </div>
              {/* Folio aktif */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${c.pillBorder} ${c.pill}`}>
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${D ? "bg-emerald-500/15" : "bg-emerald-100"}`}>
                  <ImageIcon className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <div className="min-w-0">
                  <p className={`text-[9px] uppercase tracking-widest font-semibold ${c.ts}`}>Folio</p>
                  <p className={`text-[11px] font-semibold truncate ${c.tp}`}>{currentFolio?.name || "—"}</p>
                </div>
              </div>
            </div>
            {/* Warna tinta */}
            <div className={`flex items-center gap-2 mt-2 px-3 py-2 rounded-xl border ${c.pillBorder} ${c.pill}`}>
              <div className="w-4 h-4 rounded-full flex-shrink-0 ring-2 ring-black/10 ring-offset-1"
                style={{ backgroundColor: config.color, outline: `2px solid ${D ? "#09090b" : "#fff"}`, outlineOffset: "1px" }} />
              <span className={`text-[10px] font-mono ${c.ts}`}>{config.color.toUpperCase()}</span>
              <span className={`text-[10px] ${c.ts} ml-auto`}>{wordCount.toLocaleString()} kata</span>
            </div>
          </div>
          {/* Live Preview Strip */}
          {livePreviewUrl && (
            <div className={`relative rounded-xl overflow-hidden border mx-3 mb-3 ${c.pillBorder} ${isLoadingPreview ? "opacity-50" : "opacity-100"} transition-opacity duration-300`}>
              <img src={livePreviewUrl} alt="Preview" className="w-full h-24 object-cover object-top" />
              <div className={`absolute top-1.5 right-1.5 flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] ${D ? "bg-black/70 text-white/60" : "bg-white/85 text-gray-500"}`}>
                {isLoadingPreview && <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse inline-block" />}
                Live Preview
              </div>
              {isLoadingPreview && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
                  <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
                </div>
              )}
              {currentFont && (
                <div className={`absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded-md text-[9px] font-medium ${D ? "bg-black/70 text-violet-300" : "bg-white/85 text-violet-600"}`}
                  style={{ fontFamily: FONT_FAMILY_MAP[currentFont.name] || 'cursive' }}>
                  {currentFont.name}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ══ PANEL 3: OUTPUT VIEWER — mengisi sisa ruang ══ */}
        <main className="hidden md:flex flex-1 min-w-0 flex-col overflow-hidden" style={{ height: "calc(100dvh - 56px)" }}>

          {/* Output header — 2 baris agar tidak overflow di laptop kecil */}
          <div className={`flex-shrink-0 border-b ${c.divider} ${D ? "bg-[#09090b]/80" : "bg-white/80"} backdrop-blur-sm`}>

            {/* Baris 1: Status + Navigasi halaman + Riwayat/Preset */}
            <div className={`flex items-center justify-between gap-2 px-4 py-2 ${D
              ? "bg-gradient-to-r from-[#0d0d14] to-[#13131f]"
              : "bg-gradient-to-r from-indigo-100 to-violet-100"}`}>
              <div className="flex items-center gap-2 min-w-0">
                {/* Status pill */}
                {isGenerating ? (
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${D ? "bg-violet-500/12 border border-violet-500/20" : "bg-violet-50 border border-violet-200"}`}>
                    <Loader2 className="w-3 h-3 text-violet-500 animate-spin flex-shrink-0" />
                    <span className={`text-[11px] font-medium ${D ? "text-violet-400" : "text-violet-700"}`}>Generating {Math.round(generateProgress)}%</span>
                  </div>
                ) : generatedPages.length > 0 ? (
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${D ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-emerald-50 border border-emerald-200"}`}>
                    <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                    <span className={`text-[11px] font-medium ${D ? "text-emerald-400" : "text-emerald-700"}`}>{generatedPages.length} halaman siap</span>
                  </div>
                ) : (
                  <span className={`text-[11px] font-semibold uppercase tracking-widest ${c.label}`}>Output Viewer</span>
                )}

                {/* Page navigation */}
                {generatedPages.length > 0 && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setActivePageIndex(i => Math.max(0, i - 1))}
                      disabled={activePageIndex === 0}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs border transition-all ${activePageIndex === 0
                        ? D ? "border-[#ffffff05] text-white/10 cursor-not-allowed" : "border-gray-100 text-gray-200 cursor-not-allowed"
                        : c.btn
                        }`}>←</button>
                    <span className={`text-[11px] font-semibold tabular-nums min-w-[44px] text-center ${c.tp}`}>
                      {activePageIndex + 1}/{generatedPages.length}
                    </span>
                    <button
                      onClick={() => setActivePageIndex(i => Math.min(generatedPages.length - 1, i + 1))}
                      disabled={activePageIndex === generatedPages.length - 1}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs border transition-all ${activePageIndex === generatedPages.length - 1
                        ? D ? "border-[#ffffff05] text-white/10 cursor-not-allowed" : "border-gray-100 text-gray-200 cursor-not-allowed"
                        : c.btn
                        }`}>→</button>
                  </div>
                )}
              </div>

              {/* Riwayat & Preset — selalu visible di kanan */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => setActiveTab(activeTab === "history" ? "result" : "history")}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${activeTab === "history" ? c.btnActive : c.btn}`}
                  title="Riwayat">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">Riwayat</span>
                  {history.length > 0 && <span className={`text-[9px] px-1 py-0.5 rounded-full ${activeTab === "history" ? D ? "bg-white/20" : "bg-black/10" : D ? "bg-white/8 text-white/40" : "bg-gray-200 text-gray-500"}`}>{history.length}</span>}
                </button>
                <button
                  onClick={() => setActiveTab(activeTab === "presets" ? "result" : "presets")}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${activeTab === "presets" ? c.btnActive : c.btn}`}
                  title="Preset">
                  <Save className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">Preset</span>
                  {presets.length > 0 && <span className={`text-[9px] px-1 py-0.5 rounded-full ${activeTab === "presets" ? D ? "bg-white/20" : "bg-black/10" : D ? "bg-white/8 text-white/40" : "bg-gray-200 text-gray-500"}`}>{presets.length}</span>}
                </button>
              </div>
            </div>
          </div>

          {/* (Baris 2 Toolbar atas sudah dihapus agar layar lebih luas) */}

          {/* Progress bar saat generating */}
          {isGenerating && (
            <div className={`h-1 w-full relative overflow-hidden ${D ? "bg-[#ffffff08]" : "bg-gray-100"}`}>
              <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-violet-500 to-indigo-400 transition-all duration-300" style={{ width: `${generateProgress}%` }} />
            </div>
          )}

          {/* ── MAIN CONTENT AREA ── */}
          <div className="flex-1 min-h-0 overflow-hidden flex relative">

            {/* === FLOATING TOOLBAR (Figma Style) === */}
            {generatedPages.length > 0 && activeTab === "result" && (
              <div className="absolute left-1/2 -translate-x-1/2 z-[60] flex items-center gap-1.5 px-3 py-2.5 rounded-2xl shadow-2xl backdrop-blur-2xl border transition-all animate-in slide-in-from-bottom-4 duration-500"
                style={{
                  bottom: "max(2rem, calc(2rem + env(safe-area-inset-bottom)))",
                  maxWidth: "calc(100vw - 2rem)",
                  background: D
                    ? "rgba(13, 13, 20, 0.85)"
                    : "rgba(255, 255, 255, 0.92)",
                  borderColor: D
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(139,92,246,0.2)",
                  boxShadow: D
                    ? "0 8px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)"
                    : "0 8px 40px rgba(139,92,246,0.15), 0 0 0 1px rgba(139,92,246,0.1)"
                }}>

                {/* Zoom Controls */}
                <div className={`flex items-center gap-1 rounded-xl p-1 ${D ? "bg-black/40" : "bg-gray-100/80"}`}>
                  <button onClick={() => setZoomLevel(z => Math.max(40, z - 20))} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${D ? "hover:bg-white/10 text-gray-300" : "hover:bg-white text-gray-600 hover:shadow-sm"}`}>
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className={`text-xs font-mono w-10 text-center font-bold ${D ? "text-gray-200" : "text-gray-800"}`}>{zoomLevel}%</span>
                  <button onClick={() => setZoomLevel(z => Math.min(200, z + 20))} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${D ? "hover:bg-white/10 text-gray-300" : "hover:bg-white text-gray-600 hover:shadow-sm"}`}>
                    <ZoomIn className="w-4 h-4" />
                  </button>
                </div>

                <div className={`w-px h-6 mx-1 ${D ? "bg-white/10" : "bg-gray-300"}`} />

                <button onClick={() => setFullscreenPage(generatedPages[activePageIndex])} className={`hidden sm:flex w-10 h-10 rounded-xl items-center justify-center transition-all ${D ? "hover:bg-white/10 text-gray-300" : "hover:bg-gray-100 text-gray-600"}`} title="Fullscreen">
                  <Maximize2 className="w-[18px] h-[18px]" />
                </button>
                <button onClick={() => handleCopyImageToClipboard(generatedPages[activePageIndex])} className={`hidden sm:flex w-10 h-10 rounded-xl items-center justify-center transition-all ${D ? "hover:bg-white/10 text-gray-300" : "hover:bg-gray-100 text-gray-600"}`} title="Copy Image">
                  <Copy className="w-[18px] h-[18px]" />
                </button>
                <button onClick={() => setGeneratedPages([])} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${D ? "hover:bg-red-500/20 text-red-400" : "hover:bg-red-50 text-red-500"}`} title="Hapus">
                  <X className="w-5 h-5" />
                </button>

                <div className={`hidden sm:block w-px h-6 mx-1 ${D ? "bg-white/10" : "bg-gray-300"}`} />

                <button onClick={() => handleDownloadSingle(generatedPages[activePageIndex])} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg active:scale-95 ${D ? "bg-violet-500 hover:bg-violet-400 text-white shadow-violet-500/25" : "bg-violet-600 hover:bg-violet-700 text-white shadow-violet-600/30"}`}>
                  <Download className="w-4 h-4" />
                  <span>JPG</span>
                </button>

                {/* Export Dropdown Trigger */}
                <button
                  ref={exportBtnRef}
                  onClick={() => {
                    if (showExportDropdown) { setShowExportDropdown(false); return; }
                    const rect = exportBtnRef.current?.getBoundingClientRect();
                    if (rect) setExportDropdownPos({ top: rect.top, left: rect.left, height: rect.height, width: rect.width });
                    setShowExportDropdown(true);
                  }}
                  className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all border ${showExportDropdown ? (D ? "bg-white/10 border-white/20" : "bg-gray-200 border-gray-300") : (D ? "border-transparent hover:bg-white/5" : "border-transparent hover:bg-gray-100")}`}>
                  <ChevronDown className={`w-4 h-4 ${D ? "text-gray-300" : "text-gray-600"} transition-transform duration-300 ${showExportDropdown ? "rotate-180" : ""}`} />
                </button>
              </div>
            )}

            {/* Thumbnail Strip Vertikal */}
            {(generatedPages.length > 1 || isGenerating) && activeTab === "result" && (
              <div className={`hidden lg:flex flex-col gap-2 p-2 w-[72px] flex-shrink-0 overflow-y-auto border-r scrollbar-thin ${c.divider} ${D ? "bg-[#09090b]" : "bg-violet-50/80"}`}>
                {generatedPages.map((p, idx) => (
                  <button
                    key={p.page}
                    onClick={() => setActivePageIndex(idx)}
                    className={`flex-shrink-0 w-full rounded-lg overflow-hidden border-2 transition-all ${idx === activePageIndex
                      ? "border-violet-500 shadow-lg shadow-violet-500/25 scale-[1.03]"
                      : D ? "border-[#ffffff10] hover:border-violet-500/40" : "border-gray-200 hover:border-violet-300"
                      }`}
                  >
                    <img src={p.image} alt={`Hal ${p.page}`} className="w-full object-cover object-top" style={{ aspectRatio: "210/297" }} />
                    <div className={`text-[8px] text-center py-0.5 font-mono font-semibold ${idx === activePageIndex ? "text-violet-400" : c.ts}`}>
                      {p.page}
                    </div>
                  </button>
                ))}

                {/* Skeleton halaman yang masih dalam proses generate */}
                {isGenerating && Array.from({
                  length: Math.max(0, (totalStreamPages ?? 0) - generatedPages.length)
                }).map((_, idx) => (
                  <div
                    key={`skeleton-${idx}`}
                    className={`flex-shrink-0 w-full rounded-lg overflow-hidden border-2 animate-pulse ${D ? "border-[#ffffff08]" : "border-gray-100"}`}>
                    <div
                      className={`w-full ${D ? "bg-white/4" : "bg-gray-100"}`}
                      style={{ aspectRatio: "210/297" }}>
                      <div className="w-full h-full flex flex-col gap-1.5 p-2 pt-3">
                        {Array.from({ length: 8 }).map((_, i) => (
                          <div
                            key={i}
                            className={`h-px rounded-full ${D ? "bg-white/8" : "bg-gray-300/60"}`}
                            style={{ width: `${55 + (i % 3) * 15}%` }}
                          />
                        ))}
                      </div>
                    </div>
                    <div className={`text-[8px] text-center py-0.5 font-mono ${D ? "text-white/10" : "text-gray-300"}`}>
                      {generatedPages.length + idx + 1}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Output viewer utama (Figma-style Workspace) */}
            <div
              className={`relative flex-1 overflow-y-auto scrollbar-thin pb-24 ${D
                ? "bg-[#060610]"
                : "bg-gradient-to-br from-sky-100/80 via-indigo-50 to-violet-100/80"
                }`}
              style={{
                backgroundImage: D
                  ? "radial-gradient(#ffffff09 1px, transparent 1px)"
                  : "radial-gradient(#8b5cf630 1px, transparent 1px)",
                backgroundSize: "28px 28px",
              }}>

              <AnimatePresence mode="wait">
                {(() => {
                  // Mencegah error multiple children: Hanya render SATU root element pada satu waktu
                  if (activeTab !== "result") return null;

                  // STATE 1: Sedang Loading / Generating pertama kali
                  if (isGenerating && streamedPages.length === 0) {
                    return (
                      <motion.div key="generating" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                        className="flex items-center justify-center h-full min-h-[400px] flex-col gap-6">
                        <div className="relative w-24 h-24 flex items-center justify-center">
                          <div className="absolute inset-0 rounded-full border-4 border-violet-500/10 dark:border-violet-500/20" />
                          <div className="absolute inset-0 rounded-full border-4 border-violet-500 border-t-transparent animate-spin" />
                          <div className="absolute inset-2 rounded-full border-4 border-indigo-400/80 border-b-transparent animate-[spin_1.5s_reverse_infinite]" />
                          <PenTool className={`w-8 h-8 animate-pulse relative z-10 ${D ? "text-violet-400" : "text-violet-600"}`} />
                          <div className="absolute inset-0 bg-violet-500/20 blur-xl rounded-full animate-pulse" />
                        </div>
                        <div className="text-center max-w-[240px] w-full">
                          <p className={`text-base font-bold mb-2 bg-gradient-to-r ${c.accent} bg-clip-text text-transparent`}>
                            {generateProgress < 20 ? "Menyiapkan pena..." : generateProgress < 50 ? "Menulis goresan pertama..." : generateProgress < 80 ? "Menambahkan tekstur..." : "Sedikit lagi selesai..."}
                          </p>
                          <p className={`text-xs font-medium ${c.ts} mb-5 flex items-center justify-center gap-1.5`}>
                            <span>AI sedang bekerja</span>
                            <span className="flex gap-0.5 mt-1">
                              <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }} />
                              <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: "150ms" }} />
                              <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: "300ms" }} />
                            </span>
                          </p>
                          <div className={`w-full h-2.5 rounded-full overflow-hidden p-0.5 ${D ? "bg-[#ffffff0a] shadow-inner" : "bg-gray-200 shadow-inner"}`}>
                            <div className="h-full bg-gradient-to-r from-violet-500 via-indigo-400 to-violet-500 rounded-full transition-all duration-500 relative" style={{ width: `${Math.max(5, generateProgress)}%` }}>
                              <div className="absolute top-0 left-0 right-0 h-1/2 bg-white/20 rounded-full" />
                            </div>
                          </div>
                          <p className={`text-[11px] mt-2.5 font-mono tracking-widest ${c.ts}`}>{Math.round(generateProgress)}% COMPLETE</p>
                        </div>
                      </motion.div>
                    );
                  }

                  // STATE 2: Ada Halaman (Selesai atau Streaming)
                  if (generatedPages.length > 0 || streamedPages.length > 0) {
                    const page = generatedPages.length > 0 ? generatedPages[activePageIndex] : streamedPages[streamedPages.length - 1];
                    if (!page) return null;
                    return (
                      <motion.div
                        key={`page-${page.page}-${activePageIndex}`}
                        initial={{ opacity: 0, rotateY: -8, scale: 0.98 }}
                        animate={{ opacity: 1, rotateY: 0, scale: 1 }}
                        exit={{ opacity: 0, rotateY: 8, scale: 0.98 }}
                        transition={{ type: "spring", damping: 30, stiffness: 250 }}
                        className="p-4 lg:p-8 flex items-start justify-center min-h-full"
                        style={{ perspective: "1200px" }}
                      >
                        <div className="relative" style={{ width: `${zoomLevel}%`, maxWidth: "100%" }}>
                          <img src={page.image} alt={`Halaman ${page.page}`} className="w-full rounded-xl shadow-2xl cursor-zoom-in block" style={{ boxShadow: D ? "0 32px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04)" : "0 32px 80px rgba(0,0,0,0.25)" }} onClick={() => generatedPages.length > 0 && setFullscreenPage(page)} />
                          {isGenerating && streamedPages.length > 0 && (
                            <div className={`absolute bottom-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-lg backdrop-blur-sm ${D ? "bg-black/70 text-violet-400" : "bg-white/90 text-violet-600"}`}>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span className="text-[11px] font-medium">Menulis {streamedPages.length}/{totalStreamPages}</span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  }

                  // STATE 3: Kosong
                  return (
                    <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="flex items-center justify-center h-full min-h-[400px] p-8">
                      <div className="text-center max-w-sm">
                        {/* Animated Icon */}
                        <div className="relative w-24 h-24 mx-auto mb-6">
                          <div className={`absolute inset-0 rounded-3xl ${D ? "bg-gradient-to-br from-violet-900/40 to-indigo-900/40 border border-violet-700/20" : "bg-gradient-to-br from-violet-100 to-indigo-100 border border-violet-200"}`} />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <PenTool className={`w-10 h-10 ${D ? "text-violet-400/60" : "text-violet-400"}`} />
                          </div>
                          {/* Decorative dots */}
                          <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${D ? "bg-indigo-500/40" : "bg-indigo-300"}`} />
                          <div className={`absolute -bottom-1 -left-1 w-2 h-2 rounded-full ${D ? "bg-violet-500/40" : "bg-violet-300"}`} />
                        </div>

                        <p className={`text-base font-bold mb-2 ${D ? "text-white/70" : "text-gray-700"}`}>
                          Hasil akan tampil di sini
                        </p>
                        <p className={`text-[12px] leading-relaxed mb-6 ${c.ts}`}>
                          Ketik teks di editor, pilih font & folio di sidebar, lalu klik Generate.
                        </p>

                        {/* Step hints */}
                        <div className="space-y-2 text-left mb-6">
                          {[
                            { icon: "📝", label: "Ketik atau paste teks", color: D ? "bg-indigo-900/30 border-indigo-700/30" : "bg-indigo-50 border-indigo-100" },
                            { icon: "🎨", label: "Pilih font & folio di sidebar", color: D ? "bg-violet-900/30 border-violet-700/30" : "bg-violet-50 border-violet-100" },
                            { icon: "✨", label: "Klik Generate atau Ctrl+Enter", color: D ? "bg-purple-900/30 border-purple-700/30" : "bg-purple-50 border-purple-100" },
                          ].map((step, i) => (
                            <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-xl border text-xs ${step.color}`}>
                              <span className="text-base">{step.icon}</span>
                              <span className={D ? "text-white/50" : "text-gray-600"}>{step.label}</span>
                            </div>
                          ))}
                        </div>

                        <button
                          onClick={handleLoadDemo}
                          className={`w-full mb-3 py-2.5 rounded-xl text-xs font-bold border-2 border-dashed transition-all hover:scale-[1.02] active:scale-95 ${D
                            ? "border-violet-500/40 text-violet-400 hover:border-violet-500/70 hover:bg-violet-500/8"
                            : "border-violet-400 text-violet-600 hover:border-violet-500 hover:bg-violet-50"
                            }`}
                        >
                          ✍️ Coba Teks Demo — langsung isi & pilih font otomatis
                        </button>

                        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] ${D ? "bg-white/4 border-[#ffffff08] text-white/25" : "bg-violet-50 border-violet-100 text-violet-400"}`}>
                          <kbd className={`font-mono px-1.5 py-0.5 rounded text-[9px] ${D ? "bg-white/8" : "bg-white border border-violet-200"}`}>Ctrl+Enter</kbd>
                          <span>untuk Generate cepat</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })()}
              </AnimatePresence>
            </div>

            {/* ── RIWAYAT DRAWER (slide dari kanan) ── */}
            <AnimatePresence>
              {activeTab === "history" && (
                <motion.div
                  key="history-drawer"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 320, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  className={`flex-shrink-0 border-l overflow-hidden ${c.sidebar} ${c.divider}`}
                  style={{ width: 320 }}>
                  <div className="w-[320px] h-full flex flex-col">
                    <div className={`flex items-center justify-between px-4 py-3 border-b flex-shrink-0 ${c.divider}`}>
                      <div className="flex items-center gap-2">
                        <Clock className={`w-4 h-4 ${c.ts}`} />
                        <span className={`text-sm font-semibold ${c.tp}`}>Riwayat</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {history.length > 0 && (
                          <button onClick={async () => {
                            setHistory([]);
                            localStorage.removeItem("hw_history");
                            // Hapus semua riwayat milik user ini di cloud
                            if (user) {
                              await supabase.from('user_history').delete().eq('user_id', user.id);
                            }
                          }}
                            className={`text-[11px] flex items-center gap-1 px-2 py-1 rounded-lg transition-all ${D ? "text-red-400/70 hover:bg-red-500/10 border border-[#ffffff08]" : "text-red-500 hover:bg-red-50 border border-red-200"}`}>
                            <Trash2 className="w-3 h-3" />Hapus
                          </button>
                        )}
                        <button onClick={() => setActiveTab("result")} className={`w-7 h-7 rounded-lg flex items-center justify-center ${c.btn}`}>
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin">
                      {history.length === 0 ? (
                        <div className="py-12 text-center">
                          <Clock className={`w-8 h-8 mx-auto mb-3 ${c.ts} opacity-40`} />
                          <p className={`text-sm ${c.tm}`}>Belum ada riwayat</p>
                        </div>
                      ) : history.map((item) => (
                        <div key={item.id} className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${c.pillBorder} ${c.rowHover}`}>
                          <div className={`w-14 h-20 rounded-lg overflow-hidden flex-shrink-0 border shadow-sm ${D ? "border-[#ffffff14]" : "border-gray-200"}`}>
                            {item.thumbnail
                              ? <img src={item.thumbnail} alt="" className="w-full h-full object-cover object-top" />
                              : <div className={`w-full h-full flex flex-col items-center justify-center gap-1 ${D ? "bg-violet-500/12" : "bg-violet-100"}`}>
                                <FileText className="w-4 h-4 text-violet-500" />
                                <span className="text-[8px] text-violet-400 font-medium">{item.pageCount} hal</span>
                              </div>
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-[11px] font-semibold leading-snug line-clamp-2 ${c.tm}`}>{item.textPreview}</p>
                            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-md border ${D ? "bg-white/5 border-[#ffffff10] text-white/50" : "bg-gray-50 border-gray-200 text-gray-500"}`}
                                style={{ fontFamily: FONT_FAMILY_MAP[item.fontName] || "inherit" }}>
                                {item.fontName}
                              </span>
                              <span className={`text-[9px] ${c.ts}`}>{item.pageCount} hal</span>
                            </div>
                            <p className={`text-[9px] mt-1 ${c.ts}`}>{formatTime(item.timestamp)}</p>
                            <div className="flex items-center gap-1 mt-2">
                              <button onClick={() => restoreHistory(item)}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all border ${D ? "bg-indigo-500/12 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/20" : "bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100"}`}>
                                Pulihkan
                              </button>
                              <button onClick={() => deleteHistory(item.id)}
                                className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ml-auto ${D ? "text-white/20 hover:bg-red-500/10 hover:text-red-400" : "text-gray-300 hover:bg-red-50 hover:text-red-500"}`}>
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── PRESET DRAWER (slide dari kanan) ── */}
            <AnimatePresence>
              {activeTab === "presets" && (
                <motion.div
                  key="preset-drawer"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 320, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  className={`flex-shrink-0 border-l overflow-hidden ${c.sidebar} ${c.divider}`}>
                  <div className="w-[320px] h-full flex flex-col">
                    <div className={`flex items-center justify-between px-4 py-3 border-b flex-shrink-0 ${c.divider}`}>
                      <div className="flex items-center gap-2">
                        <Save className={`w-4 h-4 ${c.ts}`} />
                        <span className={`text-sm font-semibold ${c.tp}`}>Preset</span>
                      </div>
                      <button onClick={() => setActiveTab("result")} className={`w-7 h-7 rounded-lg flex items-center justify-center ${c.btn}`}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin">
                      {/* Save preset */}
                      <div className={`flex gap-2 p-3 rounded-xl border ${c.pillBorder} ${c.pill}`}>
                        <input type="text" placeholder="Nama preset..." value={presetName}
                          onChange={(e) => setPresetName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && savePreset()}
                          className={`flex-1 px-3 py-1.5 text-xs border rounded-lg transition-colors ${c.input}`} />
                        <button onClick={savePreset}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r ${c.accent} text-white hover:opacity-90`}>
                          <Save className="w-3 h-3" />Simpan
                        </button>
                      </div>
                      <p className={`text-[10px] ${c.ts}`}>Menyimpan: font, folio, warna, spasi, dan semua config.</p>
                      {presets.length === 0 ? (
                        <div className="py-10 text-center">
                          <Save className={`w-7 h-7 mx-auto mb-2.5 ${c.ts} opacity-40`} />
                          <p className={`text-sm ${c.tm}`}>Belum ada preset</p>
                        </div>
                      ) : presets.map((preset) => (
                        <div key={preset.id} className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all ${c.pillBorder} ${c.rowHover}`}>
                          <div className="w-7 h-7 rounded-lg flex-shrink-0 ring-1 ring-black/10" style={{ backgroundColor: preset.config.color }} />
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-semibold truncate ${c.tp}`}>{preset.name}</p>
                            <p className={`text-[10px] ${c.ts}`}>{fonts[preset.fontId]?.name || preset.fontId}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => loadPreset(preset)}
                              className={`px-2 py-1 rounded-md text-[10px] font-medium border transition-all ${D ? "bg-violet-500/12 text-violet-400 border-violet-500/20 hover:bg-violet-500/20" : "bg-violet-50 text-violet-600 border-violet-200"}`}>
                              Muat
                            </button>
                            <button onClick={() => deletePreset(preset.id)}
                              className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${D ? "text-white/20 hover:bg-red-500/10 hover:text-red-400" : "text-gray-300 hover:bg-red-50 hover:text-red-500"}`}>
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        </main>

        {/* ══ MOBILE: Editor + Output tabs (< md) ══ */}
        <div className="flex md:hidden flex-col w-full overflow-hidden" style={{ height: "calc(100dvh - 56px)" }}>
          {/* Mobile tab switcher (Modern iOS Style) */}
          <div className={`flex-shrink-0 px-4 py-3 border-b ${c.divider} ${D ? "bg-[#09090b]" : "bg-white"}`}>
            <div className={`flex p-1 rounded-xl relative ${D ? "bg-[#ffffff08]" : "bg-violet-100/60"}`}>
              {[
                { id: "editor", label: "✏️ Editor" },
                { id: "result", label: "✨ Hasil" },
              ].map((tab) => {
                const isActive = activeTab === tab.id || (tab.id === "editor" && activeTab === "presets");
                return (
                  <button key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-300 relative z-10 ${isActive ? (D ? "text-white" : "text-gray-900") : c.ts
                      }`}>
                    {tab.label}
                  </button>
                );
              })}
              {/* Animasi background pill (kapsul yang bergeser) */}
              <div
                className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg transition-all duration-300 ease-out shadow-sm ${D
                  ? "bg-[#13131f] border border-[#ffffff0d]"
                  : "bg-white border border-violet-200 shadow-violet-100"}`}
                style={{ left: (activeTab === "result" ? "calc(50% + 2px)" : "4px") }}
              />
            </div>
          </div>

          {/* Mobile editor panel */}
          {activeTab !== "result" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 scrollbar-thin space-y-3">
                {/* Mobile toolbar — scroll horizontal */}
                <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
                  <div className="flex items-center gap-2 flex-nowrap min-w-max pb-1">
                    <button onClick={async () => {
                      try { const t = await navigator.clipboard.readText(); setInputText(t); setText(t); toast.success("Ditempel!"); }
                      catch { toast.error("Gagal akses clipboard"); }
                    }} className={`flex items-center gap-1.5 text-[11px] px-3 py-2 rounded-xl border flex-shrink-0 ${c.btn}`}>
                      <Clipboard className="w-3.5 h-3.5" /><span>Tempel</span>
                    </button>
                    <button onClick={() => setShowAiModal(true)}
                      className={`flex items-center gap-1.5 text-[11px] px-3 py-2 rounded-xl border flex-shrink-0 ${D ? "bg-indigo-500/8 text-indigo-400 border-indigo-500/20" : "bg-indigo-50 text-indigo-600 border-indigo-200"}`}>
                      <Bot className="w-3.5 h-3.5" /><span>Tulis AI</span>
                    </button>
                    <button onClick={toggleListening}
                      className={`flex items-center gap-1.5 text-[11px] px-3 py-2 rounded-xl border flex-shrink-0 ${isListening ? "bg-red-500/15 text-red-400 border-red-500/30 animate-pulse" : c.btn}`}>
                      <Mic className="w-3.5 h-3.5" /><span>{isListening ? "Dengerin..." : "Dikte"}</span>
                    </button>
                    <button onClick={() => { setInputText(""); setText(""); toast.success("Teks dihapus!"); }}
                      disabled={!text}
                      className={`flex items-center gap-1.5 text-[11px] px-3 py-2 rounded-xl border flex-shrink-0 ${!text ? "opacity-35 cursor-not-allowed " + c.btn : D ? "hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/25 " + c.btn : "hover:bg-red-50 hover:text-red-600 hover:border-red-200 " + c.btn}`}>
                      <Trash2 className="w-3.5 h-3.5" /><span>Hapus</span>
                    </button>
                    {currentFolio && (
                      <>
                        <div className={`w-px h-5 flex-shrink-0 ${D ? "bg-white/10" : "bg-gray-200"}`} />
                        <span className={`flex items-center gap-1.5 text-[11px] px-3 py-2 rounded-xl border flex-shrink-0 ${c.tag}`}>
                          <span>📄</span><span className="max-w-[70px] truncate">{currentFolio.name}</span>
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <textarea ref={textareaRef} value={inputText} onChange={(e) => setInputText(e.target.value)}
                  placeholder="Ketik atau paste teks di sini..."
                  className={`w-full resize-none rounded-2xl px-4 py-3.5 text-sm leading-relaxed outline-none border-2 focus:border-violet-500/60 ${D ? "bg-[#0f0f12] border-[#ffffff10] text-white placeholder-white/20" : "bg-white/40 border-white/60 shadow-inner backdrop-blur-md text-gray-900 placeholder-indigo-900/40 caret-violet-600"
                    }`} style={{ minHeight: "240px" }} />
                {text.length > 0 && (
                  <div className={`h-1 rounded-full overflow-hidden ${D ? "bg-[#ffffff08]" : "bg-gray-200"}`}>
                    <div className={`h-full rounded-full ${text.length > 45000 ? "bg-red-500" : D ? "bg-emerald-500" : "bg-emerald-600"}`}
                      style={{ width: `${Math.min(100, (text.length / 50000) * 100)}%` }} />
                  </div>
                )}
              </div>

              {/* Generate bar — sticky, ikut naik saat keyboard muncul */}
              <div
                className={`flex-shrink-0 flex items-center gap-3 px-4 py-3 border-t ${c.divider} ${D ? "bg-[#09090b]/95" : "bg-white/95"} backdrop-blur-xl`}
                style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
                <div className="flex-1 min-w-0">
                  {currentFont ? (
                    <p className={`text-[12px] font-semibold truncate ${c.tp}`} style={{ fontFamily: FONT_FAMILY_MAP[currentFont.name] || currentFont.name }}>
                      {currentFont.name}
                    </p>
                  ) : (
                    <p className={`text-[11px] ${c.ts}`}>Pilih font di Pengaturan</p>
                  )}
                  <p className={`text-[10px] ${c.ts}`}>{wordCount} kata · {currentFolio?.name || "Pilih folio"}</p>
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !text.trim() || !selectedFolio}
                  className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all flex-shrink-0 shadow-lg active:scale-95 ${isGenerating || !text.trim() || !selectedFolio
                    ? D ? "bg-white/4 text-white/20 cursor-not-allowed border border-[#ffffff06] shadow-none" : "bg-gray-100 text-gray-300 cursor-not-allowed border border-gray-200 shadow-none"
                    : `bg-gradient-to-r ${c.accent} text-white shadow-violet-500/30`
                    }`}>
                  {isGenerating
                    ? <><Loader2 className="w-4 h-4 animate-spin" /><span>{Math.round(generateProgress)}%</span></>
                    : <><Sparkles className="w-4 h-4" /><span>Generate{estimatedPages > 1 ? ` (${estimatedPages})` : ""}</span></>
                  }
                </button>
              </div>
            </div>
          )}

          {/* Mobile result panel */}
          {activeTab === "result" && (
            <div className={`flex-1 overflow-y-auto pb-24 scrollbar-thin ${D ? "bg-[#060608]" : "bg-gray-100"}`}>
              {generatedPages.length > 0 ? (
                <div className="p-4">
                  {generatedPages.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
                      {generatedPages.map((p, idx) => (
                        <button key={p.page} onClick={() => setActivePageIndex(idx)}
                          className={`flex-shrink-0 rounded-lg overflow-hidden border-2 ${idx === activePageIndex ? "border-violet-500" : D ? "border-[#ffffff10]" : "border-gray-200"}`}
                          style={{ width: 36 }}>
                          <img src={p.image} alt={`Hal ${p.page}`} className="w-full object-cover" style={{ aspectRatio: '210/297' }} />
                        </button>
                      ))}
                    </div>
                  )}
                  <div
                    style={{ transform: `scale(${mobileZoom / 100})`, transformOrigin: "top center", transition: "transform 0.1s ease" }}
                    onTouchStart={(e) => {
                      if (e.touches.length === 2) {
                        // Pinch start
                        const dx = e.touches[0].clientX - e.touches[1].clientX;
                        const dy = e.touches[0].clientY - e.touches[1].clientY;
                        pinchStartDistRef.current = Math.sqrt(dx * dx + dy * dy);
                        pinchStartZoomRef.current = mobileZoom;
                      } else {
                        swipeStartXRef.current = e.touches[0].clientX;
                        swipeStartYRef.current = e.touches[0].clientY;
                      }
                    }}
                    onTouchMove={(e) => {
                      if (e.touches.length === 2 && pinchStartDistRef.current !== null) {
                        e.preventDefault();
                        const dx = e.touches[0].clientX - e.touches[1].clientX;
                        const dy = e.touches[0].clientY - e.touches[1].clientY;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        const ratio = dist / pinchStartDistRef.current;
                        const newZoom = Math.min(250, Math.max(60, pinchStartZoomRef.current * ratio));
                        setMobileZoom(Math.round(newZoom));
                      }
                    }}
                    onTouchEnd={(e) => {
                      if (pinchStartDistRef.current !== null) {
                        pinchStartDistRef.current = null;
                        return;
                      }
                      if (swipeStartXRef.current === null) return;
                      const deltaX = e.changedTouches[0].clientX - swipeStartXRef.current;
                      const deltaY = e.changedTouches[0].clientY - (swipeStartYRef.current ?? 0);
                      if (Math.abs(deltaX) < Math.abs(deltaY) || Math.abs(deltaX) < 40) return;
                      if (deltaX < 0) {
                        setActivePageIndex(i => Math.min(generatedPages.length - 1, i + 1));
                      } else {
                        setActivePageIndex(i => Math.max(0, i - 1));
                      }
                      swipeStartXRef.current = null;
                      swipeStartYRef.current = null;
                    }}>
                    <img
                      src={generatedPages[activePageIndex]?.image}
                      alt="Hasil"
                      className="w-full rounded-xl shadow-xl select-none"
                      onClick={() => mobileZoom === 100 && setFullscreenPage(generatedPages[activePageIndex])}
                    />
                    {generatedPages.length > 1 && (
                      <div className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold backdrop-blur-md shadow-sm ${isDark ? "bg-black/60 text-white/90" : "bg-white/80 text-gray-800"
                        }`}>
                        {activePageIndex + 1} / {generatedPages.length}
                      </div>
                    )}
                  </div>


                  {/* Reset zoom jika diperbesar */}
                  {mobileZoom !== 100 && (
                    <button
                      onClick={() => setMobileZoom(100)}
                      className={`mt-2 mx-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-medium border transition-all ${c.btn}`}>
                      <ZoomOut className="w-3 h-3" />Reset Zoom ({mobileZoom}%)
                    </button>
                  )}
                  {/* Indikator swipe halaman */}
                  {generatedPages.length > 1 && (
                    <div className="flex justify-center gap-1.5 mt-3">
                      {generatedPages.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => setActivePageIndex(idx)}
                          className={`rounded-full transition-all duration-300 ${idx === activePageIndex
                            ? "w-5 h-1.5 bg-violet-500"
                            : D ? "w-1.5 h-1.5 bg-white/20" : "w-1.5 h-1.5 bg-gray-300"
                            }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : isGenerating ? (
                <div className="flex items-center justify-center h-full min-h-[300px] flex-col gap-4">
                  <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
                  <p className={`text-sm ${c.tm}`}>Generating {Math.round(generateProgress)}%</p>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full min-h-[300px]">
                  <p className={`text-sm ${c.ts}`}>Klik Generate untuk mulai</p>
                </div>
              )}

              {/* FAB: Generate ulang saat di tab Hasil */}
              <button
                onClick={() => setActiveTab("editor" as any)}
                className={`fixed bottom-24 right-4 w-12 h-12 rounded-full shadow-2xl flex items-center justify-center z-40 bg-gradient-to-br ${c.accent} text-white`}
                style={{ boxShadow: "0 8px 24px rgba(139,92,246,0.4)" }}
              >
                <PenTool className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

      </div>

      {/* ── EXPORT DROPDOWN PORTAL — fixed di atas semua layer ── */}
      <AnimatePresence>
        {showExportDropdown && exportDropdownPos && (
          <>
            <div className="fixed inset-0 z-[90]" onClick={() => setShowExportDropdown(false)} />
            <motion.div
              ref={exportDropdownRef}
              // Animasi menyesuaikan arah buka (dari bawah atau dari atas)
              initial={{ opacity: 0, y: exportDropdownPos.top > (typeof window !== 'undefined' ? window.innerHeight : 800) / 2 ? 10 : -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: exportDropdownPos.top > (typeof window !== 'undefined' ? window.innerHeight : 800) / 2 ? 10 : -10, scale: 0.95 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              style={{
                position: "fixed",
                left: Math.min(exportDropdownPos.left - 120, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 200),
                ...(typeof window !== 'undefined' && exportDropdownPos.top > window.innerHeight / 2
                  ? { bottom: window.innerHeight - exportDropdownPos.top + 16 }
                  : { top: exportDropdownPos.top + exportDropdownPos.height + 16 }),
                zIndex: 9999,
              }}
              className={`w-48 rounded-2xl border shadow-2xl overflow-hidden backdrop-blur-xl ${D
                ? "bg-[#0d0d14]/95 border-[#ffffff10] shadow-[0_16px_48px_rgba(0,0,0,0.7)]"
                : "bg-white/98 border-violet-200 shadow-[0_16px_48px_rgba(139,92,246,0.2)]"}`}>
              <div className="p-1">
                <button onClick={() => { handleDownloadAllPng(); setShowExportDropdown(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${c.rowHover} ${c.tm}`}>
                  <div className="w-6 h-6 rounded-md flex items-center justify-center bg-violet-500/15">
                    <Download className="w-3.5 h-3.5 text-violet-500" />
                  </div>Semua JPG
                </button>
                <button onClick={() => { handleDownloadZip(); setShowExportDropdown(false); }}
                  disabled={isDownloadingZip}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${c.rowHover} ${c.tm} ${isDownloadingZip ? "opacity-50" : ""}`}>
                  <div className="w-6 h-6 rounded-md flex items-center justify-center bg-emerald-500/15">
                    {isDownloadingZip ? <Loader2 className="w-3.5 h-3.5 text-emerald-500 animate-spin" /> : <Package className="w-3.5 h-3.5 text-emerald-500" />}
                  </div>ZIP Archive
                </button>
                <div className={`my-1 h-px ${D ? "bg-white/8" : "bg-gray-100"}`} />
                <button onClick={() => { handleExportPdf(); setShowExportDropdown(false); }}
                  disabled={isExportingPdf}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${c.rowHover} ${c.tm} ${isExportingPdf ? "opacity-50" : ""}`}>
                  <div className="w-6 h-6 rounded-md flex items-center justify-center bg-amber-500/15">
                    {isExportingPdf ? <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" /> : <FileDown className="w-3.5 h-3.5 text-amber-500" />}
                  </div>PDF
                </button>
                <button onClick={async () => {
                  setShowExportDropdown(false);
                  const tid = toast.loading("Membuat PNG transparan...");
                  try {
                    const res = await fetch(`${API_URL}/api/download/transparent`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ imageData: generatedPages[activePageIndex].image })
                    });
                    if (!res.ok) throw new Error();
                    const blob = await res.blob();
                    saveAs(blob, `tulisan_transparan_hal${activePageIndex + 1}.png`);
                    toast.success("PNG transparan berhasil!", { id: tid });
                  } catch { toast.error("Gagal export", { id: tid }); }
                }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${c.rowHover} ${c.tm}`}>
                  <div className="w-6 h-6 rounded-md flex items-center justify-center bg-purple-500/15">
                    <ImageIcon className="w-3.5 h-3.5 text-purple-500" />
                  </div>PNG Transparan
                </button>
                <button onClick={() => { handleExportDocx(); setShowExportDropdown(false); }}
                  disabled={isExportingDocx}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${c.rowHover} ${c.tm} ${isExportingDocx ? "opacity-50" : ""}`}>
                  <div className="w-6 h-6 rounded-md flex items-center justify-center bg-blue-500/15">
                    {isExportingDocx ? <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" /> : <FileText className="w-3.5 h-3.5 text-blue-500" />}
                  </div>Word (.docx)
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── MOBILE BOTTOM BAR (Modern Floating Dock) ── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden pointer-events-none p-4 safe-area-pb">
        {/* Notifikasi proses tulis melayang di atas dock */}
        <AnimatePresence>
          {isGenerating && totalStreamPages > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
              className={`absolute -top-12 left-0 right-0 mx-auto w-max max-w-[90%] px-4 py-2 rounded-full text-[10px] font-medium text-center shadow-lg pointer-events-auto backdrop-blur-md border ${D ? "bg-violet-500/20 text-violet-300 border-violet-500/30" : "bg-white/90 text-violet-700 border-violet-200"}`}>
              <Loader2 className="w-3 h-3 animate-spin inline mr-1.5 -mt-0.5" />
              Menulis halaman {streamedPages.length} dari {totalStreamPages}
              {totalStreamPages > 0 && streamedPages.length > 0 && (
                <span className="ml-1 opacity-60">
                  · ~{Math.ceil((totalStreamPages - streamedPages.length) * 3)}s lagi
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dock Kaca (Glassmorphism) */}
        <div className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl shadow-2xl pointer-events-auto backdrop-blur-xl border transition-all ${D
          ? "bg-[#0d0d14]/90 border-[#ffffff10] shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
          : "bg-white/90 border-violet-200 shadow-[0_8px_32px_rgba(139,92,246,0.15)]"}`}>
          <button onClick={() => setMobileSidebarOpen(true)}
            className={`flex md:hidden w-8 h-8 rounded-lg items-center justify-center transition-all ${c.btn}`}>
            <Menu className="w-3.5 h-3.5" />
          </button>

          <div className="flex-1 min-w-0 pl-1 relative">
            {currentFont ? (
              <span className={`text-[12px] font-bold truncate block ${c.tp}`} style={{ fontFamily: FONT_FAMILY_MAP[currentFont.name] || currentFont.name }}>
                {currentFont.name}
              </span>
            ) : (
              <span className={`text-[11px] ${c.ts}`}>Pilih font...</span>
            )}
            <span className={`text-[9px] mt-0.5 block truncate ${c.ts}`}>
              {wordCount} kata • Est. {estimatedPages} hal
            </span>
            {isGenerating && (
              <div className="absolute -bottom-2.5 left-0 right-0 h-[2px] opacity-70">
                <div className="h-full bg-gradient-to-r from-violet-500 to-indigo-400 transition-all duration-500" style={{ width: `${generateProgress}%` }} />
              </div>
            )}
          </div>

          {generatedPages.length > 0 && typeof navigator !== "undefined" && !!navigator.share && (
            <button
              onClick={() => handleSharePage(generatedPages[activePageIndex])}
              className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 transition-all ${c.btn}`}
              title="Bagikan ke WA/Telegram"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </button>
          )}

          <button onClick={handleGenerate} disabled={isGenerating || !text.trim() || !selectedFolio}
            className={`flex items-center gap-1.5 px-5 py-3 rounded-xl font-bold text-sm transition-all flex-shrink-0 shadow-lg ${isGenerating || !text.trim() || !selectedFolio
              ? D ? "bg-white/4 text-white/20 cursor-not-allowed border border-[#ffffff06] shadow-none" : "bg-gray-100 text-gray-300 cursor-not-allowed border border-gray-200 shadow-none"
              : `bg-gradient-to-r ${c.accent} text-white hover:opacity-90 active:scale-95`
              }`}>
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin mx-3" /> : <><Sparkles className="w-4 h-4" /><span>Generate</span></>}
          </button>
        </div>
      </div>

    </div>
  );
}