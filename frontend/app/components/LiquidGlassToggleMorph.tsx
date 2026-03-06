"use client";
import React from "react";

function LiquidGlassToggleMorphInner({ value, onChange, colorClass = "bg-[#34c759]", isDark, isApple = false }: {
    value: boolean; onChange: (val: boolean) => void; colorClass?: string; isDark: boolean; isApple?: boolean;
}) {
    const colorMap: Record<string, string> = {
        "bg-violet-500": "violet",
        "bg-[#34c759]": "green",
        "bg-orange-500": "orange",
        "bg-emerald-500": "emerald",
        "bg-stone-500": "stone",
    };
    const colorKey = colorMap[colorClass] || "violet";
    const onClass = `on-${colorKey}`;

    if (isApple) {
        return (
            <button
                type="button"
                onClick={() => {
                    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                        navigator.vibrate(8);
                    }
                    onChange(!value);
                }}
                style={{ WebkitTapHighlightColor: 'transparent' }}
                className={`toggle-premium ${value ? onClass : 'off'} select-none touch-none`}
            >
                <span className="toggle-premium-thumb" />
            </button>
        );
    }

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => {
                if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                    navigator.vibrate(8);
                }
                onChange(!value);
            }}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onChange(!value);
                }
            }}
            style={{ WebkitTapHighlightColor: 'transparent' }}
            className={`toggle-cyber ${value ? onClass : 'off'} select-none touch-none`}
        >
            <div className="toggle-cyber-track" />
            <span className="toggle-cyber-thumb" />
        </div>
    );
}

const LiquidGlassToggleMorph = React.memo(LiquidGlassToggleMorphInner);
export default LiquidGlassToggleMorph;
