"use client";
import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { SECTION_COLORS } from "../lib/constants";

function SidebarSectionInner({
    title, children, defaultOpen = true, isDark, className = "", badge
}: {
    title: string; children: React.ReactNode; defaultOpen?: boolean; isDark: boolean; className?: string; badge?: string;
}) {
    const [open, setOpen] = useState(defaultOpen);
    const theme = SECTION_COLORS[title];
    const t = theme ? (isDark ? theme.dark : theme.light) : null;

    const bg = t ? t.bg : (isDark ? "bg-white/[0.04]" : "bg-white/60");
    const border = t ? t.border : (isDark ? "border-[#ffffff0d]" : "border-violet-100");
    const headerHover = t ? t.header : (isDark ? "hover:bg-white/[0.03]" : "hover:bg-violet-50/80");
    const labelColor = t ? t.label : (isDark ? "text-[#52525b]" : "text-violet-400");
    const icon = t ? t.icon : "";
    const divider = t ? t.border : (isDark ? "border-[#ffffff08]" : "border-violet-100");

    // Tambahkan variabel ini untuk mendeteksi apakah kita butuh overflow visible
    const isOverflowVisible = className.includes("!overflow-visible");

    return (
        <div className={`rounded-xl border backdrop-blur-sm shadow-sm sidebar-section-glow ${bg} ${border} ${className} ${isOverflowVisible ? "" : "overflow-hidden"}`}>
            <button
                onClick={() => setOpen(!open)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-t-xl transition-colors duration-200 ${open ? `border-b ${divider}` : "rounded-b-xl"} ${headerHover} hover:ring-1 ${isDark ? "hover:ring-white/5" : "hover:ring-violet-200"}`}
            >
                <div className="flex items-center gap-2">
                    {icon && <span className="text-sm">{icon}</span>}
                    <span className={`text-[11.5px] 3xl:text-xs 4xl:text-sm font-bold uppercase tracking-[0.1em] ${labelColor}`}>{title}</span>
                    {badge && (
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${isDark
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
                    <ChevronDown className={`w-4 h-4 flex-shrink-0 ${labelColor}`} />
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
                        style={{ overflow: isOverflowVisible ? "visible" : "hidden" }}
                    >
                        <div className="p-3.5 space-y-3">{children}</div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

const SidebarSection = React.memo(SidebarSectionInner);
export default SidebarSection;

