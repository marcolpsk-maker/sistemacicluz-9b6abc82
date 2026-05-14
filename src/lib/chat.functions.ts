import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string().min(1).max(8000),
      })
    )
    .min(1)
    .max(50),
});

export const sendChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { reply: "", error: "Chave de IA não configurada." };
    }

    const userMessage = data.messages[data.messages.length - 1];

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content:
                "Você é o assistente do CICLUZ, plataforma interna de gestão de marketing. Responda em português, de forma clara e objetiva, ajudando o usuário com ideias, planejamento, organização de projetos e brainstorming.",
            },
            ...data.messages,
          ],
        }),
      });

      if (res.status === 429) {
        return { reply: "", error: "Muitas requisições. Tente novamente em instantes." };
      }
      if (res.status === 402) {
        return { reply: "", error: "Créditos de IA esgotados. Adicione créditos no workspace." };
      }
      if (!res.ok) {
        return { reply: "", error: `Erro do gateway (${res.status}).` };
      }

      const json = await res.json();
      const reply: string = json?.choices?.[0]?.message?.content ?? "";

      // Persist
      const { supabase } = context;
      await supabase.from("chat_messages").insert({
        user_id: context.userId,
        message: userMessage.content,
        response: reply,
      });

      return { reply, error: null as string | null };
    } catch (e) {
      console.error("chat error:", e);
      return { reply: "", error: "Falha ao contatar o assistente." };
    }
  });
