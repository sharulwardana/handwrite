"use client";
import React from "react";
import { motion } from "framer-motion";

interface OnboardingModalProps {
    show: boolean;
    isDark: boolean;
    isAppleDevice: boolean;
    onboardingStep: number;
    onClose: () => void;
    onNext: () => void;
    onPrev: () => void;
}

function OnboardingModal({ show, isDark, isAppleDevice, onboardingStep, onClose, onNext, onPrev }: OnboardingModalProps) {
    if (!show) return null;

    const isMobileView = typeof window !== 'undefined' && window.innerWidth < 1024;

    const mobileSelectors: Record<number, string | null> = {
        0: null,
        1: null,
        2: null,
        3: "generate-btn",
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
                onClick={onClose}
            />

            {/* Spotlight */}
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

            {/* Modal card */}
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
                            <button onClick={onClose}
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

                        {/* Hint visual khusus mobile step 1 */}
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
                                <button onClick={onPrev}
                                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${isDark ? "bg-black/30 border border-white/10 text-white/80 hover:bg-white/10" : "bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100"}`}>
                                    ← Kembali
                                </button>
                            )}
                            <button onClick={onNext}
                                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:opacity-90 active:scale-95 transition-colors shadow-lg shadow-violet-500/25">
                                {onboardingStep < 3 ? "Lanjut →" : "Mulai Sekarang! 🚀"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default React.memo(OnboardingModal);
