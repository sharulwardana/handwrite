"use client";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { HistoryItem } from "../lib/types";

/**
 * useCloudSync — Syncs history, energy, and drafts with Supabase cloud.
 * Extracted from page.tsx (lines 84–142) to improve modularity.
 */
export function useCloudSync(
    user: SupabaseUser | null,
    setHistory: (items: HistoryItem[]) => void,
    setEnergy: (val: number) => void,
    setText: (val: string) => void,
    setInputText: (val: string) => void
) {
    const [cloudLoaded, setCloudLoaded] = useState(false);

    useEffect(() => {
        if (!user) return;

        const fetchCloudData = async () => {
            // 1. Ambil Riwayat
            const { data: histData } = await supabase
                .from('user_history')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(20);

            if (histData) {
                const cloudHistory: HistoryItem[] = histData.map((d: any) => ({
                    id: d.id,
                    timestamp: new Date(d.created_at).getTime(),
                    text: d.text_content,
                    fontId: d.config.fontId || "indie_flower",
                    folioId: d.config.folioId || "",
                    config: d.config,
                    fontName: d.config.fontName || d.config.fontId,
                    folioName: d.config.folioName || d.config.folioId,
                    pageCount: d.config.pageCount || 1,
                    textPreview: d.text_content.slice(0, 80) + (d.text_content.length > 80 ? "..." : ""),
                    thumbnail: ""
                }));
                setHistory(cloudHistory);
            }

            // 2. Ambil Energi
            const { data: creditData } = await supabase
                .from('user_credits')
                .select('energy_balance')
                .eq('email', user.email)
                .single();

            if (creditData) {
                setEnergy(creditData.energy_balance);
                localStorage.setItem("hw_energy", creditData.energy_balance.toString());
            } else {
                // Default energy 5 untuk user baru
                await supabase.from('user_credits').insert([{ email: user.email, energy_balance: 5 }]);
                setEnergy(5);
            }

            // 3. Ambil Draft Terakhir
            const { data: draftData } = await supabase
                .from('user_drafts')
                .select('text_content')
                .eq('id', user.id)
                .single();

            if (draftData && draftData.text_content) {
                setText(draftData.text_content);
                setInputText(draftData.text_content);
            }

            setCloudLoaded(true);
        };

        fetchCloudData();
    }, [user, setHistory, setEnergy, setText, setInputText]);

    return { cloudLoaded };
}
