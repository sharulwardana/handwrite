"use client";
import React, { ReactNode } from "react";
import { Sparkles, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface CommandItem {
    icon: ReactNode;
    label: string;
    keywords: string[];
    action: () => void;
}

interface CommandPaletteProps {
    show: boolean;
    onClose: () => void;
    isDark: boolean;
    cmdSearch: string;
    setCmdSearch: (v: string) => void;
    commands: CommandItem[];
}

function CommandPalette({ show, onClose, isDark, cmdSearch, setCmdSearch, commands }: CommandPaletteProps) {
    const D = isDark;
    const filtered = commands.filter(
        cmd => cmd.label.toLowerCase().includes(cmdSearch.toLowerCase()) ||
            cmd.keywords.some(k => k.includes(cmdSearch.toLowerCase()))
    );

    return (
        <AnimatePresence>
            {show && (
                <div className="fixed inset-0 z-[300] flex items-start justify-center pt-[10vh] sm:pt-[15vh] p-4">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={onClose} />
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
                            {filtered.map((cmd, i) => (
                                <button key={i} onClick={cmd.action} className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all active:scale-95 ${D ? "hover:bg-white/5 text-white/80" : "hover:bg-gray-100 text-gray-700"}`}>
                                    <div className={`p-2 rounded-lg flex-shrink-0 ${D ? "bg-white/10 text-white/70" : "bg-white shadow-sm border border-gray-200 text-violet-600"}`}>
                                        {React.cloneElement(cmd.icon as React.ReactElement, { className: "w-4 h-4" })}
                                    </div>
                                    <span className="text-sm font-semibold">{cmd.label}</span>
                                    <ChevronDown className="w-4 h-4 -rotate-90 ml-auto opacity-30" />
                                </button>
                            ))}
                            {cmdSearch && filtered.length === 0 && (
                                <div className="py-8 text-center text-sm text-gray-500">
                                    Tidak ada perintah untuk &quot;{cmdSearch}&quot;
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}

export default React.memo(CommandPalette);
