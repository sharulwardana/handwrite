"use client";
import React, { type ReactNode } from "react";
import {
    PanelLeftClose, PanelLeftOpen, Menu, PenTool, Sun, Moon,
    X, LogIn, LogOut, Loader2, Settings, Zap
} from "lucide-react";
import type { User as SupabaseUser } from "@supabase/supabase-js";

interface HeaderProps {
    isDark: boolean;
    setIsDark: (v: boolean) => void;
    D: boolean;
    c: { header: string; btn: string; tp: string; ts: string; divider: string };
    user: SupabaseUser | null;
    handleLogin: () => void;
    handleLogout: () => void;
    sidebarOpen: boolean;
    setSidebarOpen: (v: boolean) => void;
    setMobileSidebarOpen: (v: boolean) => void;
    backendOnline: boolean | null;
    isGenerating: boolean;
    generateProgress: number;
    abortController: AbortController | null;
    generatedPages: { page: number; image: string }[];
    text: string;
    estimatedPages: number;
    estimatedTimeLabel: string;
    wordCount: number;
    hideHeader: boolean;
    isMobileView: boolean;
    zenMode: boolean;
    isAppleDevice: boolean;
    energy: number;
    setShowShortcuts: (v: boolean) => void;
    setShowQrisModal: (v: boolean) => void;
    setShowAdminModal: (v: boolean) => void;
}

function Header({
    isDark, setIsDark, D, c, user, handleLogin, handleLogout,
    sidebarOpen, setSidebarOpen, setMobileSidebarOpen,
    backendOnline, isGenerating, generateProgress, abortController,
    generatedPages, text, estimatedPages, estimatedTimeLabel, wordCount,
    hideHeader, isMobileView, zenMode, isAppleDevice, energy,
    setShowShortcuts, setShowQrisModal, setShowAdminModal,
}: HeaderProps) {
    return (
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
                    <button
                        onClick={() => setMobileSidebarOpen(true)}
                        aria-label="Buka menu pengaturan"
                        className={`flex lg:hidden w-11 h-11 rounded-xl items-center justify-center transition-colors ${c.btn}`}>
                        <Menu className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>

                    <div className="flex items-center gap-2.5">
                        {/* Logo icon */}
                        <div className="relative flex-shrink-0">
                            <div className={`absolute inset-0 rounded-xl blur-md opacity-60 ${D ? "bg-violet-500" : "bg-violet-400"}`} />
                            <div className="relative w-8 h-8 bg-gradient-to-br from-violet-500 via-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/40 border border-white/20 animate-[float-up_3s_ease-in-out_infinite]">
                                <PenTool className="w-3.5 h-3.5 text-white drop-shadow" />
                            </div>
                        </div>
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

                {/* CENTER: status pill */}
                <div className="hidden sm:flex flex-1 justify-center">
                    {isGenerating ? (
                        <div className={`relative flex items-center gap-2.5 pl-3 pr-2 py-1.5 rounded-full overflow-hidden border ${D ? "bg-violet-500/8 border-violet-500/20" : "bg-violet-50 border-violet-200/80"}`}
                            style={{ boxShadow: D ? "0 0 20px rgba(139,92,246,0.12)" : "0 0 16px rgba(139,92,246,0.08)" }}>
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
                        {/* Login / User */}
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
                        {/* Backend status */}
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
                        {/* Energy / Admin */}
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
                    {/* GROUP 2: AKSI */}
                    <div className="flex items-center gap-1.5 pl-1">
                        <button
                            onClick={() => setShowShortcuts(true)}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors text-[13px] font-bold ${c.btn}`}
                            title="Keyboard Shortcuts">
                            ?
                        </button>
                        <button
                            onClick={() => {
                                if (!(document as any).startViewTransition) {
                                    setIsDark(!isDark);
                                    return;
                                }
                                (document as any).startViewTransition(() => {
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
                            <div className={`absolute inset-0 rounded-2xl theme-bg-morph ${isDark ? "theme-bg-dark" : "theme-bg-light"}`} />
                            <Sun className={`absolute w-[18px] h-[18px] theme-icon theme-sun ${isDark ? "theme-icon-hidden-down" : "theme-icon-visible"} text-amber-500 fill-amber-200`} />
                            <Moon className={`absolute w-[18px] h-[18px] theme-icon theme-moon ${isDark ? "theme-icon-visible" : "theme-icon-hidden-up"} text-violet-300 fill-violet-900/40`} />
                            <div className={`absolute inset-0 rounded-2xl theme-ripple ${isDark ? "theme-ripple-dark" : "theme-ripple-light"}`} />
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
}

export default React.memo(Header);
