"use client";
import React, { useRef } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";

function BeforeAfterSliderInner() {
    // INP OPTIMIZATION: Ganti useState dengan useMotionValue (tidak me-render ulang React Tree per piksel)
    const rawX = useMotionValue(50);
    const containerRef = useRef<HTMLDivElement>(null);

    // Transform rawX (0-100) menjadi string persentase yang aman untuk CSS
    const sliderWidth = useTransform(rawX, v => `${v}%`);
    const lineLeft = useTransform(rawX, v => `calc(${v}% - 1px)`);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();

        const onMouseMove = (me: MouseEvent) => {
            const x = Math.max(0, Math.min(me.clientX - rect.left, rect.width));
            rawX.set((x / rect.width) * 100);
        };

        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);

        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        rawX.set((x / rect.width) * 100);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();

        const onTouchMove = (te: TouchEvent) => {
            const x = Math.max(0, Math.min(te.touches[0].clientX - rect.left, rect.width));
            rawX.set((x / rect.width) * 100);
        };

        const onTouchEnd = () => {
            window.removeEventListener('touchmove', onTouchMove);
            window.removeEventListener('touchend', onTouchEnd);
        };

        window.addEventListener('touchmove', onTouchMove, { passive: true });
        window.addEventListener('touchend', onTouchEnd);

        const x = Math.max(0, Math.min(e.touches[0].clientX - rect.left, rect.width));
        rawX.set((x / rect.width) * 100);
    };

    return (
        <div
            ref={containerRef}
            className="relative w-full max-w-4xl mx-auto h-[250px] sm:h-[350px] rounded-3xl overflow-hidden cursor-ew-resize touch-pan-y shadow-[0_24px_64px_rgba(139,92,246,0.15)] border border-[#ffffff15] select-none group bg-[#000000]"
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
        >
            {/* Gambar AFTER (Tulisan Tangan) - Lapisan Bawah */}
            <div
                className="absolute inset-0 bg-white flex items-center justify-center p-8 sm:p-12"
                style={{ backgroundImage: "radial-gradient(#8b5cf630 1px, transparent 1px)", backgroundSize: "28px 28px" }}
            >
                <p className="text-2xl sm:text-4xl text-[#1a3a7c] leading-relaxed opacity-90 text-left w-full max-w-3xl" style={{ fontFamily: "var(--font-caveat), cursive" }}>
                    &quot;Pendidikan adalah senjata paling ampuh yang bisa kamu gunakan untuk mengubah dunia. Setiap huruf yang kamu tulis adalah bukti bahwa kamu peduli pada masa depanmu.&quot;
                </p>
            </div>

            {/* Gambar BEFORE (Teks Ketikan) - Lapisan Atas yang Terpotong */}
            <motion.div
                className="absolute inset-0 bg-[#000000] flex items-center justify-center p-8 sm:p-12 border-r-[3px] border-violet-500 overflow-hidden shadow-[10px_0_20px_rgba(0,0,0,0.5)]"
                style={{ width: sliderWidth }}
            >
                <div className="w-full max-w-3xl absolute left-8 sm:left-12 pr-8">
                    <p className="font-mono text-sm sm:text-lg text-gray-300 leading-relaxed text-left">
                        &quot;Pendidikan adalah senjata paling ampuh yang bisa kamu gunakan untuk mengubah dunia. Setiap huruf yang kamu tulis adalah bukti bahwa kamu peduli pada masa depanmu.&quot;
                    </p>
                </div>
            </motion.div>

            {/* Garis & Tombol Slider */}
            <motion.div
                className="absolute top-0 bottom-0 w-0.5 flex items-center justify-center pointer-events-none transition-transform"
                style={{ left: lineLeft }}
            >
                <div className="w-10 h-10 bg-white rounded-full shadow-[0_0_20px_rgba(139,92,246,0.5)] flex items-center justify-center text-violet-600 transition-transform group-hover:scale-110">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l-4 4 4 4m8-8l4 4-4 4" />
                    </svg>
                </div>
            </motion.div>
        </div>
    );
}

const BeforeAfterSlider = React.memo(BeforeAfterSliderInner);
export default BeforeAfterSlider;
