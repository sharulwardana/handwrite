"use client";
import React, { useState, useRef, useEffect, forwardRef } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const OptimizedTextarea = forwardRef(({ value, onChange, debounce = 300, ...props }: any, ref: any) => {
    const [localValue, setLocalValue] = useState(value);
    const timerRef = useRef<ReturnType<typeof setTimeout>>();
    useEffect(() => { setLocalValue(value); }, [value]);
    useEffect(() => () => { clearTimeout(timerRef.current); }, []);
    return (
        <textarea
            {...props}
            ref={ref}
            value={localValue}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                const val = e.target.value;
                setLocalValue(val);
                clearTimeout(timerRef.current);
                timerRef.current = setTimeout(() => {
                    React.startTransition(() => onChange(val));
                }, debounce);
            }}
        />
    );
});
OptimizedTextarea.displayName = "OptimizedTextarea";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const OptimizedInput = forwardRef(({ value, onChange, debounce = 150, ...props }: any, ref: any) => {
    const [localValue, setLocalValue] = useState(value);
    const timerRef = useRef<ReturnType<typeof setTimeout>>();
    useEffect(() => { setLocalValue(value); }, [value]);
    useEffect(() => () => { clearTimeout(timerRef.current); }, []);
    return (
        <input
            {...props}
            ref={ref}
            value={localValue}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const val = e.target.value;
                setLocalValue(val);
                clearTimeout(timerRef.current);
                timerRef.current = setTimeout(() => {
                    React.startTransition(() => onChange(val));
                }, debounce);
            }}
        />
    );
});
OptimizedInput.displayName = "OptimizedInput";
