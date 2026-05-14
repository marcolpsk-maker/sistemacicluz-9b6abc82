import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, X } from "lucide-react";
import { ChatPanel } from "./ChatPanel";
import { Button } from "@/components/ui/button";

export function FloatingChat() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setOpen((v) => !v)}
        size="icon"
        className="fixed bottom-5 right-5 z-40 h-14 w-14 rounded-full shadow-lg"
        aria-label={open ? "Fechar chat" : "Abrir chat"}
      >
        {open ? <X className="h-5 w-5" /> : <Bot className="h-6 w-6" />}
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-5 z-40 w-[min(380px,calc(100vw-2.5rem))] h-[min(560px,calc(100vh-8rem))] rounded-xl border bg-card shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
              <div className="flex items-center gap-2 font-semibold">
                <Bot className="h-5 w-5 text-primary" />
                Chat IA
              </div>
              <button onClick={() => setOpen(false)} aria-label="Fechar">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <ChatPanel compact />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
