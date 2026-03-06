"use client";
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

function TypewriterTextInner({ texts, isDark }: { texts: string[]; isDark: boolean }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [displayed, setDisplayed] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        const current = texts[currentIndex];
        let timeout: ReturnType<typeof setTimeout>;

        if (!isDeleting && displayed.length < current.length) {
            timeout = setTimeout(() => {
                setDisplayed(current.slice(0, displayed.length + 1));
            }, 45);
        } else if (!isDeleting && displayed.length === current.length) {
            timeout = setTimeout(() => setIsDeleting(true), 1800);
        } else if (isDeleting && displayed.length > 0) {
            timeout = setTimeout(() => {
                setDisplayed(current.slice(0, displayed.length - 1));
            }, 25);
        } else if (isDeleting && displayed.length === 0) {
            setIsDeleting(false);
            setCurrentIndex((i) => (i + 1) % texts.length);
        }

        return () => clearTimeout(timeout);
    }, [displayed, isDeleting, currentIndex, texts]);

    return (
        <p className={`text-sm font-bold ${isDark ? "text-white/90" : "text-gray-800"}`}>
            {displayed}
            <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
                className={isDark ? "text-violet-400" : "text-violet-500"}
            >|</motion.span>
        </p>
    );
}

const TypewriterText = React.memo(TypewriterTextInner);
export default TypewriterText;
