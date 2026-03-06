"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import toast from "react-hot-toast";
import type { User as SupabaseUser } from "@supabase/supabase-js";

/**
 * useAuth — Manages Supabase authentication state.
 * Extracted from page.tsx (lines 61–154) to improve modularity.
 */
export function useAuth() {
    const [user, setUser] = useState<SupabaseUser | null>(null);
    const [showEditor, setShowEditor] = useState(false);

    useEffect(() => {
        supabase.auth.getUser().then(({ data, error }: { data: any; error: any }) => {
            if (!error && data?.user) {
                setUser(data.user);
                setShowEditor(true);
            }
        });

        const { data: authListener } = supabase.auth.onAuthStateChange((event: any, session: any) => {
            setUser(session?.user ?? null);
            if (session?.user) setShowEditor(true);
        });

        return () => { authListener.subscription.unsubscribe(); };
    }, []);

    const handleLogin = useCallback(async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin }
        });
    }, []);

    const handleLogout = useCallback(async () => {
        await supabase.auth.signOut();
        toast.success("Berhasil logout");
    }, []);

    return { user, showEditor, setShowEditor, handleLogin, handleLogout };
}
