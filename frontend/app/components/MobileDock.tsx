"use client";
import React from "react";
import { Sparkles, Menu, Loader2 } from "lucide-react";
import type { GeneratedPage } from "../lib/types";
import { FONT_FAMILY_MAP } from "../lib/constants";

interface MobileDockProps {
    isDark: boolean;
    D: boolean;
    c: { btn: string; tp: string; ts: string };
    isAppleDevice: boolean;
    activeTab: string;
    hideMobileDock: boolean;
    activePagesMemo: any[];
    setMobileSidebarOpen: (v: boolean) => void;
    currentFont: { name: string } | null;
    wordCount: number;
    estimatedPages: number;
    isGenerating: boolean;
    generateProgress: number;
    generatedPages: GeneratedPage[];
    activePageIndex: number;
    handleGenerate: () => void;
    handleSharePage: (p: GeneratedPage) => void;
    text: string;
    selectedFolio: any;
}

function MobileDock({
    isDark, D, c, isAppleDevice, activeTab, hideMobileDock, activePagesMemo,
    setMobileSidebarOpen, currentFont, wordCount, estimatedPages,
    isGenerating, generateProgress, generatedPages, activePageIndex,
    handleGenerate, handleSharePage, text, selectedFolio,
}: MobileDockProps) {
    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 hidden max-[767px]:flex pointer-events-none px-3 sm:px-4 safe-area-pb flex justify-center">
            <div className={`w-full flex items-center gap-2 sm:gap-3 px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-2xl pointer-events-auto transition-[transform,opacity] duration-500 ease-in-out ${activeTab === "result" || hideMobileDock || activePagesMemo.length > 0 ? "translate-y-[150%] opacity-0 pointer-events-none" : "translate-y-0 opacity-100"} ${isAppleDevice ? (D ? "liquid-glass shadow-2xl" : "glass-panel") : (D ? "bg-[#2c2c35] border border-[#ffffff10] shadow-2xl" : "bg-white border border-gray-200 shadow-xl")}`}>
                <button onClick={() => React.startTransition(() => setMobileSidebarOpen(true))}
                    className={`flex lg:hidden w-8 h-8 rounded-lg items-center justify-center transition-colors ${c.btn}`}>
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
                            <div className="h-full bg-gradient-to-r from-violet-500 to-indigo-400 transition-[width] duration-500" style={{ width: `${generateProgress}%` }} />
                        </div>
                    )}
                </div>

                {generatedPages.length > 0 && typeof navigator !== "undefined" && !!navigator.share && (
                    <button
                        onClick={() => handleSharePage(generatedPages[activePageIndex])}
                        className={`w-9 h-9 rounded-full border flex items-center justify-center flex-shrink-0 transition-all hover:scale-110 active:scale-90 ${c.btn}`}
                        title="Bagikan ke WA/Telegram">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                    </button>
                )}

                <button
                    onClick={handleGenerate}
                    disabled={isGenerating || !text.trim() || !selectedFolio}
                    className="btn-ripple relative flex items-center gap-1.5 px-5 py-3 rounded-2xl font-bold text-sm flex-shrink-0 transition-all overflow-hidden active:scale-95"
                    style={isGenerating || !text.trim() || !selectedFolio
                        ? { background: D ? "rgba(255,255,255,0.04)" : "#f3f4f6", color: D ? "rgba(255,255,255,0.15)" : "#9ca3af", cursor: "not-allowed" }
                        : { background: "linear-gradient(135deg, #8b5cf6, #6d28d9, #4f46e5)", color: "white", boxShadow: "0 4px 16px rgba(109,40,217,0.45), inset 0 1px 0 rgba(255,255,255,0.2)" }
                    }>
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
            </div>
        </div>
    );
}

export default React.memo(MobileDock);
