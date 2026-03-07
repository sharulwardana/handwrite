"use client";
import React, { type RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, Package, FileDown, FileText, Loader2, ImageIcon } from "lucide-react";
import toast from "react-hot-toast";

interface ExportDropdownProps {
    D: boolean;
    c: { rowHover: string; tm: string };
    showExportDropdown: boolean;
    setShowExportDropdown: (v: boolean) => void;
    exportDropdownPos: { top: number; left: number; height: number } | null;
    exportDropdownRef: React.Ref<HTMLDivElement>;
    handleDownloadAllPng: () => void;
    handleDownloadZip: () => void;
    handleExportPdf: (quality: "high" | "low") => void;
    handleExportDocx: () => void;
    isDownloadingZip: boolean;
    isExportingPdf: boolean;
    isExportingDocx: boolean;
    generatedPages: { page: number; image: string }[];
    activePageIndex: number;
    API_URL: string;
}

function ExportDropdown({
    D, c, showExportDropdown, setShowExportDropdown,
    exportDropdownPos, exportDropdownRef,
    handleDownloadAllPng, handleDownloadZip, handleExportPdf, handleExportDocx,
    isDownloadingZip, isExportingPdf, isExportingDocx,
    generatedPages, activePageIndex, API_URL,
}: ExportDropdownProps) {
    return (
        <AnimatePresence>
            {showExportDropdown && exportDropdownPos && (
                <>
                    <div className="fixed inset-0 z-[90]" onClick={() => setShowExportDropdown(false)} />
                    <motion.div
                        ref={exportDropdownRef}
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
            )}
        </AnimatePresence>
    );
}

export default React.memo(ExportDropdown);
