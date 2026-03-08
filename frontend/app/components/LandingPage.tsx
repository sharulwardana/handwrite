"use client";
import React, { ReactElement } from "react";
import { Sparkles, LogIn, PenTool, Zap, FileDown, BookOpen, Bot } from "lucide-react";
import { motion, type Variants } from "framer-motion";
import { Caveat } from "next/font/google";
import BeforeAfterSlider from "./BeforeAfterSlider";

const caveat = Caveat({
    subsets: ["latin"],
    weight: ["400", "700"],
    display: "swap",
    variable: "--font-caveat",
});

const springUp: Variants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } } };

interface LandingPageProps {
    isDark: boolean;
    tp: string; // c.tp text color class
    handleLogin: () => void;
    setShowEditor: (v: boolean) => void;
}

function LandingPage({ isDark, tp, handleLogin, setShowEditor }: LandingPageProps) {
    return (
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
                <motion.div variants={springUp}>
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

                {/* 2. Headline */}
                <h1 className={`text-3xl xs:text-4xl sm:text-6xl md:text-8xl 2xl:text-[7rem] 3xl:text-[8rem] 4xl:text-[10rem] font-black mb-6 tracking-tight leading-[1.1] ${tp} ${caveat.variable}`} style={{ fontFamily: "var(--font-caveat), 'Caveat Fallback', cursive" }}>
                    Tugas Tulis Tangan <br />
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-400 via-indigo-400 to-cyan-400">
                        Selesai dalam 5 Detik.
                    </span>
                </h1>

                {/* 3. Deskripsi */}
                <motion.div variants={springUp}>
                    <p className={`text-base sm:text-xl lg:text-2xl 2xl:text-[1.6rem] mb-12 max-w-2xl 3xl:max-w-3xl mx-auto leading-relaxed ${isDark ? "text-gray-400" : "text-gray-600 font-medium"}`}>
                        Gak perlu lagi pegal atau begadang menyalin teks. Ubah ketikan panjangmu menjadi tulisan tangan bolpoin super realistis di atas kertas folio, langsung dari browser.
                    </p>
                </motion.div>

                {/* 4. Interaktif Before/After Slider */}
                <motion.div variants={{ hidden: { opacity: 0, scale: 0.95, y: 30 }, show: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 200, damping: 25 } } } as Variants} className="w-full mb-16 min-h-[250px] sm:min-h-[350px] flex items-center justify-center">
                    <div className="w-full flex-col flex items-center">
                        <BeforeAfterSlider />
                        <p className="text-[11px] text-gray-500 mt-4 uppercase tracking-widest font-bold">Geser slider untuk melihat keajaiban 👆</p>
                    </div>
                </motion.div>

                {/* 5. Tombol Aksi */}
                <motion.div variants={springUp} className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto px-6">
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
                <motion.div variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { delay: 0.5, duration: 1 } } } as Variants} className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-12">
                    {[
                        { icon: <Zap />, label: "Real-time Preview" },
                        { icon: <FileDown />, label: "Export PDF & Word" },
                        { icon: <BookOpen />, label: "Flipbook 3D Mode" },
                        { icon: <Bot />, label: "AI Anti-Plagiasi" },
                    ].map((f) => (
                        <div key={f.label} className="flex flex-col items-center gap-2">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDark ? "bg-white/5" : "bg-violet-100 shadow-sm"}`}>
                                {React.cloneElement(f.icon as ReactElement, { className: `w-5 h-5 ${isDark ? "text-gray-300" : "text-violet-600"}` })}
                            </div>
                            <div className={`text-xs font-semibold ${isDark ? "text-gray-400" : "text-gray-700"}`}>{f.label}</div>
                        </div>
                    ))}
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
    );
}

export default React.memo(LandingPage);
