import { createFileRoute } from "@tanstack/react-router";
import { Bot } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ChatPanel } from "@/components/chat/ChatPanel";

export const Route = createFileRoute("/_authenticated/chat")({ component: ChatPage });

function ChatPage() {
  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bot className="h-6 w-6 text-primary" /> Chat IA
        </h1>
        <p className="text-sm text-muted-foreground">Assistente para ideias e organização.</p>
      </div>
      <Card className="flex-1 flex flex-col overflow-hidden">
        <ChatPanel />
      </Card>
    </div>
  );
}
