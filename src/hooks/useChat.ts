import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { sendChatMessage } from "@/lib/chat.functions";
import { toast } from "sonner";

export type ChatMsg = { role: "user" | "assistant"; content: string };

export function useChat() {
  const { user } = useAuth();
  const send = useServerFn(sendChatMessage);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  useEffect(() => {
    if (!user || historyLoaded) return;
    supabase
      .from("chat_messages")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(50)
      .then(({ data }) => {
        if (data) {
          const hist: ChatMsg[] = [];
          data.forEach((row) => {
            hist.push({ role: "user", content: row.message });
            if (row.response) hist.push({ role: "assistant", content: row.response });
          });
          setMessages(hist);
        }
        setHistoryLoaded(true);
      });
  }, [user, historyLoaded]);

  // Realtime: keep both /chat route and floating panel in sync
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("chat-rt")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          const row = payload.new as { message: string; response: string | null };
          setMessages((prev) => {
            // dedupe: skip if last user message already matches
            const last = prev[prev.length - 1];
            const lastUser = prev[prev.length - 2];
            if (
              last?.role === "assistant" &&
              last.content === (row.response ?? "") &&
              lastUser?.role === "user" &&
              lastUser.content === row.message
            ) return prev;
            const next = [...prev];
            // Avoid double-append from the same client; only append if not present
            const hasUser = next.some((m, i) => m.role === "user" && m.content === row.message && next[i + 1]?.content === row.response);
            if (hasUser) return prev;
            next.push({ role: "user", content: row.message });
            if (row.response) next.push({ role: "assistant", content: row.response });
            return next;
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const next: ChatMsg[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setLoading(true);
    try {
      const res = await send({ data: { messages: next } });
      if (res.error) {
        toast.error(res.error);
      } else {
        setMessages([...next, { role: "assistant", content: res.reply }]);
      }
    } catch (e) {
      console.error(e);
      toast.error("Falha ao enviar mensagem");
    } finally {
      setLoading(false);
    }
  }, [messages, loading, send]);

  return { messages, loading, sendMessage };
}
