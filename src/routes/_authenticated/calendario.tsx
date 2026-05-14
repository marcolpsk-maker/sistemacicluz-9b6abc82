import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Construction } from "lucide-react";

export const Route = createFileRoute("/_authenticated/calendario")({ component: P });
function P() { return <div className="space-y-4"><h1>Calendário</h1><Card className="p-8 text-center"><Construction className="h-10 w-10 text-accent mx-auto mb-3" /><p className="text-muted-foreground">Em breve.</p></Card></div>; }
