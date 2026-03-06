"use client";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  FileText, Download, Settings, Sparkles, Image as ImageIcon,
  Moon, Sun, ZoomIn, ZoomOut, ChevronDown, Package, RefreshCw, X,
  PanelLeftClose, PanelLeftOpen, Maximize2, FileDown,
  Clock, Trash2, CheckCircle2, Loader2, PenTool, Save, Copy,
  Link, Clipboard, Wifi, WifiOff, Menu, Bot, Mic, LogIn, LogOut,
  Zap, MessageCircle, BookOpen, Wand2, Sigma
} from "lucide-react";
import { supabase, supabaseConfigured } from "./lib/supabase";
import toast, { Toaster } from "react-hot-toast";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
import dynamic from "next/dynamic";
import confetti from "canvas-confetti";
import { Caveat } from "next/font/google";
import "react-image-crop/dist/ReactCrop.css";
import type { Crop, PixelCrop } from "react-image-crop";
import type { User as SupabaseUser } from "@supabase/supabase-js";

// ─── Extracted modules ─────────────────────────────────
import type { Font, Folio, GeneratedPage, HistoryItem, SavedPreset } from "./lib/types";
import { FONT_FAMILY_MAP, INK_PRESETS, DEMO_TEXT, DEFAULT_CONFIG, SECTION_COLORS } from "./lib/constants";
import { getApiUrl } from "./lib/api";
import { compressThumbnail, formatTime, safeSetHistory } from "./lib/utils";

// ─── Extracted components ───────────────────────────────
import SidebarSection from "./components/SidebarSection";
import OdometerNumber from "./components/OdometerNumber";
import TypewriterText from "./components/TypewriterText";
import MagneticHover from "./components/MagneticHover";
import BeforeAfterSlider from "./components/BeforeAfterSlider";
import LiquidGlassSlider from "./components/LiquidGlassSlider";
import LiquidGlassToggleMorph from "./components/LiquidGlassToggleMorph";
import DraggableLiquidTabs from "./components/DraggableLiquidTabs";
import { OptimizedTextarea, OptimizedInput } from "./components/OptimizedInputs";

// ─── Extracted hooks ────────────────────────────────────
import { useAuth } from "./hooks/useAuth";
import { useCloudSync } from "./hooks/useCloudSync";

// ─── Dynamic imports (lazy-loaded) ─────────────────────
const QRCodeSVG = dynamic(() => import("qrcode.react").then(mod => ({ default: mod.QRCodeSVG })), { ssr: false, loading: () => <div className="w-full h-full bg-gray-100 animate-pulse rounded" /> });
const FlipBook = dynamic(() => import("react-pageflip"), { ssr: false }) as any;
const ReactCrop = dynamic(() => import("react-image-crop"), { ssr: false });

// PERF: Caveat font di-load di level page (hanya dipakai di landing hero)
const caveat = Caveat({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-caveat",
});

export default function Home() {

  // PERF + HYDRATION FIX: Mounted guard
  const [mounted, setMounted] = useState(false);
  const API_URL = useMemo(() => getApiUrl(), []);
  useEffect(() => { setMounted(true); }, []);

  // ── Auth & Cloud Sync (extracted hooks) ────────────────────────────────────
  const { user, showEditor, setShowEditor, handleLogin, handleLogout } = useAuth();

  // Apple device detection (was previously inside auth useEffect)
  useEffect(() => {
    setIsAppleDevice(/iPhone|iPad|iPod|Mac/i.test(navigator.userAgent));
  }, []);

  const [inputText, setInputText] = useState("");
  const [text, setText] = useState("");
  const [hideMobileDock, setHideMobileDock] = useState(false);
  const [hideHeader, setHideHeader] = useState(false);
  const lastHeaderScrollRef = useRef(0);
  const lastScrollYRef = useRef(0);
  const [energy, setEnergy] = useState<number>(5); // Modal awal 5 Energi untuk user gratis
  const [showQrisModal, setShowQrisModal] = useState(false);
  const [selectedFont, setSelectedFont] = useState("indie_flower");
  const [selectedFolio, setSelectedFolio] = useState("");
  const [selectedFolioEven, setSelectedFolioEven] = useState("");
  const [useDoubleFolio, setUseDoubleFolio] = useState(false);
  const [fonts, setFonts] = useState<Record<string, Font>>({});
  const [folios, setFolios] = useState<Folio[]>([]);
  const [generatedPages, setGeneratedPages] = useState<GeneratedPage[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [presets, setPresets] = useState<SavedPreset[]>([]);

  // Cloud sync: fetch history, energy, drafts from Supabase
  useCloudSync(user, setHistory, setEnergy, setText, setInputText);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generateProgress, setGenerateProgress] = useState(0);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return true; // SSR: default dark
    const saved = localStorage.getItem('hw_theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return true; // SSR: default terbuka
    return window.innerWidth >= 1280; // hanya buka otomatis di layar lebar
  });
  const [isLoadingFonts, setIsLoadingFonts] = useState(true);
  const [isLoadingFolios, setIsLoadingFolios] = useState(true);

  const [isAppleDevice, setIsAppleDevice] = useState(false);
  const platformTheme = isAppleDevice ? "theme-ios" : "theme-futuristic";
  const [zoomLevel, setZoomLevel] = useState(100);
  const outputViewerRef = useRef<HTMLDivElement>(null);
  const [navPreviewDir, setNavPreviewDir] = useState<'prev' | 'next' | null>(null);
  const [ambientColor, setAmbientColor] = useState('violet');
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingTransparent, setIsExportingTransparent] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [fontDropdownOpen, setFontDropdownOpen] = useState(false);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [fullscreenPage, setFullscreenPage] = useState<GeneratedPage | null>(null);
  const [activeTab, setActiveTab] = useState<"result" | "history" | "presets">("result");
  const [zenMode, setZenMode] = useState(false);
  const [selectedTextRange, setSelectedTextRange] = useState({ text: "", start: 0, end: 0 });
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  // ── FITUR BARU: Magic Placeholder, Drag Overlay, Command Palette ──
  const [magicPlaceholder, setMagicPlaceholder] = useState("");
  const [isGlobalDragging, setIsGlobalDragging] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [cmdSearch, setCmdSearch] = useState("");

  // Effect 1: Animasi Mesin Tik untuk Placeholder
  useEffect(() => {
    const phrases = [
      "Ketik atau paste teks tugasmu di sini...",
      "Tarik & lepas (Drag & Drop) file Word / TXT ke sini 📄...",
      "Ketik '/' untuk memanggil Asisten AI 🪄...",
      "Tekan Ctrl + K untuk menu rahasia ⌨️...",
      "Mulai ketik 'Menurut sejarah kemerdekaan...' ✍️"
    ];
    let currentPhrase = 0;
    let currentChar = 0;
    let isDeleting = false;
    let timer: NodeJS.Timeout;

    const type = () => {
      const text = phrases[currentPhrase];
      if (!isDeleting && currentChar < text.length) {
        setMagicPlaceholder(text.slice(0, currentChar + 1));
        currentChar++;
        timer = setTimeout(type, 50);
      } else if (isDeleting && currentChar > 0) {
        setMagicPlaceholder(text.slice(0, currentChar - 1));
        currentChar--;
        timer = setTimeout(type, 20); // Kecepatan hapus
      } else {
        isDeleting = !isDeleting;
        if (!isDeleting) currentPhrase = (currentPhrase + 1) % phrases.length;
        timer = setTimeout(type, isDeleting ? 2500 : 500); // Jeda sebelum hapus/ngetik baru
      }
    };
    timer = setTimeout(type, 500);
    return () => clearTimeout(timer);
  }, []);

  // Effect 2: Sensor Drag & Drop Global dan Shortcut Ctrl+K
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) {
        e.preventDefault();
        setIsGlobalDragging(true);
      }
    };
    const handleDragLeave = (e: DragEvent) => {
      if (e.clientX === 0 || e.clientY === 0) setIsGlobalDragging(false);
    };
    const handleDrop = () => setIsGlobalDragging(false);

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdSearch(""); // Reset search bar
        setShowCommandPalette(true);
      }
    };

    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const checkTextSelection = () => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    if (start !== end) {
      setSelectedTextRange({ text: text.substring(start, end), start, end });
    } else {
      setSelectedTextRange({ text: "", start: 0, end: 0 });
    }
  };
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
  const [isMobileView, setIsMobileView] = useState(() => {
    if (typeof window === 'undefined') return false; // SSR: default false
    return window.innerWidth < 768;
  });

  const sessionIdRef = useRef<string>(
    `hw_${Date.now()}_${Math.random().toString(36).slice(2)}`
  );
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const ONBOARDING_SPOTLIGHT = [
    { selector: null, description: "welcome" },
    { selector: "sidebar-settings", selectorMobile: null, description: "sidebar" },   // mobile: tidak highlight, drawer sudah buka
    { selector: "editor-panel", selectorMobile: null, description: "editor" },        // mobile: tidak highlight panel
    { selector: "generate-btn", selectorMobile: "generate-btn", description: "generate" }, // generate btn ada di semua ukuran
  ];
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const prevBackendOnlineRef = useRef<boolean | null>(null);
  const [showSeedCopied, setShowSeedCopied] = useState(false);
  const [showKeyboardHint, setShowKeyboardHint] = useState(false);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'book' | 'grid'>('book');
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [showMobileExportSheet, setShowMobileExportSheet] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);
  const exportBtnRef = useRef<HTMLButtonElement>(null);
  const [exportDropdownPos, setExportDropdownPos] = useState<{ top: number; left: number; height: number; width: number } | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const pullStartYRef = useRef<number | null>(null);
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
  const [isAiExpanding, setIsAiExpanding] = useState(false);

  const handleAiExpand = async () => {
    if (!text.trim()) {
      toast.error("Ketik/paste teks yang mau dipoles dulu!");
      return;
    }
    setIsAiExpanding(true);
    const tid = toast.loading("AI sedang merombak & memanjangkan teks...");
    try {
      const res = await fetch(`${API_URL}/api/ai-expand`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      if (data.success) {
        const newText = data.text.trim();
        setInputText(newText);
        setText(newText);
        toast.success("Teks berhasil dipoles & dipanjangkan! ✨", { id: tid });
      } else {
        throw new Error(data.error || "Gagal menghubungi AI");
      }
    } catch (e: any) {
      toast.error(e.message, { id: tid });
    } finally {
      setIsAiExpanding(false);
    }
  };
  const [aiDraftResult, setAiDraftResult] = useState("");
  const recognitionRef = useRef<any>(null);
  const previewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPreviewHashRef = useRef<string>("");
  const cropImgRef = useRef<HTMLImageElement>(null);
  const swipeStartXRef = useRef<number | null>(null);
  // Helper: navigasi halaman yang aman — priority: FlipBook API → setState fallback
  const navigateToPage = useCallback((index: number) => {
    const clampedIndex = Math.max(0, Math.min(
      (generatedPages.length || streamedPages.length) - 1, index
    ));
    if (clampedIndex === activePageIndex) return;

    // ── PAPER SOUND EFFECT (Web Audio API — no library needed) ──
    if (typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined') {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();

        // Buffer noise putih pendek — simulasi suara kertas
        const bufferSize = ctx.sampleRate * 0.06; // 60ms
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
          // White noise yang makin pelan di akhir (fade out)
          const envelope = 1 - (i / bufferSize);
          data[i] = (Math.random() * 2 - 1) * envelope * envelope;
        }

        // Source node
        const source = ctx.createBufferSource();
        source.buffer = buffer;

        // Filter — potong frekuensi rendah, sisakan "kertas"
        const highpass = ctx.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.value = 2000;

        const bandpass = ctx.createBiquadFilter();
        bandpass.type = 'bandpass';
        bandpass.frequency.value = 4000;
        bandpass.Q.value = 0.8;

        // Gain — sangat pelan agar tidak mengganggu
        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(0.04, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);

        // Hubungkan: source → highpass → bandpass → gain → output
        source.connect(highpass);
        highpass.connect(bandpass);
        bandpass.connect(gainNode);
        gainNode.connect(ctx.destination);

        source.start(ctx.currentTime);
        source.stop(ctx.currentTime + 0.06);

        // Cleanup context setelah selesai
        source.onended = () => ctx.close();
      } catch {
        // Silent fail — audio tidak wajib
      }
    }

    // Haptic feedback di mobile
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(5);
    }

    setActivePageIndex(clampedIndex);
    try {
      // Ambil instance langsung dari buku
      const flip = flipInstance.current || bookRef.current?.pageFlip?.();

      if (flip && typeof flip.turnToPage === 'function') {
        flip.turnToPage(clampedIndex);
      } else if (flip && typeof flip.flip === 'function') {
        flip.flip(clampedIndex);
      }
    } catch (e) {
      console.error("Gagal membalik halaman:", e);
    }
  }, [generatedPages.length, streamedPages.length, activePageIndex]);
  const swipeStartYRef = useRef<number | null>(null);
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef<number>(100);
  const [mobileZoom, setMobileZoom] = useState(100);
  const [swipeFeedback, setSwipeFeedback] = useState<'left' | 'right' | null>(null);
  const [rubberBandOffset, setRubberBandOffset] = useState(0);
  const [isRubberBanding, setIsRubberBanding] = useState(false);
  const [themeTransitioning, setThemeTransitioning] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [generateSuccess, setGenerateSuccess] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [contextMenuPage, setContextMenuPage] = useState<GeneratedPage | null>(null);
  const [targetUserEmail, setTargetUserEmail] = useState("");
  const [addAmount, setAddAmount] = useState(100);

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
  const bookRef = useRef<any>(null);
  const flipInstance = useRef<any>(null);
  const sidebarScrollRef = useRef<HTMLDivElement>(null);
  const sidebarScrollPosRef = useRef<number>(0);

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => { setSeed(Date.now()); }, []);

  // Efek untuk membaca parameter URL Kolaborasi
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareId = params.get("share");

    if (shareId) {
      const loadSharedConfig = async () => {
        const tid = toast.loading("Menerapkan pengaturan dari teman... ✨");
        try {
          const { data, error } = await supabase
            .from("shared_configs")
            .select("*")
            .eq("id", shareId)
            .single();

          if (error || !data) throw error;

          setText(data.text);
          setInputText(data.text);
          if (data.config) updateConfig(data.config);
          if (data.folio_id) setSelectedFolio(data.folio_id);
          if (data.font_id) setSelectedFont(data.font_id);

          toast.success("Pengaturan teman berhasil ditiru!", { id: tid });
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (err) {
          toast.error("Gagal memuat atau link sudah kadaluarsa.", { id: tid });
        }
      };
      loadSharedConfig();
    }
  }, []);

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
    if (!text.trim()) return;
    setAutoSaveStatus('saving');
    const timer = setTimeout(async () => {
      // 1. Simpan di penyimpanan lokal browser
      localStorage.setItem("hw_draft_text", text);

      // 2. Auto-save ke Cloud (Supabase) jika user sudah login
      if (user && text.trim().length > 0) {
        try {
          await supabase.from('user_drafts').upsert({
            id: user.id,
            email: user.email,
            text_content: text,
            updated_at: new Date().toISOString()
          });
        } catch (err) {
          console.warn("Gagal auto-save ke cloud", err);
        }
      }
      setAutoSaveStatus('saved');
      setTimeout(() => setAutoSaveStatus('idle'), 2000);
    }, 1500);

    return () => clearTimeout(timer);
  }, [text, user]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.max(160, textareaRef.current.scrollHeight)}px`;
    }
  }, [text]);

  // PERF: Debounce resize handler agar tidak thrash layout
  useEffect(() => {
    let rafId: number;
    const onResize = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const w = window.innerWidth;
        setIsMobileView(w < 768);
        if (w >= 1280) {
          setSidebarOpen(true);
        } else {
          setSidebarOpen(false);
        }
        if (w >= 1024) setMobileSidebarOpen(false);
      });
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); cancelAnimationFrame(rafId); };
  }, []);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${API_URL}/api/health`, { signal: AbortSignal.timeout(3000) });
        const isOnline = res.ok;
        setBackendOnline(isOnline);
        // Hanya tampilkan toast jika status berubah (bukan saat pertama kali check)
        if (prevBackendOnlineRef.current !== null && prevBackendOnlineRef.current !== isOnline) {
          if (isOnline) {
            toast.success("Server terhubung kembali ✅", { duration: 3000 });
          } else {
            toast.error("Server terputus. Coba lagi nanti.", { duration: 5000 });
          }
        }
        prevBackendOnlineRef.current = isOnline;
      } catch {
        setBackendOnline(false);
        if (prevBackendOnlineRef.current === true) {
          toast.error("Koneksi ke server terputus.", { duration: 5000 });
        }
        prevBackendOnlineRef.current = false;
      }
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
      const res = await fetch(`${API_URL}/api/fonts`, { cache: "no-store", next: { revalidate: 0 } });
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
      const res = await fetch(`${API_URL}/api/folios`, { cache: "no-store", next: { revalidate: 0 } });
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

  useEffect(() => {
    loadFonts();
    loadFolios();
    // Trigger font load untuk iOS
    if (typeof document !== 'undefined') {
      document.fonts.ready.then(() => setFontsLoaded(true));
    }
  }, [loadFonts, loadFolios]);

  useEffect(() => {
    const savedTheme = localStorage.getItem("hw_theme");
    const savedEnergy = localStorage.getItem("hw_energy");
    if (savedEnergy !== null) setEnergy(parseInt(savedEnergy));
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
  useEffect(() => { localStorage.setItem("hw_energy", energy.toString()); }, [energy]);
  useEffect(() => { localStorage.setItem("hw_lastFont", selectedFont); }, [selectedFont]);

  // ── STEP 19: AMBIENT COLOR — deteksi warna tinta → update background gradient ──
  useEffect(() => {
    const hex = config.color.toLowerCase().replace('#', '');
    if (hex.startsWith('1') || hex.startsWith('2') || hex.startsWith('0')) {
      setAmbientColor('navy');
    } else if (hex.includes('ff') && (hex.includes('00ff') || hex.match(/^0{0,2}[0-9a-f]{0,2}(ff|cc|99)/))) {
      setAmbientColor('blue');
    } else if (hex.startsWith('ff') && !hex.startsWith('ff00')) {
      setAmbientColor('amber');
    } else if (hex.includes('22') || hex.includes('16') || hex.includes('15') || hex.startsWith('16') || hex.startsWith('0f')) {
      setAmbientColor('emerald');
    } else if (hex.includes('8b') || hex.includes('7c') || hex.includes('6d') || hex.includes('4f') || hex.includes('5c')) {
      setAmbientColor('violet');
    } else {
      setAmbientColor('violet');
    }
  }, [config.color]);

  // ── STEP 17: SCROLL WHEEL ZOOM (Ctrl+Scroll pada output viewer desktop) ──
  useEffect(() => {
    const el = outputViewerRef.current;
    if (!el) return;
    const handleWheelZoom = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const isTrackpad = Math.abs(e.deltaY) < 50;
      const sensitivity = isTrackpad ? 1.5 : 0.3;
      const delta = -e.deltaY * sensitivity;
      setZoomLevel(z => Math.round(Math.min(200, Math.max(50, z + delta))));
    };
    el.addEventListener('wheel', handleWheelZoom, { passive: false });
    return () => el.removeEventListener('wheel', handleWheelZoom);
  }, []);
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
  const fontSizeCalc = config.fontSize || 25; // Tambahkan fallback
  const effectiveWidth = (config.maxWidth || 1100) - (config.startX || 70) - (config.marginJitter ?? 6);
  const charWidth = fontSizeCalc * 0.52;
  const charsPerLine = Math.max(1, Math.floor(effectiveWidth / charWidth));

  const estimatedLines = text.split("\n").reduce((acc, line) => {
    if (!line.trim()) return acc + 1;
    return acc + Math.max(1, Math.ceil((line.length || 1) / charsPerLine));
  }, 0);

  const linesPerPage = Math.max(1, Math.floor(
    ((config.pageBottom || 1520) - (config.startY || 65)) / (config.lineHeight || 38)
  ));
  const estimatedPages = Math.max(1, Math.ceil(estimatedLines / linesPerPage));
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const currentFont = fonts[selectedFont];
  const currentFolio = folios.find((f) => f.id === selectedFolio);
  const estimatedSeconds = estimatedPages * Math.max(2, Math.min(8, Math.ceil(wordCount / estimatedPages / 20)));
  const estimatedTimeLabel = estimatedSeconds < 60
    ? `~${estimatedSeconds}s`
    : `~${Math.ceil(estimatedSeconds / 60)}m`;

  // ── Generate ─────────────────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!text.trim()) { toast.error("Masukkan teks dulu!"); return; }
    if (!selectedFolio) { toast.error("Pilih folio dulu!"); return; }
    if (!user) {
      toast.error("Silakan Login Cloud untuk fitur ini!", { icon: "🔒" });
      handleLogin();
      return;
    }

    // ── KODE RAHASIA DEVELOPER (GOD MODE) ──
    const DEV_EMAIL = process.env.NEXT_PUBLIC_DEV_EMAIL || "sharulwrdn10@gmail.com";
    const isDeveloper = user?.email === DEV_EMAIL;

    // Cek apakah energi cukup (Developer bebas batas)
    if (!isDeveloper && energy < estimatedPages) {
      setShowQrisModal(true);
      return;
    }

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
    const controller = new AbortController();
    setAbortController(controller);

    try {
      // Retry otomatis SSE — maksimal 3 kali jika koneksi terputus
      const MAX_RETRY = 3;
      let retryCount = 0;
      let res: Response | null = null;

      while (retryCount < MAX_RETRY) {
        try {
          res = await fetch(`${API_URL}/api/generate/stream`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-User-Email": user?.email || ""
            },
            body,
            signal: controller.signal,
          });

          // KODE BARU: Baca pesan error asli dari backend Python
          if (!res.ok) {
            const errData = await res.json().catch(() => null);
            throw new Error(errData?.error || `Error ${res.status}: Gagal memproses data`);
          }

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
              setActivePageIndex(0); // Fix: selalu reset ke halaman pertama saat streaming
              setGenerateProgress(Math.round((msg.page / Math.max(1, totalPages)) * 100));
              if (msg.page === 1) {
                toast.success("✨ Halaman pertama selesai!", { id: tid, duration: 2000 });
                setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 200);
              }
            }
            if (msg.type === "done") {
              setActivePageIndex(0);
              setGeneratedPages(collectedPages);
              setStreamedPages([]);
              setGenerateProgress(100);

              // ── POTONG ENERGI DI UI & DATABASE (Kecuali Developer) ──
              if (!isDeveloper) {
                const deduction = collectedPages.length;
                const newBalance = Math.max(0, energy - deduction);

                // 1. Update di layar (UI)
                setEnergy(newBalance);

                // 2. Update di Database Supabase
                if (user?.email) {
                  await supabase
                    .from('user_credits')
                    .update({ energy_balance: newBalance })
                    .eq('email', user.email);
                }
              }

              toast.success(`✅ ${collectedPages.length} halaman selesai!`, { duration: 3000 });
              setGenerateSuccess(true);
              fireConfetti();
              setTimeout(() => setGenerateSuccess(false), 2000);
              // Tampilkan keyboard hint sekali saja
              if (!localStorage.getItem("hw_kb_hint_shown") && !isMobileView) {
                setShowKeyboardHint(true);
                setTimeout(() => {
                  setShowKeyboardHint(false);
                  localStorage.setItem("hw_kb_hint_shown", "1");
                }, 3000);
              }

              // Haptic feedback untuk Android
              if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                navigator.vibrate([50, 30, 50]);
              }

              // Simpan ke Cache & History (Sisa kode di bawahnya tetap sama)
              try {
                await fetch(`${API_URL}/api/cache/save`, {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ sessionId: sessionIdRef.current, pages: collectedPages }),
                });
                localStorage.setItem("hw_lastSession", sessionIdRef.current);
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
              safeSetHistory(newHistory, setHistory);
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
      if (e instanceof Error && e.name === "AbortError") {
        toast("Proses dibatalkan.", { id: tid, icon: "🛑" });
        setGenerateError(null);
      } else {
        const errMsg = e instanceof Error ? e.message : "Gagal generate";
        toast.error(errMsg, { id: tid, duration: 4000 });
        setGenerateError(errMsg);
      }
    } finally {
      setIsGenerating(false);
      setIsStreaming(false);
      setAbortController(null);

      setTimeout(() => setGenerateProgress(0), 1500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, selectedFolio, selectedFont, config, seed, energy, useDoubleFolio, selectedFolioEven,
    leftHanded, writeSpeed, enableTypo, slantAngle, tiredMode, showPageNumber,
    pageNumberFormat, watermarkText, history, currentFont, currentFolio, handleLogin, API_URL]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setFullscreenPage(null);
        setMobileSidebarOpen(false);
        return;
      }
      if (e.key === "ArrowRight" && !isGenerating && generatedPages.length > 0) {
        e.preventDefault();
        navigateToPage(activePageIndex + 1);
        return;
      }
      if (e.key === "ArrowLeft" && !isGenerating && generatedPages.length > 0) {
        e.preventDefault();
        navigateToPage(activePageIndex - 1);
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
  }, [isGenerating, text, selectedFolio, handleGenerate, navigateToPage, activePageIndex]);

  // ── Downloads ────────────────────────────────────────────────────────────────
  // ── FUNGSI SHARE HALAMAN ──
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
          text: "Dibuat dengan Mager Nulis",
        });
      } else {
        handleDownloadSingle(page);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error("Gagal membagikan gambar");
    }
  };

  // Fungsi navigasi Onboarding agar sidebar kebuka otomatis di HP
  const handleNextOnboardingStep = () => {
    const isMobile = window.innerWidth < 1024;

    if (onboardingStep === 0 && isMobile) {
      setMobileSidebarOpen(true);
      setTimeout(() => setOnboardingStep(1), 300); // Tunggu sidebar kebuka
    } else if (onboardingStep === 1 && isMobile) {
      setMobileSidebarOpen(false);
      setTimeout(() => setOnboardingStep(2), 300); // Tutup sidebar lanjut nulis
    } else if (onboardingStep < 3) {
      setOnboardingStep(s => s + 1);
    } else {
      setShowOnboarding(false);
      localStorage.setItem("hw_onboarded", "1");
    }
  };

  const handlePrevOnboardingStep = () => {
    const isMobile = window.innerWidth < 1024;
    if (onboardingStep === 1 && isMobile) {
      setMobileSidebarOpen(false); // Tutup sidebar kalau balik ke welcome
    } else if (onboardingStep === 2 && isMobile) {
      setMobileSidebarOpen(true); // Buka sidebar lagi kalau balik dari nulis
    }
    setOnboardingStep(s => s - 1);
  };

  // ── FUNGSI SHARE LINK PUBLIK ──
  const handleSharePublicLink = async () => {
    if (!text.trim()) {
      toast.error("Ketikan teksnya terlebih dahulu!");
      return;
    }
    const tid = toast.loading("Merakit link awan... ☁️");
    try {
      const { data, error } = await supabase
        .from("shared_configs")
        .insert([{
          text: text, config: config, folio_id: selectedFolio, font_id: selectedFont
        }])
        .select("id")
        .single();

      if (error) throw error;

      const shareUrl = `${window.location.origin}/?share=${data.id}`;
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link tercopy! Bagikan ke temanmu 🚀", { id: tid, duration: 4000 });
    } catch (err) {
      console.error(err);
      toast.error("Gagal membuat link kolaborasi.", { id: tid });
    }
  };

  // ── FUNGSI UPDATE ENERGI (KHUSUS ADMIN) ──
  const handleAdminUpdateEnergy = async () => {
    const DEV_EMAIL = process.env.NEXT_PUBLIC_DEV_EMAIL || "sharulwrdn10@gmail.com";
    if (user?.email !== DEV_EMAIL) {
      toast.error("Akses ditolak: Anda bukan admin.");
      return;
    }
    if (!targetUserEmail) {
      toast.error("Masukkan email user target!");
      return;
    }

    const tid = toast.loading("Mengirim energi ke database... ⚡");
    try {
      const { error } = await supabase
        .from("user_credits")
        .upsert({
          email: targetUserEmail.toLowerCase().trim(),
          energy_balance: addAmount,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      toast.success(`Berhasil! ${targetUserEmail} sekarang punya ${addAmount} energi.`, { id: tid });
      setTargetUserEmail("");
      setShowAdminModal(false);
    } catch (err) {
      console.error(err);
      toast.error("Gagal update. Pastikan koneksi database aman.", { id: tid });
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
    const pages = streamedPages.length > 0 ? streamedPages : generatedPages;
    if (pages.length === 0) return;
    setIsDownloadingZip(true);
    const toastId = toast.loading("Mengepak semua halaman ke dalam ZIP...");
    try {
      const response = await fetch(`${API_URL}/api/download/zip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pages })
      });
      if (!response.ok) throw new Error("Gagal kompilasi ZIP");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Tugas_Handwriting_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Berhasil mendownload ZIP!", { id: toastId });
      setShowExportDropdown(false);
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const handleDownloadPdf = async () => {
    const pages = streamedPages.length > 0 ? streamedPages : generatedPages;
    if (pages.length === 0) return;
    setIsExportingPdf(true);
    const toastId = toast.loading("Menyusun PDF Resolusi Tinggi...");
    try {
      const response = await fetch(`${API_URL}/api/download-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pages })
      });
      if (!response.ok) throw new Error("Gagal menyusun PDF");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Tugas_Handwriting_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Berhasil mendownload PDF!", { id: toastId });
      setShowExportDropdown(false);
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleDownloadTransparent = async (pageData: GeneratedPage) => {
    setIsExportingTransparent(true);
    const toastId = toast.loading("Mengekstrak Tinta Transparan (Sticker)...");
    try {
      const response = await fetch(`${API_URL}/api/download/transparent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData: pageData.image })
      });
      if (!response.ok) throw new Error("Gagal mengekstrak PNG transparan");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Tulisan_Sticker_Hal_${pageData.page}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Berhasil mendownload PNG Transparan!", { id: toastId });
      setShowExportDropdown(false);
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    } finally {
      setIsExportingTransparent(false);
    }
  };

  const handleExportPdf = async (quality: "low" | "high") => {
    if (!generatedPages.length) return;
    setIsExportingPdf(true);
    const tid = toast.loading(quality === "low" ? "Merakit PDF (Hemat Kuota)..." : "Merakit PDF (Resolusi Tinggi)...");

    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      for (let i = 0; i < generatedPages.length; i++) {
        if (i > 0) pdf.addPage();

        let imgData = generatedPages[i].image;

        // Jika mode Hemat Kuota, kompres ukuran gambar di Canvas HTML5 sebelum masuk ke PDF
        if (quality === "low") {
          const img = new window.Image();
          img.src = imgData;
          await new Promise((resolve) => { img.onload = resolve; });

          const canvas = document.createElement("canvas");
          canvas.width = img.width * 0.45; // Perkecil dimensi jadi 45% dari aslinya
          canvas.height = img.height * 0.45;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            imgData = canvas.toDataURL("image/jpeg", 0.6); // Kualitas JPEG 60%
          }
        }

        // Terapkan kompresi internal jsPDF ("FAST" = ringan, "SLOW" = kualitas tinggi)
        pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight, undefined, quality === "low" ? "FAST" : "SLOW");
      }

      pdf.save(`Tugas_TulisanTangan_${quality === "low" ? "Hemat" : "HD"}.pdf`);
      toast.success("PDF berhasil didownload!", { id: tid });
    } catch {
      toast.error("Gagal membuat PDF", { id: tid });
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportDocx = async () => {
    if (!generatedPages.length) return;
    setIsExportingDocx(true);
    const tid = toast.loading("Membuat Word document...");
    try {
      const { Document, Packer, Paragraph, ImageRun } = await import("docx");
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
      const { saveAs } = await import("file-saver");
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

  const handleLongPressStart = (page: GeneratedPage) => {
    if (!isAppleDevice) return;
    const timer = setTimeout(() => {
      // Haptic feedback Apple style
      if ('vibrate' in navigator) navigator.vibrate(10);
      setContextMenuPage(page);
    }, 500);
    setLongPressTimer(timer);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const fireConfetti = useCallback(() => {
    // Tembakan pertama — dari kiri
    confetti({
      particleCount: 60,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.7 },
      colors: ["#7c3aed", "#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd", "#ffffff"],
      ticks: 200,
      gravity: 0.8,
      scalar: 0.9,
    });

    // Tembakan kedua — dari kanan
    confetti({
      particleCount: 60,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.7 },
      colors: ["#7c3aed", "#6366f1", "#818cf8", "#a5b4fc", "#e0e7ff", "#ffffff"],
      ticks: 200,
      gravity: 0.8,
      scalar: 0.9,
    });

    // Tembakan ketiga — dari tengah, lebih kecil
    setTimeout(() => {
      confetti({
        particleCount: 30,
        angle: 90,
        spread: 70,
        origin: { x: 0.5, y: 0.6 },
        colors: ["#fbbf24", "#f59e0b", "#fcd34d", "#ffffff"],
        ticks: 150,
        gravity: 1,
        scalar: 0.7,
      });
    }, 300);
  }, []);

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

  const handlePullRefresh = async () => {
    if (isPullRefreshing) return;
    setIsPullRefreshing(true);
    try {
      await Promise.all([loadFonts(), loadFolios()]);
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([30, 20, 30]);
      }
    } finally {
      setIsPullRefreshing(false);
      setPullDistance(0);
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
      ? "bg-[#000000]" // Deep Space pekat
      : "bg-[#FAFAFB] sidebar-light-bg", // Putih bersih modern

    header: D
      ? "bg-[#000000]/50 border-b border-[#ffffff08] backdrop-blur-xl supports-[backdrop-filter]:bg-[#000000]/30"
      : "bg-white/70 border-b border-violet-100/50 backdrop-blur-xl supports-[backdrop-filter]:bg-white/40",

    sidebar: D
      ? "bg-[#000000]/30 border-r border-[#ffffff0a] backdrop-blur-3xl supports-[backdrop-filter]:bg-[#000000]/20"
      : "bg-[#FAFAFB]/60 sidebar-light-bg border-r border-violet-100/60 backdrop-blur-2xl",

    card: D
      ? "bg-[#13131f] border-[#ffffff0d] shadow-[0_2px_16px_rgba(0,0,0,0.4)] backdrop-blur-sm transition-colors"
      : "bg-white border-violet-200 shadow-[0_4px_20px_rgba(139,92,246,0.12)] transition-colors",

    cardHover: D
      ? "hover:border-violet-500/30 hover:shadow-[0_4px_24px_rgba(139,92,246,0.15)] transition-colors duration-300"
      : "hover:border-violet-300 hover:shadow-[0_4px_24px_rgba(139,92,246,0.15)] transition-colors duration-300",

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
      ? "bg-[#ffffff08] hover:bg-[#ffffff12] text-[#d4d4d8] border border-[#ffffff0f] shadow-sm hover:scale-[1.02] active:scale-95 transition-colors duration-200"
      : "bg-white hover:bg-violet-50 text-violet-700 border border-violet-300 shadow-sm hover:border-violet-400 hover:scale-[1.02] active:scale-95 transition-colors duration-200",

    btnActive: D
      ? "bg-white text-black shadow-md hover:scale-[1.02] active:scale-95 transition-colors duration-200"
      : "bg-violet-600 text-white shadow-md shadow-violet-500/30 hover:scale-[1.02] active:scale-95 transition-colors duration-200",

    rowHover: D
      ? "hover:bg-[#ffffff06]"
      : "hover:bg-violet-50",

    dropdown: D
      ? "bg-[#13131f] border-[#ffffff12] shadow-2xl"
      : "bg-white border-violet-200 shadow-2xl",

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
    <div className={`py-3 px-3 space-y-2.5 ${isAppleDevice ? "bg-transparent backdrop-blur-3xl" : ""}`}>

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
          className={`w-full flex items-center justify-center gap-2 px-3 py-3 rounded-xl border-2 border-dashed text-sm font-medium transition-colors ${isAnalyzingPhoto
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
            className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border transition-colors ${fontDropdownOpen
              ? D ? "border-violet-500/50 bg-violet-500/8" : "border-violet-400 bg-violet-50"
              : D ? "border-[#ffffff0f] bg-[#ffffff06] hover:border-[#ffffff18]"
                : "border-[#d1d5db] bg-gray-50 hover:border-[#9ca3af]"
              }`}
          >
            {isLoadingFonts ? (
              <div className="h-4 w-28 rounded skeleton" />
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
            <div className={`absolute top-full left-0 right-0 mt-1.5 z-50 overflow-hidden ${isAppleDevice ? "rounded-2xl border border-white/25 shadow-2xl liquid-glass-dropdown" : `rounded-xl border ${c.dropdown}`}`}>
              <div className={`max-h-52 overflow-y-auto py-1 ${isAppleDevice ? 'scrollbar-thin' : ''}`}>
                {Object.entries(fonts).map(([key, font]) => (
                  <button key={key}
                    onClick={() => { setSelectedFont(key); setFontDropdownOpen(false); }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 transition-colors ${c.rowHover} ${selectedFont === key ? D ? "bg-violet-500/12" : "bg-violet-50" : ""}`}
                  >
                    <div className="flex flex-col gap-0.5 text-left">
                      <span className={`text-[11px] font-semibold uppercase tracking-wide ${c.ts}`} style={{ fontFamily: 'inherit' }}>
                        {font.name}
                      </span>
                      <span className={`text-[17px] leading-snug ${c.ts}`} style={{ fontFamily: fontsLoaded ? (FONT_FAMILY_MAP[font.name] || font.name) : 'inherit' }}>
                        {text.trim().slice(0, 22) || "Halo, tulisanku rapi!"}
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
          <LiquidGlassSlider
            min={0} max={1} step={0.05}
            value={writeSpeed}
            onChange={setWriteSpeed}
            isDark={D}
            colorClass="bg-[#ff9f0a]" // Orange iOS
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
          <LiquidGlassSlider
            min={-15} max={15} step={1}
            value={slantAngle}
            onChange={setSlantAngle}
            isDark={D}
            colorClass="bg-[#5e5ce6]" // Indigo iOS
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
                className={`py-2.5 rounded-xl border-2 text-[12px] font-medium transition-colors ${leftHanded === m.val
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
          <LiquidGlassSlider
            min={0} max={20} step={1}
            value={config.marginJitter ?? 6}
            onChange={(v: number) => updateConfig({ ...config, marginJitter: v })}
            isDark={D}
            colorClass="bg-[#30d158]" // Green iOS
          />
          <div className={`flex justify-between text-[10px] mt-1.5 ${c.ts}`}>
            <span>Rata kiri</span><span>Bergelombang</span>
          </div>
        </div>

        <div className="flex items-center justify-between mt-4">
          <div>
            <p className={`text-[10.5px] font-semibold uppercase tracking-widest ${c.label}`}>Efek Typo</p>
            <p className={`text-[10px] mt-0.5 ${c.ts}`}>{enableTypo ? "Salah + coretan sesekali" : "Bersih tanpa coretan"}</p>
          </div>
          <LiquidGlassToggleMorph value={enableTypo} onChange={setEnableTypo} colorClass="bg-violet-500" isDark={D} isApple={isAppleDevice} />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className={`text-[10.5px] font-semibold uppercase tracking-widest ${c.label}`}>Mode Lelah</p>
            <p className={`text-[10px] mt-0.5 ${c.ts}`}>{tiredMode ? "Makin acak di halaman akhir" : "Konsisten dari awal"}</p>
          </div>
          <LiquidGlassToggleMorph value={tiredMode} onChange={setTiredMode} colorClass="bg-orange-500" isDark={D} isApple={isAppleDevice} />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-[10.5px] font-semibold uppercase tracking-widest ${c.label}`}>Nomor Halaman</p>
              <p className={`text-[10px] mt-0.5 ${c.ts}`}>{showPageNumber ? "Aktif" : "Tidak ada nomor"}</p>
            </div>
            <LiquidGlassToggleMorph value={showPageNumber} onChange={setShowPageNumber} colorClass="bg-emerald-500" isDark={D} isApple={isAppleDevice} />
          </div>
          {showPageNumber && (
            <div className="grid grid-cols-3 gap-1 mt-2">
              {[{ label: "- 1 -", val: "- {n} -" }, { label: "1", val: "{n}" }, { label: "Hal. 1", val: "Hal. {n}" }].map((f) => (
                <button key={f.val} onClick={() => setPageNumberFormat(f.val)}
                  className={`py-1.5 rounded-lg text-[11px] font-medium transition-colors border ${pageNumberFormat === f.val
                    ? D ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-emerald-600 text-white border-emerald-600"
                    : D ? "bg-white/4 text-white/50 border-[#ffffff08] hover:border-[#ffffff15]" : "bg-white text-gray-600 border-[#d1d5db] hover:bg-gray-50"
                    }`}>
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-4">
          <div>
            <p className={`text-[10.5px] font-semibold uppercase tracking-widest ${c.label}`}>Tekstur Kertas</p>
            <p className={`text-[10px] mt-0.5 ${c.ts}`}>{config.paperTexture ? "Ada bayangan & lipatan" : "Kertas datar bersih"}</p>
          </div>
          <LiquidGlassToggleMorph value={config.paperTexture ?? false} onChange={(v: boolean) => updateConfig({ ...config, paperTexture: v })} colorClass="bg-stone-500" isDark={D} isApple={isAppleDevice} />
        </div>
      </SidebarSection>

      <SidebarSection title="Watermark" isDark={D} defaultOpen={false}>
        <p className={`text-[11px] leading-relaxed ${c.ts}`}>
          Teks watermark diagonal tipis di setiap halaman. Berguna untuk nama atau kelas.
        </p>
        <div className="relative">
          <OptimizedInput
            type="text"
            placeholder="Contoh: Nama Siswa · Kelas X"
            value={watermarkText}
            onChange={(val: string) => setWatermarkText(val)}
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
          <div className="flex items-center justify-between mb-1">
            <p className={`text-[10.5px] font-semibold uppercase tracking-widest ${c.label}`}>Spasi Kata</p>
            <span className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-lg border ${D ? "bg-sky-500/15 text-sky-400 border-sky-500/20" : "bg-sky-50 text-sky-700 border-sky-200"}`}>
              {config.wordSpacing >= 0 ? `+${config.wordSpacing}` : config.wordSpacing}px
            </span>
          </div>

          {/* Slider Kaca Pembesar untuk Spasi */}
          <LiquidGlassSlider
            min={-10} max={40} step={1}
            value={config.wordSpacing}
            onChange={(v: number) => updateConfig({ ...config, wordSpacing: v })}
            isDark={D}
            colorClass="bg-[#0a84ff]" // Warna biru iOS
          />

          {/* Animasi Tab Liquid Glass Stretchy (Framer Motion) */}
          <div className="mt-4">
            <DraggableLiquidTabs
              options={[
                { label: "Rapat", value: -5 },
                { label: "Normal", value: 8 },
                { label: "Lebar", value: 25 }
              ]}
              value={config.wordSpacing === -5 ? -5 : config.wordSpacing === 25 ? 25 : 8}
              onChange={(val: number) => updateConfig({ ...config, wordSpacing: val })}
              isDark={D}
              isApple={isAppleDevice}
            />
          </div>
        </div>

        <div>
          <p className={`text-[10.5px] font-semibold uppercase tracking-widest mb-2 ${c.label}`}>Warna Tinta</p>
          <div className="grid grid-cols-3 gap-1.5 mb-2.5">
            {INK_PRESETS.map((p) => (
              <button key={p.color} onClick={() => updateConfig({ ...config, color: p.color })}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border-2 transition-colors text-[11px] font-medium ${config.color === p.color
                  ? D ? "border-violet-500/70 bg-violet-500/12 text-white" : "border-violet-500 bg-violet-50 text-violet-700"
                  : D ? "border-[#ffffff08] text-white/55 hover:border-[#ffffff18]" : "border-[#d1d5db] text-gray-600 hover:border-[#9ca3af] hover:bg-gray-50"
                  }`}>
                <div className="ink-dot" style={{ backgroundColor: p.color }} />
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

          {/* Live ink preview */}
          <div className={`ink-preview-box flex items-center gap-2 px-3 py-2.5 rounded-xl border ${c.pillBorder} ${c.pill} mt-2`}>
            <p className="ink-preview-text text-[13px] leading-relaxed"
              style={{
                fontFamily: currentFont ? (FONT_FAMILY_MAP[currentFont.name] || currentFont.name) : 'cursive',
                color: config.color
              }}>
              Halo, ini warna tintaku hari ini.
            </p>
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
          className={`p-4 border-2 border-dashed rounded-xl text-center cursor-pointer transition-colors ${isAnalyzingFolio
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
                <div key={i}
                  className={`h-20 rounded-xl overflow-hidden relative ${isDark ? "bg-white/5" : "bg-gray-100"}`}
                  style={{ animationDelay: `${i * 0.08}s` }}>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
                </div>
              ))}
            </div>
          ) : folios.length === 0 ? (
            <div className={`col-span-2 py-8 px-4 rounded-xl border-2 border-dashed text-center ${D ? "border-violet-500/20 bg-violet-500/5" : "border-violet-300 bg-violet-50/50"}`}>
              <div className={`w-10 h-10 mx-auto mb-3 rounded-xl flex items-center justify-center ${D ? "bg-violet-500/15" : "bg-violet-100"}`}>
                <ImageIcon className="w-5 h-5 text-violet-500" />
              </div>
              <p className={`text-xs font-bold mb-1 ${D ? "text-violet-400" : "text-violet-600"}`}>
                Belum ada folio
              </p>
              <p className={`text-[10px] leading-relaxed ${D ? "text-white/30" : "text-gray-500"}`}>
                Drag & drop gambar folio di atas, atau klik area upload untuk memilih file JPG/PNG
              </p>
            </div>
          ) : (
            folios.map((folio) => (
              <label key={folio.id} className={`cursor-pointer block rounded-xl overflow-hidden transition-colors duration-200 ${selectedFolio === folio.id ? c.folioRing : c.folioUnsel}`}>
                <input type="radio" name="folio" value={folio.id} checked={selectedFolio === folio.id}
                  onChange={(e) => handleFolioChangeWithAnalyze(e.target.value)} className="hidden" />
                <div className="relative group">
                  <img
                    src={folio.preview.startsWith("http") ? folio.preview : `${API_URL}${folio.preview}`}
                    alt={folio.name}
                    className="w-full h-20 object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(139,92,246,0.08)' }}
                  />
                  {selectedFolio === folio.id && (
                    <div className="absolute inset-0 bg-violet-500/20 flex items-center justify-center backdrop-blur-[1px] transition-colors">
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
          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-medium transition-colors ${useDoubleFolio
            ? D ? "border-violet-500/50 bg-violet-500/10 text-violet-400" : "border-violet-500 bg-violet-50 text-violet-700"
            : c.btn}`}>
          <span>📖 Folio Bolak-balik</span>
          <div className={`w-8 h-4 rounded-full transition-colors ${useDoubleFolio ? "bg-violet-500" : D ? "bg-white/20" : "bg-gray-300"}`}>
            <div className={`w-3 h-3 rounded-full bg-white mt-0.5 transition-colors ${useDoubleFolio ? "ml-4" : "ml-0.5"}`} />
          </div>
        </button>

        {useDoubleFolio && (
          <div>
            <p className={`text-[10px] mb-1.5 ${c.ts}`}>Folio halaman genap:</p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {folios.map((folio) => (
                <label key={folio.id} className={`cursor-pointer block rounded-xl overflow-hidden transition-colors duration-200 ${selectedFolioEven === folio.id ? c.folioRing : c.folioUnsel}`}>
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
        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs font-medium transition-colors ${showConfig ? c.btnActive : c.btn}`}>
        <div className="flex items-center gap-2">
          <Settings className="w-3.5 h-3.5" />
          <span>Advanced Config</span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showConfig ? "rotate-180" : ""}`} />
      </button>

      {showConfig && (
        <div className={`rounded-2xl border ${isAppleDevice ? "bg-white/10 backdrop-blur-xl border-white/20 shadow-2xl" : c.card} p-4 animate-fadeIn mt-2`}>
          <div className="flex items-center justify-between mb-3">
            <p className={`text-[10.5px] font-semibold uppercase tracking-widest ${c.label}`}>Advanced Config</p>
            <button onClick={() => updateConfig(DEFAULT_CONFIG)}
              className={`flex items-center gap-1 text-[10.5px] px-2 py-1 rounded-lg transition-colors ${c.btn}`}>
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
      <div className="mt-8 px-4 pb-6 flex justify-center select-none pointer-events-none">
        <div className={`flex flex-col items-center justify-center px-4 py-3 rounded-2xl border backdrop-blur-sm ${D ? "bg-black/20 border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]" : "bg-white/50 border-violet-200 shadow-sm"}`}>
          <span className={`text-[8px] uppercase tracking-[0.2em] font-bold mb-1 ${D ? "text-white/40" : "text-violet-400"}`}>Developed By</span>
          <span className={`text-[11px] font-black tracking-wide ${D ? "text-white/80" : "text-violet-700"}`}>MOHAMMAD ADAM MAHFUD</span>
        </div>
      </div>
    </div>
  );

  // ──────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────────────────
  // Memoize FlipBook ditaruh di level paling atas agar tidak melanggar Rules of Hooks

  const activePagesMemo = generatedPages.length > 0 ? generatedPages : streamedPages;
  const PRELOAD_RANGE = 2;
  const memoizedFlipBook = React.useMemo(() => {
    if (activePagesMemo.length === 0) return null;
    return (
      <FlipBook
        ref={bookRef}
        width={420}
        height={594}
        size="stretch"
        minWidth={280}
        maxWidth={800}
        minHeight={400}
        maxHeight={1131}
        maxShadowOpacity={0.3}
        showCover={false}
        mobileScrollSupport={true}
        className="shadow-2xl rounded-sm"
        onFlip={(e: any) => setActivePageIndex(e.data)}
        // TAMBAHKAN BARIS INI:
        onInit={(e: any) => { flipInstance.current = e.object; }}
      >
        {activePagesMemo.map((p, idx) => {
          const isNear = Math.abs(idx - activePageIndex) <= PRELOAD_RANGE;
          return (
            <div key={p.page} className="bg-white overflow-hidden" style={{ boxShadow: "inset 0 0 20px rgba(0,0,0,0.05)" }}>
              {isNear ? (
                <motion.img
                  key={`page-${p.page}`}
                  src={p.image}
                  alt={`Hal ${p.page}`}
                  draggable={false}
                  className="w-full h-full object-cover cursor-grab active:cursor-grabbing"
                  loading="lazy"
                  decoding="async"
                  initial={{ opacity: 0.7 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  onDoubleClick={() => generatedPages.length > 0 && setFullscreenPage(p)}
                  onTouchStart={() => handleLongPressStart(p)}
                  onTouchEnd={handleLongPressEnd}
                  onTouchCancel={handleLongPressEnd}
                  onMouseLeave={handleLongPressEnd}
                />
              ) : (
                <div className={`w-full h-full flex items-center justify-center ${D ? "bg-white/5" : "bg-gray-50"}`}>
                  <Loader2 className="w-6 h-6 text-violet-400/30 animate-spin" />
                </div>
              )}
            </div>
          );
        })}
      </FlipBook>
    );
  }, [activePagesMemo, activePageIndex, generatedPages.length, D]);

  // PERF FIX LCP: isAuthChecking TIDAK memblokir render lagi.
  // Landing page tetap tampil (!showEditor && !user) selama auth check berjalan.
  // Saat auth selesai dan user terdeteksi login, setShowEditor(true) otomatis switch ke editor.

  // HYDRATION FIX: Return null saat SSR agar tidak ada mismatch server↔client.
  // WAJIB ditaruh DI BAWAH semua hooks (Rules of Hooks).
  if (!mounted) return null;

  return (
    <div className={`min-h-screen ${c.page} ${platformTheme}`} style={{ fontFamily: "'DM Sans', system-ui, sans-serif", contain: "layout style" }} suppressHydrationWarning>

      {/* ── CINEMATIC THEME TRANSITION OVERLAY ── */}
      <AnimatePresence>
        {themeTransitioning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.08 }}
            className="fixed inset-0 z-[999] pointer-events-none"
            style={{
              background: isDark
                ? "rgba(255, 255, 255, 0.12)"
                : "rgba(0, 0, 0, 0.15)",
              backdropFilter: "blur(2px)",
              WebkitBackdropFilter: "blur(2px)",
            }}
          />
        )}
      </AnimatePresence>

      {/* ── TOASTER ── */}
      <Toaster
        position={isMobileView ? "bottom-center" : "top-center"}
        containerStyle={isMobileView ? {
          bottom: 'calc(5rem + env(safe-area-inset-bottom))'
        } : {}}
        toastOptions={{
          duration: 4000,
          className: isAppleDevice ? "apple-dynamic-toast" : "",
          success: {
            iconTheme: { primary: '#10b981', secondary: '#fff' },
            style: {
              border: D ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(16, 185, 129, 0.4)',
              background: D ? 'rgba(6, 78, 59, 0.85)' : '#ecfdf5',
              color: D ? '#34d399' : '#065f46'
            },
          },
          error: {
            duration: 5000,
            iconTheme: { primary: '#ef4444', secondary: '#fff' },
            style: {
              border: D ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(239, 68, 68, 0.4)',
              background: D ? 'rgba(127, 29, 29, 0.85)' : '#fef2f2',
              color: D ? '#f87171' : '#991b1b'
            },
          },
          style: isAppleDevice ? {
            background: isDark ? 'rgba(30, 30, 30, 0.75)' : 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            color: isDark ? '#fff' : '#000',
            border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.05)',
            boxShadow: isDark
              ? '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.1)'
              : '0 8px 32px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255,255,255,0.5)',
            borderRadius: '999px',
            padding: '12px 24px',
            fontSize: '14px',
            fontWeight: '500',
            letterSpacing: '-0.01em',
          } : {
            background: D ? "rgba(15, 15, 20, 0.85)" : "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            color: D ? "#fff" : "#111",
            padding: "14px 24px",
            borderRadius: "999px",
            fontSize: "13px",
            fontWeight: "600",
            letterSpacing: "0.2px",
            border: D ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(139,92,246,0.15)",
            boxShadow: D ? "0 20px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.02)" : "0 20px 40px rgba(139,92,246,0.15)"
          }
        }}
      />

      {/* --- TAMBAHKAN KODE INI MULAI DARI SINI --- */}
      {!showEditor && !user ? (
        /* ══ LANDING PAGE SECTION ══ */
        <div className={`relative min-h-[100dvh] w-full flex flex-col items-center p-4 sm:p-6 text-center overflow-clip ${isDark ? "aurora-bg-dark" : "aurora-bg-light"}`}>
          {/* Background Ambient Glow */}
          <div className="absolute top-0 left-0 w-full h-full z-0 pointer-events-none">
            <div className={`absolute top-[-15%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[150px] animate-pulse ${isDark ? "bg-violet-600/20" : "bg-violet-400/35"}`} />
            <div className={`absolute bottom-[-15%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[150px] ${isDark ? "bg-indigo-600/20" : "bg-indigo-400/30"}`} />
            <div className={`absolute top-[40%] left-[30%] w-[40%] h-[40%] rounded-full blur-[120px] ${isDark ? "bg-fuchsia-600/10" : "bg-fuchsia-400/20"}`} />
          </div>

          {/* Staggered Container */}
          <motion.div
            initial="hidden"
            animate="show"
            variants={{
              hidden: { opacity: 0 },
              show: { opacity: 1, transition: { staggerChildren: 0.15 } }
            }}
            className="relative z-10 w-full max-w-5xl mx-auto flex flex-col items-center mt-12 mb-20"
          >
            {/* 1. Badge */}
            <motion.div variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } } }}>
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border mb-8 shadow-xl backdrop-blur-md ${isDark ? "bg-[#ffffff08] border-[#ffffff15]" : "bg-white/70 border-violet-200 shadow-violet-100"}`}>
                <motion.div
                  animate={{ rotate: [0, 15, -15, 0] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}>
                  <Sparkles className={`w-4 h-4 ${isDark ? "text-violet-400" : "text-violet-600"}`} />
                </motion.div>
                <span className={`text-xs font-bold uppercase tracking-widest ${isDark ? "text-gray-300" : "text-violet-700"}`}>
                  Teknologi Humanizer AI
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-600"}`}>
                  GRATIS
                </span>
              </div>
            </motion.div>

            {/* 2. Headline — DILUAR motion.div agar render langsung tanpa animasi = LCP optimal */}
            <h1 className={`text-3xl xs:text-4xl sm:text-6xl md:text-8xl 2xl:text-[7rem] 3xl:text-[8rem] 4xl:text-[10rem] font-black mb-6 tracking-tight leading-[1.1] ${c.tp} ${caveat.variable}`} style={{ fontFamily: "var(--font-caveat), 'Caveat Fallback', cursive" }}>
              Tugas Tulis Tangan <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-400 via-indigo-400 to-cyan-400">
                Selesai dalam 5 Detik.
              </span>
            </h1>

            {/* 3. Deskripsi */}
            <motion.div variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } } }}>
              <p className={`text-base sm:text-xl lg:text-2xl 2xl:text-[1.6rem] mb-12 max-w-2xl 3xl:max-w-3xl mx-auto leading-relaxed ${isDark ? "text-gray-400" : "text-gray-600 font-medium"}`}>
                Gak perlu lagi pegal atau begadang menyalin teks. Ubah ketikan panjangmu menjadi tulisan tangan bolpoin super realistis di atas kertas folio, langsung dari browser.
              </p>
            </motion.div>

            {/* 4. Interaktif Before/After Slider */}
            <motion.div variants={{ hidden: { opacity: 0, scale: 0.95, y: 30 }, show: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 200, damping: 25 } } }} className="w-full mb-16">
              <BeforeAfterSlider />
              <p className="text-[11px] text-gray-500 mt-4 uppercase tracking-widest font-bold">Geser slider untuk melihat keajaiban 👆</p>
            </motion.div>

            {/* 5. Tombol Aksi */}
            <motion.div variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } } }} className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto px-6">
              <button onClick={handleLogin} className={`w-full sm:w-auto px-8 py-4 rounded-2xl font-black text-lg transition-colors hover:scale-105 active:scale-95 flex items-center justify-center gap-2 shadow-lg ${isDark ? "bg-white text-black shadow-[0_0_40px_rgba(255,255,255,0.3)]" : "bg-violet-600 text-white shadow-violet-500/40"}`}>
                <LogIn className="w-5 h-5" />
                Mulai Gratis Sekarang
              </button>
              <button onClick={() => setShowEditor(true)} className={`w-full sm:w-auto px-8 py-4 rounded-2xl border font-bold text-lg transition-colors active:scale-95 flex items-center justify-center gap-2 ${isDark ? "border-[#ffffff15] text-white hover:bg-white/10" : "border-violet-300 text-violet-700 hover:bg-violet-100 bg-white/60"}`}>
                <PenTool className="w-5 h-5 opacity-70" />
                Coba Demo Editor
              </button>
            </motion.div>

            {/* 6. Fitur List */}
            <motion.div variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { delay: 0.5, duration: 1 } } }} className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-12">
              <div className="flex flex-col items-center gap-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDark ? "bg-white/5" : "bg-violet-100 shadow-sm"}`}><Zap className={`w-5 h-5 ${isDark ? "text-gray-300" : "text-violet-600"}`} /></div>
                <div className={`text-xs font-semibold ${isDark ? "text-gray-400" : "text-gray-700"}`}>Real-time Preview</div>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDark ? "bg-white/5" : "bg-violet-100 shadow-sm"}`}><FileDown className={`w-5 h-5 ${isDark ? "text-gray-300" : "text-violet-600"}`} /></div>
                <div className={`text-xs font-semibold ${isDark ? "text-gray-400" : "text-gray-700"}`}>Export PDF & Word</div>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDark ? "bg-white/5" : "bg-violet-100 shadow-sm"}`}><BookOpen className={`w-5 h-5 ${isDark ? "text-gray-300" : "text-violet-600"}`} /></div>
                <div className={`text-xs font-semibold ${isDark ? "text-gray-400" : "text-gray-700"}`}>Flipbook 3D Mode</div>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDark ? "bg-white/5" : "bg-violet-100 shadow-sm"}`}><Bot className={`w-5 h-5 ${isDark ? "text-gray-300" : "text-violet-600"}`} /></div>
                <div className={`text-xs font-semibold ${isDark ? "text-gray-400" : "text-gray-700"}`}>AI Anti-Plagiasi</div>
              </div>
            </motion.div>

            {/* WATERMARK DEVELOPER */}
            <div className="mt-auto w-full pt-16 pb-6 text-center z-10 select-none pointer-events-none">
              <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${isDark ? "text-white/30" : "text-violet-400/50"}`}>
                Engineered & Designed by
              </p>
              <p className={`text-sm font-black tracking-widest mt-1.5 ${isDark ? "text-white/50" : "text-violet-600/60"}`}>
                MOHAMMAD ADAM MAHFUD
              </p>
            </div>

          </motion.div>
        </div>
      ) : (
        <>
          {/* ── MESH GRADIENT BACKGROUND — Animated Aurora ── */}
          <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden">
            {isDark ? (
              <>
                <div className="absolute inset-0 bg-[#060610]" />
                {/* Orb 1 — violet kiri atas, bergerak */}
                <div className="absolute w-[70vw] h-[70vw] rounded-full opacity-[0.18] blur-[100px]"
                  style={{
                    background: "radial-gradient(circle, #7c3aed 0%, #4f46e5 50%, transparent 80%)",
                    top: "-20%", left: "-15%",
                    animation: "orb-drift-1 18s ease-in-out infinite alternate",
                    willChange: "transform",
                  }} />
                {/* Orb 2 — cyan kanan bawah */}
                <div className="absolute w-[50vw] h-[50vw] rounded-full opacity-[0.10] blur-[80px]"
                  style={{
                    background: "radial-gradient(circle, #06b6d4 0%, #3b82f6 60%, transparent 80%)",
                    bottom: "-10%", right: "-10%",
                    animation: "orb-drift-2 22s ease-in-out infinite alternate",
                    willChange: "transform",
                  }} />
                {/* Orb 3 — pink center, subtle */}
                <div className="absolute w-[40vw] h-[40vw] rounded-full opacity-[0.07] blur-[120px]"
                  style={{
                    background: "radial-gradient(circle, #ec4899 0%, transparent 70%)",
                    top: "40%", left: "40%",
                    animation: "orb-drift-3 28s ease-in-out infinite alternate",
                    willChange: "transform",
                  }} />
              </>
            ) : (
              <>
                <div className="absolute inset-0 bg-[#f8f7ff]" />
                <div className="absolute w-[60vw] h-[60vw] rounded-full opacity-[0.25] blur-[80px]"
                  style={{
                    background: "radial-gradient(circle, #c4b5fd 0%, #a78bfa 40%, transparent 80%)",
                    top: "-15%", left: "-10%",
                    animation: "orb-drift-1 18s ease-in-out infinite alternate",
                    willChange: "transform",
                  }} />
                <div className="absolute w-[50vw] h-[50vw] rounded-full opacity-[0.15] blur-[60px]"
                  style={{
                    background: "radial-gradient(circle, #818cf8 0%, #6366f1 50%, transparent 80%)",
                    bottom: "-10%", right: "-5%",
                    animation: "orb-drift-2 22s ease-in-out infinite alternate",
                    willChange: "transform",
                  }} />
              </>
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
                    <button onClick={() => setIsCropping(false)} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${c.btn}`}>
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex-1 min-h-0 overflow-auto rounded-xl border border-dashed border-gray-500/30 bg-black/10 flex items-center justify-center p-2">
                    <ReactCrop crop={crop} onChange={(_, percentCrop) => setCrop(percentCrop)} onComplete={(c) => setCompletedCrop(c)}>
                      <img ref={cropImgRef} src={cropImgSrc} alt="Crop me" className="max-h-[55vh] w-auto object-contain rounded" />
                    </ReactCrop>
                  </div>

                  <div className="flex justify-end gap-3 mt-5 flex-shrink-0">
                    <button onClick={() => setIsCropping(false)} className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${c.btn}`}>
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
                    }} className={`px-6 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r ${c.accent} text-white shadow-lg hover:scale-105 active:scale-95 transition-colors`}>
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
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  drag={isAppleDevice ? "y" : false}
                  dragConstraints={{ top: 0, bottom: 0 }}
                  dragElastic={{ top: 0, bottom: 0.4 }}
                  onDragEnd={(_, info) => {
                    if (info.offset.y > 80) setPendingHwConfig(null);
                  }}
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
                    <button onClick={() => setPendingHwConfig(null)} className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors ${c.btn}`}>
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
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  drag={isAppleDevice ? "y" : false}
                  dragConstraints={{ top: 0, bottom: 0 }}
                  dragElastic={{ top: 0, bottom: 0.4 }}
                  onDragEnd={(_, info) => {
                    if (info.offset.y > 80) { setShowAiModal(false); setAiDraftResult(""); }
                  }}
                  className={`relative w-full max-w-lg rounded-2xl p-5 border shadow-2xl ${isDark ? "bg-[#18181b] border-[#ffffff14]" : "bg-white border-gray-200"}`}>
                  {isAppleDevice && <div className="drag-handle" />}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
                        <Bot className="w-4 h-4 text-indigo-500" />
                      </div>
                      <h3 className={`font-bold ${c.tp}`}>Asisten AI</h3>
                    </div>
                    <button onClick={() => { setShowAiModal(false); setAiDraftResult(""); }} className={c.ts}><X className="w-4 h-4" /></button>
                  </div>
                  <OptimizedTextarea
                    debounce={0}
                    value={aiPrompt}
                    onChange={(val: string) => setAiPrompt(val)}
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
                            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-colors border ${c.btn}`}>
                            <Copy className="w-3 h-3" />Salin
                          </button>
                          <button
                            onClick={() => setAiDraftResult("")}
                            className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${D ? "text-white/30 hover:text-white/60" : "text-gray-300 hover:text-gray-500"}`}>
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
                          className={`w-full py-2 rounded-xl text-xs font-bold bg-gradient-to-r ${c.accent} text-white hover:opacity-90 active:scale-95 transition-colors`}>
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
                    autoFocus
                    className={`w-full mt-4 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r ${c.accent} text-white transition-colors flex justify-center items-center gap-2 ${isAiDrafting ? "opacity-70" : "hover:scale-[1.02] active:scale-95"}`}>
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
                  onClick={() => {
                    setMobileSidebarOpen(false);
                    // Kembalikan fokus ke textarea setelah drawer tertutup
                    setTimeout(() => textareaRef.current?.focus(), 350);
                  }}
                />
                <motion.aside
                  key="mob-drawer"
                  initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
                  transition={{ type: "spring", damping: 28, stiffness: 300 }}
                  className={`fixed top-0 left-0 bottom-0 w-[300px] md:w-[320px] max-w-[85vw] z-[70] overflow-y-auto border-r ${isAppleDevice ? (isDark ? "bg-black/70 backdrop-blur-3xl border-[#ffffff10]" : "liquid-glass-light") : (isDark ? "bg-[#18181b] border-[#ffffff10]" : "bg-white border-gray-200")}`}
                >
                  {/* Drag handle visual */}
                  <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                    <div className={`drag-handle ${D ? "bg-white/20" : "bg-gray-300"}`} />
                  </div>
                  <div className={`sticky top-0 flex items-center justify-between px-4 h-14 border-b ${c.divider} ${isAppleDevice ? (D ? "bg-black/70 backdrop-blur-3xl" : "liquid-glass-light") : (D ? "bg-[#18181b]" : "bg-white")} z-[80]`}>
                    <div className="flex items-center gap-2.5">
                      <div className="relative">
                        <div className={`absolute inset-0 rounded-xl blur-sm opacity-50 ${D ? "bg-violet-500" : "bg-violet-400"}`} />
                        <div className="relative w-7 h-7 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                          <PenTool className="w-3.5 h-3.5 text-white" />
                        </div>
                      </div>
                      <div>
                        <p className={`text-[13px] font-bold leading-none ${c.tp}`}>Pengaturan</p>
                        <p className={`text-[9px] leading-none mt-0.5 ${D ? "text-white/25" : "text-gray-400"}`}>Mager Nulis v1.2</p>
                      </div>
                    </div>
                    <button onClick={() => { setMobileSidebarOpen(false); setTimeout(() => textareaRef.current?.focus(), 350); }}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-90 ${D ? "bg-white/8 hover:bg-white/14 text-white/60" : "bg-gray-100 hover:bg-gray-200 text-gray-500"}`}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {renderSidebarContent()}

                  {/* ── MOBILE LOGOUT BUTTON ── */}
                  <div className={`mt-auto border-t ${c.divider} p-4 mt-8 ${isAppleDevice ? (D ? "bg-black/70 backdrop-blur-3xl" : "bg-gray-50 bg-opacity-80") : (D ? "bg-[#18181b]" : "bg-gray-50")}`}>
                    {user ? (
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className={`text-[11px] ${c.ts}`}>Masuk sebagai:</span>
                          <span className={`text-[12px] font-bold ${c.tp} truncate max-w-[180px]`}>{user.email}</span>
                        </div>
                        <button onClick={async () => { setMobileSidebarOpen(false); await handleLogout(); }}
                          className="p-2.5 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition-colors">
                          <LogOut className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => { setMobileSidebarOpen(false); handleLogin(); }}
                        className="w-full flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-2xl font-bold text-sm transition-all hover:scale-[1.02] active:scale-95"
                        style={{
                          background: "linear-gradient(135deg, #8b5cf6, #6d28d9, #4f46e5)",
                          color: "white",
                          boxShadow: "0 4px 20px rgba(109,40,217,0.4), inset 0 1px 0 rgba(255,255,255,0.2)"
                        }}>
                        <LogIn className="w-4 h-4" />
                        <span>Masuk dengan Google</span>
                      </button>
                    )}
                  </div>

                </motion.aside>
              </>
            )}
          </AnimatePresence>

          {/* ── ONBOARDING TOUR ── */}
          {showOnboarding && (() => {
            const isMobileView = typeof window !== 'undefined' && window.innerWidth < 1024;

            // Tentukan selector berdasarkan ukuran layar
            // Di mobile: sidebar-settings adalah hidden lg:flex, jadi tidak ada di DOM visible
            // Hanya generate-btn yang ada di semua ukuran layar
            const mobileSelectors: Record<number, string | null> = {
              0: null,          // welcome — tidak highlight apapun
              1: null,          // sidebar di mobile = drawer, tidak bisa di-highlight
              2: null,          // editor panel di mobile tidak punya id yang visible
              3: "generate-btn", // generate button ada di mobile dock bottom
            };
            const desktopSelectors: Record<number, string | null> = {
              0: null,
              1: "sidebar-settings",
              2: "editor-panel",
              3: "generate-btn",
            };

            const targetId = isMobileView
              ? mobileSelectors[onboardingStep] ?? null
              : desktopSelectors[onboardingStep] ?? null;

            const el = targetId ? document.getElementById(targetId) : null;
            const rect = el?.getBoundingClientRect();
            const hasValidRect = rect && rect.width > 0 && rect.height > 0;

            return (
              <div className="fixed inset-0 z-[200] pointer-events-none">
                {/* Overlay gelap */}
                <motion.div
                  className="absolute inset-0 pointer-events-auto"
                  animate={{ backgroundColor: onboardingStep === 0 ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.55)" }}
                  transition={{ duration: 0.3 }}
                  onClick={() => { setShowOnboarding(false); localStorage.setItem("hw_onboarded", "1"); }}
                />

                {/* Spotlight — hanya render jika elemen valid & terlihat di viewport */}
                {onboardingStep > 0 && hasValidRect && (() => {
                  const safeLeft = Math.max(8, rect.left - 6);
                  const safeTop = Math.max(8, rect.top - 6);
                  const safeWidth = Math.min(
                    rect.width + 12,
                    (typeof window !== 'undefined' ? window.innerWidth : 400) - safeLeft - 8
                  );
                  return (
                    <motion.div
                      key={targetId}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3 }}
                      className="absolute pointer-events-none rounded-2xl"
                      style={{
                        top: safeTop,
                        left: safeLeft,
                        width: safeWidth,
                        height: rect.height + 12,
                        boxShadow: "0 0 0 4px #7C3AED, 0 0 0 9999px rgba(0,0,0,0.55)",
                        border: "2px solid rgba(139,92,246,0.8)",
                      }}
                    />
                  );
                })()}

                {/* Modal card — fixed center, responsive semua ukuran S/M/L/XL/4K */}
                <div
                  className="pointer-events-auto"
                  style={{
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 'min(340px, calc(100vw - 2rem))',
                    maxHeight: 'calc(100dvh - 4rem)',
                    overflowY: 'auto',
                    zIndex: 202,
                  }}
                >
                  <div className={`rounded-[2rem] border shadow-2xl overflow-hidden ${isAppleDevice
                    ? (isDark ? "bg-[#1c1c1e]/85 backdrop-blur-3xl border-white/15" : "bg-white/85 backdrop-blur-3xl border-white/40")
                    : (isDark ? "bg-[#0d0d14] border-[#ffffff10]" : "bg-white border-violet-100")
                    } ${isDark ? "shadow-[0_24px_64px_rgba(0,0,0,0.8)]" : "shadow-[0_24px_64px_rgba(139,92,246,0.15)]"}`}>

                    {isAppleDevice && <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-violet-500/10 pointer-events-none z-0" />}

                    <div className="relative z-10 p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex gap-1.5">
                          {[0, 1, 2, 3].map(i => (
                            <div key={i} className={`h-1.5 rounded-full transition-colors duration-300 ${i === onboardingStep ? "w-6 bg-violet-500" : i < onboardingStep ? "w-3 bg-violet-300" : "w-3 bg-gray-300 dark:bg-white/10"}`} />
                          ))}
                        </div>
                        <button onClick={() => { setShowOnboarding(false); localStorage.setItem("hw_onboarded", "1"); }}
                          className={`text-[11px] px-2.5 py-1.5 rounded-lg transition-colors font-medium ${isDark ? "text-white/50 hover:text-white hover:bg-white/10" : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"}`}>
                          Skip
                        </button>
                      </div>
                      <div className="text-4xl mb-3">{[["👋"], ["🎨"], ["📝"], ["🚀"]][onboardingStep]}</div>
                      <h3 className={`text-base font-bold mb-2 ${isDark ? "text-white" : "text-gray-900"}`}>
                        {["Selamat datang di Mager Nulis!", "Pilih Gaya Tulisan", "Ketik Teks Tugasmu", "Generate & Download"][onboardingStep]}
                      </h3>
                      <p className={`text-[12.5px] leading-relaxed mb-6 ${isDark ? "text-white/70" : "text-gray-600"}`}>
                        {[
                          "Ubah teks apapun jadi tulisan tangan realistis di atas folio dalam hitungan detik.",
                          isMobileView
                            ? "Ketuk tombol ☰ di pojok kiri atas untuk membuka sidebar. Di sana kamu bisa pilih font, warna tinta, efek typo, dan banyak lagi!"
                            : "Di sidebar kiri, pilih font, kemiringan, warna tinta, efek typo, dan banyak lagi untuk tulisan yang benar-benar terasa manusiawi.",
                          isMobileView
                            ? "Ketuk tab Editor di atas, lalu ketik atau paste teks tugasmu. Bisa sampai 50.000 karakter!"
                            : "Paste teks tugasmu di area utama. Bisa sampai 50.000 karakter! Gunakan Ctrl+Enter untuk langsung Generate.",
                          "Klik Generate dan halaman muncul satu per satu secara real-time. Download sebagai JPG, ZIP, PDF, atau Word."
                        ][onboardingStep]}
                      </p>

                      {/* Hint visual khusus mobile step 1: tunjukkan tombol hamburger */}
                      {isMobileView && onboardingStep === 1 && (
                        <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl mb-4 border ${isDark ? "bg-violet-500/10 border-violet-500/20" : "bg-violet-50 border-violet-200"}`}>
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isDark ? "bg-white/10" : "bg-white shadow-sm border border-gray-200"}`}>
                            <svg className={`w-4 h-4 ${isDark ? "text-white" : "text-gray-700"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                          </div>
                          <p className={`text-[11px] font-medium ${isDark ? "text-white/80" : "text-gray-600"}`}>
                            Tombol ini ada di pojok kiri atas header
                          </p>
                        </div>
                      )}

                      <div className="flex gap-2">
                        {onboardingStep > 0 && (
                          <button onClick={handlePrevOnboardingStep}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${isDark ? "bg-black/30 border border-white/10 text-white/80 hover:bg-white/10" : "bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100"}`}>
                            ← Kembali
                          </button>
                        )}
                        <button onClick={handleNextOnboardingStep}
                          className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:opacity-90 active:scale-95 transition-colors shadow-lg shadow-violet-500/25">
                          {onboardingStep < 3 ? "Lanjut →" : "Mulai Sekarang! 🚀"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── CINEMATIC DRAG & DROP OVERLAY ── */}
          <AnimatePresence>
            {isGlobalDragging && (
              <motion.div
                initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
                animate={{ opacity: 1, backdropFilter: "blur(12px)" }}
                exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
                className="fixed inset-0 z-[999] flex items-center justify-center pointer-events-none bg-black/40"
              >
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="w-full max-w-3xl aspect-video mx-4 rounded-[3rem] border-[6px] border-dashed border-violet-400 bg-violet-500/20 flex flex-col items-center justify-center gap-6 shadow-[0_0_100px_rgba(139,92,246,0.3)]"
                >
                  <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center animate-bounce shadow-2xl">
                    <FileText className="w-12 h-12 text-white" />
                  </div>
                  <h2 className="text-3xl sm:text-5xl font-black text-white drop-shadow-lg tracking-wide text-center">
                    Lepaskan Dokumen Di Sini!
                  </h2>
                  <p className="text-white/90 font-medium text-base sm:text-xl px-4 text-center">
                    File <strong className="text-violet-200">.TXT</strong> atau <strong className="text-blue-200">.DOCX (Word)</strong> akan disulap jadi tulisan tangan.
                  </p>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── GLOBAL COMMAND PALETTE (CTRL + K) ── */}
          <AnimatePresence>
            {showCommandPalette && (
              <div className="fixed inset-0 z-[300] flex items-start justify-center pt-[10vh] sm:pt-[15vh] p-4">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                  onClick={() => setShowCommandPalette(false)} />
                <motion.div initial={{ scale: 0.95, opacity: 0, y: -20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: -20 }}
                  className={`relative w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col ${D ? "bg-[#13131f] border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.6)]" : "bg-white border-gray-200 shadow-[0_20px_60px_rgba(139,92,246,0.15)]"}`}>

                  <div className={`flex items-center px-4 border-b ${D ? "border-white/10 bg-white/5" : "border-gray-100 bg-gray-50/50"}`}>
                    <Sparkles className={`w-5 h-5 flex-shrink-0 ${D ? "text-violet-400" : "text-violet-600"}`} />
                    <input
                      autoFocus
                      type="text"
                      placeholder="Apa yang ingin kamu lakukan? (Ketik 'dark', 'pdf', 'ai'...)"
                      value={cmdSearch}
                      onChange={(e) => setCmdSearch(e.target.value)}
                      className={`w-full bg-transparent border-none px-4 py-5 text-sm sm:text-base outline-none ${D ? "text-white placeholder-white/30" : "text-gray-900 placeholder-gray-400"}`}
                    />
                    <kbd className={`text-[10px] px-2 py-1 rounded border font-bold font-mono ${D ? "bg-white/10 border-white/20 text-white/50" : "bg-white border-gray-200 text-gray-500 shadow-sm"}`}>ESC</kbd>
                  </div>

                  <div className="p-2 max-h-[50vh] overflow-y-auto scrollbar-hide flex flex-col gap-1">
                    {[
                      { icon: <PenTool />, label: "Tulis dengan Asisten AI", keywords: ["ai", "bot", "tulis", "buat", "otomatis", "auto"], action: () => { setShowAiModal(true); setShowCommandPalette(false); } },
                      { icon: <Mic />, label: "Mulai Dikte Suara", keywords: ["dikte", "suara", "mic", "voice", "ngomong", "bicara"], action: () => { toggleListening(); setShowCommandPalette(false); } },
                      { icon: D ? <Sun /> : <Moon />, label: `Ganti ke Mode ${D ? "Siang" : "Malam"}`, keywords: ["dark", "light", "malam", "siang", "tema", "theme"], action: () => { setIsDark(!isDark); setShowCommandPalette(false); } },
                      { icon: <FileDown />, label: "Export PDF (Kualitas Tinggi)", keywords: ["pdf", "export", "download", "cetak", "print", "hd"], action: () => { handleExportPdf("high"); setShowCommandPalette(false); } },
                      { icon: <FileText />, label: "Export ke Word (.docx)", keywords: ["word", "docx", "export", "download"], action: () => { handleExportDocx(); setShowCommandPalette(false); } },
                      { icon: <Package />, label: "Download ZIP Archive", keywords: ["zip", "rar", "archive", "semua"], action: () => { handleDownloadZip(); setShowCommandPalette(false); } },
                      { icon: <Settings />, label: "Buka Advanced Config", keywords: ["setting", "pengaturan", "config", "margin", "spasi"], action: () => { setShowConfig(true); setMobileSidebarOpen(true); setShowCommandPalette(false); } },
                      { icon: <Trash2 />, label: "Hapus Semua Teks Editor", keywords: ["hapus", "clear", "bersihkan", "trash", "buang"], action: () => { setInputText(""); setText(""); setShowCommandPalette(false); toast.success("Teks dihapus!"); } },
                    ]
                      .filter(cmd => cmd.label.toLowerCase().includes(cmdSearch.toLowerCase()) || cmd.keywords.some(k => k.includes(cmdSearch.toLowerCase())))
                      .map((cmd, i) => (
                        <button key={i} onClick={cmd.action} className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all active:scale-95 ${D ? "hover:bg-white/5 text-white/80" : "hover:bg-gray-100 text-gray-700"}`}>
                          <div className={`p-2 rounded-lg flex-shrink-0 ${D ? "bg-white/10 text-white/70" : "bg-white shadow-sm border border-gray-200 text-violet-600"}`}>
                            {React.cloneElement(cmd.icon, { className: "w-4 h-4" })}
                          </div>
                          <span className="text-sm font-semibold">{cmd.label}</span>
                          <ChevronDown className="w-4 h-4 -rotate-90 ml-auto opacity-30" />
                        </button>
                      ))}
                    {/* Jika tidak ada hasil pencarian */}
                    {cmdSearch && [/*...filter data*/].length === 0 && (
                      <div className="py-8 text-center text-sm text-gray-500">
                        Tidak ada perintah untuk "{cmdSearch}"
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* ── KEYBOARD SHORTCUT MODAL ── */}
          <AnimatePresence>
            {showShortcuts && (
              <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                  onClick={() => setShowShortcuts(false)} />
                <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                  className={`relative w-full max-w-sm rounded-3xl border shadow-2xl overflow-hidden ${isAppleDevice
                    ? (D ? "bg-[#1c1c1e]/85 backdrop-blur-3xl border-white/15" : "bg-white/85 backdrop-blur-3xl border-white/40")
                    : (D ? "bg-[#18181b] border-[#ffffff14]" : "bg-white border-gray-200")
                    }`}>

                  {isAppleDevice && <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-violet-500/10 pointer-events-none z-0" />}

                  <div className="relative z-10 p-6 max-h-[85vh] overflow-y-auto scrollbar-hide">
                    <div className="flex items-center justify-between mb-5">
                      <h3 className={`font-bold text-base ${c.tp}`}>⌨️ Keyboard Shortcuts</h3>
                      <button onClick={() => setShowShortcuts(false)}
                        className={`w-11 h-11 rounded-xl flex items-center justify-center ${c.btn}`}>
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
                        <div key={i} className={`flex items-center justify-between px-3 py-2.5 rounded-xl ${D ? "bg-black/20" : "bg-gray-50"}`}>
                          <span className={`text-xs font-medium ${c.tm}`}>{s.label}</span>
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
                      className={`w-full mt-5 py-2.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${isAppleDevice ? (D ? "bg-white/10 hover:bg-white/20 border-white/10 text-white" : "bg-black/5 hover:bg-black/10 border-black/10 text-black") : c.btn}`}>
                      Lihat Tutorial Onboarding
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* ── MODAL TOP UP QRIS ── */}
          <AnimatePresence>
            {showQrisModal && (
              <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                  onClick={() => setShowQrisModal(false)} />

                {/* PERBAIKAN: Pisahkan container utama dengan inner scrollable agar border tidak terpotong */}
                <motion.div
                  initial={{ scale: 0.95, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.95, opacity: 0, y: 20 }}
                  drag={isAppleDevice ? "y" : false}
                  dragConstraints={{ top: 0, bottom: 0 }}
                  dragElastic={{ top: 0, bottom: 0.4 }}
                  onDragEnd={(_, info) => {
                    if (info.offset.y > 80) setShowQrisModal(false);
                  }}
                  className={`relative w-full max-w-sm sm:max-w-md max-h-[92dvh] rounded-[2rem] border shadow-2xl flex flex-col overflow-hidden ${isAppleDevice
                    ? (D ? "bg-[#1c1c1e]/85 backdrop-blur-3xl border-white/15" : "bg-white/85 backdrop-blur-3xl border-white/40")
                    : (D ? "bg-[#13131f] border-[#ffffff14]" : "bg-white border-gray-200")
                    }`}>

                  {/* Kilauan Liquid Glass — Tetap nempel statis di luar agar tidak ikut ke-scroll */}
                  {isAppleDevice && <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-white/20 via-transparent to-violet-500/10 pointer-events-none z-0" />}

                  {/* INNER CONTENT SCROLLABLE (Ini yang menyembuhkan border aneh) */}
                  <div className="relative z-10 flex flex-col items-center text-center w-full h-full overflow-y-auto scrollbar-hide p-6 sm:p-8">
                    {isAppleDevice && <div className="drag-handle" />}
                    <div className="w-14 h-14 sm:w-16 sm:h-16 flex-shrink-0 rounded-full bg-amber-500/20 flex items-center justify-center mb-4 sm:mb-5 shadow-[0_0_30px_rgba(245,158,11,0.3)]">
                      <Zap className="w-6 h-6 sm:w-7 sm:h-7 text-amber-500" fill="currentColor" />
                    </div>

                    <h3 className={`font-bold text-lg sm:text-xl mb-1.5 sm:mb-2 flex-shrink-0 ${c.tp}`}>Energi Habis!</h3>
                    <p className={`text-xs sm:text-sm mb-4 sm:mb-6 flex-shrink-0 ${c.ts}`}>
                      Kamu butuh energi untuk menulis halaman. Yuk dukung kreator dengan Top Up untuk mendapatkan fitur Premium!
                    </p>

                    <div className="w-40 h-40 sm:w-48 sm:h-48 flex-shrink-0 bg-white p-3 sm:p-4 rounded-2xl border-4 border-amber-500 mb-4 sm:mb-6 shadow-xl flex items-center justify-center relative group">
                      <QRCodeSVG
                        value="00020101021126570011ID.DANA.WWW011893600915300202425202090020242520303UMI51440014ID.CO.QRIS.WWW0215ID10254508315380303UMI5204594553033605802ID5909DUA PUTRA600409056105511526304B1DC"
                        size={140}
                        level="H"
                        includeMargin={false}
                        style={{ width: "100%", height: "100%" }}
                      />
                      <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex items-end justify-center p-2 rounded-xl">
                        <span className="text-[9px] sm:text-[10px] font-bold text-amber-600 bg-white/95 px-2 py-1 rounded-full shadow-sm">Scan Aman & Cepat</span>
                      </div>
                    </div>

                    <div className="w-full space-y-2.5 mb-4 sm:mb-6 flex-shrink-0">
                      {[
                        { name: "Paket Maba", energy: 15, price: "5.000", color: "blue", tag: "Hemat", emoji: "🎒" },
                        { name: "Paket Deadline", energy: 50, price: "15.000", color: "violet", tag: "Populer", emoji: "⚡" },
                        { name: "Paket Sultan", energy: 150, price: "35.000", color: "amber", tag: "Terbaik", emoji: "👑" },
                      ].map((tier) => (
                        <div key={tier.name} className={`relative flex items-center justify-between p-3 sm:p-3.5 rounded-2xl border transition-all ${tier.tag === "Populer"
                          ? D
                            ? "bg-violet-500/10 border-violet-500/50 ring-1 ring-violet-500/30 shadow-[0_0_20px_rgba(139,92,246,0.15)]"
                            : "bg-violet-50 border-violet-300 ring-1 ring-violet-300 shadow-[0_0_20px_rgba(139,92,246,0.1)]"
                          : tier.tag === "Terbaik"
                            ? D ? "bg-amber-500/8 border-amber-500/30" : "bg-amber-50 border-amber-200"
                            : D ? "bg-black/20 border-white/10" : "bg-gray-50 border-gray-200"
                          }`}>

                          {/* Badge Populer — melayang di atas */}
                          {tier.tag === "Populer" && (
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                              <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full shadow-lg whitespace-nowrap
                                ${D
                                  ? "bg-gradient-to-r from-violet-600 to-indigo-500 text-white shadow-violet-500/40"
                                  : "bg-gradient-to-r from-violet-600 to-indigo-500 text-white shadow-violet-500/30"
                                }`}>
                                ⭐ PALING LARIS
                              </span>
                            </div>
                          )}

                          {/* Badge Terbaik — melayang di atas */}
                          {tier.tag === "Terbaik" && (
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                              <span className="text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full shadow-lg whitespace-nowrap bg-gradient-to-r from-amber-500 to-orange-400 text-white shadow-amber-500/30">
                                👑 PALING HEMAT/HAL
                              </span>
                            </div>
                          )}

                          <div className="text-left flex items-center gap-2.5">
                            {/* Emoji icon */}
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${tier.color === "blue" ? D ? "bg-blue-500/15" : "bg-blue-100"
                              : tier.color === "violet" ? D ? "bg-violet-500/15" : "bg-violet-100"
                                : D ? "bg-amber-500/15" : "bg-amber-100"
                              }`}>
                              {tier.emoji}
                            </div>
                            <div>
                              <span className={`text-xs font-bold ${c.tp}`}>{tier.name}</span>
                              <p className={`text-[10px] mt-0.5 ${c.ts}`}>⚡ {tier.energy} halaman</p>
                            </div>
                          </div>

                          <div className="text-right flex-shrink-0">
                            <span className={`text-sm font-black ${tier.color === "blue" ? D ? "text-blue-400" : "text-blue-600"
                              : tier.color === "violet" ? D ? "text-violet-400" : "text-violet-600"
                                : D ? "text-amber-400" : "text-amber-600"
                              }`}>Rp {tier.price}</span>
                            <p className={`text-[9px] mt-0.5 ${c.ts}`}>
                              Rp {Math.round(parseInt(tier.price.replace(".", "")) / tier.energy)}/hal
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="w-full mt-auto flex-shrink-0 pt-2">
                      <a href="https://wa.me/6285156843756?text=Halo%20Admin%20HandWrite%20AI,%20saya%20sudah%20transfer%20via%20QRIS%20untuk%20Top%20Up%20Energi.%20Berikut%20bukti%20transfernya:"
                        target="_blank" rel="noopener noreferrer"
                        className="w-full py-2.5 sm:py-3 rounded-xl font-bold text-white bg-[#25D366] hover:bg-[#1ebd5a] active:scale-95 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-green-500/30 text-xs sm:text-sm">
                        <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                        Konfirmasi via WhatsApp
                      </a>

                      <button onClick={() => setShowQrisModal(false)}
                        className={`mt-4 text-[11px] sm:text-xs font-semibold transition-colors px-4 py-2 rounded-xl ${D ? "text-white/60 hover:text-white hover:bg-white/10" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"}`}>
                        Tutup dulu, mau lihat-lihat
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* ── DASHBOARD ADMIN RAHASIA ── */}
          <AnimatePresence>
            {showAdminModal && (
              <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/80 backdrop-blur-md"
                  onClick={() => setShowAdminModal(false)} />
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                  className={`relative w-[95vw] max-w-md rounded-3xl p-5 sm:p-6 border shadow-2xl max-h-[85vh] overflow-y-auto ${D ? "bg-[#0d0d14] border-violet-500/30" : "bg-white border-violet-200"}`}>

                  {/* Close button */}
                  <button onClick={() => setShowAdminModal(false)} className={`absolute top-4 right-4 p-1.5 rounded-full hover:bg-white/10 transition-colors ${c.ts}`}>
                    <X className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-2 mb-4">
                    <Settings className="w-5 h-5 text-violet-500 shrink-0" />
                    <h3 className={`font-bold text-sm sm:text-base ${c.tp}`}>Admin Control Panel</h3>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className={`text-[10px] uppercase font-bold mb-1 block ${c.ts}`}>Email User Target</label>
                      <input
                        type="email"
                        placeholder="contoh: maba@gmail.com"
                        value={targetUserEmail}
                        onChange={(e) => setTargetUserEmail(e.target.value)}
                        className={`w-full min-w-0 px-3 sm:px-4 py-2.5 rounded-xl text-sm border ${c.input}`}
                      />
                    </div>
                    <div>
                      <label className={`text-[10px] uppercase font-bold mb-1 block ${c.ts}`}>Set Total Energi</label>
                      <input
                        type="number"
                        value={addAmount}
                        onChange={(e) => setAddAmount(Number(e.target.value))}
                        className={`w-full min-w-0 px-3 sm:px-4 py-2.5 rounded-xl text-sm border ${c.input}`}
                      />
                    </div>

                    <button
                      onClick={handleAdminUpdateEnergy}
                      className="w-full py-3 rounded-xl font-bold text-white bg-violet-600 hover:bg-violet-700 shadow-lg shadow-violet-500/25 transition-colors text-sm sm:text-base min-h-[44px]">
                      Update Energi Sekarang
                    </button>

                    {/* Area 2: Logout Button */}
                    <div className={`border-t pt-4 mt-2 ${D ? "border-white/10" : "border-gray-200"}`}>
                      <button
                        onClick={async () => { setShowAdminModal(false); await handleLogout(); }}
                        className="w-full py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-500/25 transition-colors text-sm sm:text-base min-h-[44px] flex items-center justify-center gap-2">
                        <LogOut className="w-4 h-4" />
                        Logout dari Akun
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* ── MOBILE EXPORT BOTTOM SHEET ── */}
          <AnimatePresence>
            {showMobileExportSheet && (
              <div className="fixed inset-0 z-[180] lg:hidden">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                  onClick={() => setShowMobileExportSheet(false)}
                />
                <motion.div
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", damping: 30, stiffness: 300 }}
                  drag="y"
                  dragConstraints={{ top: 0, bottom: 0 }}
                  dragElastic={{ top: 0, bottom: 0.4 }}
                  onDragEnd={(_, info) => {
                    if (info.offset.y > 80) setShowMobileExportSheet(false);
                  }}
                  className={`absolute bottom-0 left-0 right-0 rounded-t-[2rem] border-t shadow-2xl ${isAppleDevice
                    ? D ? "bg-[#1c1c1e]/95 backdrop-blur-3xl border-white/10" : "bg-white/95 backdrop-blur-3xl border-black/5"
                    : D ? "bg-[#18181b] border-[#ffffff12]" : "bg-white border-gray-200"
                    }`}
                  style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
                >
                  {/* Handle */}
                  <div className="flex justify-center pt-3 pb-1">
                    <div className="drag-handle" />
                  </div>

                  {/* Title */}
                  <div className="px-5 py-4">
                    <h3 className={`text-base font-bold ${c.tp}`}>Export Hasil</h3>
                    <p className={`text-[11px] mt-0.5 ${c.ts}`}>{generatedPages.length} halaman siap diexport</p>
                  </div>

                  {/* Options */}
                  <div className="px-4 space-y-2 pb-2">
                    {[
                      {
                        icon: <Download className="w-5 h-5" />,
                        label: "Download JPG",
                        desc: "Halaman aktif saja",
                        color: "violet",
                        action: () => { handleDownloadSingle(generatedPages[activePageIndex]); setShowMobileExportSheet(false); }
                      },
                      {
                        icon: <Package className="w-5 h-5" />,
                        label: "Download ZIP",
                        desc: "Semua halaman dalam satu file",
                        color: "emerald",
                        action: () => { handleDownloadZip(); setShowMobileExportSheet(false); }
                      },
                      {
                        icon: <FileDown className="w-5 h-5" />,
                        label: "Export PDF",
                        desc: "Siap print & kirim via WA",
                        color: "amber",
                        action: () => { handleExportPdf("high"); setShowMobileExportSheet(false); }
                      },
                      {
                        icon: <FileDown className="w-5 h-5" />,
                        label: "PDF Hemat Kuota",
                        desc: "Ukuran kecil untuk WhatsApp",
                        color: "rose",
                        action: () => { handleExportPdf("low"); setShowMobileExportSheet(false); }
                      },
                      {
                        icon: <FileText className="w-5 h-5" />,
                        label: "Export Word (.docx)",
                        desc: "Buka di Microsoft Word",
                        color: "blue",
                        action: () => { handleExportDocx(); setShowMobileExportSheet(false); }
                      },
                    ].map((item, i) => {
                      const colorMap: Record<string, string> = {
                        violet: D ? "bg-violet-500/15 text-violet-400" : "bg-violet-100 text-violet-600",
                        emerald: D ? "bg-emerald-500/15 text-emerald-400" : "bg-emerald-100 text-emerald-600",
                        amber: D ? "bg-amber-500/15 text-amber-400" : "bg-amber-100 text-amber-600",
                        rose: D ? "bg-rose-500/15 text-rose-400" : "bg-rose-100 text-rose-600",
                        blue: D ? "bg-blue-500/15 text-blue-400" : "bg-blue-100 text-blue-600",
                      };
                      return (
                        <button
                          key={i}
                          onClick={item.action}
                          className={`card-lift w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl border active:scale-[0.98] ${D ? "border-[#ffffff08] hover:bg-white/5" : "border-gray-100 hover:bg-gray-50"
                            }`}
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colorMap[item.color]}`}>
                            {item.icon}
                          </div>
                          <div className="text-left">
                            <p className={`text-sm font-semibold ${c.tp}`}>{item.label}</p>
                            <p className={`text-[11px] ${c.ts}`}>{item.desc}</p>
                          </div>
                          <ChevronDown className={`w-4 h-4 -rotate-90 ml-auto flex-shrink-0 ${c.ts}`} />
                        </button>
                      );
                    })}
                  </div>

                  {/* Cancel */}
                  <div className="px-4 pt-2">
                    <button
                      onClick={() => setShowMobileExportSheet(false)}
                      className={`w-full py-3.5 rounded-2xl text-sm font-bold transition-colors ${D ? "bg-white/8 text-white hover:bg-white/12" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                    >
                      Batal
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* ── APPLE LONG PRESS CONTEXT MENU ── */}
          <AnimatePresence>
            {contextMenuPage && (
              <div className="fixed inset-0 z-[150] flex items-end justify-center p-4"
                onClick={() => setContextMenuPage(null)}>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                />
                <motion.div
                  initial={{ y: 100, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 100, opacity: 0 }}
                  transition={{ type: "spring", damping: 28, stiffness: 300 }}
                  onClick={(e) => e.stopPropagation()}
                  className={`relative w-full max-w-sm rounded-3xl border overflow-hidden shadow-2xl ${isDark
                    ? "bg-[#1c1c1e]/90 backdrop-blur-3xl border-white/15"
                    : "bg-white/90 backdrop-blur-3xl border-black/10"
                    }`}
                >
                  <div className="drag-handle mt-3" />

                  {/* Preview thumbnail */}
                  <div className="px-4 pb-3">
                    <img
                      src={contextMenuPage.image}
                      alt=""
                      className="w-full h-32 object-cover object-top rounded-2xl"
                    />
                    <p className={`text-[11px] text-center mt-2 font-medium ${isDark ? "text-white/50" : "text-gray-400"}`}>
                      Halaman {contextMenuPage.page}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className={`mx-4 mb-4 rounded-2xl overflow-hidden border ${isDark ? "border-white/10" : "border-gray-100"}`}>
                    {[
                      { icon: "⬇️", label: "Download JPG", action: () => handleDownloadSingle(contextMenuPage) },
                      { icon: "📋", label: "Copy ke Clipboard", action: () => handleCopyImageToClipboard(contextMenuPage) },
                      { icon: "⛶", label: "Lihat Fullscreen", action: () => setFullscreenPage(contextMenuPage) },
                      { icon: "↗️", label: "Bagikan", action: () => handleSharePage(contextMenuPage) },
                    ].map((item, i, arr) => (
                      <button
                        key={item.label}
                        onClick={() => { item.action(); setContextMenuPage(null); }}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium transition-colors active:scale-[0.98] ${isDark ? "hover:bg-white/8 text-white" : "hover:bg-gray-50 text-gray-800"
                          } ${i < arr.length - 1 ? (isDark ? "border-b border-white/8" : "border-b border-gray-100") : ""}`}
                      >
                        <span className="text-base">{item.icon}</span>
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Cancel */}
                  <div className="px-4 pb-6">
                    <button
                      onClick={() => setContextMenuPage(null)}
                      className={`w-full py-3.5 rounded-2xl text-sm font-bold transition-colors ${isDark ? "bg-white/10 text-white hover:bg-white/15" : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                        }`}
                    >
                      Batal
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* ── FULLSCREEN ── */}
          {fullscreenPage && (
            <div
              className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-4 backdrop-blur-sm"
              onClick={() => setFullscreenPage(null)}>
              <button
                className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                onClick={() => setFullscreenPage(null)}>
                <X className="w-5 h-5" />
              </button>
              <div className="text-center" onClick={(e) => e.stopPropagation()}>
                <p className="text-white/35 text-[11px] mb-3 tracking-widest uppercase flex items-center justify-center gap-3">
                  <span>Halaman {fullscreenPage.page}</span>
                  <span>·</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white/50 font-mono text-[10px]">ESC</kbd>
                  <span className="text-white/20">tutup</span>
                  {generatedPages.length > 1 && (
                    <>
                      <span>·</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white/50 font-mono text-[10px]">←</kbd>
                      <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white/50 font-mono text-[10px]">→</kbd>
                      <span className="text-white/20">navigasi</span>
                    </>
                  )}
                </p>
                <img
                  src={fullscreenPage.image}
                  alt={`Halaman ${fullscreenPage.page}`}
                  className="max-h-[88vh] max-w-[92vw] rounded-xl shadow-2xl object-contain"
                  decoding="async"
                />
                <div className="flex justify-center gap-3 mt-4">
                  {generatedPages.length > 1 && (
                    <button
                      onClick={() => {
                        const idx = generatedPages.findIndex(p => p.page === fullscreenPage.page);
                        if (idx > 0) setFullscreenPage(generatedPages[idx - 1]);
                      }}
                      disabled={generatedPages.findIndex(p => p.page === fullscreenPage.page) === 0}
                      className="flex items-center gap-1.5 px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white rounded-xl text-sm font-medium transition-colors">
                      ← Prev
                    </button>
                  )}
                  <button
                    onClick={() => handleDownloadSingle(fullscreenPage)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors">
                    <Download className="w-4 h-4" />Download
                  </button>
                  {generatedPages.length > 1 && (
                    <button
                      onClick={() => {
                        const idx = generatedPages.findIndex(p => p.page === fullscreenPage.page);
                        if (idx < generatedPages.length - 1) setFullscreenPage(generatedPages[idx + 1]);
                      }}
                      disabled={generatedPages.findIndex(p => p.page === fullscreenPage.page) === generatedPages.length - 1}
                      className="flex items-center gap-1.5 px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white rounded-xl text-sm font-medium transition-colors">
                      Next →
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── HEADER ── */}
          <header className={`${c.header} border-b sticky top-0 z-50 transition-all duration-300 ${hideHeader && isMobileView ? "-translate-y-full" : "translate-y-0"} ${zenMode ? "hidden" : ""} ${isAppleDevice ? 'liquid-glass-shimmer' : ''}`}>
            {isGenerating && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-violet-500/10">
                <div className="progress-shimmer h-full bg-gradient-to-r from-violet-500 to-indigo-400 transition-[width] duration-500"
                  style={{ width: `${generateProgress}%` }} />
              </div>
            )}
            <div className="w-full max-w-[1400px] 2xl:max-w-[1600px] 3xl:max-w-[2000px] 4xl:max-w-[2400px] mx-auto px-3 sm:px-4 lg:px-6 3xl:px-12 h-14 flex items-center justify-between gap-2">

              {/* LEFT: toggle + logo */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => setSidebarOpen(!sidebarOpen)}
                  className={`hidden lg:flex w-8 h-8 rounded-lg items-center justify-center transition-colors ${c.btn}`}>
                  {sidebarOpen ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeftOpen className="w-3.5 h-3.5" />}
                </button>
                {/* Ubah md:hidden menjadi lg:hidden di bawah ini */}
                <button
                  onClick={() => setMobileSidebarOpen(true)}
                  aria-label="Buka menu pengaturan"
                  className={`flex lg:hidden w-11 h-11 rounded-xl items-center justify-center transition-colors ${c.btn}`}>
                  <Menu className="w-3.5 h-3.5" aria-hidden="true" />
                </button>

                <div className="flex items-center gap-2.5">
                  {/* Logo icon — layered glow effect */}
                  <div className="relative flex-shrink-0">
                    <div className={`absolute inset-0 rounded-xl blur-md opacity-60 ${D ? "bg-violet-500" : "bg-violet-400"}`} />
                    <div className="relative w-8 h-8 bg-gradient-to-br from-violet-500 via-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/40 border border-white/20 animate-[float-up_3s_ease-in-out_infinite]">
                      <PenTool className="w-3.5 h-3.5 text-white drop-shadow" />
                    </div>
                  </div>
                  {/* Brand name + badge */}
                  <div className="hidden xs:flex flex-col gap-0">
                    <span className="font-extrabold text-[13px] leading-tight tracking-tight bg-clip-text text-transparent shimmer-text pb-[2px]">
                      Mager Nulis
                    </span>
                    <span className={`text-[8px] font-bold tracking-widest uppercase leading-none mt-0.5 ${D ? "text-white/25" : "text-violet-400/60"}`}>
                      AI Handwriting
                    </span>
                  </div>
                  <span className={`hidden sm:inline-flex text-[8px] px-1.5 py-0.5 rounded-full font-bold tracking-wider border ${D ? "border-violet-400/25 bg-violet-500/10 text-violet-400" : "border-violet-200 bg-violet-50 text-violet-500"}`}>v1.2</span>
                </div>
              </div>

              {/* CENTER: status pill — premium redesign */}
              <div className="hidden sm:flex flex-1 justify-center">
                {isGenerating ? (
                  <div className={`relative flex items-center gap-2.5 pl-3 pr-2 py-1.5 rounded-full overflow-hidden border ${D ? "bg-violet-500/8 border-violet-500/20" : "bg-violet-50 border-violet-200/80"}`}
                    style={{ boxShadow: D ? "0 0 20px rgba(139,92,246,0.12)" : "0 0 16px rgba(139,92,246,0.08)" }}>
                    {/* animated bg bar */}
                    <div className="absolute inset-0 opacity-20"
                      style={{ background: `linear-gradient(90deg, transparent 0%, ${D ? "rgba(139,92,246,0.4)" : "rgba(139,92,246,0.2)"} ${generateProgress}%, transparent ${generateProgress}%)`, transition: "background 0.4s ease" }} />
                    <div className="relative flex items-center gap-2">
                      <div className="relative w-3.5 h-3.5">
                        <svg className="w-3.5 h-3.5 -rotate-90" viewBox="0 0 14 14">
                          <circle cx="7" cy="7" r="5.5" fill="none" stroke={D ? "rgba(139,92,246,0.2)" : "rgba(139,92,246,0.15)"} strokeWidth="1.5" />
                          <circle cx="7" cy="7" r="5.5" fill="none" stroke={D ? "#a78bfa" : "#7c3aed"} strokeWidth="1.5"
                            strokeDasharray={`${2 * Math.PI * 5.5}`}
                            strokeDashoffset={`${2 * Math.PI * 5.5 * (1 - generateProgress / 100)}`}
                            strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.4s ease" }} />
                        </svg>
                      </div>
                      <span className={`text-[11px] font-semibold tabular-nums ${D ? "text-violet-300" : "text-violet-700"}`}>
                        Generating {Math.round(generateProgress)}%
                      </span>
                      <button onClick={() => abortController?.abort()}
                        className={`ml-1 w-5 h-5 rounded-full flex items-center justify-center transition-colors ${D ? "bg-red-500/15 hover:bg-red-500/25 text-red-400" : "bg-red-50 hover:bg-red-100 text-red-500"}`}
                        title="Batalkan">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                ) : generatedPages.length > 0 ? (
                  <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border ${D ? "bg-emerald-500/8 border-emerald-500/20" : "bg-emerald-50 border-emerald-200"}`}
                    style={{ boxShadow: D ? "0 0 16px rgba(16,185,129,0.1)" : "none" }}>
                    <span className="status-dot" style={{ background: "transparent" }}>
                      <span className="status-dot-inner" style={{ background: "#10b981", boxShadow: "0 0 6px rgba(16,185,129,0.8)" }} />
                    </span>
                    <span className={`text-[11px] font-semibold ${D ? "text-emerald-400" : "text-emerald-700"}`}>
                      {generatedPages.length} halaman siap
                    </span>
                  </div>
                ) : text.trim() ? (
                  <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border ${D ? "bg-white/4 border-white/8" : "bg-white border-violet-100 shadow-sm"}`}>
                    <div className={`flex gap-1 items-center`}>
                      <span className={`text-[10px] font-bold tabular-nums ${D ? "text-white/70" : "text-violet-700"}`}>~{estimatedPages} hal</span>
                      <span className={`text-[10px] ${D ? "text-white/20" : "text-violet-300"}`}>·</span>
                      <span className={`text-[10px] ${D ? "text-white/40" : "text-gray-500"}`}>{estimatedTimeLabel}</span>
                      <span className={`text-[10px] ${D ? "text-white/20" : "text-violet-300"}`}>·</span>
                      <span className={`text-[10px] font-medium tabular-nums ${D ? "text-white/50" : "text-gray-600"}`}>{wordCount.toLocaleString()} kata</span>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* RIGHT: backend status + help + dark mode */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <div className={`flex items-center gap-1.5 pr-2 border-r ${D ? "border-white/10" : "border-violet-200"}`}>
                  {/* ── TOMBOL LOGIN CLOUD ── */}
                  {user ? (
                    <div className="hidden md:flex items-center gap-2 mr-1">
                      <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border ${D ? "border-white/8 bg-white/4" : "border-violet-100 bg-violet-50/50"}`}>
                        <div className="w-4 h-4 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-[8px] text-white font-bold flex-shrink-0">
                          {(user.user_metadata.full_name || user.email || "U")[0].toUpperCase()}
                        </div>
                        <span className={`text-[10px] font-medium max-w-[80px] truncate ${D ? "text-white/60" : "text-gray-600"}`}>
                          {user.user_metadata.full_name?.split(" ")[0] || user.email?.split("@")[0]}
                        </span>
                      </div>
                      <button onClick={handleLogout} title="Logout"
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${D ? "bg-red-500/10 hover:bg-red-500/20 text-red-400" : "bg-red-50 hover:bg-red-100 text-red-500"}`}>
                        <LogOut className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button onClick={handleLogin}
                      className="btn-ripple hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold mr-1 transition-all hover:scale-105 active:scale-95"
                      style={{
                        background: D ? "linear-gradient(135deg, #4f46e5, #7c3aed)" : "linear-gradient(135deg, #6d28d9, #4f46e5)",
                        color: "white",
                        boxShadow: "0 2px 12px rgba(109,40,217,0.35)"
                      }}>
                      <LogIn className="w-3 h-3" />
                      <span>Login</span>
                    </button>
                  )}
                  {/* Backend status — dot indicator instead of full pill on small screens */}
                  <div title={backendOnline === null ? "Memeriksa..." : backendOnline ? "Backend terhubung" : "Backend offline"}
                    className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[10px] font-medium transition-colors ${backendOnline === null
                      ? D ? "border-white/6 text-white/25" : "border-gray-200 text-gray-400"
                      : backendOnline
                        ? D ? "border-emerald-500/20 bg-emerald-500/6 text-emerald-400" : "border-emerald-200 bg-emerald-50 text-emerald-600"
                        : D ? "border-red-500/20 bg-red-500/6 text-red-400" : "border-red-200 bg-red-50 text-red-600"
                      }`}>
                    {backendOnline === null
                      ? <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      : <div className={`w-1.5 h-1.5 rounded-full ${backendOnline ? "bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.8)]" : "bg-red-500"}`} />}
                    <span className="hidden lg:inline">{backendOnline === null ? "..." : backendOnline ? "Online" : "Offline"}</span>
                  </div>
                  {/* INDIKATOR ENERGI / ADMIN DASHBOARD */}
                  {user?.email === (process.env.NEXT_PUBLIC_DEV_EMAIL || "sharulwrdn10@gmail.com") ? (
                    <button
                      onClick={() => setShowAdminModal(true)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border bg-violet-600 border-violet-500 text-white text-[10px] sm:text-[11px] font-bold hover:bg-violet-700 transition-colors flex-shrink-0 shadow-sm"
                      title="Admin Control Panel">
                      <Settings className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">ADMIN</span>
                      <span className="sm:hidden">MGR</span>
                    </button>
                  ) : (
                    <div className="relative group">
                      <button onClick={() => setShowQrisModal(true)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-colors ${energy < estimatedPages
                          ? "bg-rose-500/10 text-rose-500 border-rose-500/30 animate-pulse"
                          : D ? "bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20" : "bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100"
                          }`}>
                        <Zap className={`w-3.5 h-3.5 ${energy < estimatedPages ? "text-rose-500" : "text-amber-500"}`} fill="currentColor" />
                        <span>{energy}</span>
                      </button>
                      {/* Tooltip */}
                      <div className={`absolute top-full right-0 mt-2 w-48 px-3 py-2.5 rounded-xl border shadow-xl text-[11px] leading-relaxed pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-[100] ${D ? "bg-[#18181b] border-[#ffffff14] text-white/80" : "bg-white border-gray-200 text-gray-600"}`}>
                        <p className="font-bold mb-1">⚡ Energi Kamu</p>
                        <p>1 energi = 1 halaman generate.</p>
                        <p className="mt-1">Klik untuk Top Up lebih banyak energi.</p>
                        {energy < estimatedPages && (
                          <p className={`mt-1.5 font-semibold ${D ? "text-rose-400" : "text-rose-500"}`}>
                            Tidak cukup untuk {estimatedPages} halaman!
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {/* ══ GROUP 2: AKSI ══ */}
                <div className="flex items-center gap-1.5 pl-1">

                  <button
                    onClick={() => setShowShortcuts(true)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors text-[13px] font-bold ${c.btn}`}
                    title="Keyboard Shortcuts">
                    ?
                  </button>
                  <button
                    onClick={() => {
                      if (!document.startViewTransition) {
                        setIsDark(!isDark);
                        return;
                      }
                      document.startViewTransition(() => {
                        setIsDark(!isDark);
                      });
                    }}
                    className={`relative w-11 h-11 rounded-2xl flex items-center justify-center overflow-hidden border theme-toggle-btn ${isDark
                      ? "bg-[#18181b] border-[#ffffff1a]"
                      : "bg-gradient-to-br from-sky-50 to-amber-50 border-amber-200/50"
                      }`}
                    title={isDark ? "Ke Mode Siang" : "Ke Mode Malam"}
                    aria-label={isDark ? "Aktifkan light mode" : "Aktifkan dark mode"}
                  >
                    {/* Background morphing circle */}
                    <div className={`absolute inset-0 rounded-2xl theme-bg-morph ${isDark ? "theme-bg-dark" : "theme-bg-light"
                      }`} />

                    {/* Sun icon */}
                    <Sun className={`absolute w-[18px] h-[18px] theme-icon theme-sun ${isDark ? "theme-icon-hidden-down" : "theme-icon-visible"
                      } text-amber-500 fill-amber-200`} />

                    {/* Moon icon */}
                    <Moon className={`absolute w-[18px] h-[18px] theme-icon theme-moon ${isDark ? "theme-icon-visible" : "theme-icon-hidden-up"
                      } text-violet-300 fill-violet-900/40`} />

                    {/* Ripple effect on click */}
                    <div className={`absolute inset-0 rounded-2xl theme-ripple ${isDark ? "theme-ripple-dark" : "theme-ripple-light"
                      }`} />
                  </button>
                </div>
              </div>
            </div>
          </header>


          {/* ── BODY: 3-PANEL LAYOUT ── */}
          <div className="w-full max-w-[1400px] 2xl:max-w-[1600px] 3xl:max-w-[2000px] 4xl:max-w-[2400px] mx-auto flex overflow-hidden" style={{ height: "calc(100dvh - 56px)" }}>

            {/* ══ PANEL 1: SIDEBAR SETTINGS — Desktop only ══ */}
            <motion.aside
              id="sidebar-settings"
              className={`page-enter hidden lg:flex flex-col flex-shrink-0 border-r overflow-hidden ${c.sidebar} ${zenMode ? "!hidden" : ""}`}
              animate={{ width: sidebarOpen ? "auto" : 0 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              style={{ height: "calc(100dvh - 56px)", animationDelay: "0.1s" }}
            >
              <motion.div
                animate={{
                  opacity: sidebarOpen ? 1 : 0,
                  x: sidebarOpen ? 0 : -20
                }}
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                ref={sidebarScrollRef}
                className="sidebar-scroll-container flex-1 overflow-y-auto pb-8 scrollbar-thin w-[288px] 2xl:w-[320px] 3xl:w-[380px] 4xl:w-[440px]"
                onScroll={(e) => { sidebarScrollPosRef.current = e.currentTarget.scrollTop; }}
              >
                {renderSidebarContent()}
              </motion.div>
            </motion.aside>

            {/* ══ BUNGKUS PANEL 2 & 3 ══ */}
            <div className="page-enter hidden lg:flex flex-1 overflow-hidden" style={{ height: "calc(100dvh - 56px)" }}>

              {/* ══ PANEL 2: EDITOR ══ */}
              <div id="editor-panel"
                className={`flex flex-col border-r flex-shrink-0 ${c.sidebar} transition-[width] duration-300 ${zenMode
                  ? "w-full lg:w-full border-r-0"
                  : sidebarOpen
                    ? "lg:w-[340px] xl:w-[400px] 2xl:w-[440px] 3xl:w-[600px] 4xl:w-[700px]"
                    : "lg:w-[380px] xl:w-[440px] 2xl:w-[520px] 3xl:w-[720px] 4xl:w-[850px]"
                  }`}>

                {/* Editor header — premium redesign */}
                <div className={`flex-shrink-0 px-4 py-3 border-b ${c.divider} flex items-center justify-between`}
                  style={{
                    background: D
                      ? "linear-gradient(135deg, rgba(19,19,31,0.98) 0%, rgba(13,13,20,0.98) 100%)"
                      : "linear-gradient(135deg, rgba(250,249,255,0.98) 0%, rgba(238,242,255,0.98) 100%)"
                  }}>
                  <div className="flex items-center gap-2">
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center ${D ? "bg-violet-500/15" : "bg-violet-100"}`}>
                      <span className="text-[10px]">📝</span>
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-[0.12em] ${D ? "text-white/30" : "text-gray-400"}`}>Editor</span>
                    {currentFont && (
                      <span className={`text-[10.5px] px-2 py-0.5 rounded-full border font-medium ${D ? "border-violet-500/20 bg-violet-500/8 text-violet-300" : "border-violet-200 bg-violet-50 text-violet-600"}`}
                        style={{ fontFamily: FONT_FAMILY_MAP[currentFont.name] || currentFont.name }}>
                        {currentFont.name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`hidden sm:inline-flex items-center gap-1 text-[10px] ${D ? "text-white/25" : "text-gray-400"}`}>
                      <span className={`font-bold tabular-nums ${D ? "text-indigo-400" : "text-indigo-600"}`}>{wordCount.toLocaleString()}</span>
                      <span>kata</span>
                    </span>

                    <button onClick={() => setZenMode(!zenMode)}
                      className={`hidden lg:flex items-center gap-1 px-2 py-1 rounded-lg text-[9.5px] font-bold transition-all duration-200 border hover:scale-105 active:scale-95 ${zenMode ? "bg-violet-500/15 text-violet-400 border-violet-500/25" : D ? "hover:bg-white/5 text-white/25 border-transparent hover:text-white/50" : "hover:bg-gray-100 text-gray-400 border-transparent hover:text-gray-600"}`}
                      title="Zen Mode (Fullscreen)">
                      <Maximize2 className="w-3 h-3" />
                      <span>{zenMode ? "Keluar" : "Zen"}</span>
                    </button>

                    <div className="relative group">
                      <motion.button
                        id="generate-btn"
                        onClick={handleGenerate}
                        disabled={isGenerating || !text.trim() || !selectedFolio}
                        whileHover={!(isGenerating || !text.trim() || !selectedFolio) ? { y: -2, scale: 1.02 } : {}}
                        whileTap={!(isGenerating || !text.trim() || !selectedFolio) ? { scale: 0.96 } : {}}
                        className={`btn-ripple relative flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm min-w-[130px] overflow-hidden transition-all duration-200 ${isGenerating || !text.trim() || !selectedFolio
                          ? D ? "bg-white/4 text-white/20 cursor-not-allowed border border-white/6" : "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
                          : generateSuccess
                            ? "text-white"
                            : "text-white btn-generate-idle btn-generate-pulse"
                          } ${isGenerating ? 'btn-generate-active' : ''}`}
                        style={
                          generateSuccess
                            ? { background: "linear-gradient(135deg, #10b981, #059669)", boxShadow: "0 4px 20px rgba(16,185,129,0.4), inset 0 1px 0 rgba(255,255,255,0.2)" }
                            : !(isGenerating || !text.trim() || !selectedFolio)
                              ? { background: D ? "linear-gradient(135deg, #7c3aed, #6d28d9, #4f46e5)" : "linear-gradient(135deg, #8b5cf6, #7c3aed, #6366f1)", boxShadow: "0 4px 20px rgba(124,58,237,0.45), inset 0 1px 0 rgba(255,255,255,0.2)" }
                              : {}
                        }>
                        {/* Shimmer sweep overlay */}
                        {!(isGenerating || !text.trim() || !selectedFolio) && !generateSuccess && (
                          <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
                            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                          </div>
                        )}
                        {/* Progress fill */}
                        {isGenerating && (
                          <motion.div
                            className="absolute inset-0 rounded-xl"
                            style={{
                              background: "linear-gradient(90deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)",
                              width: `${generateProgress}%`,
                              transition: "width 0.4s ease-out",
                            }}
                          />
                        )}
                        <div className="relative z-10 flex items-center gap-1.5">
                          {isGenerating ? (
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                              <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" />
                              <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2.5"
                                strokeDasharray={`${2 * Math.PI * 10}`}
                                strokeDashoffset={`${2 * Math.PI * 10 * (1 - generateProgress / 100)}`}
                                strokeLinecap="round"
                                style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', transition: 'stroke-dashoffset 0.4s ease' }}
                              />
                            </svg>
                          ) : generateSuccess ? (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <Sparkles className="w-4 h-4" />
                          )}
                          <span>
                            {isGenerating
                              ? `${Math.round(generateProgress)}%`
                              : generateSuccess
                                ? '✓ Selesai!'
                                : 'Generate'
                            }
                          </span>
                          {!isGenerating && !generateSuccess && estimatedPages > 1 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/20 font-bold">{estimatedPages}</span>
                          )}
                        </div>
                      </motion.button>
                      {/* Glow halo di bawah tombol */}
                      {!(isGenerating || !text.trim() || !selectedFolio) && !generateSuccess && (
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3/4 h-3 blur-md opacity-50 pointer-events-none rounded-full"
                          style={{ background: "linear-gradient(90deg, #8b5cf6, #6366f1)" }} />
                      )}
                      {/* Tooltip shortcut */}
                      <div className={`absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap
    opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50
    flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-medium border shadow-lg
    ${D ? "bg-[#09090b] border-white/10 text-white/50" : "bg-white border-gray-200 text-gray-500 shadow-md"}`}>
                        <kbd className={`px-1 rounded text-[8px] font-mono ${D ? "bg-white/8" : "bg-gray-100"}`}>Ctrl</kbd>
                        <span>+</span>
                        <kbd className={`px-1 rounded text-[8px] font-mono ${D ? "bg-white/8" : "bg-gray-100"}`}>↵</kbd>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Textarea area - scrollable */}
                <div className="flex-1 relative overflow-y-auto min-h-0 scrollbar-thin">

                  {/* ── FLOATING SELECTION MENU (Notion Style) ── */}
                  <AnimatePresence>
                    {selectedTextRange.text && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className={`fixed left-1/2 -translate-x-1/2 bottom-32 lg:absolute lg:bottom-10 z-[70] flex items-center gap-1 p-1.5 rounded-2xl shadow-2xl backdrop-blur-2xl border ${D ? "bg-black/80 border-white/10" : "bg-white/95 border-gray-200"}`}
                      >
                        <span className={`px-2 text-[10px] font-semibold uppercase tracking-widest ${D ? "text-white/40" : "text-gray-400"}`}>Aksi:</span>

                        <button onClick={async () => {
                          const tid = toast.loading("Memoles teks pilihan...");
                          try {
                            const res = await fetch(`${API_URL}/api/ai-expand`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: selectedTextRange.text }) });
                            const data = await res.json();
                            if (data.success) {
                              const newFullText = text.substring(0, selectedTextRange.start) + data.text.trim() + text.substring(selectedTextRange.end);
                              setInputText(newFullText); setText(newFullText); setSelectedTextRange({ text: "", start: 0, end: 0 }); toast.success("Berhasil dipoles!", { id: tid });
                            } else throw new Error();
                          } catch { toast.error("Gagal memoles", { id: tid }); }
                        }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-colors ${D ? "bg-violet-500/20 text-violet-300 hover:bg-violet-500/30" : "bg-violet-100 text-violet-700 hover:bg-violet-200"}`}>
                          <Wand2 className="w-3.5 h-3.5" /> Poles AI
                        </button>

                        <button onClick={() => {
                          navigator.clipboard.writeText(selectedTextRange.text);
                          toast.success("Teks disalin!");
                          setSelectedTextRange({ text: "", start: 0, end: 0 });
                        }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-colors ${D ? "hover:bg-white/10 text-gray-300" : "hover:bg-gray-100 text-gray-600"}`}>
                          <Copy className="w-3.5 h-3.5" /> Salin
                        </button>

                        <button onClick={() => {
                          const newFullText = text.substring(0, selectedTextRange.start) + text.substring(selectedTextRange.end);
                          setInputText(newFullText); setText(newFullText); setSelectedTextRange({ text: "", start: 0, end: 0 });
                        }} className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-colors ${D ? "hover:bg-red-500/20 text-red-400" : "hover:bg-red-50 text-red-600"}`}>
                          <Trash2 className="w-3.5 h-3.5" /> Hapus
                        </button>

                        <button onClick={() => setSelectedTextRange({ text: "", start: 0, end: 0 })} className={`ml-1 p-1.5 rounded-lg transition-colors ${D ? "text-white/30 hover:bg-white/10" : "text-gray-400 hover:bg-gray-100"}`}>
                          <X className="w-4 h-4" />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {/* ── SLASH COMMAND MENU (Notion Style) ── */}
                  <AnimatePresence>
                    {showSlashMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className={`absolute left-1/2 -translate-x-1/2 bottom-24 lg:bottom-16 z-[75] flex flex-col gap-1 w-64 p-2 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] backdrop-blur-3xl border ${D ? "bg-[#18181b]/95 border-white/15" : "bg-white/95 border-gray-200"}`}
                      >
                        <div className="px-3 py-1.5 flex items-center justify-between">
                          <span className={`text-[10px] font-bold uppercase tracking-widest ${c.ts}`}>Sihir AI & Alat 🪄</span>
                          <kbd className={`text-[9px] px-1.5 py-0.5 rounded ${D ? "bg-white/10 text-white/50" : "bg-gray-100 text-gray-500"}`}>Bckspc</kbd>
                        </div>

                        <button onClick={() => {
                          const newText = text.slice(0, -1); // Hapus '/'
                          setInputText(newText); setText(newText);
                          setShowSlashMenu(false); setShowAiModal(true);
                        }} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left ${D ? "hover:bg-white/10" : "hover:bg-gray-100"}`}>
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${D ? "bg-indigo-500/20 text-indigo-400" : "bg-indigo-100 text-indigo-600"}`}><Bot className="w-4 h-4" /></div>
                          <div><p className={`text-xs font-bold ${c.tp}`}>Tulis dengan AI</p><p className={`text-[10px] ${c.ts}`}>Buat draf otomatis</p></div>
                        </button>

                        <button onClick={() => {
                          const newText = text.slice(0, -1); // Hapus '/'
                          setInputText(newText); setText(newText);
                          setShowSlashMenu(false); toggleListening();
                        }} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left ${D ? "hover:bg-white/10" : "hover:bg-gray-100"}`}>
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${D ? "bg-red-500/20 text-red-400" : "bg-red-100 text-red-600"}`}><Mic className="w-4 h-4" /></div>
                          <div><p className={`text-xs font-bold ${c.tp}`}>Dikte Suara</p><p className={`text-[10px] ${c.ts}`}>Ketik lewat ucapan</p></div>
                        </button>

                        <button onClick={() => {
                          const newText = text.slice(0, -1) + " $\\frac{1}{2}p$ ";
                          setInputText(newText); setText(newText); setShowSlashMenu(false);
                          setTimeout(() => textareaRef.current?.focus(), 50);
                        }} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left ${D ? "hover:bg-white/10" : "hover:bg-gray-100"}`}>
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${D ? "bg-amber-500/20 text-amber-400" : "bg-amber-100 text-amber-600"}`}><Sigma className="w-4 h-4" /></div>
                          <div><p className={`text-xs font-bold ${c.tp}`}>Pecahan Matematika</p><p className={`text-[10px] ${c.ts}`}>Sisipkan rumus</p></div>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div className="p-4 flex flex-col gap-3">

                    {/* Toolbar — scrollable horizontal, rapi di semua ukuran */}
                    <div className="flex flex-col gap-2">

                      {/* Baris 1: Tombol aksi — scroll horizontal di layar sempit */}
                      <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide -mx-1 px-1">
                        <div className="flex items-center gap-1.5 flex-nowrap min-w-max">

                          {/* Tempel */}
                          <MagneticHover isApple={isAppleDevice} className="flex-shrink-0">
                            <button
                              onClick={async () => {
                                try {
                                  const t = await navigator.clipboard.readText();
                                  setInputText(t); setText(t); toast.success("Teks ditempel!");
                                } catch { toast.error("Tidak bisa akses clipboard"); }
                              }}
                              className={`token-chip flex items-center w-full gap-1.5 text-[11px] px-3 py-2 rounded-xl border whitespace-nowrap ${isAppleDevice ? 'liquid-glass-btn' : c.btn}`}>
                              <Clipboard className="w-3.5 h-3.5 flex-shrink-0" />
                              <span>Tempel</span>
                            </button>
                          </MagneticHover>

                          {/* Tulis dengan AI */}
                          <MagneticHover isApple={isAppleDevice} className="flex-shrink-0">
                            <button
                              onClick={() => setShowAiModal(true)}
                              className={`token-chip flex items-center w-full gap-1.5 text-[11px] px-3 py-2 rounded-xl border whitespace-nowrap ${D
                                ? "bg-indigo-500/8 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/15 hover:border-indigo-500/35"
                                : "bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300"
                                }`}>
                              <Bot className="w-3.5 h-3.5 flex-shrink-0" />
                              <span>Tulis AI</span>
                            </button>
                          </MagneticHover>

                          {/* Poles & Panjangkan AI */}
                          <MagneticHover isApple={isAppleDevice} className="flex-shrink-0">
                            <button
                              onClick={handleAiExpand}
                              disabled={!text.trim() || isAiExpanding}
                              className={`token-chip flex items-center w-full gap-1.5 text-[11px] px-3 py-2 rounded-xl border whitespace-nowrap ${!text.trim()
                                ? "opacity-35 cursor-not-allowed border-gray-300"
                                : D
                                  ? "bg-purple-500/10 text-purple-400 border-purple-500/30 hover:bg-purple-500/20"
                                  : "bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100"
                                }`}
                            >
                              {isAiExpanding ? <Loader2 className="w-3.5 h-3.5 flex-shrink-0 animate-spin" /> : <Wand2 className="w-3.5 h-3.5 flex-shrink-0" />}
                              <span>Poles & Panjangkan</span>
                            </button>
                          </MagneticHover>

                          {/* Dikte */}
                          <MagneticHover isApple={isAppleDevice} className="flex-shrink-0">
                            <button
                              onClick={toggleListening}
                              title={isListening ? "Berhenti mendikte" : "Mulai mendikte"}
                              className={`token-chip flex items-center w-full gap-1.5 text-[11px] px-3 py-2 rounded-xl border whitespace-nowrap ${isListening
                                ? "bg-red-500/15 text-red-400 border-red-500/30 animate-pulse"
                                : c.btn
                                }`}>
                              <Mic className="w-3.5 h-3.5 flex-shrink-0" />
                              <span>{isListening ? "Dengerin..." : "Dikte"}</span>
                            </button>
                          </MagneticHover>

                          {/* Hapus */}
                          <MagneticHover isApple={isAppleDevice} className="flex-shrink-0">
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
                                          className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-[10px] font-bold transition-colors hover:bg-red-600 hover:scale-105 active:scale-95 shadow-md shadow-red-500/20">
                                          Ya, Hapus
                                        </button>
                                        <button
                                          onClick={() => toast.dismiss(t.id)}
                                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors hover:scale-105 active:scale-95 ${D ? "bg-white/10 text-white hover:bg-white/20" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
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
                              className={`token-chip flex items-center gap-1.5 text-[11px] px-3 py-2 rounded-xl border whitespace-nowrap flex-shrink-0 ${!text
                                ? "opacity-35 cursor-not-allowed " + c.btn
                                : D
                                  ? "hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/25 " + c.btn
                                  : "hover:bg-red-50 hover:text-red-600 hover:border-red-200 " + c.btn
                                }`}>
                              <Trash2 className="w-3.5 h-3.5 flex-shrink-0" />
                              <span>Hapus</span>
                            </button>
                          </MagneticHover>

                          {/* Copy Semua Teks */}
                          <MagneticHover isApple={isAppleDevice} className="flex-shrink-0">
                            <button
                              onClick={() => {
                                if (!text.trim()) return;
                                navigator.clipboard.writeText(text).then(() => {
                                  toast.success("Semua teks berhasil disalin! 📋");
                                }).catch(() => {
                                  toast.error("Gagal menyalin teks");
                                });
                              }}
                              disabled={!text.trim()}
                              className={`token-chip flex items-center gap-1.5 text-[11px] px-3 py-2 rounded-xl border whitespace-nowrap ${!text.trim()
                                ? "opacity-35 cursor-not-allowed " + c.btn
                                : D
                                  ? "bg-sky-500/10 text-sky-400 border-sky-500/30 hover:bg-sky-500/20"
                                  : "bg-sky-50 text-sky-600 border-sky-200 hover:bg-sky-100"
                                }`}>
                              <Copy className="w-3.5 h-3.5 flex-shrink-0" />
                              <span>Salin Teks</span>
                            </button>
                          </MagneticHover>

                          {/* Bagikan Link Publik */}
                          <MagneticHover isApple={isAppleDevice} className="flex-shrink-0">
                            <button
                              onClick={handleSharePublicLink}
                              disabled={!text.trim()}
                              className={`token-chip flex items-center gap-1.5 text-[11px] px-3 py-2 rounded-xl border whitespace-nowrap ${!text.trim()
                                ? "opacity-35 cursor-not-allowed " + c.btn
                                : D
                                  ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/20"
                                  : "bg-cyan-50 text-cyan-600 border-cyan-200 hover:bg-cyan-100"
                                }`}
                            >
                              <Link className="w-3.5 h-3.5 flex-shrink-0" />
                              <span>Link Publik</span>
                            </button>
                          </MagneticHover>

                          {/* Sisipkan Pecahan LaTeX */}
                          <MagneticHover isApple={isAppleDevice} className="flex-shrink-0">
                            <button
                              onClick={() => {
                                const latex = " $\\frac{1}{2}p$ ";
                                setInputText(prev => prev + latex);
                                setText(prev => prev + latex);
                                setTimeout(() => textareaRef.current?.focus(), 50);
                              }}
                              className={`token-chip flex items-center gap-1.5 text-[11px] px-3 py-2 rounded-xl border whitespace-nowrap flex-shrink-0 ${D
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
                                : "bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100"
                                }`}
                              title="Sisipkan format rumus pecahan"
                            >
                              <Sigma className="w-3.5 h-3.5 flex-shrink-0" />
                              <span>Pecahan</span>
                            </button>
                          </MagneticHover>

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

                      {/* Stats mini — tablet & mobile */}
                      <div className={`flex items-center gap-2 flex-wrap md:hidden`}>
                        <span className={`text-[10px] px-2 py-1 rounded-lg border ${c.pillBorder} ${c.pill} ${c.ts}`}>
                          📄 ~{estimatedPages} hal
                        </span>
                        <span className={`text-[10px] px-2 py-1 rounded-lg border ${c.pillBorder} ${c.pill} ${c.ts}`}>
                          ⏱ {estimatedTimeLabel}
                        </span>
                        {currentFont && (
                          <span className={`text-[10px] px-2 py-1 rounded-lg border ${c.pillBorder} ${c.pill} ${c.ts}`}
                            style={{ fontFamily: FONT_FAMILY_MAP[currentFont.name] || currentFont.name }}>
                            {currentFont.name}
                          </span>
                        )}
                      </div>

                      {/* Baris 2: Counter karakter + estimasi halaman */}
                      <div className={`flex items-center justify-between px-1`}>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10.5px] ${c.ts}`}>
                            <span className={`font-semibold tabular-nums transition-all duration-300 ${text.length > 40000 ? "text-red-400 scale-110" : D ? "text-emerald-400" : "text-emerald-600"}`}
                              style={{ display: 'inline-block' }}>
                              {text.length.toLocaleString()}
                            </span>
                            <span className={c.ts}>/50k karakter</span>
                          </span>
                          <span className={`text-[10px] ${D ? "text-white/15" : "text-gray-300"}`}>·</span>
                          <span className={`text-[10.5px] ${c.ts}`}>
                            {wordCount.toLocaleString()} kata
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {autoSaveStatus !== 'idle' && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                              className={`flex items-center gap-1 text-[10px] font-medium ${autoSaveStatus === 'saving' ? c.ts : D ? 'text-emerald-400' : 'text-emerald-600'}`}
                            >
                              {autoSaveStatus === 'saving' ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                            </motion.div>
                          )}
                          <span className={`text-[11px] font-bold tabular-nums px-2 py-0.5 rounded-lg border transition-colors ${text.length > 45000
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
                    </div>
                    {/* ── AI QUICK INSERT CHIPS (DIPINDAH KE ATAS TEXTAREA) ── */}
                    {!text.trim() && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        transition={{ duration: 0.3, delay: 0.2 }}
                        className="flex flex-col gap-2 mb-2"
                      >
                        <div className="flex items-center gap-1.5 px-1">
                          <div className={`w-3 h-3 rounded-sm flex items-center justify-center ${D ? "bg-violet-500/20" : "bg-violet-100"}`}>
                            <Sparkles className={`w-2 h-2 ${D ? "text-violet-400" : "text-violet-500"}`} />
                          </div>
                          <p className={`text-[9.5px] font-bold uppercase tracking-[0.12em] ${D ? "text-white/25" : "text-gray-400"}`}>
                            Mulai dengan...
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { text: "Pada suatu hari yang cerah,", color: D ? "from-violet-500/15 to-purple-500/10 border-violet-500/20 text-violet-300 hover:border-violet-400/40" : "from-violet-50 to-purple-50 border-violet-200 text-violet-700 hover:border-violet-300" },
                            { text: "Berdasarkan hasil penelitian,", color: D ? "from-blue-500/15 to-indigo-500/10 border-blue-500/20 text-blue-300 hover:border-blue-400/40" : "from-blue-50 to-indigo-50 border-blue-200 text-blue-700 hover:border-blue-300" },
                            { text: "Menurut pendapat saya,", color: D ? "from-emerald-500/15 to-teal-500/10 border-emerald-500/20 text-emerald-300 hover:border-emerald-400/40" : "from-emerald-50 to-teal-50 border-emerald-200 text-emerald-700 hover:border-emerald-300" },
                            { text: "Di era globalisasi ini,", color: D ? "from-orange-500/15 to-amber-500/10 border-orange-500/20 text-orange-300 hover:border-orange-400/40" : "from-orange-50 to-amber-50 border-orange-200 text-orange-700 hover:border-orange-300" },
                            { text: "Seiring perkembangan zaman,", color: D ? "from-pink-500/15 to-rose-500/10 border-pink-500/20 text-pink-300 hover:border-pink-400/40" : "from-pink-50 to-rose-50 border-pink-200 text-pink-700 hover:border-pink-300" },
                            { text: "Dalam kehidupan sehari-hari,", color: D ? "from-cyan-500/15 to-sky-500/10 border-cyan-500/20 text-cyan-300 hover:border-cyan-400/40" : "from-cyan-50 to-sky-50 border-cyan-200 text-cyan-700 hover:border-cyan-300" },
                            { text: "Pendidikan merupakan hal penting", color: D ? "from-violet-500/15 to-indigo-500/10 border-violet-500/20 text-violet-300 hover:border-violet-400/40" : "from-violet-50 to-indigo-50 border-violet-200 text-violet-700 hover:border-violet-300" },
                            { text: "Indonesia adalah negara yang", color: D ? "from-red-500/15 to-orange-500/10 border-red-500/20 text-red-300 hover:border-red-400/40" : "from-red-50 to-orange-50 border-red-200 text-red-700 hover:border-red-300" },
                          ].map(({ text: starter, color }, i) => (
                            <motion.button
                              key={starter}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: 0.05 * i, duration: 0.2 }}
                              whileHover={{ scale: 1.04, y: -1 }}
                              whileTap={{ scale: 0.96 }}
                              onClick={() => {
                                const newText = starter + " ";
                                setInputText(newText);
                                setText(newText);
                                setTimeout(() => {
                                  textareaRef.current?.focus();
                                  const len = newText.length;
                                  textareaRef.current?.setSelectionRange(len, len);
                                }, 50);
                              }}
                              className={`flex items-center gap-1 text-[10.5px] px-2.5 py-1 rounded-full border bg-gradient-to-r transition-all duration-200 ${color}`}
                            >
                              <span className="font-medium">{starter}</span>
                            </motion.button>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {/* Textarea */}
                    <OptimizedTextarea
                      ref={textareaRef}
                      value={inputText}
                      onMouseUp={checkTextSelection}
                      onKeyUp={checkTextSelection}
                      onChange={(val: string) => {
                        setInputText(val);

                        // KUNCI SLASH COMMAND: Deteksi ketikan "/"
                        if (val.trim() === "/" || val.endsWith(" /") || val.endsWith("\n/")) {
                          setShowSlashMenu(true);
                        } else {
                          setShowSlashMenu(false);
                        }

                        // OPTIMISASI INP
                        setTimeout(() => {
                          React.startTransition(() => {
                            setText(val);
                          });
                        }, 50);
                      }}
                      onDragOver={(e: any) => e.preventDefault()}
                      onDrop={async (e: any) => {
                        e.preventDefault();
                        const file = e.dataTransfer.files[0];
                        if (!file) return;

                        if (file.type === "text/plain") {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            if (typeof ev.target?.result === "string") {
                              const newText = text + (text ? "\n\n" : "") + ev.target.result;
                              setText(newText); setInputText(newText);
                              toast.success("File TXT berhasil dimuat! 📄");
                            }
                          };
                          reader.readAsText(file);
                        }
                        else if (file.name.toLowerCase().endsWith(".docx")) {
                          const tid = toast.loading("Mengekstrak teks dari Word... ⏳");
                          try {
                            const mammoth = await import("mammoth");
                            const arrayBuffer = await file.arrayBuffer();
                            const result = await mammoth.extractRawText({ arrayBuffer });
                            const extractedText = result.value.trim();
                            if (extractedText) {
                              const newText = text + (text ? "\n\n" : "") + extractedText;
                              setText(newText); setInputText(newText);
                              toast.success("Teks Word berhasil diekstrak! ✨", { id: tid });
                            } else {
                              toast.error("File Word kosong atau format tidak terbaca", { id: tid });
                            }
                          } catch (err) {
                            toast.error("Gagal membaca file Word", { id: tid });
                          }
                        }
                        else {
                          toast.error("Saat ini hanya mendukung file .txt dan .docx ⚠️");
                        }
                      }}
                      placeholder={magicPlaceholder}
                      className={`flex-1 w-full h-full min-h-[60vh] resize-none px-4 pt-6 pb-[40vh] text-[16px] leading-loose transition-all duration-500 ease-out outline-none border-none bg-transparent ${D
                        ? "text-white/90 placeholder-white/20 caret-violet-400 focus:-translate-y-1 focus:shadow-[0_8px_30px_rgba(139,92,246,0.15)]"
                        : "text-gray-800 placeholder-gray-400/70 caret-violet-500 focus:-translate-y-1 focus:shadow-[0_8px_30px_rgba(139,92,246,0.15)]"
                        }`}
                      style={{
                        minHeight: "200px",
                        height: "auto",
                        fontFamily: currentFont ? (FONT_FAMILY_MAP[currentFont.name] || currentFont.name) : "inherit"
                      }}
                    />

                    {/* Char progress */}
                    {text.length > 0 && (
                      <div className={`h-1 flex-shrink-0 rounded-full overflow-hidden mt-1 ${D ? "bg-[#ffffff08]" : "bg-gray-200"}`}>
                        <div className={`h-full rounded-full transition-[width] duration-500 ${text.length > 45000 ? "bg-red-500" : text.length > 30000 ? "bg-amber-500" : D ? "bg-emerald-500" : "bg-emerald-600"
                          }`} style={{ width: `${Math.min(100, (text.length / 50000) * 100)}%` }} />
                      </div>
                    )}

                    {/* Shortcut hints */}
                    <div className={`flex items-center gap-3 text-[10px] ${c.ts} mt-1.5`}>
                      <div className="flex items-center gap-1">
                        <kbd className={`px-1.5 py-0.5 rounded border font-mono text-[9px] ${D ? "bg-white/5 border-white/10" : "bg-gray-100 border-gray-200"}`}>Ctrl+Enter</kbd>
                        <span>Generate</span>
                      </div>
                      <div className={`w-px h-3 ${D ? "bg-white/10" : "bg-gray-200"}`} />
                      <div className="flex items-center gap-1">
                        <span>Drag & drop</span>
                        <kbd className={`px-1.5 py-0.5 rounded border font-mono text-[9px] ${D ? "bg-white/5 border-white/10" : "bg-gray-100 border-gray-200"}`}>.txt / .docx</kbd>
                      </div>
                    </div>

                    {text.length > 45000 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${D ? "bg-red-500/10 border-red-500/25 text-red-400" : "bg-red-50 border-red-200 text-red-600"}`}>
                        <span className="text-base flex-shrink-0">🚨</span>
                        <p className="text-[11px] leading-relaxed">
                          Hampir penuh! <strong>{(50000 - text.length).toLocaleString()} karakter</strong> tersisa. Teks di atas 50.000 karakter akan dipotong otomatis.
                        </p>
                      </motion.div>
                    )}

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
                        <button onClick={handleCopySeed} className={`ml-0.5 p-2 -m-2 transition-colors rounded-lg ${showSeedCopied ? "text-emerald-500" : c.ts}`}>
                          {showSeedCopied ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                      {/* Tombol regenerate digabung agar user tidak bingung */}
                      <button
                        onClick={() => setSeed(Date.now())}
                        title="Ganti seed — hasil tulisan akan berbeda"
                        className={`p-2.5 rounded-xl border transition-colors ${c.btn}`}>
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
                    <div className={`stats-card flex items-center gap-2 px-3 py-2 rounded-xl border ${c.pillBorder} ${c.pill}`}>
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${D ? "bg-violet-500/15" : "bg-violet-100"}`}>
                        <FileText className="w-3.5 h-3.5 text-violet-500" />
                      </div>
                      <div>
                        <p className={`text-[9px] uppercase tracking-widest font-semibold ${c.ts}`}>Halaman</p>
                        <p className={`text-sm font-bold tabular-nums ${D ? "text-violet-400" : "text-violet-600"}`}>~{estimatedPages}</p>
                      </div>
                    </div>
                    {/* Estimasi waktu */}
                    <div className={`stats-card flex items-center gap-2 px-3 py-2 rounded-xl border ${c.pillBorder} ${c.pill}`}>
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${D ? "bg-amber-500/15" : "bg-amber-100"}`}>
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                      </div>
                      <div>
                        <p className={`text-[9px] uppercase tracking-widest font-semibold ${c.ts}`}>Estimasi</p>
                        <p className={`text-sm font-bold ${D ? "text-amber-400" : "text-amber-600"}`}>{estimatedTimeLabel}</p>
                      </div>
                    </div>
                    {/* Font aktif */}
                    <div className={`stats-card flex items-center gap-2 px-3 py-2 rounded-xl border ${c.pillBorder} ${c.pill}`}>
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
                    <div className={`stats-card flex items-center gap-2 px-3 py-2 rounded-xl border ${c.pillBorder} ${c.pill}`}>
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
                {/* ── EDITOR PROGRESS BAR — visual page estimation ── */}
                <div className={`mx-3 mb-2 h-1 rounded-full overflow-hidden ${D ? "bg-[#ffffff06]" : "bg-violet-100/50"}`}>
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-500 transition-[width] duration-500 ease-out"
                    style={{ width: `${Math.min(100, (estimatedPages / 10) * 100)}%` }}
                  />
                </div>
              </div>

              {/* ══ PANEL 3: OUTPUT VIEWER ══ */}
              <main className={`flex flex-1 min-w-0 flex-col overflow-hidden ${zenMode ? "hidden" : ""}`}>

                {/* Output header — premium redesign */}
                <div className={`flex-shrink-0 border-b ${c.divider} backdrop-blur-xl`}
                  style={{
                    background: D
                      ? "linear-gradient(135deg, rgba(9,9,11,0.95) 0%, rgba(13,13,20,0.95) 100%)"
                      : "linear-gradient(135deg, rgba(245,243,255,0.95) 0%, rgba(238,242,255,0.95) 100%)"
                  }}>

                  {/* Baris 1: Status + Navigasi halaman + Riwayat/Preset */}
                  <div className="flex items-center justify-between gap-2 px-4 py-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Status pill — premium */}
                      {isGenerating ? (
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${D ? "bg-violet-500/8 border-violet-500/20" : "bg-violet-50 border-violet-200"}`}>
                          <div className="relative w-3 h-3 flex-shrink-0">
                            <svg className="w-3 h-3 -rotate-90" viewBox="0 0 12 12">
                              <circle cx="6" cy="6" r="4.5" fill="none" stroke={D ? "rgba(139,92,246,0.2)" : "rgba(139,92,246,0.15)"} strokeWidth="1.5" />
                              <circle cx="6" cy="6" r="4.5" fill="none" stroke={D ? "#a78bfa" : "#7c3aed"} strokeWidth="1.5"
                                strokeDasharray={`${2 * Math.PI * 4.5}`}
                                strokeDashoffset={`${2 * Math.PI * 4.5 * (1 - generateProgress / 100)}`}
                                strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.4s ease" }} />
                            </svg>
                          </div>
                          <span className={`text-[10.5px] font-semibold tabular-nums ${D ? "text-violet-300" : "text-violet-700"}`}>
                            {Math.round(generateProgress)}%
                          </span>
                          <button onClick={() => abortController?.abort()}
                            className={`w-4 h-4 rounded-full flex items-center justify-center transition-colors ${D ? "bg-red-500/15 hover:bg-red-500/25 text-red-400" : "bg-red-50 hover:bg-red-100 text-red-500"}`}
                            title="Batalkan">
                            <X className="w-2 h-2" />
                          </button>
                        </div>
                      ) : generatedPages.length > 0 ? (
                        <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border ${D ? "bg-emerald-500/8 border-emerald-500/20" : "bg-emerald-50 border-emerald-200"}`}>
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.8)]" />
                          <span className={`text-[10.5px] font-semibold ${D ? "text-emerald-400" : "text-emerald-700"}`}>
                            {generatedPages.length} hal siap
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <div className={`w-4 h-4 rounded-md flex items-center justify-center ${D ? "bg-indigo-500/15" : "bg-indigo-100"}`}>
                            <ImageIcon className={`w-2.5 h-2.5 ${D ? "text-indigo-400" : "text-indigo-500"}`} />
                          </div>
                          <span className={`text-[10px] font-bold uppercase tracking-[0.1em] ${D ? "text-white/30" : "text-gray-400"}`}>Output</span>
                        </div>
                      )}
                    </div>

                    {/* Riwayat & Preset — selalu visible di kanan */}
                    <div className="flex items-center gap-1 flex-shrink-0">

                      {/* ── Togle View Mode (Buku vs Scroll Vertikal) ── */}
                      {generatedPages.length > 0 && activeTab === "result" && (
                        <div className={`hidden sm:flex items-center p-0.5 rounded-full border mr-2 ${D ? "bg-black/40 border-white/8" : "bg-gray-100 border-gray-200"}`}>
                          <button
                            onClick={() => setViewMode('book')}
                            className={`p-1.5 rounded-full transition-all duration-200 ${viewMode === 'book' ? (D ? "bg-white/10 text-violet-400 shadow-sm" : "bg-white text-violet-600 shadow-sm") : (D ? "text-white/30 hover:text-white/70" : "text-gray-400 hover:text-gray-600")}`}
                            title="Mode Buku (3D)">
                            <BookOpen className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-full transition-all duration-200 ${viewMode === 'grid' ? (D ? "bg-white/10 text-violet-400 shadow-sm" : "bg-white text-violet-600 shadow-sm") : (D ? "text-white/30 hover:text-white/70" : "text-gray-400 hover:text-gray-600")}`}
                            title="Mode Scroll Vertikal">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                            </svg>
                          </button>
                        </div>
                      )}

                      <button
                        onClick={() => setActiveTab(activeTab === "history" ? "result" : "history")}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10.5px] font-semibold border transition-all duration-200 hover:scale-105 active:scale-95 ${activeTab === "history" ? c.btnActive : c.btn}`}
                        title="Riwayat">
                        <Clock className="w-3 h-3" />
                        <span className="hidden lg:inline">Riwayat</span>
                        {history.length > 0 && (
                          <span className={`text-[8.5px] px-1.5 py-0.5 rounded-full font-bold ${activeTab === "history" ? D ? "bg-white/20" : "bg-black/10" : D ? "bg-white/8 text-white/35" : "bg-gray-200 text-gray-500"}`}>
                            {history.length}
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => setActiveTab(activeTab === "presets" ? "result" : "presets")}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10.5px] font-semibold border transition-all duration-200 hover:scale-105 active:scale-95 ${activeTab === "presets" ? c.btnActive : c.btn}`}
                        title="Preset">
                        <Save className="w-3 h-3" />
                        <span className="hidden lg:inline">Preset</span>
                        {presets.length > 0 && (
                          <span className={`text-[8.5px] px-1.5 py-0.5 rounded-full font-bold ${activeTab === "presets" ? D ? "bg-white/20" : "bg-black/10" : D ? "bg-white/8 text-white/35" : "bg-gray-200 text-gray-500"}`}>
                            {presets.length}
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Progress bar saat generating */}
                {isGenerating && (
                  <div className={`h-1 w-full relative overflow-hidden ${D ? "bg-[#ffffff08]" : "bg-gray-100"}`}>
                    <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-violet-500 to-indigo-400 transition-[width] duration-300" style={{ width: `${generateProgress}%` }} />
                  </div>
                )}

                {/* ── READING PROGRESS BAR ── */}
                {generatedPages.length > 1 && !isGenerating && (
                  <div className={`h-[2px] w-full relative overflow-hidden ${D ? "bg-white/5" : "bg-violet-100"}`}>
                    <motion.div
                      className="progress-shimmer absolute top-0 left-0 h-full bg-gradient-to-r from-violet-500 via-indigo-400 to-cyan-400"
                      initial={{ width: 0 }}
                      animate={{
                        width: `${((activePageIndex + 1) / generatedPages.length) * 100}%`
                      }}
                      transition={{ type: "spring", stiffness: 200, damping: 30 }}
                    />
                    {/* Glow di ujung bar */}
                    <motion.div
                      className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-violet-400 shadow-[0_0_6px_rgba(139,92,246,0.8)]"
                      initial={{ left: 0 }}
                      animate={{
                        left: `calc(${((activePageIndex + 1) / generatedPages.length) * 100}% - 4px)`
                      }}
                      transition={{ type: "spring", stiffness: 200, damping: 30 }}
                    />
                  </div>
                )}

                {/* ── MAIN CONTENT AREA ── */}
                <div className="flex-1 min-h-0 overflow-hidden flex relative">

                  {/* Keyboard Navigation Hint */}
                  <AnimatePresence>
                    {showKeyboardHint && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className={`absolute bottom-28 left-1/2 -translate-x-1/2 z-[55] flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium border shadow-lg backdrop-blur-xl pointer-events-none ${D ? "bg-black/80 border-white/10 text-white/70" : "bg-white/95 border-violet-200 text-gray-600"}`}>
                        <kbd className={`px-1.5 py-0.5 rounded border font-mono text-[10px] ${D ? "bg-white/10 border-white/20 text-white" : "bg-gray-100 border-gray-300 text-gray-700"}`}>←</kbd>
                        <span>navigasi halaman</span>
                        <kbd className={`px-1.5 py-0.5 rounded border font-mono text-[10px] ${D ? "bg-white/10 border-white/20 text-white" : "bg-gray-100 border-gray-300 text-gray-700"}`}>→</kbd>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Scroll to First Page Button — Desktop */}
                  {generatedPages.length > 1 && activePageIndex > 0 && activeTab === "result" && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      onClick={() => navigateToPage(0)}
                      className={`absolute top-4 right-4 z-[55] flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border shadow-lg transition-colors ${D ? "bg-black/70 backdrop-blur-xl border-white/15 text-white/70 hover:text-white hover:bg-black/90" : "bg-white/90 backdrop-blur-xl border-violet-200 text-violet-600 hover:bg-white"}`}>
                      <ChevronDown className="w-3.5 h-3.5 rotate-180" />
                      <span>Hal. 1</span>
                    </motion.button>
                  )}

                  {/* === FLOATING TOOLBAR (Figma Style) === */}
                  {activePagesMemo.length > 0 && activeTab === "result" && (
                    <div className="absolute left-1/2 -translate-x-1/2 z-[60] flex items-center gap-1.5 px-3 py-2.5 rounded-2xl shadow-2xl backdrop-blur-2xl border transition-colors animate-in slide-in-from-bottom-4 duration-500"
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
                      <div className={`relative flex items-center gap-1 rounded-xl p-1 group/zoom ${D ? "bg-black/40" : "bg-gray-100/80"}`}>
                        <button onClick={() => setZoomLevel(z => Math.max(40, z - 20))} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${D ? "hover:bg-white/10 text-gray-300" : "hover:bg-white text-gray-600 hover:shadow-sm"}`}>
                          <ZoomOut className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setZoomLevel(100)}
                          className={`text-xs font-mono w-10 text-center font-bold transition-colors ${zoomLevel !== 100 ? "text-violet-400 hover:text-violet-300" : D ? "text-gray-200" : "text-gray-800"}`}
                          title="Reset zoom ke 100%"
                        >{zoomLevel}%</button>
                        <button onClick={() => setZoomLevel(z => Math.min(200, z + 20))} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${D ? "hover:bg-white/10 text-gray-300" : "hover:bg-white text-gray-600 hover:shadow-sm"}`}>
                          <ZoomIn className="w-4 h-4" />
                        </button>
                        {/* Tooltip Ctrl+Scroll hint */}
                        <AnimatePresence>
                          {zoomLevel === 100 && (
                            <motion.div
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 4 }}
                              transition={{ delay: 2, duration: 0.3 }}
                              className={`absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none z-50 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium border shadow-lg opacity-0 group/zoom:opacity-100 transition-opacity`}
                              style={{
                                background: D ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.95)",
                                borderColor: D ? "rgba(255,255,255,0.1)" : "rgba(139,92,246,0.2)",
                                color: D ? "rgba(255,255,255,0.6)" : "#7c3aed",
                              }}
                            >
                              <kbd className={`px-1 rounded text-[9px] font-mono ${D ? "bg-white/10" : "bg-gray-100"}`}>Ctrl</kbd>
                              <span>+</span>
                              <span>scroll untuk zoom</span>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <div className={`w-px h-6 mx-1 ${D ? "bg-white/10" : "bg-gray-300"}`} />

                      {/* ── NAVIGASI DESKTOP / LAPTOP dengan Nav Preview Tooltip (Step 18) ── */}
                      <div className="flex items-center gap-1">
                        {/* Tombol PREV dengan tooltip preview */}
                        <div
                          className="relative group/navprev"
                          onMouseEnter={() => activePageIndex > 0 && generatedPages.length > 0 && setNavPreviewDir('prev')}
                          onMouseLeave={() => setNavPreviewDir(null)}
                        >
                          <button
                            onClick={() => navigateToPage(activePageIndex - 1)}
                            disabled={activePageIndex === 0}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${activePageIndex === 0 ? "opacity-30 cursor-not-allowed" : D ? "hover:bg-white/10 text-gray-300" : "hover:bg-gray-100 text-gray-600"}`}
                            title="Halaman Sebelumnya"
                          >
                            <ChevronDown className="w-4 h-4 rotate-90" />
                          </button>
                          {/* Nav Preview Tooltip - PREV */}
                          <AnimatePresence>
                            {navPreviewDir === 'prev' && activePageIndex > 0 && generatedPages[activePageIndex - 1] && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 4 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 4 }}
                                transition={{ duration: 0.15 }}
                                className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-50 pointer-events-none rounded-xl overflow-hidden border shadow-2xl`}
                                style={{
                                  width: 120,
                                  background: D ? "rgba(13,13,20,0.95)" : "rgba(255,255,255,0.98)",
                                  borderColor: D ? "rgba(255,255,255,0.12)" : "rgba(139,92,246,0.25)",
                                }}
                              >
                                <img
                                  src={generatedPages[activePageIndex - 1].image}
                                  alt=""
                                  className="w-full object-cover object-top"
                                  style={{ aspectRatio: "210/297" }}
                                />
                                <div className={`px-2 py-1.5 text-center`}>
                                  <p className={`text-[10px] font-bold ${D ? "text-white/70" : "text-gray-700"}`}>
                                    Hal. {activePageIndex}
                                  </p>
                                  <p className={`text-[9px] ${D ? "text-white/30" : "text-gray-400"}`}>Klik untuk kembali</p>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        <span className={`text-xs font-bold px-1.5 flex items-center gap-0.5 ${D ? "text-gray-300" : "text-gray-700"}`}>
                          <OdometerNumber value={activePageIndex + 1} isDark={D} />
                          <span className="opacity-40">/</span>
                          <OdometerNumber value={Math.max(1, activePagesMemo.length)} isDark={D} />
                        </span>

                        {/* Tombol NEXT dengan tooltip preview */}
                        <div
                          className="relative group/navnext"
                          onMouseEnter={() => activePageIndex < generatedPages.length - 1 && generatedPages.length > 0 && setNavPreviewDir('next')}
                          onMouseLeave={() => setNavPreviewDir(null)}
                        >
                          <button
                            onClick={() => navigateToPage(activePageIndex + 1)}
                            disabled={activePageIndex === generatedPages.length - 1}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${activePageIndex === generatedPages.length - 1 ? "opacity-30 cursor-not-allowed" : D ? "hover:bg-white/10 text-gray-300" : "hover:bg-gray-100 text-gray-600"}`}
                            title="Halaman Selanjutnya"
                          >
                            <ChevronDown className="w-4 h-4 -rotate-90" />
                          </button>
                          {/* Nav Preview Tooltip - NEXT */}
                          <AnimatePresence>
                            {navPreviewDir === 'next' && activePageIndex < generatedPages.length - 1 && generatedPages[activePageIndex + 1] && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 4 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 4 }}
                                transition={{ duration: 0.15 }}
                                className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-50 pointer-events-none rounded-xl overflow-hidden border shadow-2xl`}
                                style={{
                                  width: 120,
                                  background: D ? "rgba(13,13,20,0.95)" : "rgba(255,255,255,0.98)",
                                  borderColor: D ? "rgba(255,255,255,0.12)" : "rgba(139,92,246,0.25)",
                                }}
                              >
                                <img
                                  src={generatedPages[activePageIndex + 1].image}
                                  alt=""
                                  className="w-full object-cover object-top"
                                  style={{ aspectRatio: "210/297" }}
                                />
                                <div className={`px-2 py-1.5 text-center`}>
                                  <p className={`text-[10px] font-bold ${D ? "text-white/70" : "text-gray-700"}`}>
                                    Hal. {activePageIndex + 2}
                                  </p>
                                  <p className={`text-[9px] ${D ? "text-white/30" : "text-gray-400"}`}>Klik untuk lanjut</p>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>

                      <div className={`w-px h-6 mx-1 ${D ? "bg-white/10" : "bg-gray-300"}`} />

                      <button onClick={() => setFullscreenPage(generatedPages[activePageIndex])} className={`hidden sm:flex w-10 h-10 rounded-xl items-center justify-center transition-colors ${D ? "hover:bg-white/10 text-gray-300" : "hover:bg-gray-100 text-gray-600"}`} title="Fullscreen">
                        <Maximize2 className="w-[18px] h-[18px]" />
                      </button>
                      <button onClick={() => handleCopyImageToClipboard(generatedPages[activePageIndex])} className={`hidden sm:flex w-10 h-10 rounded-xl items-center justify-center transition-colors ${D ? "hover:bg-white/10 text-gray-300" : "hover:bg-gray-100 text-gray-600"}`} title="Copy Image">
                        <Copy className="w-[18px] h-[18px]" />
                      </button>
                      <button onClick={() => setGeneratedPages([])} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${D ? "hover:bg-red-500/20 text-red-400" : "hover:bg-red-50 text-red-500"}`} title="Hapus">
                        <X className="w-5 h-5" />
                      </button>

                      <div className={`hidden sm:block w-px h-6 mx-1 ${D ? "bg-white/10" : "bg-gray-300"}`} />

                      <button onClick={() => handleDownloadSingle(generatedPages[activePageIndex])} className={`btn-ripple flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-colors shadow-lg active:scale-95 ${D ? "bg-violet-500 hover:bg-violet-400 text-white shadow-violet-500/25" : "bg-violet-600 hover:bg-violet-700 text-white shadow-violet-600/30"}`}>
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
                        className={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors border ${showExportDropdown ? (D ? "bg-white/10 border-white/20" : "bg-gray-200 border-gray-300") : (D ? "border-transparent hover:bg-white/5" : "border-transparent hover:bg-gray-100")}`}>
                        <ChevronDown className={`w-4 h-4 ${D ? "text-gray-300" : "text-gray-600"} transition-transform duration-300 ${showExportDropdown ? "rotate-180" : ""}`} />
                      </button>
                    </div>
                  )}

                  {/* Thumbnail Strip Vertikal */}
                  {(activePagesMemo.length > 0 || isGenerating) && activeTab === "result" && (
                    <div className={`hidden lg:flex flex-col gap-2 p-2 w-[72px] 2xl:w-[88px] 3xl:w-[100px] flex-shrink-0 overflow-y-auto border-r scrollbar-thin ${c.divider} ${D ? "bg-[#09090b]" : "bg-violet-50/80"}`}>

                      {/* Thumbnail halaman yang sudah selesai */}
                      {activePagesMemo.map((p, idx) => (
                        <div key={p.page} className="relative group/thumb flex-shrink-0 w-full">

                          {/* Tombol thumbnail */}
                          <button
                            onClick={() => navigateToPage(idx)}
                            className={`card-lift w-full rounded-lg overflow-hidden border-2 duration-200 ${idx === activePageIndex
                              ? "border-violet-500 shadow-lg shadow-violet-500/25 scale-[1.03]"
                              : D ? "border-[#ffffff10] hover:border-violet-500/40" : "border-gray-200 hover:border-violet-300"
                              }`}
                          >
                            <img
                              src={p.image}
                              alt={`Hal ${p.page}`}
                              className="w-full object-cover object-top"
                              style={{ aspectRatio: "210/297" }}
                            />
                            <div className={`text-[8px] text-center py-1 font-mono font-bold transition-colors ${idx === activePageIndex
                              ? D ? "bg-violet-500/20 text-violet-300" : "bg-violet-100 text-violet-600"
                              : c.ts
                              }`}>
                              {idx === activePageIndex ? `● ${p.page}` : p.page}
                            </div>
                          </button>
                        </div>
                      ))}

                      {/* Skeleton halaman yang masih dalam proses generate */}
                      {isGenerating && Array.from({
                        length: Math.max(0, (totalStreamPages ?? 0) - activePagesMemo.length)
                      }).map((_, idx) => (
                        <div
                          key={`skeleton-${idx}`}
                          className={`flex-shrink-0 w-full rounded-lg overflow-hidden border-2 ${D ? "border-[#ffffff08]" : "border-gray-100"}`}
                        >
                          <div
                            className={`w-full relative overflow-hidden ${D ? "bg-white/4" : "bg-gray-50"}`}
                            style={{ aspectRatio: "210/297" }}
                          >
                            {/* Shimmer sweep */}
                            <div
                              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_1.8s_ease-in-out_infinite]"
                              style={{ animationDelay: `${idx * 0.15}s` }}
                            />
                            <div className="w-full h-full flex flex-col gap-2 p-2 pt-3">
                              {Array.from({ length: 10 }).map((_, i) => (
                                <motion.div
                                  key={i}
                                  initial={{ width: 0, opacity: 0 }}
                                  animate={{
                                    width: `${50 + (i % 4) * 12}%`,
                                    opacity: 0.6
                                  }}
                                  transition={{
                                    duration: 1.2,
                                    repeat: Infinity,
                                    repeatType: "reverse",
                                    delay: i * 0.08 + idx * 0.1
                                  }}
                                  className={`h-[2px] rounded-full ${D ? "bg-violet-400/30" : "bg-violet-300/50"}`}
                                />
                              ))}
                            </div>
                          </div>
                          <div className={`text-[8px] text-center py-0.5 font-mono ${D ? "text-white/20" : "text-gray-400"}`}>
                            {generatedPages.length + idx + 1}
                          </div>
                        </div>
                      ))}

                    </div>
                  )}

                  {/* Output viewer utama (Figma-style Workspace) */}
                  <div
                    ref={outputViewerRef}
                    className={`spotlight-container relative flex-1 overflow-y-auto scrollbar-thin pb-24 transition-all duration-700 ${D
                      ? "bg-[#060610]"
                      : "bg-gradient-to-br from-sky-100/80 via-indigo-50 to-violet-100/80"
                      }`}
                    style={{
                      backgroundImage: D
                        ? "radial-gradient(#ffffff09 1px, transparent 1px)"
                        : "radial-gradient(#8b5cf630 1px, transparent 1px)",
                      backgroundSize: "28px 28px",
                      background: (() => {
                        const ambientColorMap: Record<string, { dark: string; light: string }> = {
                          violet: {
                            dark: "radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.07) 0%, transparent 70%), radial-gradient(#ffffff09 1px, transparent 1px)",
                            light: "radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.06) 0%, transparent 70%), radial-gradient(#8b5cf630 1px, transparent 1px)",
                          },
                          blue: {
                            dark: "radial-gradient(ellipse at 50% 0%, rgba(37,99,235,0.08) 0%, transparent 70%), radial-gradient(#ffffff09 1px, transparent 1px)",
                            light: "radial-gradient(ellipse at 50% 0%, rgba(37,99,235,0.06) 0%, transparent 70%), radial-gradient(#8b5cf630 1px, transparent 1px)",
                          },
                          amber: {
                            dark: "radial-gradient(ellipse at 50% 0%, rgba(245,158,11,0.07) 0%, transparent 70%), radial-gradient(#ffffff09 1px, transparent 1px)",
                            light: "radial-gradient(ellipse at 50% 0%, rgba(245,158,11,0.05) 0%, transparent 70%), radial-gradient(#8b5cf630 1px, transparent 1px)",
                          },
                          navy: {
                            dark: "radial-gradient(ellipse at 50% 0%, rgba(30,58,138,0.10) 0%, transparent 70%), radial-gradient(#ffffff09 1px, transparent 1px)",
                            light: "radial-gradient(ellipse at 50% 0%, rgba(30,58,138,0.06) 0%, transparent 70%), radial-gradient(#8b5cf630 1px, transparent 1px)",
                          },
                          emerald: {
                            dark: "radial-gradient(ellipse at 50% 0%, rgba(16,185,129,0.07) 0%, transparent 70%), radial-gradient(#ffffff09 1px, transparent 1px)",
                            light: "radial-gradient(ellipse at 50% 0%, rgba(16,185,129,0.05) 0%, transparent 70%), radial-gradient(#8b5cf630 1px, transparent 1px)",
                          },
                        };
                        return ambientColorMap[ambientColor]?.[D ? 'dark' : 'light'] || undefined;
                      })(),
                    }}
                    onMouseMove={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      e.currentTarget.style.setProperty('--x', `${e.clientX - rect.left}px`);
                      e.currentTarget.style.setProperty('--y', `${e.clientY - rect.top}px`);
                    }}
                  >


                    <AnimatePresence mode="wait">
                      {(() => {
                        // Mencegah error multiple children: Hanya render SATU root element pada satu waktu
                        if (activeTab !== "result") return null;

                        // STATE 1: Sedang Loading / Generating pertama kali
                        if (isGenerating && streamedPages.length === 0) {
                          return (
                            <motion.div key="generating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                              className="flex items-center justify-center h-full min-h-[400px] w-full p-8">
                              <div className={`relative w-full max-w-md p-8 rounded-2xl border backdrop-blur-sm shadow-2xl flex flex-col gap-5 overflow-hidden ${D ? "bg-[#13131f]/60 border-[#ffffff10]" : "bg-white/60 border-violet-100"}`}>

                                {/* Shimmer sweep */}
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-violet-500/10 to-transparent w-[200%] animate-[shimmer_2s_infinite] -translate-x-full pointer-events-none" />

                                {/* Header */}
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center">
                                    <motion.div
                                      animate={{ rotate: 360 }}
                                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                    >
                                      <PenTool className="w-5 h-5 text-violet-500" />
                                    </motion.div>
                                  </div>
                                  <div>
                                    <TypewriterText
                                      texts={["AI Sedang Menulis...", "Meniru gaya tulisanmu...", "Menyesuaikan spasi...", "Hampir selesai..."]}
                                      isDark={D}
                                    />
                                    <p className={`text-[10px] font-mono tracking-widest uppercase mt-0.5 ${c.ts}`}>
                                      {Math.round(generateProgress)}% — Halaman {streamedPages.length}/{totalStreamPages || estimatedPages}
                                    </p>
                                  </div>
                                </div>

                                {/* Progress bar */}
                                <div className={`h-1.5 rounded-full overflow-hidden ${D ? "bg-white/8" : "bg-violet-100"}`}>
                                  <motion.div
                                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-400"
                                    animate={{ width: `${generateProgress}%` }}
                                    transition={{ duration: 0.4, ease: "easeOut" }}
                                  />
                                </div>

                                {/* Skeleton baris tulisan tangan */}
                                <div className="space-y-2.5 mt-2">
                                  {[85, 92, 78, 88, 65, 72, 90].map((width, i) => (
                                    <motion.div
                                      key={i}
                                      initial={{ width: 0, opacity: 0 }}
                                      animate={{ width: `${width}%`, opacity: 1 }}
                                      transition={{ duration: 0.6, delay: i * 0.08, ease: "easeOut" }}
                                      className={`h-[6px] rounded-full ${D ? "bg-white/10" : "bg-violet-100"}`}
                                      style={{
                                        background: D
                                          ? `linear-gradient(90deg, rgba(139,92,246,0.3) 0%, rgba(255,255,255,0.06) 100%)`
                                          : `linear-gradient(90deg, rgba(139,92,246,0.25) 0%, rgba(139,92,246,0.05) 100%)`
                                      }}
                                    />
                                  ))}
                                </div>

                                {/* Cancel button */}
                                <button
                                  onClick={() => abortController?.abort()}
                                  className={`flex items-center justify-center gap-2 w-full py-2 rounded-xl border text-xs font-medium transition-colors mt-1 ${D ? "border-red-500/20 text-red-400 hover:bg-red-500/10" : "border-red-200 text-red-500 hover:bg-red-50"
                                    }`}
                                >
                                  <X className="w-3.5 h-3.5" />
                                  Batalkan Generate
                                </button>
                              </div>
                            </motion.div>
                          );
                        }

                        if (generatedPages.length > 0 || streamedPages.length > 0) {
                          const pages = generatedPages.length > 0 ? generatedPages : streamedPages;

                          // Logika Hologram Parallax 3D (Hanya untuk Desktop / Non-Apple)
                          const enableHolo3D = !isAppleDevice && !isMobileView;

                          return (
                            <motion.div
                              key="book-viewer"
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="p-4 lg:p-8 flex items-center justify-center min-h-full w-full relative"
                              style={{ perspective: enableHolo3D ? "2000px" : "none" }}
                            >

                              <motion.div
                                className="relative group"
                                data-hologram="true"
                                style={{
                                  width: `${zoomLevel}%`,
                                  maxWidth: "100%",
                                  display: "flex",
                                  justifyContent: "center",
                                  transformStyle: "preserve-3d"
                                }}
                                whileHover={enableHolo3D ? { scale: 1.02 } : {}}
                                onMouseMove={(e: any) => {
                                  if (!enableHolo3D) return;
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const x = (e.clientX - rect.left) / rect.width - 0.5;
                                  const y = (e.clientY - rect.top) / rect.height - 0.5;
                                  e.currentTarget.style.transform = `rotateY(${x * 15}deg) rotateX(${-y * 15}deg)`;
                                }}
                                onMouseLeave={(e: any) => {
                                  if (!enableHolo3D) return;
                                  e.currentTarget.style.transition = "transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)";
                                  e.currentTarget.style.transform = "rotateY(0deg) rotateX(0deg)";
                                  setTimeout(() => {
                                    e.currentTarget.style.transition = "";
                                  }, 600);
                                }}
                              >
                                {/* Bayangan 3D di bawah kertas (menambah kesan Hologram terbang) */}
                                {enableHolo3D && (
                                  <>
                                    <div
                                      className="absolute inset-0 bg-black/40 blur-[40px] -z-10 translate-y-12 scale-90 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                                      style={{ transform: "translateZ(-80px)" }}
                                    />
                                    {/* Liquid Glow di belakang elemen saat di-hover */}
                                    <div
                                      className="absolute inset-0 bg-gradient-to-tr from-violet-500/20 via-fuchsia-500/20 to-cyan-500/20 blur-[60px] -z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 scale-110"
                                      style={{ transform: "translateZ(-120px)" }}
                                    />
                                  </>
                                )}

                                <AnimatePresence mode="wait">
                                  {viewMode === 'book' ? (
                                    <motion.div
                                      key="flipbook-container"
                                      initial={{ opacity: 0, scale: 0.98 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      exit={{ opacity: 0, scale: 0.98 }}
                                      transition={{ duration: 0.2, ease: "easeOut" }}
                                      style={{ width: "100%", display: "flex", justifyContent: "center" }}
                                    >
                                      {memoizedFlipBook}
                                    </motion.div>
                                  ) : (
                                    <motion.div
                                      key="grid-container"
                                      initial={{ opacity: 0, y: 20 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ opacity: 0, y: -20 }}
                                      transition={{ duration: 0.2, ease: "easeOut" }}
                                      className="w-full flex flex-col items-center gap-8 pb-12 pt-4"
                                    >
                                      {activePagesMemo.map((p, idx) => (
                                        <motion.div
                                          key={p.page}
                                          initial={{ opacity: 0, y: 50, scale: 0.98 }}
                                          whileInView={{ opacity: 1, y: 0, scale: 1 }}
                                          viewport={{ once: true, margin: "-40px" }}
                                          transition={{ duration: 0.6, ease: [0.25, 1.15, 0.4, 1], delay: 0.1 }}
                                          className="relative group w-full flex justify-center"
                                        >
                                          <div className="relative shadow-2xl rounded-sm overflow-hidden border border-black/5" style={{ width: "min(100%, 700px)" }}>
                                            <img
                                              src={p.image}
                                              alt={`Hal ${p.page}`}
                                              className="w-full h-auto object-cover"
                                              loading="lazy"
                                            />
                                            {/* Nomor Halaman & Tombol Download per Halaman */}
                                            <div className={`absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300`}>
                                              <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-black/60 text-white backdrop-blur-md shadow-lg">
                                                Hal {p.page}
                                              </span>
                                              <button
                                                onClick={() => handleDownloadSingle(p)}
                                                className="w-8 h-8 rounded-full flex items-center justify-center bg-violet-600 text-white shadow-lg hover:scale-110 transition-transform">
                                                <Download className="w-4 h-4" />
                                              </button>
                                            </div>
                                          </div>
                                        </motion.div>
                                      ))}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </motion.div>
                            </motion.div>
                          );
                        }

                        // STATE ERROR
                        if (generateError && generatedPages.length === 0) {
                          return (
                            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                              className="flex items-center justify-center min-h-full p-8 py-16">
                              <div className="text-center max-w-sm">
                                <div className={`w-16 h-16 mx-auto mb-5 rounded-2xl flex items-center justify-center ${D ? "bg-red-500/15" : "bg-red-50"}`}>
                                  <span className="text-3xl">⚠️</span>
                                </div>
                                <p className={`text-base font-bold mb-2 ${D ? "text-red-400" : "text-red-600"}`}>
                                  Generate Gagal
                                </p>
                                <p className={`text-[12px] leading-relaxed mb-6 px-4 ${D ? "text-white/50" : "text-gray-500"}`}>
                                  {generateError}
                                </p>
                                <div className="flex flex-col gap-2">
                                  <button
                                    onClick={() => { setGenerateError(null); handleGenerate(); }}
                                    className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-2xl font-bold text-sm text-white transition-all hover:scale-[1.02] active:scale-95"
                                    style={{ background: "linear-gradient(135deg, #8b5cf6, #6d28d9)", boxShadow: "0 4px 16px rgba(109,40,217,0.35)" }}>
                                    <RefreshCw className="w-4 h-4" />
                                    Coba Lagi
                                  </button>
                                  <button
                                    onClick={() => setGenerateError(null)}
                                    className={`px-6 py-2 rounded-2xl text-xs font-medium border transition-all hover:scale-105 active:scale-95 ${c.btn}`}>
                                    Tutup
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          );
                        }

                        // STATE 3: Kosong
                        return (
                          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="flex items-center justify-center min-h-full p-8 py-16">
                            <div className="text-center max-w-sm m-auto">
                              <div className="relative w-32 h-32 mx-auto mb-8 mt-6 flex items-center justify-center">
                                {/* Glow background */}
                                <div className={`absolute inset-0 rounded-3xl ${D ? "bg-gradient-to-br from-violet-900/40 to-indigo-900/40" : "bg-gradient-to-br from-violet-100 to-indigo-100"}`} />

                                {/* SVG animasi menulis */}
                                <svg viewBox="0 0 80 80" className="relative z-10 w-20 h-20">
                                  {/* Kertas */}
                                  <rect x="15" y="10" width="42" height="55" rx="4"
                                    className={D ? "fill-white/8 stroke-white/20" : "fill-violet-50 stroke-violet-200"}
                                    strokeWidth="1.5"
                                  />
                                  {/* Garis-garis teks yang "menulis sendiri" */}
                                  {[20, 27, 34, 41, 48].map((y, i) => (
                                    <line
                                      key={i}
                                      x1="22" y1={y} x2="50" y2={y}
                                      className={D ? "stroke-violet-400/60" : "stroke-violet-400"}
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      style={{
                                        strokeDasharray: 28,
                                        strokeDashoffset: 28,
                                        animation: `drawLine 0.4s ease-out ${0.3 + i * 0.15}s forwards, linePulse 2s ease-in-out ${1.5 + i * 0.15}s infinite`
                                      }}
                                    />
                                  ))}
                                  {/* Pena */}
                                  <g style={{ animation: 'penMove 2s ease-in-out 0.2s infinite' }}>
                                    <line x1="52" y1="18" x2="44" y2="52"
                                      className={D ? "stroke-violet-400" : "stroke-violet-500"}
                                      strokeWidth="2.5" strokeLinecap="round"
                                    />
                                    <polygon points="44,52 42,58 48,54"
                                      className={D ? "fill-violet-400" : "fill-violet-500"}
                                    />
                                  </g>
                                </svg>
                              </div>

                              <p className={`text-base font-bold mb-2 ${D ? "text-white/70" : "text-gray-700"}`}>
                                Hasil akan tampil di sini
                              </p>
                              <p className={`text-[12px] leading-relaxed mb-6 ${c.ts}`}>
                                Ketik teks di editor, pilih font & folio di sidebar, lalu klik Generate.
                              </p>

                              {/* Step hints */}
                              <div className="space-y-1.5 text-left mb-6">
                                {[
                                  { icon: "📝", label: "Ketik atau paste teks", num: "1", color: D ? "border-indigo-500/15" : "border-indigo-100", bg: D ? "bg-indigo-500/6" : "bg-indigo-50/80", numBg: D ? "bg-indigo-500/20 text-indigo-400" : "bg-indigo-100 text-indigo-600" },
                                  { icon: "🎨", label: "Pilih font & folio di sidebar", num: "2", color: D ? "border-violet-500/15" : "border-violet-100", bg: D ? "bg-violet-500/6" : "bg-violet-50/80", numBg: D ? "bg-violet-500/20 text-violet-400" : "bg-violet-100 text-violet-600" },
                                  { icon: "✨", label: "Klik Generate atau Ctrl+Enter", num: "3", color: D ? "border-purple-500/15" : "border-purple-100", bg: D ? "bg-purple-500/6" : "bg-purple-50/80", numBg: D ? "bg-purple-500/20 text-purple-400" : "bg-purple-100 text-purple-600" },
                                ].map((step, i) => (
                                  <div key={i} className={`stagger-item flex items-center gap-3 px-3 py-2.5 rounded-2xl border text-xs ${step.bg} ${step.color}`}>
                                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0 ${step.numBg}`}>{step.num}</span>
                                    <span className={D ? "text-white/55" : "text-gray-600"}>{step.label}</span>
                                    <span className="ml-auto text-sm">{step.icon}</span>
                                  </div>
                                ))}
                              </div>

                              <button
                                onClick={handleLoadDemo}
                                className="w-full mb-3 py-3 rounded-2xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-95 overflow-hidden relative"
                                style={{
                                  background: D
                                    ? "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(99,102,241,0.10))"
                                    : "linear-gradient(135deg, rgba(139,92,246,0.08), rgba(99,102,241,0.06))",
                                  border: D ? "1.5px dashed rgba(139,92,246,0.35)" : "1.5px dashed rgba(139,92,246,0.4)",
                                  color: D ? "#a78bfa" : "#7c3aed"
                                }}
                              >
                                <span className="relative z-10">✍️ Coba Teks Demo — langsung isi & pilih font otomatis</span>
                              </button>

                              <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10.5px] ${D ? "bg-white/4 border-white/6 text-white/25" : "bg-violet-50 border-violet-100 text-violet-400"}`}>
                                <kbd className={`font-mono px-1.5 py-0.5 rounded-md text-[9px] ${D ? "bg-white/8 border border-white/10" : "bg-white border border-violet-200"}`}>Ctrl+Enter</kbd>
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
                                  className={`text-[11px] flex items-center gap-1 px-2 py-1 rounded-lg transition-colors ${D ? "text-red-400/70 hover:bg-red-500/10 border border-[#ffffff08]" : "text-red-500 hover:bg-red-50 border border-red-200"}`}>
                                  <Trash2 className="w-3 h-3" />Hapus
                                </button>
                              )}
                              <button onClick={() => setActiveTab("result")} className={`w-11 h-11 rounded-xl flex items-center justify-center ${c.btn}`}>
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin">
                            {history.length === 0 ? (
                              <div className="py-10 text-center px-4">
                                <div className={`w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center ${D ? "bg-white/5" : "bg-violet-50"}`}>
                                  <Clock className={`w-6 h-6 ${c.ts} opacity-60`} />
                                </div>
                                <p className={`text-sm font-semibold mb-1 ${c.tp}`}>Belum ada riwayat</p>
                                <p className={`text-[11px] leading-relaxed ${c.ts}`}>
                                  Setiap kali kamu Generate, hasilnya otomatis tersimpan di sini.
                                </p>
                                <button
                                  onClick={() => { setActiveTab("result"); textareaRef.current?.focus(); }}
                                  className={`mt-4 px-4 py-2 rounded-xl text-xs font-bold border-2 border-dashed transition-colors ${D ? "border-violet-500/40 text-violet-400 hover:bg-violet-500/8" : "border-violet-400 text-violet-600 hover:bg-violet-50"}`}>
                                  ✍️ Mulai Generate Pertama
                                </button>
                              </div>
                            ) : history.map((item) => (
                              <div key={item.id} className={`history-card flex items-start gap-3 p-3 rounded-xl border cursor-pointer ${c.pillBorder} ${c.rowHover}`}>
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
                                      className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors border ${D ? "bg-indigo-500/12 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/20" : "bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100"}`}>
                                      Pulihkan
                                    </button>
                                    <button onClick={() => deleteHistory(item.id)}
                                      className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ml-auto ${D ? "text-white/20 hover:bg-red-500/10 hover:text-red-400" : "text-gray-300 hover:bg-red-50 hover:text-red-500"}`}>
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
                            <button onClick={() => setActiveTab("result")} className={`w-11 h-11 rounded-xl flex items-center justify-center ${c.btn}`}>
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin">
                            {/* Save preset */}
                            <div className={`flex gap-2 p-3 rounded-xl border ${c.pillBorder} ${c.pill}`}>
                              <OptimizedInput type="text" placeholder="Nama preset..." value={presetName}
                                onChange={(val: string) => setPresetName(val)}
                                onKeyDown={(e: any) => e.key === "Enter" && savePreset()}
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
                              <div key={preset.id} className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-colors ${c.pillBorder} ${c.rowHover}`}>
                                <div className="w-7 h-7 rounded-lg flex-shrink-0 ring-1 ring-black/10" style={{ backgroundColor: preset.config.color }} />
                                <div className="flex-1 min-w-0">
                                  <p className={`text-xs font-semibold truncate ${c.tp}`}>{preset.name}</p>
                                  <p className={`text-[10px] ${c.ts}`}>{fonts[preset.fontId]?.name || preset.fontId}</p>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button onClick={() => loadPreset(preset)}
                                    className={`px-2 py-1 rounded-md text-[10px] font-medium border transition-colors ${D ? "bg-violet-500/12 text-violet-400 border-violet-500/20 hover:bg-violet-500/20" : "bg-violet-50 text-violet-600 border-violet-200"}`}>
                                    Muat
                                  </button>
                                  <button onClick={() => deletePreset(preset.id)}
                                    className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${D ? "text-white/20 hover:bg-red-500/10 hover:text-red-400" : "text-gray-300 hover:bg-red-50 hover:text-red-500"}`}>
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
            </div>

            {/* ══ MOBILE & TABLET: Editor + Output tabs (< lg) ══ */}
            <div className="flex lg:hidden flex-col md:flex-row w-full overflow-hidden" style={{ height: "calc(100dvh - 56px)" }}>
              {/* Tab Switcher — sembunyikan di tablet karena layout split */}
              <div className={`flex-shrink-0 px-4 py-3 border-b md:hidden ${c.divider} bg-transparent`}>
                <DraggableLiquidTabs
                  options={[
                    { label: "✏️ Editor", value: "editor" },
                    {
                      label: generatedPages.length > 0
                        ? `✨ Hasil (${generatedPages.length})`
                        : "✨ Hasil",
                      value: "result"
                    }
                  ]}
                  value={activeTab === "result" ? "result" : "editor"}
                  onChange={(val: string) => setActiveTab(val as any)}
                  isDark={D}
                  isApple={isAppleDevice}
                />
              </div>

              {/* Editor panel — proporsional & modern di tablet */}
              <div className={`md:w-[380px] lg:w-[420px] md:border-r md:flex-shrink-0 flex flex-col overflow-hidden relative ${c.sidebar} ${c.divider} ${activeTab === "result" && window.innerWidth < 768 ? "hidden" : "flex"} md:flex`}>
                <div className="flex-1 flex flex-col overflow-y-auto p-4 pb-28 scrollbar-thin gap-3"
                  onScroll={(e) => {
                    const currentScrollY = e.currentTarget.scrollTop;
                    if (!isAppleDevice) {
                      // Fitur Auto-Hide Dock khusus non-Apple (Android/Tablet/Laptop L)
                      if (currentScrollY > lastScrollYRef.current && currentScrollY > 50) {
                        setHideMobileDock(true);
                      } else if (currentScrollY < lastScrollYRef.current) {
                        setHideMobileDock(false);
                      }
                    } else {
                      // Apple Device selalu tampil
                      setHideMobileDock(false);
                    }
                    lastScrollYRef.current = currentScrollY;
                  }}
                >

                  {/* Mobile toolbar — STICKY Glass horizontal */}
                  <div className={`sticky top-[-16px] z-20 pt-4 pb-2 overflow-x-auto scrollbar-hide -mx-4 px-4 flex-shrink-0 backdrop-blur-xl border-b transition-all duration-300 ${D ? "bg-[#0f0f1a]/80 border-[#ffffff10]" : "bg-violet-50/80 border-violet-200/50"}`}>
                    <div className="flex items-center gap-2.5 flex-nowrap min-w-max pb-2">

                      {/* Tempel */}
                      <button onClick={async () => {
                        try { const t = await navigator.clipboard.readText(); setInputText(t); setText(t); toast.success("Ditempel!"); }
                        catch { toast.error("Gagal akses clipboard"); }
                      }} className={`w-11 h-11 rounded-full flex items-center justify-center border flex-shrink-0 transition-transform active:scale-95 ${D ? "bg-[#ffffff08] border-[#ffffff10] text-white/70" : "bg-white border-gray-200 text-gray-600 shadow-sm"}`} title="Tempel Teks">
                        <Clipboard className="w-4 h-4" />
                      </button>

                      {/* Tulis AI */}
                      <button onClick={() => setShowAiModal(true)}
                        className={`w-11 h-11 rounded-full flex items-center justify-center border flex-shrink-0 transition-transform active:scale-95 ${D ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400" : "bg-indigo-50 border-indigo-200 text-indigo-600 shadow-sm"}`} title="Tulis dengan AI">
                        <Bot className="w-4 h-4" />
                      </button>

                      {/* Poles AI */}
                      <button onClick={handleAiExpand} disabled={!text.trim() || isAiExpanding}
                        className={`w-11 h-11 rounded-full flex items-center justify-center border flex-shrink-0 transition-transform active:scale-95 ${!text.trim() ? "opacity-35 cursor-not-allowed" : D ? "bg-purple-500/10 border-purple-500/20 text-purple-400" : "bg-purple-50 border-purple-200 text-purple-600 shadow-sm"}`} title="Poles Teks AI">
                        {isAiExpanding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                      </button>

                      {/* Dikte */}
                      <button onClick={toggleListening}
                        className={`w-11 h-11 rounded-full flex items-center justify-center border flex-shrink-0 transition-transform active:scale-95 ${isListening ? "bg-red-500/20 border-red-500/30 text-red-400 animate-pulse" : D ? "bg-[#ffffff08] border-[#ffffff10] text-white/70" : "bg-white border-gray-200 text-gray-600 shadow-sm"}`} title="Dikte Suara">
                        <Mic className="w-4 h-4" />
                      </button>

                      {/* Hapus */}
                      <button onClick={() => { setInputText(""); setText(""); toast.success("Teks dihapus!"); }}
                        disabled={!text}
                        className={`w-11 h-11 rounded-full flex items-center justify-center border flex-shrink-0 transition-transform active:scale-95 ${!text ? "opacity-35 cursor-not-allowed" : D ? "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20" : "bg-red-50 border-red-200 text-red-600 shadow-sm"}`} title="Hapus Semua">
                        <Trash2 className="w-4 h-4" />
                      </button>

                      {/* Pecahan */}
                      <button onClick={() => {
                        const latex = " $\\frac{1}{2}p$ ";
                        setInputText(prev => prev + latex);
                        setText(prev => prev + latex);
                        setTimeout(() => textareaRef.current?.focus(), 50);
                      }}
                        className={`w-11 h-11 rounded-full flex items-center justify-center border flex-shrink-0 transition-transform active:scale-95 ${D ? "bg-amber-500/10 border-amber-500/20 text-amber-400" : "bg-amber-50 border-amber-200 text-amber-600 shadow-sm"}`} title="Sisipkan Pecahan">
                        <Sigma className="w-4 h-4" />
                      </button>

                      {/* Badge Folio */}
                      {currentFolio && (
                        <>
                          <div className={`w-px h-6 flex-shrink-0 mx-1 ${D ? "bg-white/10" : "bg-gray-200"}`} />
                          <span className={`flex items-center gap-1.5 text-[11px] px-3.5 h-10 rounded-full border flex-shrink-0 ${D ? "bg-white/5 border-white/10 text-white/80" : "bg-white border-gray-200 text-gray-700 shadow-sm"}`}>
                            <span>📄</span><span className="max-w-[70px] truncate font-medium">{currentFolio.name}</span>
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* ── AI QUICK INSERT CHIPS MOBILE (DIPINDAH KE ATAS TEXTAREA) ── */}
                  {!text.trim() && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.3, delay: 0.2 }}
                      className="flex flex-col gap-2 mb-2"
                    >
                      <p className={`text-[10px] font-semibold uppercase tracking-widest px-1 ${c.ts}`}>
                        ✨ Mulai dengan...
                      </p>
                      <div className="flex overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1 gap-1.5">
                        {[
                          "Pada suatu hari yang cerah,",
                          "Berdasarkan hasil penelitian,",
                          "Menurut pendapat saya,",
                          "Di era globalisasi ini,",
                          "Seiring perkembangan zaman,",
                        ].map((starter) => (
                          <motion.button
                            key={starter}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              const newText = starter + " ";
                              setInputText(newText);
                              setText(newText);
                              setTimeout(() => {
                                textareaRef.current?.focus();
                                const len = newText.length;
                                textareaRef.current?.setSelectionRange(len, len);
                              }, 50);
                            }}
                            className={`flex-shrink-0 flex items-center gap-1 text-[11px] px-3 py-1.5 rounded-full border transition-all ${D
                              ? "bg-[#ffffff06] border-[#ffffff10] text-white/50 hover:bg-violet-500/12 hover:text-violet-300"
                              : "bg-white border-violet-200 text-violet-600 hover:bg-violet-50 hover:border-violet-300 shadow-sm"
                              }`}
                          >
                            <span>"{starter}"</span>
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Textarea — Ditambahkan flex-1 agar memenuhi sisa ruang layar dan UI lebih modern ala Notion */}
                  <OptimizedTextarea
                    ref={textareaRef}
                    value={inputText}
                    onMouseUp={checkTextSelection}
                    onKeyUp={checkTextSelection}
                    onChange={(val: string) => {
                      setInputText(val);
                      setText(val);
                      // KUNCI SLASH COMMAND: Deteksi ketikan garis miring "/"
                      if (val.trim() === "/" || val.endsWith(" /") || val.endsWith("\n/")) {
                        setShowSlashMenu(true);
                      } else {
                        setShowSlashMenu(false);
                      }
                    }}
                    placeholder={magicPlaceholder}
                    className={`flex-1 w-full resize-none px-2 pt-4 pb-[40vh] text-[16px] leading-loose transition-all duration-500 ease-out outline-none border-none bg-transparent ${D
                      ? "text-white/90 placeholder-white/20 caret-violet-400 focus:-translate-y-1 focus:shadow-[0_8px_30px_rgba(139,92,246,0.15)]"
                      : "text-gray-800 placeholder-gray-400/70 caret-violet-500 focus:-translate-y-1 focus:shadow-[0_8px_30px_rgba(139,92,246,0.15)]"
                      }`}
                    style={{
                      minHeight: "280px",
                      fontFamily: currentFont ? (FONT_FAMILY_MAP[currentFont.name] || currentFont.name) : "inherit"
                    }}
                  />

                  {/* Progress bar — Ditambahkan flex-shrink-0 agar tidak gepeng */}
                  {text.length > 0 && (
                    <div className={`h-1 flex-shrink-0 rounded-full overflow-hidden mt-1 ${D ? "bg-[#ffffff08]" : "bg-gray-200"}`}>
                      <div className={`h-full rounded-full transition-[width] duration-500 ${text.length > 45000 ? "bg-red-500" : D ? "bg-emerald-500" : "bg-emerald-600"}`}
                        style={{ width: `${Math.min(100, (text.length / 50000) * 100)}%` }} />
                    </div>
                  )}
                </div>
                {/* ── STICKY DOCK GENERATE (KHUSUS TABLET) ── */}
                <div className="hidden md:flex lg:hidden flex-shrink-0 p-4 border-t z-20 backdrop-blur-2xl transition-all"
                  style={{
                    borderColor: D ? "rgba(255,255,255,0.08)" : "rgba(139,92,246,0.15)",
                    background: D ? "rgba(18,18,24,0.85)" : "rgba(255,255,255,0.92)",
                    boxShadow: D ? "0 -10px 40px rgba(0,0,0,0.5)" : "0 -10px 40px rgba(139,92,246,0.08)"
                  }}>
                  <div className="flex items-center justify-between w-full gap-3">
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className={`text-[13px] font-bold truncate block ${c.tp}`} style={{ fontFamily: currentFont ? (FONT_FAMILY_MAP[currentFont.name] || currentFont.name) : "inherit" }}>
                        {currentFont ? currentFont.name : "Pilih font..."}
                      </span>
                      <span className={`text-[10.5px] mt-0.5 block truncate ${c.ts}`}>
                        {wordCount} kata • Est. {estimatedPages} hal
                      </span>
                      {isGenerating && (
                        <div className="h-[3px] mt-2 w-full bg-violet-500/20 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-violet-500 to-indigo-400 transition-[width] duration-500" style={{ width: `${generateProgress}%` }} />
                        </div>
                      )}
                    </div>

                    <button onClick={handleGenerate} disabled={isGenerating || !text.trim() || !selectedFolio}
                      className={`btn-ripple btn-generate-tablet flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-sm transition-all flex-shrink-0 ${isGenerating || !text.trim() || !selectedFolio
                        ? D ? "bg-white/5 text-white/30 cursor-not-allowed border border-[#ffffff10]" : "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
                        : `bg-gradient-to-r ${c.accent} text-white shadow-[0_8px_20px_rgba(139,92,246,0.3)] hover:scale-[1.02] active:scale-95 border border-white/10`
                        }`}>
                      {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      <span>{isGenerating ? `${Math.round(generateProgress)}%` : "Generate AI"}</span>
                    </button>
                  </div>
                </div>
                {/* ── AKHIR DOCK ── */}

              </div>

              {/* Result panel — full di mobile, flex-1 di tablet */}
              {(activeTab === "result" || (typeof window !== 'undefined' && window.innerWidth >= 768)) && (() => {
                // Menggunakan activePagesMemo dari atas agar tidak duplikasi state
                return (
                  <div
                    className={`flex-1 overflow-y-auto pb-24 scrollbar-thin ${isAppleDevice ? "bg-transparent" : (D ? "bg-black" : "bg-gray-100")}`}
                    onTouchStart={(e) => {
                      if (e.currentTarget.scrollTop === 0) {
                        pullStartYRef.current = e.touches[0].clientY;
                      }
                    }}
                    onTouchMove={(e) => {
                      if (pullStartYRef.current === null) return;
                      const dist = Math.max(0, Math.min(80, e.touches[0].clientY - pullStartYRef.current));
                      setPullDistance(dist);
                    }}
                    onTouchEnd={() => {
                      if (pullDistance > 60) handlePullRefresh();
                      else setPullDistance(0);
                      pullStartYRef.current = null;
                    }}
                  >
                    {/* Pull to refresh indicator */}
                    {(pullDistance > 0 || isPullRefreshing) && (
                      <div className="flex justify-center pt-2 pb-1 transition-all duration-200"
                        style={{ height: isPullRefreshing ? 44 : pullDistance * 0.6 }}>
                        <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] font-medium border ${D ? "bg-black/60 border-white/10 text-white/70" : "bg-white/90 border-violet-200 text-violet-600"}`}>
                          {isPullRefreshing
                            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>Memuat ulang...</span></>
                            : <><RefreshCw className="w-3.5 h-3.5" style={{ transform: `rotate(${pullDistance * 3}deg)` }} /><span>{pullDistance > 60 ? "Lepas untuk refresh" : "Tarik untuk refresh"}</span></>
                          }
                        </div>
                      </div>
                    )}
                    {activePagesMemo.length > 0 ? (
                      <div className="flex overflow-x-auto mobile-result-scroll">

                        {/* Thumbnail "Banyak Jendela" telah DIHAPUS agar layar HP lebih luas dan estetik */}

                        <div
                          className="mobile-result-page relative px-4 flex items-start justify-center pt-4"
                          style={{ transform: `scale(${mobileZoom / 100})`, transformOrigin: "top center", transition: "transform 0.1s ease" }}
                          onTouchStart={(e) => {
                            if (e.touches.length === 2) {
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
                              setMobileZoom(Math.round(Math.min(250, Math.max(60, pinchStartZoomRef.current * ratio))));
                            }
                          }}
                          onTouchEnd={(e) => {
                            if (pinchStartDistRef.current !== null) { pinchStartDistRef.current = null; return; }
                            if (swipeStartXRef.current === null) return;
                            const deltaX = e.changedTouches[0].clientX - swipeStartXRef.current;
                            const deltaY = e.changedTouches[0].clientY - (swipeStartYRef.current ?? 0);

                            // PERBAIKAN: Beri kelonggaran toleransi swipe agar tidak mudah batal
                            if (Math.abs(deltaY) > Math.abs(deltaX) * 1.5 || Math.abs(deltaX) < 35) {
                              swipeStartXRef.current = null;
                              swipeStartYRef.current = null;
                              return;
                            }

                            const isAtFirst = activePageIndex === 0;
                            const isAtLast = activePageIndex === activePagesMemo.length - 1;
                            const swipingLeft = deltaX < 0;
                            const swipingRight = deltaX > 0;

                            if ((swipingLeft && isAtLast) || (swipingRight && isAtFirst)) {
                              const bounceDir = swipingLeft ? -1 : 1;
                              if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(10);
                              setIsRubberBanding(true);
                              setRubberBandOffset(bounceDir * 18);
                              setTimeout(() => setRubberBandOffset(bounceDir * 8), 80);
                              setTimeout(() => setRubberBandOffset(0), 200);
                              setTimeout(() => setIsRubberBanding(false), 250);
                            } else {
                              if (swipingLeft) {
                                setSwipeFeedback('left');
                                setActivePageIndex(i => Math.min(activePagesMemo.length - 1, i + 1));
                              } else {
                                setSwipeFeedback('right');
                                setActivePageIndex(i => Math.max(0, i - 1));
                              }
                              setTimeout(() => setSwipeFeedback(null), 300);
                              if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(6);
                            }
                            swipeStartXRef.current = null;
                            swipeStartYRef.current = null;
                          }}
                          // PERBAIKAN: Dukungan drag pakai Mouse saat testing Responsive di Desktop
                          onMouseDown={(e) => {
                            if (e.button !== 0) return;
                            swipeStartXRef.current = e.clientX;
                            swipeStartYRef.current = e.clientY;
                          }}
                          onMouseUp={(e) => {
                            if (swipeStartXRef.current === null) return;
                            const deltaX = e.clientX - swipeStartXRef.current;
                            const deltaY = e.clientY - (swipeStartYRef.current ?? 0);

                            if (Math.abs(deltaY) > Math.abs(deltaX) * 1.5 || Math.abs(deltaX) < 35) {
                              swipeStartXRef.current = null; swipeStartYRef.current = null; return;
                            }

                            const isAtFirst = activePageIndex === 0;
                            const isAtLast = activePageIndex === activePagesMemo.length - 1;
                            const swipingLeft = deltaX < 0;
                            const swipingRight = deltaX > 0;

                            if ((swipingLeft && isAtLast) || (swipingRight && isAtFirst)) {
                              const bounceDir = swipingLeft ? -1 : 1;
                              setIsRubberBanding(true);
                              setRubberBandOffset(bounceDir * 18);
                              setTimeout(() => setRubberBandOffset(0), 200);
                              setTimeout(() => setIsRubberBanding(false), 250);
                            } else {
                              if (swipingLeft) {
                                setSwipeFeedback('left');
                                setActivePageIndex(i => Math.min(activePagesMemo.length - 1, i + 1));
                              } else {
                                setSwipeFeedback('right');
                                setActivePageIndex(i => Math.max(0, i - 1));
                              }
                              setTimeout(() => setSwipeFeedback(null), 300);
                            }
                            swipeStartXRef.current = null; swipeStartYRef.current = null;
                          }}
                        >

                          <div className="relative" style={{ aspectRatio: '210/297' }}>
                            <motion.img
                              src={activePagesMemo[activePageIndex]?.image}
                              alt={`Halaman ${activePageIndex + 1}`}
                              className="w-full h-full object-contain rounded-xl shadow-xl select-none"
                              loading="lazy"
                              decoding="async"
                              onClick={() => mobileZoom === 100 && setFullscreenPage(activePagesMemo[activePageIndex])}
                              animate={{
                                x: rubberBandOffset,
                                scale: isRubberBanding ? 0.97 : 1,
                              }}
                              transition={{
                                type: "spring",
                                stiffness: 400,
                                damping: 25,
                                mass: 0.8,
                              }}
                            />
                            {/* Swipe feedback overlay */}
                            <AnimatePresence>
                              {swipeFeedback && (
                                <motion.div
                                  initial={{ opacity: 0.6 }}
                                  animate={{ opacity: 0 }}
                                  exit={{ opacity: 0 }}
                                  transition={{ duration: 0.3 }}
                                  className={`absolute inset-0 rounded-xl pointer-events-none flex items-center justify-center ${swipeFeedback === 'left' ? 'bg-gradient-to-l from-violet-500/20 to-transparent' : 'bg-gradient-to-r from-violet-500/20 to-transparent'}`}
                                >
                                  <div className={`${D ? "bg-black/50" : "bg-white/70"} backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-1.5`}>
                                    <ChevronDown className={`w-4 h-4 text-violet-500 ${swipeFeedback === 'left' ? '-rotate-90' : 'rotate-90'}`} />
                                    <span className={`text-[11px] font-bold ${D ? "text-white" : "text-violet-700"}`}>
                                      Hal. {swipeFeedback === 'left' ? activePageIndex + 1 : activePageIndex + 1}
                                    </span>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          {activePagesMemo.length > 1 && activePageIndex === 0 && (
                            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-medium backdrop-blur-md border animate-pulse pointer-events-none"
                              style={{
                                background: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.8)',
                                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(139,92,246,0.2)',
                                color: isDark ? 'rgba(255,255,255,0.7)' : '#7c3aed'
                              }}>
                              <span>←</span>
                              <span>Geser untuk ganti halaman</span>
                              <span>→</span>
                            </div>
                          )}

                          {/* Indikator Halaman Minimalis ala Instagram */}
                          {activePagesMemo.length > 1 && (
                            <div className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-[11px] font-bold backdrop-blur-md shadow-sm border ${isDark ? "bg-black/60 text-white/90 border-white/10" : "bg-white/80 text-gray-800 border-gray-200"
                              }`}>
                              {activePageIndex + 1} / {activePagesMemo.length}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : isGenerating ? (
                      <div className="flex items-center justify-center h-full min-h-[300px] flex-col gap-4">
                        <div className="w-12 h-12 rounded-full bg-violet-500/20 flex items-center justify-center animate-pulse">
                          <PenTool className="w-6 h-6 text-violet-500" />
                        </div>
                        <p className={`text-sm font-bold bg-gradient-to-r ${c.accent} bg-clip-text text-transparent`}>
                          AI Sedang Menulis...
                        </p>
                        <p className={`text-[10px] ${c.ts} font-mono tracking-widest uppercase`}>
                          {Math.round(generateProgress)}% Selesai
                        </p>
                      </div>
                    ) : (
                      <div className={`flex items-center justify-center h-full min-h-[300px] mb-6 rounded-2xl outline-none border ${isAppleDevice ? (D
                        ? "bg-black/50 backdrop-blur-3xl border-[#ffffff10] shadow-inner"
                        : "bg-white/40 backdrop-blur-3xl border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.04)]"
                      ) : (D
                        ? "bg-black/50 border-[#ffffff10]"
                        : "bg-gray-50/50 border-gray-200/80"
                      )}`}>
                        <p className={`text-sm ${c.ts}`}>Klik Generate untuk mulai</p>
                      </div>
                    )}

                    {/* Scroll to Top — muncul setelah scroll 200px */}
                    {activePagesMemo.length > 2 && activePageIndex > 0 && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        onClick={() => setActivePageIndex(0)}
                        className={`fixed right-4 z-[55] w-10 h-10 rounded-full flex items-center justify-center shadow-lg border transition-colors ${D ? "bg-black/80 backdrop-blur-xl border-white/15 text-white/70" : "bg-white/90 backdrop-blur-xl border-violet-200 text-violet-600"}`}
                        style={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }}>
                        <ChevronDown className="w-5 h-5 rotate-180" />
                      </motion.button>
                    )}

                    {/* ── MOBILE FLOATING DYNAMIC ISLAND (MORPHING) ── */}
                    {(activePagesMemo.length > 0 || isGenerating) && (
                      <div className="fixed bottom-8 left-0 right-0 z-[60] flex justify-center px-4 pointer-events-none">
                        <motion.div
                          layout
                          initial={{ y: 50, scale: 0.8, opacity: 0 }}
                          animate={{ y: 0, scale: 1, opacity: 1 }}
                          transition={{ type: "spring", bounce: 0.4, duration: 0.8 }}
                          className="flex items-center p-1.5 rounded-full shadow-2xl backdrop-blur-xl border overflow-hidden pointer-events-auto"
                          style={{
                            background: D ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.95)",
                            borderColor: D ? "rgba(255,255,255,0.15)" : "rgba(139,92,246,0.3)",
                            boxShadow: D ? "0 12px 40px rgba(0,0,0,0.8), inset 0 1px 1px rgba(255,255,255,0.1)" : "0 12px 40px rgba(139,92,246,0.25), inset 0 1px 1px rgba(255,255,255,0.8)"
                          }}
                        >
                          {isGenerating ? (
                            /* ── STATE 1: SEDANG LOADING (Dynamic Island Expanded) ── */
                            <motion.div layout className="flex items-center gap-3 px-5 py-2">
                              {/* Audio Wave anim saat loading */}
                              <div className="flex items-center gap-0.5 h-4">
                                {[1, 2, 3, 4].map(i => (
                                  <motion.div key={i}
                                    animate={{ height: ["4px", "14px", "4px"] }}
                                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
                                    className="w-1 rounded-full bg-violet-500"
                                  />
                                ))}
                              </div>
                              <span className={`text-[12px] font-bold tracking-wide whitespace-nowrap ${D ? "text-white" : "text-gray-900"}`}>
                                Menulis {streamedPages.length}/{totalStreamPages}...
                              </span>
                              <div className={`w-px h-5 mx-1 ${D ? "bg-white/20" : "bg-gray-300"}`} />
                              <button onClick={() => setActiveTab("editor" as any)} className={`text-[11px] font-bold text-violet-500 hover:text-violet-400 transition-colors uppercase tracking-widest bg-violet-500/10 px-3 py-1.5 rounded-full`}>
                                Sembunyikan
                              </button>
                            </motion.div>
                          ) : (
                            /* ── STATE 2: SELESAI (Tools Muncul - Compact Island) ── */
                            <motion.div layout className="flex items-center">
                              <button onClick={() => setActiveTab("editor" as any)} className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${D ? "hover:bg-white/10 text-gray-300" : "hover:bg-violet-50 text-violet-600"}`}>
                                <PenTool className="w-[18px] h-[18px]" />
                              </button>

                              <div className={`w-px h-6 mx-1.5 ${D ? "bg-white/20" : "bg-gray-300"}`} />

                              {activePagesMemo.length > 0 && (
                                <>
                                  <button onClick={() => setActivePageIndex(i => Math.max(0, i - 1))} disabled={activePageIndex === 0} className={`w-8 h-10 flex items-center justify-center transition-colors active:scale-95 ${activePageIndex === 0 ? "opacity-30" : "text-violet-500"}`}>
                                    <ChevronDown className="w-5 h-5 rotate-90" />
                                  </button>
                                  <span className={`text-[13px] font-bold flex items-center gap-0.5 px-0.5 ${D ? "text-white" : "text-gray-900"}`}>
                                    <OdometerNumber value={activePageIndex + 1} isDark={D} />
                                    <span className="opacity-40">/</span>
                                    <OdometerNumber value={Math.max(1, activePagesMemo.length)} isDark={D} />
                                  </span>
                                  {/* Disabled disesuaikan dengan activePagesMemo.length */}
                                  <button onClick={() => setActivePageIndex(i => Math.min(activePagesMemo.length - 1, i + 1))} disabled={activePageIndex === activePagesMemo.length - 1 || activePagesMemo.length <= 1} className={`w-8 h-10 flex items-center justify-center transition-colors active:scale-95 ${activePageIndex === activePagesMemo.length - 1 || activePagesMemo.length <= 1 ? "opacity-30" : "text-violet-500"}`}>
                                    <ChevronDown className="w-5 h-5 -rotate-90" />
                                  </button>
                                  <div className={`w-px h-6 mx-1.5 ${D ? "bg-white/20" : "bg-gray-300"}`} />
                                </>
                              )}

                              <div className="ml-1.5">
                                {mobileZoom !== 100 ? (
                                  <button onClick={() => setMobileZoom(100)} className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-amber-500/15 text-amber-500 hover:bg-amber-500/25 text-[12px] font-bold transition-colors">
                                    <ZoomOut className="w-4 h-4" /><span>Reset ({mobileZoom}%)</span>
                                  </button>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => handleDownloadSingle(activePagesMemo[activePageIndex])}
                                      className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[12px] font-bold text-white shadow-lg active:scale-95 transition-all hover:opacity-90 bg-gradient-to-r ${D ? "from-violet-600 to-indigo-600" : "from-violet-500 to-indigo-500"}`}>
                                      <Download className="w-4 h-4" /><span>JPG</span>
                                    </button>
                                    <button
                                      onClick={() => setShowMobileExportSheet(true)}
                                      className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[12px] font-bold active:scale-95 transition-all border ${D ? "bg-white/10 text-white border-white/20" : "bg-violet-50 text-violet-700 border-violet-200"}`}>
                                      <ChevronDown className="w-4 h-4" /><span>Export</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </motion.div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div >

          {/* ── EXPORT DROPDOWN PORTAL — fixed di atas semua layer ── */}
          <AnimatePresence>
            {
              showExportDropdown && exportDropdownPos && (
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
                      left: Math.min(
                        exportDropdownPos.left - 120,
                        (typeof window !== 'undefined' ? window.innerWidth : 1200) - 220
                      ),
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
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${c.rowHover} ${c.tm}`}>
                        <div className="w-6 h-6 rounded-md flex items-center justify-center bg-violet-500/15">
                          <Download className="w-3.5 h-3.5 text-violet-500" />
                        </div>Semua JPG
                      </button>
                      <button onClick={() => { handleDownloadZip(); setShowExportDropdown(false); }}
                        disabled={isDownloadingZip}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${c.rowHover} ${c.tm} ${isDownloadingZip ? "opacity-50" : ""}`}>
                        <div className="w-6 h-6 rounded-md flex items-center justify-center bg-emerald-500/15">
                          {isDownloadingZip ? <Loader2 className="w-3.5 h-3.5 text-emerald-500 animate-spin" /> : <Package className="w-3.5 h-3.5 text-emerald-500" />}
                        </div>ZIP Archive
                      </button>
                      <div className={`my-1 h-px ${D ? "bg-white/8" : "bg-gray-100"}`} />
                      <button onClick={() => { handleExportPdf("high"); setShowExportDropdown(false); }}
                        disabled={isExportingPdf}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${c.rowHover} ${c.tm} ${isExportingPdf ? "opacity-50" : ""}`}>
                        <div className="w-6 h-6 rounded-md flex items-center justify-center bg-amber-500/15">
                          {isExportingPdf ? <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" /> : <FileDown className="w-3.5 h-3.5 text-amber-500" />}
                        </div>PDF (Resolusi Tinggi / Cetak)
                      </button>
                      <button onClick={() => { handleExportPdf("low"); setShowExportDropdown(false); }}
                        disabled={isExportingPdf}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${c.rowHover} ${c.tm} ${isExportingPdf ? "opacity-50" : ""}`}>
                        <div className="w-6 h-6 rounded-md flex items-center justify-center bg-rose-500/15">
                          {isExportingPdf ? <Loader2 className="w-3.5 h-3.5 text-rose-500 animate-spin" /> : <FileDown className="w-3.5 h-3.5 text-rose-500" />}
                        </div>PDF (Hemat Kuota / WA)
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
                          const { saveAs } = await import("file-saver");
                          saveAs(blob, `tulisan_transparan_hal${activePageIndex + 1}.png`);
                          toast.success("PNG transparan berhasil!", { id: tid });
                        } catch { toast.error("Gagal export", { id: tid }); }
                      }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${c.rowHover} ${c.tm}`}>
                        <div className="w-6 h-6 rounded-md flex items-center justify-center bg-purple-500/15">
                          <ImageIcon className="w-3.5 h-3.5 text-purple-500" />
                        </div>PNG Transparan
                      </button>
                      <button onClick={() => { handleExportDocx(); setShowExportDropdown(false); }}
                        disabled={isExportingDocx}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${c.rowHover} ${c.tm} ${isExportingDocx ? "opacity-50" : ""}`}>
                        <div className="w-6 h-6 rounded-md flex items-center justify-center bg-blue-500/15">
                          {isExportingDocx ? <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" /> : <FileText className="w-3.5 h-3.5 text-blue-500" />}
                        </div>Word (.docx)
                      </button>
                    </div>
                  </motion.div>
                </>
              )
            }
          </AnimatePresence >

          {/* ── MOBILE BOTTOM BAR (Modern Floating Dock) ── */}
          <div className="fixed bottom-0 left-0 right-0 z-50 hidden max-[767px]:flex pointer-events-none px-3 sm:px-4 safe-area-pb flex justify-center" >

            {/* Dock Kaca (Glassmorphism) */}
            <div className={`w-full flex items-center gap-2 sm:gap-3 px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-2xl pointer-events-auto transition-[transform,opacity] duration-500 ease-in-out ${activeTab === "result" || hideMobileDock || activePagesMemo.length > 0 ? "translate-y-[150%] opacity-0 pointer-events-none" : "translate-y-0 opacity-100"} ${isAppleDevice ? (D ? "liquid-glass shadow-2xl" : "glass-panel") : (D ? "bg-[#2c2c35] border border-[#ffffff10] shadow-2xl" : "bg-white border border-gray-200 shadow-xl")}`
            }>
              {/* Ubah md:hidden menjadi lg:hidden di bawah ini */}
              <button onClick={() => setMobileSidebarOpen(true)}
                className={`flex lg:hidden w-8 h-8 rounded-lg items-center justify-center transition-colors ${c.btn}`}>
                <Menu className="w-3.5 h-3.5" />
              </button >

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
                    <div className="h-full bg-gradient-to-r from-violet-500 to-indigo-400 transition-[width] duration-500" style={{ width: `${generateProgress}%` }} />
                  </div>
                )}
              </div>

              {
                generatedPages.length > 0 && typeof navigator !== "undefined" && !!navigator.share && (
                  <button
                    onClick={() => handleSharePage(generatedPages[activePageIndex])}
                    className={`w-9 h-9 rounded-full border flex items-center justify-center flex-shrink-0 transition-all hover:scale-110 active:scale-90 ${c.btn}`}
                    title="Bagikan ke WA/Telegram"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                  </button>
                )
              }

              <button
                onClick={handleGenerate}
                disabled={isGenerating || !text.trim() || !selectedFolio}
                className="btn-ripple relative flex items-center gap-1.5 px-5 py-3 rounded-2xl font-bold text-sm flex-shrink-0 transition-all overflow-hidden active:scale-95"
                style={isGenerating || !text.trim() || !selectedFolio
                  ? { background: D ? "rgba(255,255,255,0.04)" : "#f3f4f6", color: D ? "rgba(255,255,255,0.15)" : "#9ca3af", cursor: "not-allowed" }
                  : { background: "linear-gradient(135deg, #8b5cf6, #6d28d9, #4f46e5)", color: "white", boxShadow: "0 4px 16px rgba(109,40,217,0.45), inset 0 1px 0 rgba(255,255,255,0.2)" }
                }>
                {/* shimmer sweep */}
                {!(isGenerating || !text.trim() || !selectedFolio) && (
                  <div className="absolute inset-0 -translate-x-full animate-[shimmer_2.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
                )}
                <div className="relative z-10 flex items-center gap-1.5">
                  {isGenerating
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Sparkles className="w-4 h-4" />
                  }
                  <span>{isGenerating ? `${Math.round(generateProgress)}%` : "Generate"}</span>
                </div>
              </button>
            </div >
          </div >
        </>
      )}
    </div >
  );
}