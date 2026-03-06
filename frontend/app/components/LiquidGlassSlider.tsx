"use client";
import React, { useState } from "react";

function LiquidGlassSliderInner({ value, min = 0, max = 1, step = 0.05, onChange, isDark, colorClass = "bg-[#0a84ff]" }: {
    value: number; min?: number; max?: number; step?: number;
    onChange: (val: number) => void; isDark: boolean; colorClass?: string;
}) {
    const [isPressed, setIsPressed] = useState(false);
    const percentage = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

    const handlePointer = (e: React.PointerEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const margin = 16;
        const trackWidth = rect.width - (margin * 2);
        let pointerX = e.clientX - (rect.left + margin);

        pointerX = Math.max(0, Math.min(trackWidth, pointerX));
        const newVal = min + (pointerX / trackWidth) * (max - min);
        const snapped = Math.max(min, Math.min(max, Math.round(newVal / step) * step));
        if (snapped !== value) {
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                navigator.vibrate(3);
            }
            onChange(snapped);
        }
    };

    return (
        <div
            className="relative w-full h-8 flex items-center cursor-pointer touch-none select-none group mt-1 outline-none"
            style={{ WebkitTapHighlightColor: 'transparent' }}
            onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                setIsPressed(true);
                handlePointer(e);
            }}
            onPointerMove={(e) => {
                if (!isPressed) return;
                handlePointer(e);
            }}
            onPointerUp={(e) => {
                e.currentTarget.releasePointerCapture(e.pointerId);
                setIsPressed(false);
            }}
            onPointerCancel={() => setIsPressed(false)}
        >
            <div className="relative w-full h-full flex items-center mx-[16px]">
                <div className={`absolute w-full h-[6px] rounded-full overflow-hidden ${isDark ? 'bg-white/20' : 'bg-gray-200'}`}>
                    <div className={`absolute h-full left-0 top-0 ${colorClass}`} style={{ width: `${percentage}%` }} />
                </div>

                <div
                    className="absolute top-1/2 pointer-events-none flex items-center justify-center"
                    style={{
                        left: `${percentage}%`,
                        transform: 'translate(-50%, -50%)',
                        width: '44px',
                        height: '44px',
                    }}
                >
                    <div
                        className={`bg-white rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.3)] flex items-center justify-center border border-black/5
            ${isPressed ? 'w-[36px] h-[22px]' : 'w-[28px] h-[18px]'}`}
                        style={{
                            transitionProperty: 'width, height, box-shadow',
                            transitionDuration: '300ms',
                            transitionTimingFunction: 'cubic-bezier(0.25, 1.15, 0.4, 1)'
                        }}
                    />
                </div>
            </div>
        </div>
    );
}

const LiquidGlassSlider = React.memo(LiquidGlassSliderInner);
export default LiquidGlassSlider;
