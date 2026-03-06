"use client";
import React, { useState, useRef } from "react";
import { motion } from "framer-motion";

function MagneticHoverInner({ children, isApple, className }: { children: React.ReactNode, isApple: boolean, className?: string }) {
    const ref = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ x: 0, y: 0 });

    const handleMouse = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isApple || !ref.current) return;
        const { clientX, clientY } = e;
        const { height, width, left, top } = ref.current.getBoundingClientRect();
        const middleX = clientX - (left + width / 2);
        const middleY = clientY - (top + height / 2);
        setPosition({ x: middleX * 0.25, y: middleY * 0.25 });
    };

    const reset = () => {
        setPosition({ x: 0, y: 0 });
    };

    return (
        <motion.div
            ref={ref}
            onMouseMove={handleMouse}
            onMouseLeave={reset}
            animate={{ x: position.x, y: position.y }}
            transition={{ type: "spring", stiffness: 350, damping: 25, mass: 0.5 }}
            whileTap={isApple ? { scale: 0.92, rotate: -2 } : undefined}
            className={className}
        >
            {children}
        </motion.div>
    );
}

const MagneticHover = React.memo(MagneticHoverInner);
export default MagneticHover;
