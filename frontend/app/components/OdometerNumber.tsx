"use client";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

function OdometerNumberInner({
    value,
    isDark,
    className = ""
}: {
    value: number;
    isDark: boolean;
    className?: string;
}) {
    const [displayValue, setDisplayValue] = useState(value);
    const [direction, setDirection] = useState<'up' | 'down'>('up');

    useEffect(() => {
        setDisplayValue((prev) => {
            setDirection(value > prev ? 'up' : 'down');
            return value;
        });
    }, [value]);

    return (
        <div className={`relative overflow-hidden inline-flex items-center justify-center ${className}`}
            style={{ minWidth: `${String(value).length * 0.7}em` }}>
            <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                    key={value}
                    initial={{
                        y: direction === 'up' ? 16 : -16,
                        opacity: 0,
                        filter: "blur(4px)"
                    }}
                    animate={{
                        y: 0,
                        opacity: 1,
                        filter: "blur(0px)"
                    }}
                    exit={{
                        y: direction === 'up' ? -16 : 16,
                        opacity: 0,
                        filter: "blur(4px)"
                    }}
                    transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 30,
                        mass: 0.6
                    }}
                    className="inline-block tabular-nums"
                >
                    {value}
                </motion.span>
            </AnimatePresence>
        </div>
    );
}

const OdometerNumber = React.memo(OdometerNumberInner);
export default OdometerNumber;
