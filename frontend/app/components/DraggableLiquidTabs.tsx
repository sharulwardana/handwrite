"use client";
import React, { useState, useRef, useEffect } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

interface TabOption {
    value: string | number;
    label: string;
}

export default function DraggableLiquidTabs({ options, value, onChange, isDark, isApple }: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    options: TabOption[]; value: string | number; onChange: (val: any) => void; isDark: boolean; isApple: boolean;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [contentWidth, setContentWidth] = useState(0);

    const x = useMotionValue(0);
    const animatedX = useSpring(x, { stiffness: 450, damping: 35, mass: 0.8 });

    // RAHASIA MASKING APPLE: Teks di dalam kaca bergerak berlawanan arah dengan kaca
    const invertedX = useTransform(animatedX, (val) => -val);
    const scale = useSpring(1, { stiffness: 400, damping: 25 });

    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver((entries) => {
            setContentWidth(entries[0].contentRect.width);
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    const pillWidth = contentWidth > 0 ? contentWidth / options.length : 0;

    useEffect(() => {
        if (!isDragging && pillWidth > 0) {
            const index = options.findIndex((o) => o.value === value);
            x.set(index * pillWidth);
        }
    }, [value, isDragging, pillWidth, x, options]);

    const handlePointerDown = (e: React.PointerEvent) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setIsDragging(true);
        scale.set(0.96);
        updatePointer(e);
    };

    const handlePointerMove = (e: React.PointerEvent) => { if (isDragging) updatePointer(e); };

    const handlePointerUp = (e: React.PointerEvent) => {
        e.currentTarget.releasePointerCapture(e.pointerId);
        if (!isDragging) return;
        setIsDragging(false);
        scale.set(1);
        if (!containerRef.current || pillWidth === 0) return;
        const rect = containerRef.current.getBoundingClientRect();
        const pointerX = e.clientX - rect.left - 4;
        let closestIndex = Math.round((pointerX - pillWidth / 2) / pillWidth);
        closestIndex = Math.max(0, Math.min(options.length - 1, closestIndex));
        onChange(options[closestIndex].value);
    };

    const updatePointer = (e: React.PointerEvent) => {
        if (!containerRef.current || pillWidth === 0) return;
        const rect = containerRef.current.getBoundingClientRect();
        const pointerX = e.clientX - rect.left - 4;
        let newX = pointerX - (pillWidth / 2);
        const maxX = contentWidth - pillWidth;
        newX = Math.max(0, Math.min(maxX, newX));
        x.set(newX);
    };

    const inactiveColor = isDark ? "text-white/40" : "text-gray-500";
    const activeColor = isDark ? "text-white" : "text-gray-900";

    return (
        <div
            ref={containerRef}
            className={`relative flex rounded-full p-1 overflow-hidden border touch-none cursor-pointer select-none outline-none
        ${isApple ? "border-white/20 bg-black/10 backdrop-blur-md shadow-inner" : (isDark ? "border-[#ffffff10] bg-black/30" : "border-gray-200 bg-gray-100")}`}
            style={{ WebkitTapHighlightColor: 'transparent' }}
            onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}
        >
            {/* LAPISAN 1: Teks Abu-abu di Background */}
            <div className="absolute inset-0 p-1 flex z-0 pointer-events-none">
                {options.map((opt) => (
                    <div key={`bg-${opt.value}`} className="flex-1 flex items-center justify-center">
                        <span className={`text-[11.5px] font-bold tracking-wide ${inactiveColor}`}>{opt.label}</span>
                    </div>
                ))}
            </div>

            {/* LAPISAN 2: Gelembung Kaca yang Bergerak */}
            <motion.div
                style={{ x: animatedX, width: pillWidth, scale: scale }}
                className={`absolute top-1 bottom-1 left-1 rounded-full z-10 overflow-hidden flex items-center justify-center
          ${isApple ? "bg-white/30 backdrop-blur-2xl border border-white/40 shadow-[0_2px_10px_rgba(0,0,0,0.2)]" : (isDark ? "bg-[#3a3a40]" : "bg-white shadow-md")}`}
            >
                {isApple && <div className="absolute top-0 w-1/2 h-[2px] bg-gradient-to-r from-transparent via-white/80 to-transparent rounded-full opacity-60 z-20 pointer-events-none" />}

                {/* LAPISAN 3: KUNCI RAHASIA (Teks Menyala di dalam kaca) */}
                <motion.div
                    style={{ x: invertedX, width: contentWidth }}
                    className="absolute top-0 bottom-0 left-0 flex pointer-events-none"
                >
                    {options.map((opt) => (
                        <div key={`fg-${opt.value}`} className="h-full flex items-center justify-center" style={{ width: pillWidth }}>
                            <span className={`text-[11.5px] font-bold tracking-wide drop-shadow-sm ${activeColor}`}>{opt.label}</span>
                        </div>
                    ))}
                </motion.div>
            </motion.div>

            {/* HITBOX: Area Tembus Pandang untuk mendeteksi ketukan (klik) */}
            {options.map((opt) => (
                <div key={`hitbox-${opt.value}`} className="relative z-20 flex-1 py-1.5 opacity-0 pointer-events-none">
                    <div className="text-[11.5px] font-bold text-center">{opt.label}</div>
                </div>
            ))}
        </div>
    );
}
