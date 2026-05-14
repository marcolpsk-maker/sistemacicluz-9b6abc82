import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Construction } from "lucide-react";

export const Route = createFileRoute("/_authenticated/kanban")({ component: () => <Placeholder title="Kanban" /> });

function Placeholder({ title }: { title: string }) {
  return (
    <div className="space-y-4">
      <h1>{title}</h1>
      <Card className="p-8 text-center">
        <Construction className="h-10 w-10 text-accent mx-auto mb-3" />
        <p className="text-muted-foreground">Esta seção será implementada na próxima fase.</p>
      </Card>
    </div>
  );
}
